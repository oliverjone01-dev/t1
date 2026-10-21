#!/usr/bin/env python3
"""Read-only Market delivery sync. No contacts, addresses or comments are saved."""
import argparse
import collections
import csv
import datetime as dt
import hashlib
import io
import json
from pathlib import Path
import re
import tempfile
from zoneinfo import ZoneInfo

from fetch_delivery_sheet import SHEET, TABS, HEADERS, cents, closed_day, fetch_tab, sheet_date

# The accepted manual ledger ends on 02.10. Its historic layouts are deliberately
# not reinterpreted as the modern Sheet schema.
START = "2026-10-03"
FIELDS = ["order", "vedomost", "offer", "shipped", "status", "ship", "buyer", "tags", "note"]
STATUSES = {"Создан", "В очереди", "Доставлен", "Собственная доставка", "Возврат",
            "Возвращается ЛК", "Вернули на склад", "ОТМЕНЕН"}


def clean(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def date_of(value, doc):
    # Both Moscow and Saint Petersburg ledger numbers encode the year.
    year = re.search(r"[МСMC](\d{2})-", doc)
    return sheet_date(value, "М" + year[1] + "-" if year else "")


def order_of(value, known, delivered):
    value = clean(value)
    if value in known:
        return value
    tokens = re.findall(r"\d{9,}", value)
    hit = next((t for t in tokens if t in delivered), None) or next((t for t in tokens if t in known), None)
    if hit:
        return hit
    if re.fullmatch(r"\d{9,}", value):
        return value
    raise ValueError("ambiguous order number")


def document(row):
    return row["order"], row["vedomost"] or "~" + row["shipped"]


def amount(value):
    n = cents(value)
    return "" if n is None else format(n / 100, ".2f").rstrip("0").rstrip(".")


def parse_tab(text, name, through, known, delivered, issues=None):
    rows = list(csv.reader(io.StringIO(text)))
    if len(rows) < 2 or any(len(rows[0]) <= i or rows[0][i].strip() != h for i, h in HEADERS.items()):
        raise ValueError(f"{name}: empty sheet or changed headers")
    result, counts = [], collections.Counter()
    for index, row in enumerate(rows[1:], 2):
        row += [""] * max(0, 18 - len(row))
        if not row[0].startswith("Яндекс"):
            continue
        counts["market_rows"] += 1
        try:
            date = date_of(row[4], row[2])
            if date is None:
                counts["undated_rows"] += 1
                if issues is not None and clean(row[7]) in STATUSES:
                    issues.append({"order": order_of(row[1], known, delivered), "shipped": "",
                                   "status": clean(row[7]), "ship": cents(row[14]) / 100 if cents(row[14]) is not None else None,
                                   "reason": "в Google-таблице нет даты отгрузки; новая отправка пока не добавлена в расход"})
                continue
            if date < START:
                counts["historical_rows"] += 1
                continue
            if date > through:
                counts["future_rows"] += 1
                continue
            status = clean(row[7])
            if status not in STATUSES:
                raise ValueError("unexpected status/layout")
            # Explicit columns: M is customer payment, O is our carrier cost.
            record = dict(zip(FIELDS, [order_of(row[1], known, delivered), clean(row[2]), clean(row[3]),
                                      clean(row[4]), status, amount(row[14]), amount(row[12]), clean(row[0]), ""]))
            result.append(record)
            counts["accepted_rows"] += 1
            counts["missing_cost_rows"] += not bool(record["ship"])
        except (ValueError, TypeError):
            # Source cells can contain PII. Never put their values in errors.
            raise ValueError(f"{name}: row {index}, invalid date/order/status/amount") from None
    return result, dict(counts)


def read_ledger(text):
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames != FIELDS:
        raise ValueError("delivery ledger: unexpected columns")
    return list(reader)


def merge(previous, archive, active):
    # One authoritative set of rows per order/document. Active wins when a
    # document is temporarily present in both tabs. Absent history is retained.
    grouped = collections.defaultdict(list)
    for row in previous:
        grouped[document(row)].append(row)
    incoming_docs = set()
    for rows in (archive, active):
        new = collections.defaultdict(list)
        for row in rows:
            new[document(row)].append(row)
        for key, records in new.items():
            prices = {r["ship"] for r in records if r["ship"] != ""}
            if len(prices) > 1:
                raise ValueError("conflicting costs for one order/document")
            if not records[0]["vedomost"]:
                old_keys = [k for k, group in grouped.items()
                            if k != key and k[0] == key[0] and not group[0]["vedomost"] and k not in new]
                if old_keys:
                    # A formerly empty bill may acquire both a cost and a corrected
                    # date. With an already accepted cost we cannot tell a date
                    # correction from a second trip without the ledger number.
                    if len(old_keys) != 1 or any(r["ship"] != "" for k in old_keys for r in grouped[k]):
                        raise ValueError("ambiguous changed shipment date without ledger number")
                    del grouped[old_keys[0]]
            grouped[key] = records
            incoming_docs.add(key)
    result = []
    seen = set()
    for key in sorted(grouped):
        for row in grouped[key]:
            full = tuple(row[k] for k in FIELDS)
            if full not in seen:
                seen.add(full)
                result.append(row)
    return result, len(set(grouped) - incoming_docs)


def render(rows):
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=FIELDS, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return stream.getvalue()


def prepare(root, active, archive, now):
    data = root / "data-ym"
    path = data / "delivery.csv"
    previous_text = path.read_text() if path.exists() else (root / "fixtures/delivery_ym.csv").read_text()
    state_path = data / "delivery_source.json"
    state = {}
    if path.exists():
        state = json.loads(state_path.read_text())
        if state.get("csv_sha256") != hashlib.sha256(previous_text.encode()).hexdigest():
            raise ValueError("previous delivery snapshot/hash mismatch")
    previous = read_ledger(previous_text)
    orders = [json.loads(line) for line in (data / "orders.ndjson").read_text().splitlines() if line]
    known = {str(row["order"]) for row in orders}
    delivered = {str(row["order"]) for row in orders if row["status"] == "DELIVERED"}
    through = closed_day(now)
    issues = []
    a, astat = parse_tab(active, "active", through, known, delivered, issues)
    h, hstat = parse_tab(archive, "archive", through, known, delivered, issues)
    source_rows = astat.get("market_rows", 0) + hstat.get("market_rows", 0)
    prior_rows = sum(s.get("market_rows", 0) for s in state.get("source_counts", {}).values())
    minimum = prior_rows * 0.6 if prior_rows else len(previous) * 0.5
    if source_rows < max(1, minimum):
        raise ValueError("Market source coverage dropped; refuse incomplete refresh")
    incoming = a + h
    if not incoming:
        raise ValueError("no eligible modern Market rows; refuse empty refresh")
    merged, retained = merge(previous, h, a)
    # Only an explicitly observed document may update prior history (including
    # a rescheduled shipment whose old cost was blank). All other rows survive.
    observed = {document(r) for r in incoming}
    revisited_undocumented = {r["order"] for r in incoming if not r["vedomost"]}
    historic = lambda rows: sorted(tuple(r[k] for k in FIELDS) for r in rows
                                   if document(r) not in observed and
                                   not (not r["vedomost"] and r["order"] in revisited_undocumented))
    if historic(previous) != historic(merged):
        raise ValueError("historic delivery rows changed")
    text = render(merged)
    state = {"schema": 1, "platform": "ym", "loaded_at": now.isoformat(), "through": through,
             "source": {"spreadsheet_id": SHEET, "tabs": {k: TABS[k] for k in ("active", "archive")}},
             "window_from": START, "rows": len(merged), "source_counts": {"active": astat, "archive": hstat},
             "source_issues": list({json.dumps(i, sort_keys=True): i for i in issues}.values()),
             "retained_documents": retained, "csv_sha256": hashlib.sha256(text.encode()).hexdigest()}
    return {"delivery.csv": text, "delivery_source.json": json.dumps(state, ensure_ascii=False, indent=2) + "\n"}


def write_bundle(root, outputs):
    target = root / "data-ym"
    target.mkdir(exist_ok=True)
    temporary = []
    try:
        for name, content in outputs.items():
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=target, delete=False) as stream:
                stream.write(content)
                temporary.append((Path(stream.name), target / name))
        for src, dst in temporary:
            src.replace(dst)
    finally:
        for src, _ in temporary:
            src.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()
    # Fetch and validate both responses before the first local mutation.
    outputs = prepare(args.root, fetch_tab("active"), fetch_tab("archive"), dt.datetime.now(ZoneInfo("Europe/Moscow")))
    write_bundle(args.root, outputs)
    state = json.loads(outputs["delivery_source.json"])
    print(json.dumps({k: state[k] for k in ("loaded_at", "through", "rows", "source_counts", "retained_documents")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
