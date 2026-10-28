"""Read-only operational delivery snapshots, independent of the money ledger.

Only an allowlist of identifiers, product articles, dates and statuses is saved.
Full active+archive reads are required: disappearing rows are not cancellations.
"""
import csv
import datetime as dt
import hashlib
import io
import json
import os
from pathlib import Path
import re
from zoneinfo import ZoneInfo

from fetch_delivery_sheet import fetch_tab, sheet_date, order_number, clean_arts, encoded, write_bundle, START

FILE = "delivery_timeline.json"
STATUSES = {"Создан", "Доставлен", "Собственная доставка", "Возврат", "Вернули на склад",
            "В очереди", "Собственная/в очереди", "ОТМЕНЕН", "ОТМЕНЁН"}
FIELDS = ("shipped", "planned", "actual", "status")
HEADERS = {0: "Площадка", 1: "Номер заказа", 2: "Номер по ведомости", 3: "Артикул",
           4: "Дата отгрузки", 5: "Дата доставки", 6: "Дата доставки факт.", 7: "Статус"}


def parse(text, tab, collection_year=2026):
    cells = list(csv.reader(io.StringIO(text)))
    if len(cells) < 2 or any(len(cells[0]) <= i or cells[0][i].strip() != h for i, h in HEADERS.items()):
        raise ValueError(tab + ": changed delivery headers or truncated response")
    rows = {}
    for number, row in enumerate(cells[1:], 2):
        row += [""] * max(0, 8 - len(row))
        if "OZON" not in row[0].upper():
            continue
        dates = {}
        issues = []
        year = re.search(r"[А-ЯA-Z]{1,2}(\d{2})-", row[2].upper())
        if not year and collection_year != 2026 and any(v.strip() and not re.search(r"20\d{2}", v) for v in row[4:7]):
            raise ValueError(f"{tab}: yearless row needs year confirmation at row {number}")
        for field, i in (("shipped", 4), ("planned", 5), ("actual", 6)):
            try:
                dates[field] = sheet_date(row[i], "М" + year[1] + "-" if year else row[2])
            except ValueError:
                dates[field] = None
                issues.append("invalid_" + field)
        # Shipment is the scope anchor; plan is a fallback for not-yet-shipped rows.
        scope = dates["shipped"] or dates["planned"]
        if scope and scope < START:
            continue
        try:
            order = order_number(row[1])
        except ValueError:
            raise ValueError(f"{tab}: invalid order at row {number}") from None
        ledger_text = row[2].strip().upper().replace("M", "М")
        codes = sorted(set(re.findall(r"(?:НС|НМ|С|М)\d{2}-\d+", ledger_text)))
        rest = re.sub(r"(?:НС|НМ|С|М)\d{2}-\d+", "", ledger_text)
        rest = re.sub(r"\d+\s*ШТ\.?", "", rest).strip()
        if rest:
            raise ValueError(f"{tab}: missing/invalid stable trip identifier at row {number}")
        ledger = "+".join(codes) or "БЕЗ-НОМЕРА"
        if not codes:
            issues.append("missing_trip")
        status = row[7].strip()
        if status not in STATUSES:
            status = "Неизвестный статус"
            issues.append("unknown_status")
        key = order + ":" + ledger
        item = dict(id=key, order=order, trip=ledger, arts=clean_arts(row[3]),
                    status=status, **dates, issues=issues, tab=tab)
        if key in rows:
            if any(rows[key][f] != item[f] for f in FIELDS) or (not codes and sorted(rows[key]["arts"]) != sorted(item["arts"])):
                raise ValueError(f"{tab}: conflicting duplicate trip at row {number}")
            item["arts"] = sorted(set(item["arts"] + rows[key]["arts"]))
        rows[key] = item
    return rows


def prepare(active, archive, old, now):
    if old and old.get("version") != 1:
        raise ValueError("unsupported delivery timeline")
    stamp = now.isoformat()
    day = now.astimezone(ZoneInfo("Europe/Moscow")).date().isoformat()
    if old and stamp < old["loaded_at"]:
        raise ValueError("refuse out-of-order delivery snapshot")
    a, b = parse(active, "active", int(day[:4])), parse(archive, "archive", int(day[:4]))
    incoming = dict(b)
    for key, row in a.items():
        if key in b and row["trip"] == "БЕЗ-НОМЕРА" and (any(row[f] != b[key][f] for f in FIELDS) or sorted(row["arts"]) != sorted(b[key]["arts"])):
            raise ValueError("ambiguous unnumbered delivery across active/archive")
        if key in b and any(row[f] != b[key][f] for f in FIELDS):
            row["issues"].append("source_conflict")
        incoming[key] = row
    if not incoming:
        raise ValueError("empty operational delivery snapshot")
    previous = {r["id"]: r for r in (old or {}).get("rows", [])}
    history = list((old or {}).get("history", []))
    for key, row in incoming.items():
        prior = previous.get(key)
        row["first_seen"] = prior["first_seen"] if prior else stamp
        row["last_seen"] = stamp
        row["missing"] = False
        if prior:
            changes = {f: [prior[f], row[f]] for f in FIELDS if prior[f] != row[f]}
            if changes:
                history.append({"id": hashlib.sha256((key + stamp + encoded(changes)).encode()).hexdigest()[:24],
                                "trip_id": key, "order": row["order"], "observed_at": stamp,
                                "previous_seen": prior["last_seen"], "changes": changes, "status": row["status"],
                                "conflict": "source_conflict" in row["issues"] or "source_conflict" in prior["issues"]})
        previous[key] = row
    for key in previous.keys() - incoming.keys():
        previous[key] = dict(previous[key], missing=True)
    return {"version": 1, "source_date": day, "loaded_at": stamp,
            "started_at": (old or {}).get("started_at", stamp), "scope_from": START,
            "observed_days": sorted(set((old or {}).get("observed_days", []) + [day])),
            "rows": sorted(previous.values(), key=lambda r: r["id"]), "history": history}


def main():
    root = Path(os.environ.get("DATA_DIR", "data"))
    path = root / FILE
    old = json.loads(path.read_text()) if path.exists() else None
    result = prepare(fetch_tab("active"), fetch_tab("archive"), old, dt.datetime.now(dt.timezone.utc))
    write_bundle(root, {FILE: encoded(result)})
    print(encoded({"source_date": result["source_date"], "rows": len(result["rows"]),
                   "changes": len(result["history"]), "issues": sum(bool(r["issues"]) for r in result["rows"])}).strip())


if __name__ == "__main__":
    main()
