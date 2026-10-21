"""Source and replay regressions. No network, credentials or personal data."""
import csv
import datetime as dt
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import urllib.error

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "delivery"))
import fetch_delivery_sheet as sheet

NOW = dt.datetime(2026, 10, 21, 12, tzinfo=dt.timezone.utc)
LOCATIONS = {"тула": "Тула", "тульская область": "Тульская область"}


def row(order="72685709-0383-1", date="7 октября", ship="5 691,00 ₽", paid="7500", **kw):
    cells = [""] * 38
    for i, value in {0: "OZON GENGLASS", 1: order, 2: "М26-1234", 3: "GGT-03-3-3-L-120",
                     4: date, 7: "Создан", 10: "Тульская область, Тула, улица Тестовая, 99",
                     12: paid, 14: ship}.items():
        cells[i] = value
    for i, value in kw.items():
        cells[int(i)] = value
    return cells


def csv_text(*rows):
    out = io.StringIO(); writer = csv.writer(out)
    header = [""] * 38
    for i, value in sheet.HEADERS.items():
        header[i] = value
    writer.writerow(header)
    # Empty formatted grid rows are normal, but a truncated header-only response isn't.
    writer.writerows(rows or [[""] * 38])
    return out.getvalue()


def baseline():
    rows = [
        [{"order": "11111111-0001-1", "ship": 100, "deliv": 200, "d_ship": "2026-10-04"}],
        [{"d": "2026-10-04", "offer": "GGT-OLD", "ship": 100, "deliv": 200, "n": 1}],
        [{"d": "2026-10-04", "city": "Тула", "ship": 100, "deliv": 200, "n": 1, "orders": ["11111111-0001-1"]}],
        [{"order": "11111111-0001-1", "ship": 10, "deliv": 0, "d_trip": "2026-10-02"}],
    ]
    data = {f: "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rr) for f, rr in zip(sheet.FILES, rows)}
    data[sheet.FILES[-1]] = '{"GGT-OLD":[["Тула",1]]}\n'
    return data


class DeliverySheetTests(unittest.TestCase):
    def prepare(self, active, archive=None, data=None, state=None, now=NOW):
        return sheet.prepare(data or baseline(), state, active, archive if archive is not None else csv_text(row(date="4 октября")), now, LOCATIONS)

    def test_actual_money_mapping_and_replayed_copy(self):
        a = row()
        b = row("0124441920-0100-1", "13 октября", "11430,05", "7100")
        c = row("39355528-0014-1", "5 октября", "9042,26", "7000")
        out, status = self.prepare(csv_text(a, b), csv_text(a, c))
        self.assertEqual(status["ship"], 26163.31)
        self.assertEqual(status["events"], 3)
        self.assertEqual(len(out[sheet.FILES[0]].splitlines()), 4)

    def test_history_is_byte_preserved_and_repeat_is_idempotent(self):
        data = baseline(); out, _ = self.prepare(csv_text(row()), data=data)
        state = json.loads(out["delivery_sheet_state.json"])
        repeated, _ = sheet.prepare(out, state, csv_text(row()), None, NOW + dt.timedelta(hours=6))
        for file in sheet.FILES[:-1]:
            self.assertTrue(out[file].startswith(data[file]))
        for file in sheet.FILES:
            self.assertEqual(out[file], repeated[file])

    def test_archive_move_is_not_a_deletion(self):
        out, _ = self.prepare(csv_text(row()))
        state = json.loads(out["delivery_sheet_state.json"])
        next_out, next_status = sheet.prepare(out, state, csv_text(row(date="27 октября")), None, NOW + dt.timedelta(hours=6))
        self.assertEqual(next_out[sheet.FILES[1]], out[sheet.FILES[1]])
        self.assertEqual(next_status["events"], 1)
        self.assertFalse(next_status["archive_read"])

    def test_lost_full_source_row_retains_expense_and_warns(self):
        out, _ = self.prepare(csv_text(row()))
        state = json.loads(out["delivery_sheet_state.json"])
        next_out, status = self.prepare(csv_text(), data=out, state=state)
        self.assertEqual(status["retained_unseen_events"], 1)
        self.assertEqual(next_out[sheet.FILES[1]], out[sheet.FILES[1]])

    def test_return_is_expense_cancellation_is_excluded(self):
        out, status = self.prepare(csv_text(row(**{"7": "Возврат"}), row("22222222-0001-1", **{"7": "ОТМЕНЕН"})))
        self.assertEqual(status["events"], 1)
        self.assertEqual(status["counts"]["cancelled_rows"], 1)

    def test_future_closed_day_and_zero_are_distinct(self):
        _, status = self.prepare(csv_text(row(date="21 октября"), row(date="20 октября", ship="0")))
        self.assertEqual(status["events"], 0)
        self.assertEqual(status["counts"]["future_rows"], 1)
        self.assertEqual(status["counts"]["zero_cost_rows"], 1)
        self.assertEqual(sheet.closed_day(dt.datetime(2026, 10, 20, 20, 30, tzinfo=dt.timezone.utc)), "2026-10-19")
        self.assertEqual(sheet.closed_day(dt.datetime(2026, 10, 20, 21, 30, tzinfo=dt.timezone.utc)), "2026-10-20")

    def test_empty_cost_and_customer_payment_remain_unknown(self):
        _, status = self.prepare(csv_text(row(ship=""), row("22222222-0001-1", paid="")))
        self.assertEqual(status["missing_cost"], 1)
        self.assertEqual(status["missing_customer_paid"], 1)
        self.assertEqual(status["ship"], 5691)

    def test_unfilled_receipt_is_retried_from_archive(self):
        out, _ = self.prepare(csv_text(row(ship="")))
        state = json.loads(out["delivery_sheet_state.json"])
        self.assertTrue(sheet.archive_needed(state, NOW + dt.timedelta(hours=6)))
        _, status = self.prepare(csv_text(), csv_text(row()), data=out, state=state)
        self.assertEqual(status["missing_cost"], 0)
        self.assertEqual(status["events"], 1)

    def test_new_trip_does_not_modify_old_order(self):
        data = baseline(); out, status = self.prepare(csv_text(row("11111111-0001-1")), data=data)
        self.assertEqual(data[sheet.FILES[0]], out[sheet.FILES[0]])
        extra = list(map(json.loads, out[sheet.FILES[3]].splitlines()))
        self.assertEqual(len(extra), 2)
        self.assertEqual(extra[-1]["ship"], 5691)
        self.assertEqual(extra[-1]["d_trip"], "2026-10-07")

    def test_two_new_trips_keep_primary_and_extra_separate(self):
        out, status = self.prepare(csv_text(row(ship="1000"), row(ship="190", paid="")))
        primary = list(map(json.loads, out[sheet.FILES[0]].splitlines()))[-1]
        extra = list(map(json.loads, out[sheet.FILES[3]].splitlines()))[-1]
        self.assertEqual((primary["ship"], extra["ship"], status["ship"]), (1000, 190, 1190))

    def test_changed_price_is_not_an_extra_trip(self):
        out, _ = self.prepare(csv_text(row()))
        state = json.loads(out["delivery_sheet_state.json"])
        with self.assertRaisesRegex(ValueError, "changed price"):
            self.prepare(csv_text(row(ship="6000")), data=out, state=state)

    def test_product_duplicates_merge_and_cent_splits_are_conserved(self):
        out, status = self.prepare(csv_text(row(ship="100,01", **{"3": "GGT-01\nGGT-02"}), row(ship="100,01", **{"3": "GGT-03"})))
        daily = [json.loads(x) for x in out[sheet.FILES[1]].splitlines()][1:]
        self.assertEqual(status["events"], 1)
        self.assertEqual(sum(round(x["ship"] * 100) for x in daily), 10001)
        self.assertEqual(len(daily), 3)

    def test_product_component_parent_rule_is_shared(self):
        self.assertEqual(sheet.event_articles({"arts": ["GGTP-01"], "com": ["GGT-01"]}, {"GGT-01"}), ["GGT-01"])

    def test_malformed_source_fails_without_exposing_values(self):
        for cells in [row(ship="+7 999 000-00-00"), row(date="32 октября"), row(order="secret-person"), row(paid="not money")]:
            with self.subTest():
                with self.assertRaisesRegex(ValueError, r"active: row 2, invalid date/order/amount") as ex:
                    self.prepare(csv_text(cells))
                self.assertNotIn("secret-person", str(ex.exception))

    def test_headers_and_empty_response_fail(self):
        for text in ("", "<html>Login</html>", csv_text().splitlines()[0]):
            with self.assertRaises(ValueError):
                self.prepare(text)

    def test_duplicate_payment_conflict_fails(self):
        with self.assertRaisesRegex(ValueError, "invalid"):
            self.prepare(csv_text(row(), row(paid="7000")))
        with self.assertRaisesRegex(ValueError, "conflicting"):
            self.prepare(csv_text(row()), csv_text(row(paid="7000")))

    def test_actual_alias_current_number_only(self):
        self.assertEqual(sheet.order_number("36132094-1061-1\nбывш.\n31670251-0433-1\nбывш.\n31670251-0431-1"), "36132094-1061-1")

    def test_public_city_removes_contact_and_street(self):
        for address in ("+7 999 000-00-00, Иван", "99, секрет", "улица Личная, дом 1", "person@example.invalid", "Иван Иванов"):
            self.assertEqual(sheet.public_city(address, LOCATIONS), "город не указан")
        self.assertEqual(sheet.public_city("Тула, улица Личная, дом 99", LOCATIONS), "Тула")
        self.assertEqual(sheet.public_city("Тульская область, Тула, улица Личная, дом 99", LOCATIONS), "Тульская область, Тула")

    def test_archive_schedule_including_moscow_boundary_and_gap(self):
        out, _ = self.prepare(csv_text(row())); state = json.loads(out["delivery_sheet_state.json"])
        self.assertFalse(sheet.archive_needed(state, NOW + dt.timedelta(hours=24)))
        self.assertTrue(sheet.archive_needed(state, NOW + dt.timedelta(hours=37)))
        state["loaded_at"] = (NOW + dt.timedelta(days=7)).isoformat()
        self.assertTrue(sheet.archive_needed(state, NOW + dt.timedelta(days=7)))
        self.assertEqual(sheet.sheet_date("2 января", "М27-1234"), "2027-01-02")

    def test_initial_nonempty_window_is_not_overwritten(self):
        data = baseline(); data[sheet.FILES[1]] += '{"d":"2026-10-06","offer":"GGT-X","ship":3}\n'
        with self.assertRaisesRegex(ValueError, "not empty"):
            self.prepare(csv_text(row()), data=data)

    def test_a_previously_priced_row_becoming_blank_is_visible(self):
        out, _ = self.prepare(csv_text(row()))
        state = json.loads(out["delivery_sheet_state.json"])
        new, status = sheet.prepare(out, state, csv_text(row(ship="")), None, NOW + dt.timedelta(hours=6))
        self.assertEqual(status["missing_cost"], 1)
        self.assertEqual(new[sheet.FILES[1]], out[sheet.FILES[1]])

    def test_empty_both_tabs_cannot_certify_a_success(self):
        with self.assertRaisesRegex(ValueError, "no OZON"):
            sheet.prepare(baseline(), None, csv_text(), csv_text(), NOW, LOCATIONS)

    def test_failed_fetch_or_parse_does_not_change_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); data = baseline()
            for file, text in data.items(): (root / file).write_text(text)
            with patch.dict(os.environ, {"DATA_DIR": directory}), patch.object(sheet, "fetch_tab", return_value="<html>error</html>"):
                with self.assertRaises(ValueError): sheet.main()
            self.assertEqual({f.name: f.read_text() for f in root.iterdir()}, data)

    def test_transport_403_no_retry_429_bounded_retry(self):
        for code, calls in ((403, 1), (429, 3)):
            with patch.object(sheet.urllib.request, "urlopen", side_effect=urllib.error.HTTPError("url", code, "error", {}, None)) as get, patch.object(sheet.time, "sleep"):
                with self.assertRaisesRegex(ValueError, f"HTTP {code}"): sheet.fetch_tab("active")
                self.assertEqual(get.call_count, calls)

    def test_staged_write_failure_leaves_originals(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); (root / "a.json").write_text("old")
            with patch.object(sheet.os, "fsync", side_effect=OSError("disk full")):
                with self.assertRaises(OSError): sheet.write_bundle(root, {"a.json": "new"})
            self.assertEqual((root / "a.json").read_text(), "old")
            self.assertEqual(len(list(root.iterdir())), 1)


if __name__ == "__main__":
    unittest.main()
