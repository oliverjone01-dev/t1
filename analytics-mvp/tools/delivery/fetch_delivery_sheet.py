#!/usr/bin/env python3
"""Read-only Sheets adapter. Raw contacts/addresses never leave process memory.

First import: active + archive. Daily: active + accepted event ledger. Archive is
revisited after a gap >36h, weekly, for unresolved costs or ambiguous new prices.
History through 04.10.2026 is retained; second trips follow decision 02.10.
"""
import collections
import csv
import datetime as dt
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile
import time
import urllib.error
import urllib.request
from zoneinfo import ZoneInfo

from build_delivery_sku_daily import MES, CANCELLED, clean_arts, comment_codes, event_articles
from ledger_money import fix_order_no, parse_money, MoneyError

SHEET = "1D312esBrGMvtAkMUdI4mI4tkF3rOsxnAVAq9vDUgNwY"
TABS = {"active": 529668543, "archive": 1308010914, "locations": 1945053016}
START = "2026-10-05"
FILES = ("delivery_orders.ndjson", "delivery_sku_daily.ndjson", "delivery_city_daily.ndjson",
         "delivery_trips_extra.ndjson", "delivery_cities.json")
HEADERS = {0: "Площадка", 1: "Номер заказа", 2: "Номер по ведомости", 3: "Артикул",
           4: "Дата отгрузки", 6: "Дата доставки факт.", 7: "Статус", 8: "Комметарий",
           10: "Адрес", 12: "Оплата от клиента", 14: "Стоимость доставки"}


def encoded(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, allow_nan=False) + "\n"


def closed_day(now):
    return (now.astimezone(ZoneInfo("Europe/Moscow")).date() - dt.timedelta(days=1)).isoformat()


def sheet_date(value, ledger_no):
    if not value.strip():
        return None
    year = re.search(r"[МM](\d{2})-", ledger_no)
    # Yearless dates cannot silently turn into the current year at New Year.
    year = 2000 + int(year[1]) if year else 2026
    m = re.fullmatch(r"\s*(\d{1,2})\s+([а-я]+)(?:\s+(20\d{2}))?\s*", value.lower())
    if not m:
        raise ValueError("unrecognized shipment/delivery date")
    month = next((v for k, v in MES.items() if m[2].startswith(k)), None)
    if not month:
        raise ValueError("unrecognized month")
    return dt.date(int(m[3]) if m[3] else year, month, int(m[1])).isoformat()


def order_number(value):
    value = value.strip()
    if "бывш" in value.lower():
        value = value.splitlines()[0].strip()
    value = fix_order_no(value)
    if not re.fullmatch(r"\d+-\d+-\d+", value):
        raise ValueError("unrecognized order number")
    return value


def cents(value):
    amount, _ = parse_money(value)
    if amount is None:
        return None
    if not math.isfinite(amount) or amount < 0:
        raise ValueError("invalid amount")
    return round(amount * 100)


def location_key(value):
    value = re.sub(r"^(?:г\.\s*|г\s+|город\s+|республика\s+)", "", value.strip().casefold()).replace("ё", "е")
    return re.sub(r"\s+обл\.?$", " область", value)


def parse_locations(text):
    rows = list(csv.reader(io.StringIO(text)))
    if not rows or rows[0][:2] != ["Город Б", "Регион Б"]:
        raise ValueError("locations: changed headers or empty dictionary")
    locations = {}
    for row in rows[1:]:
        for value in row[:2]:
            if value and len(value) <= 90 and re.fullmatch(r"[А-Яа-яЁёA-Za-z .-]+", value.strip()):
                locations[location_key(value)] = value.strip()
    if len(locations) < 100:
        raise ValueError("locations: incomplete dictionary")
    return locations


def public_city(address, locations):
    # Only canonical names from the route dictionary are published. No substring
    # copied from the address can introduce a contact, street or house number.
    safe = []
    for part in str(address).split(","):
        canonical = locations.get(location_key(part))
        if canonical and canonical not in safe:
            safe.append(canonical)
    return ", ".join(safe[:2]) or "город не указан"


def event_key(event):
    return event["order"], event["date"], event["ship_cents"]


def parse_tab(text, tab, through, locations):
    rows = list(csv.reader(io.StringIO(text)))
    if len(rows) < 2 or any(len(rows[0]) <= i or rows[0][i].strip() != h for i, h in HEADERS.items()):
        raise ValueError(f"{tab}: empty sheet or changed headers")
    events = {}
    missing = set()
    zero = set()
    observed = set()
    counts = collections.Counter()
    for row_no, row in enumerate(rows[1:], 2):
        row += [""] * max(0, 18 - len(row))
        if "OZON" not in row[0].upper():
            continue
        counts["ozon_rows"] += 1
        try:
            observed.add(order_number(row[1]))
        except ValueError:
            pass  # Historic malformed identifiers are outside the write window.
        try:
            # Historic columns are not interpreted using the modern schema.
            date = sheet_date(row[4], row[2])
            if not date:
                if any(row[i].strip() for i in (1, 3, 14)):
                    counts["undated_rows"] += 1
                continue
            if date < START:
                continue
            if date > through:
                counts["future_rows"] += 1
                continue
            if CANCELLED(row[7]):
                counts["cancelled_rows"] += 1
                continue
            order = order_number(row[1])
            ship = cents(row[14])
            if ship is None:
                missing.add((order, date))
                continue
            if ship == 0:
                counts["zero_cost_rows"] += 1
                zero.add((order, date))
                continue
            paid = cents(row[12])
            fact = sheet_date(row[6], row[2])
            if fact and fact > through:
                fact = None
            event = {"order": order, "date": date, "ship_cents": ship,
                     "paid_cents": paid, "d_fact": fact, "arts": clean_arts(row[3]),
                     "com": comment_codes(row[8]), "city": public_city(row[10], locations)}
            key = event_key(event)
            if key in events:
                old = events[key]
                if old["paid_cents"] is not None and paid is not None and old["paid_cents"] != paid:
                    raise ValueError("conflicting customer payment for duplicated shipment")
                event["paid_cents"] = old["paid_cents"] if paid is None else paid
                event["arts"] = sorted(set(event["arts"] + old["arts"]))
                event["com"] = sorted(set(event["com"] + old["com"]))
                event["d_fact"] = max(filter(None, [fact, old["d_fact"]]), default=None)
                counts["duplicate_rows"] += 1
            events[key] = event
        except (ValueError, MoneyError) as ex:
            # Do not include source values: they can contain personal data.
            raise ValueError(f"{tab}: row {row_no}, invalid date/order/amount") from None
    return events, missing, dict(counts), {"zero": zero, "orders": observed}


def merge_events(previous, incoming, full):
    merged = {event_key(e): e for e in previous}
    old_groups = collections.defaultdict(set)
    old_dates = collections.defaultdict(set)
    for key in merged:
        old_groups[key[:2]].add(key)
        old_dates[(key[0], key[2])].add(key)
    for key in incoming:
        if key not in merged and old_groups[key[:2]] - incoming.keys():
            raise ValueError("changed price or ambiguous trip; full archive/review required")
        if key not in merged and old_dates[(key[0], key[2])] - incoming.keys():
            raise ValueError("changed date or ambiguous trip; full archive/review required")
    # Missing rows can have moved to archive. They are never silently deleted or
    # turned into zero. A full replay reports retained rows to the health UI.
    retained = len(merged.keys() - incoming.keys()) if full else 0
    merged.update(incoming)
    return sorted(merged.values(), key=event_key), retained


def split_cents(amount, n):
    q, rem = divmod(amount, n)
    return [q + (i < rem) for i in range(n)]


def project(events, baseline_orders, baseline_cities, sold=None):
    orders = {r["order"]: dict(r) for r in baseline_orders}
    daily = collections.defaultdict(lambda: [0, 0, 0])
    city_daily = collections.defaultdict(lambda: [0, 0, 0, []])
    cities = {art: collections.Counter(dict(values)) for art, values in baseline_cities.items()}
    extra = []
    for e in sorted(events, key=lambda x: (x["date"], x["order"], -x["ship_cents"])):
        paid = e["paid_cents"]  # None stays visible in source status; legacy deliv is reference only.
        if e["order"] in orders:
            extra.append({"order": e["order"], "d_trip": e["date"], "ship": e["ship_cents"] / 100,
                          "deliv": (paid or 0) / 100})
        else:
            row = {"order": e["order"], "d_ship": e["date"], "ship": e["ship_cents"] / 100,
                   "deliv": (paid or 0) / 100}
            if e["d_fact"]:
                row["d_fact"] = e["d_fact"]
            orders[e["order"]] = row
        arts = sorted(event_articles(e, sold))
        for i, art in enumerate(arts):
            r = daily[(e["date"], art)]
            r[0] += split_cents(e["ship_cents"], len(arts))[i]
            r[1] += split_cents(paid or 0, len(arts))[i]
            r[2] += 1
            cities.setdefault(art, collections.Counter())[e["city"]] += 1
        r = city_daily[(e["date"], e["city"])]
        r[0] += e["ship_cents"]; r[1] += paid or 0; r[2] += 1; r[3].append(e["order"])
    sku_rows = [{"d": d, "offer": art, "ship": r[0] / 100, "deliv": r[1] / 100, "n": r[2]}
                for (d, art), r in sorted(daily.items())]
    city_rows = [{"d": d, "city": city, "ship": r[0] / 100, "deliv": r[1] / 100,
                  "n": r[2], "orders": sorted(r[3])} for (d, city), r in sorted(city_daily.items())]
    total = sum(e["ship_cents"] for e in events)
    derived = (sum(round(r["ship"] * 100) for r in sku_rows),
               sum(round(r["ship"] * 100) for r in city_rows),
               sum(round(r["ship"] * 100) for k, r in orders.items() if k not in {x["order"] for x in baseline_orders})
               + sum(round(r["ship"] * 100) for r in extra))
    if any(value != total for value in derived):
        raise ValueError("shipment projection totals differ")
    return list(orders.values()), sku_rows, city_rows, extra, {a: c.most_common(12) for a, c in sorted(cities.items())}


def fetch_tab(tab):
    url = f"https://docs.google.com/spreadsheets/d/{SHEET}/gviz/tq?tqx=out:csv&headers=1&gid={TABS[tab]}"
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=45) as response:
                if "csv" not in response.headers.get("Content-Type", "").lower():
                    raise ValueError("source is not CSV")
                raw = response.read(8_000_001)
                if len(raw) > 8_000_000:
                    raise ValueError("sheet exceeds size limit")
                return raw.decode("utf-8-sig")
        except urllib.error.HTTPError as ex:
            if ex.code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise ValueError(f"{tab}: HTTP {ex.code}") from None
        except (TimeoutError, urllib.error.URLError):
            if attempt == 2:
                raise ValueError(f"{tab}: timeout/network failure") from None
        time.sleep(2 ** attempt)
    raise ValueError("source unavailable")


def archive_needed(state, now):
    if not state or state.get("missing_cost") or state.get("undated_rows") or state.get("unseen_keys"):
        return True
    return ((now - dt.datetime.fromisoformat(state["archive_loaded_at"])).total_seconds() >= 7 * 86400
            or (now - dt.datetime.fromisoformat(state["loaded_at"])).total_seconds() > 36 * 3600)


def prepare(data, state, active, archive, now, locations=None):
    locations = locations if locations is not None else state["locations"]
    through = closed_day(now)
    incoming, missing, counts, observed = parse_tab(active, "active", through, locations)
    zero = observed["zero"]
    full = archive is not None
    if full:
        ar, missing_ar, counts_ar, observed_ar = parse_tab(archive, "archive", through, locations)
        zero |= observed_ar["zero"]
        observed["orders"] |= observed_ar["orders"]
        # The same shipment across tabs must use the same validation as within a tab.
        for key, event in ar.items():
            if key in incoming:
                old = incoming[key]
                if all(x is not None for x in (old["paid_cents"], event["paid_cents"])) and old["paid_cents"] != event["paid_cents"]:
                    raise ValueError("conflicting payment across tabs")
                event["paid_cents"] = old["paid_cents"] if event["paid_cents"] is None else event["paid_cents"]
                event["arts"] = sorted(set(old["arts"] + event["arts"]))
                event["com"] = sorted(set(old["com"] + event["com"]))
                event["d_fact"] = max(filter(None, [old["d_fact"], event["d_fact"]]), default=None)
            incoming[key] = event
        missing |= missing_ar
        counts = dict(collections.Counter(counts) + collections.Counter(counts_ar))
    previous = state.get("events", []) if state else []
    if any((e["order"], e["date"]) in zero for e in previous):
        raise ValueError("accepted positive bill became zero or ambiguous zero trip; review required")
    events, _ = merge_events(previous, incoming, full)
    unseen = ({event_key(e) for e in previous} - incoming.keys() if full else
              ({tuple(k) for k in state.get("unseen_keys", [])} |
               {event_key(e) for e in previous if e["order"] in observed["orders"]}) - incoming.keys())
    if full and not counts.get("ozon_rows"):
        raise ValueError("both delivery tabs have no OZON rows")
    if not full and not counts.get("ozon_rows"):
        raise ValueError("empty active tab requires archive verification")
    priced_now = {(e["order"], e["date"]) for e in incoming.values()}
    # On daily active-only reads keep unresolved receipts until archive recovery.
    if not full and state:
        missing |= {tuple(x) for x in state.get("missing_keys", [])} - priced_now
    baseline_cities = state["baseline_cities"] if state else json.loads(data["delivery_cities.json"])
    historical = {}
    for file in FILES[:-1]:
        lines = data[file].splitlines(keepends=True)
        field = "d_ship" if file == FILES[0] else "d_trip" if file == FILES[3] else "d"
        historical[file] = []
        for line in lines:
            row = json.loads(line)
            if not row.get(field):
                raise ValueError(f"{file}: missing baseline date")
            if row[field] < START:
                historical[file].append(line)
            elif not state:
                raise ValueError("initial target window is not empty; review baseline")
    baseline_orders = [json.loads(x) for x in historical[FILES[0]]]
    result = project(events, baseline_orders, baseline_cities)
    # Historical lines (including old formatting) are retained byte for byte.
    outputs = {}
    old_ids = {r["order"] for r in baseline_orders}
    new_rows = ([r for r in result[0] if r["order"] not in old_ids], *result[1:4])
    for file, rows in zip(FILES[:-1], new_rows):
        outputs[file] = "".join(historical[file]) + "".join(encoded(row) for row in rows)
    outputs[FILES[-1]] = encoded(result[4])
    stamp = now.isoformat()
    next_state = {"version": 1, "start": START, "loaded_at": stamp,
                  "archive_loaded_at": stamp if full else state["archive_loaded_at"],
                  "baseline_cities": baseline_cities, "locations": locations, "events": events,
                  "unseen_keys": sorted(unseen),
                  "missing_keys": sorted(missing), "missing_cost": len(missing),
                  "undated_rows": counts.get("undated_rows", 0)}
    status = {"loaded_at": stamp, "through": through, "source": SHEET, "from": START,
              "archive_read": full, "events": len(events), "missing_cost": len(missing),
              "missing_customer_paid": sum(e["paid_cents"] is None for e in events),
              "retained_unseen_events": len(unseen), "undated_rows": next_state["undated_rows"],
              "city_unknown": sum(e["city"] == "город не указан" for e in events),
              "ship": sum(e["ship_cents"] for e in events) / 100, "counts": counts,
              "outputs": {f: hashlib.sha256(s.encode()).hexdigest() for f, s in outputs.items()}}
    outputs["delivery_sheet_state.json"] = encoded(next_state)
    outputs["delivery_sheet_status.json"] = encoded(status)
    return outputs, status


def write_bundle(root, outputs):
    with tempfile.TemporaryDirectory(prefix=".delivery-sheet-stage-", dir=root) as folder:
        temps = {}
        # All parsing, projection, invariants and temp writes precede replacement.
        for file, content in outputs.items():
            temp = Path(folder) / file
            with temp.open("w", encoding="utf-8") as out:
                out.write(content); out.flush(); os.fsync(out.fileno()); temps[file] = temp
        for file, temp in temps.items():
            os.replace(temp, root / file)


def main():
    root = Path(os.environ.get("DATA_DIR", "data"))
    now = dt.datetime.now(dt.timezone.utc)
    state_file = root / "delivery_sheet_state.json"
    state = json.loads(state_file.read_text()) if state_file.exists() else None
    if state and (state.get("version") != 1 or state.get("start") != START):
        raise ValueError("unsupported delivery state")
    data = {file: (root / file).read_text() for file in FILES}
    active = fetch_tab("active")
    archive = fetch_tab("archive") if archive_needed(state, now) else None
    locations = parse_locations(fetch_tab("locations")) if archive is not None else state["locations"]
    try:
        outputs, status = prepare(data, state, active, archive, now, locations)
        if archive is None and status["retained_unseen_events"]:
            outputs, status = prepare(data, state, active, fetch_tab("archive"), now, locations)
    except ValueError:
        if archive is not None:
            raise
        # Price/trip ambiguity must be checked against the archived original.
        outputs, status = prepare(data, state, active, fetch_tab("archive"), now, locations)
    if "--dry-run" not in sys.argv:
        write_bundle(root, outputs)
    # Counters only: no source rows, contacts, raw addresses or identifiers.
    print(encoded({k: v for k, v in status.items() if k not in ("source", "outputs")} ).strip())


if __name__ == "__main__":
    try:
        main()
    except Exception as ex:
        print(f"delivery-sheet FAILED: {type(ex).__name__}: {ex}", file=sys.stderr)
        sys.exit(1)
