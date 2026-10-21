"""Market delivery source, history and replay regressions. No network or PII."""
import csv
import datetime as dt
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "delivery"))
import fetch_ym_delivery_sheet as sheet

NOW = dt.datetime(2026, 10, 21, 23, 30, tzinfo=dt.timezone(dt.timedelta(hours=3)))
ORDER = "62227988545"


def row(order=ORDER, ship="1000", paid="3500", date="7 октября", doc="М26-4639", status="Собственная доставка"):
    cells = [""] * 38
    for i, value in {0: "Яндекс", 1: order, 2: doc, 3: "GGT-TEST", 4: date, 7: status,
                     8: "PRIVATE-COMMENT", 10: "PRIVATE-ADDRESS", 11: "PRIVATE-PHONE", 12: paid, 14: ship}.items():
        cells[i] = value
    return cells


def source(*rows):
    stream = io.StringIO()
    writer = csv.writer(stream)
    header = [""] * 38
    for i, value in sheet.HEADERS.items():
        header[i] = value
    writer.writerow(header)
    writer.writerows(rows)
    return stream.getvalue()


class DeliverySheetTests(unittest.TestCase):
    def root(self, path):
        (path / "fixtures").mkdir(); (path / "data-ym").mkdir()
        legacy = dict(zip(sheet.FIELDS, [ORDER, "М26-4639", "GGT-TEST", "28 сентября", "Собственная доставка", "", "3500", "Яндекс", ""]))
        missing = dict(legacy, order="50000000001", vedomost="М26-001", ship="777")
        (path / "fixtures/delivery_ym.csv").write_text(sheet.render([legacy, missing]))
        (path / "data-ym/orders.ndjson").write_text(json.dumps({"order": ORDER, "status": "DELIVERED"}) + "\n")
        return legacy, missing

    def test_real_mapping_and_rescheduled_document_no_double_payment(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); _, missing = self.root(root)
            output = sheet.prepare(root, source(row()), source(row()), NOW)
            records = sheet.read_ledger(output["delivery.csv"])
            self.assertEqual(len(records), 2)
            self.assertIn(missing, records)
            updated = next(r for r in records if r["order"] == ORDER)
            self.assertEqual((updated["ship"], updated["buyer"]), ("1000", "3500"))
            self.assertNotIn("PRIVATE", "".join(output.values()))

    def test_replay_and_move_to_archive_keep_exact_csv(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); self.root(root)
            first = sheet.prepare(root, source(row(), row()), source(row(date="1 марта")), NOW)
            sheet.write_bundle(root, first)
            second = sheet.prepare(root, source(row(date="25 октября")), source(row()), NOW)
            self.assertEqual(first["delivery.csv"], second["delivery.csv"])

    def test_active_correction_replaces_archive_and_previous_amount(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); self.root(root)
            sheet.write_bundle(root, sheet.prepare(root, source(row(ship="2000")), source(row(ship="2000")), NOW))
            result = sheet.prepare(root, source(row(ship="900")), source(row(ship="2000")), NOW)
            updated = [r for r in sheet.read_ledger(result["delivery.csv"]) if r["order"] == ORDER]
            self.assertEqual(len(updated), 1)
            self.assertEqual(updated[0]["ship"], "900")

    def test_missing_zero_and_cancelled_stay_distinct(self):
        known = {ORDER}
        for value, expected in [("FALSE", ""), ("", ""), ("0,00 ₽", "0")]:
            records, _ = sheet.parse_tab(source(row(ship=value, status="ОТМЕНЕН")), "active", "2026-10-20", known, known)
            self.assertEqual((records[0]["ship"], records[0]["status"]), (expected, "ОТМЕНЕН"))

    def test_future_today_excluded_but_closed_moscow_day_included(self):
        through = sheet.closed_day(NOW)
        self.assertEqual(through, "2026-10-20")
        records, counts = sheet.parse_tab(source(row(date="20 октября"), row(date="21 октября")), "active", through, {ORDER}, set())
        self.assertEqual((len(records), counts["future_rows"]), (1, 1))

    def test_legacy_layout_skipped_and_new_bad_layout_refused(self):
        legacy = row(date="1 марта"); legacy[7] = ""; legacy[8] = "Доставлен"; legacy[12] = "PRIVATE-PHONE"
        rows, _ = sheet.parse_tab(source(legacy), "archive", "2026-10-20", set(), set())
        self.assertEqual(rows, [])
        legacy[4] = "7 октября"
        with self.assertRaisesRegex(ValueError, "invalid date/order/status/amount"):
            sheet.parse_tab(source(legacy), "archive", "2026-10-20", set(), set())

    def test_invalid_second_response_and_conflicting_cost_never_write(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); self.root(root)
            for archive in ["<html>sign in</html>", source(row(ship="1000"), row(ship="2000"))]:
                before = {str(p): p.read_bytes() for p in root.rglob("*") if p.is_file()}
                with self.assertRaises(ValueError):
                    sheet.prepare(root, source(row()), archive, NOW)
                self.assertEqual(before, {str(p): p.read_bytes() for p in root.rglob("*") if p.is_file()})

    def test_new_year_ledger_number_and_multi_order_resolution(self):
        self.assertEqual(sheet.date_of("2 января", "С27-5"), "2027-01-02")
        self.assertEqual(sheet.order_of("50000000001 62227988545 (новый номер)", {ORDER, "50000000001"}, {ORDER}), ORDER)
        with self.assertRaises(ValueError):
            sheet.order_of("50000000001 62227988545", set(), set())

    def test_undated_cost_is_visible_issue_without_inventing_shipment_date(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); self.root(root)
            output = sheet.prepare(root, source(row()), source(row(order="62536179201", ship="7533", date="", doc="", status="Доставлен")), NOW)
            state = json.loads(output["delivery_source.json"])
            self.assertEqual(len(state["source_issues"]), 1)
            self.assertEqual(state["source_issues"][0]["ship"], 7533)
            self.assertNotIn("62536179201", output["delivery.csv"])
            self.assertNotIn("PRIVATE", "".join(output.values()))

    def test_changed_date_without_document_enriches_blank_but_never_duplicates_accepted_bill(self):
        old = dict(zip(sheet.FIELDS, [ORDER, "", "GGT-TEST", "28 сентября", "Доставлен", "", "3500", "Яндекс", ""]))
        fresh = dict(old, shipped="7 октября", ship="1000")
        result, _ = sheet.merge([old], [fresh], [])
        self.assertEqual(result, [fresh])
        with self.assertRaisesRegex(ValueError, "ambiguous changed shipment date"):
            sheet.merge([dict(old, ship="1000")], [fresh], [])

    def test_no_active_market_orders_is_valid_but_large_source_drop_is_not(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); self.root(root)
            ozon = row(); ozon[0] = "OZON"
            archive = source(*(row(order=str(60000000000 + i), doc=f"М26-{i}") for i in range(20)))
            output = sheet.prepare(root, source(ozon), archive, NOW)
            sheet.write_bundle(root, output)
            with self.assertRaisesRegex(ValueError, "coverage dropped"):
                sheet.prepare(root, source(ozon), source(row()), NOW)
            self.assertEqual((root / "data-ym/delivery.csv").read_text(), output["delivery.csv"])

    def test_blank_source_preserves_known_cost_with_visible_note_but_real_zero_updates(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); self.root(root)
            sheet.write_bundle(root, sheet.prepare(root, source(row(ship="2000")), source(row(ship="2000")), NOW))
            output = sheet.prepare(root, source(row(ship="")), source(row(ship="2000")), NOW)
            saved = next(r for r in sheet.read_ledger(output["delivery.csv"]) if r["order"] == ORDER)
            self.assertEqual(saved["ship"], "2000")
            self.assertIn("сохранён последний известный расход", saved["note"])
            zero = sheet.prepare(root, source(row(ship="0")), source(row(ship="2000")), NOW)
            saved = next(r for r in sheet.read_ledger(zero["delivery.csv"]) if r["order"] == ORDER)
            self.assertEqual(saved["ship"], "0")
            self.assertEqual(saved["note"], "")

    def test_missing_half_of_saved_snapshot_never_falls_back_to_fixture(self):
        for deleted in ["delivery.csv", "delivery_source.json"]:
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp); self.root(root)
                sheet.write_bundle(root, sheet.prepare(root, source(row()), source(row()), NOW))
                (root / "data-ym" / deleted).unlink()
                with self.assertRaisesRegex(ValueError, "incomplete delivery snapshot/manifest"):
                    sheet.prepare(root, source(row()), source(row()), NOW)

    def test_free_text_in_identifier_columns_never_published(self):
        for index in [2, 3]:
            private = row(); private[index] = "PRIVATE-CANARY +70000000000"
            with self.assertRaisesRegex(ValueError, "invalid date/order/status/amount"):
                sheet.parse_tab(source(private), "active", "2026-10-20", {ORDER}, set())
        private = row(); private[0] = "Яндекс PRIVATE-CANARY"
        records, _ = sheet.parse_tab(source(private), "active", "2026-10-20", {ORDER}, set())
        self.assertEqual(records[0]["tags"], "Яндекс")
        self.assertNotIn("PRIVATE-CANARY", sheet.render(records))

    def test_latin_cyrillic_ledger_alias_is_one_document_without_rewriting_absent_history(self):
        rows, _ = sheet.parse_tab(source(row(doc="M26-4639"), row(doc="М26-4639")), "active", "2026-10-20", {ORDER}, set())
        old = dict(rows[0], vedomost="M26-4639")
        absent, _ = sheet.merge([old], [], [])
        self.assertEqual(absent, [old])
        merged, _ = sheet.merge([old], rows, [])
        self.assertEqual(len(merged), 1)
        self.assertEqual((merged[0]["vedomost"], merged[0]["ship"]), ("М26-4639", "1000"))


if __name__ == "__main__":
    unittest.main()
