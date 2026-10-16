#!/usr/bin/env python3
"""ФЕНИКС #484, проба C1: модель очереди группы ozon-data (cancel-in-progress: false).
Семантика GitHub (документирована, docs.github.com в этой сессии недоступен, ссылка в ревью Codex):
не больше одного running и одного pending в группе; новый queued отменяет существующий pending.
Входы: реальные моменты постановки прогонов по расписанию 01-15.10 (REST, created_at) и их
длительности; мак: утро 04:50 UTC, вечер 17:50 UTC (коммиты 3194d446 17:50:35, 710ec0d8 04:50:29).
Варианты: base (main 4445697: dispatch нет), cda (dispatch только на push), a8b (push и schedule).
Плюс стресс-сценарии: занятая группа в момент съёма (ручной прогон) и расписание без опоздания.
"""
import json
import subprocess
import datetime as dt
from collections import defaultdict

REPO = "oliverjone01-dev/t1"


def api(url):
    return json.loads(subprocess.run(["gh", "api", url], capture_output=True, text=True).stdout)


def ts(s):
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))


def hist(wf):
    out = {}
    for r in api(f"repos/{REPO}/actions/workflows/{wf}/runs?per_page=40&event=schedule")["workflow_runs"]:
        if r["status"] != "completed":
            continue
        c, s, u = ts(r["created_at"]), ts(r["run_started_at"]), ts(r["updated_at"])
        out[c.date()] = (c, (u - s).total_seconds() / 60)
    return out


O = hist(361257227)
Z = hist(300243375)


def simulate(arrivals, variant):
    """arrivals: list of (t, wf, event). Возвращает журнал прогонов."""
    arrivals = sorted(arrivals)
    running = None  # (wf, event, start, end)
    pending = None  # (wf, event, t_queued)
    log = []
    queue = list(arrivals)
    t = None
    events = []  # (time, kind, payload)
    for a in arrivals:
        events.append((a[0], "arrive", a))
    events.sort(key=lambda e: e[0])

    def start(run, now):
        wf, ev, _ = run
        dur = durs[wf]
        end = now + dt.timedelta(minutes=dur)
        log.append(("start", now, wf, ev))
        # dispatch шагом в конце orders (за ~10 с до конца прогона)
        if wf == "O" and (variant == "a8b" and ev in ("push", "schedule") or variant == "cda" and ev == "push"):
            events.append((end - dt.timedelta(seconds=10), "arrive", (end - dt.timedelta(seconds=10), "Z", "dispatch")))
        events.append((end, "end", (wf, ev)))
        return (wf, ev, now, end)

    while events:
        events.sort(key=lambda e: (e[0], 0 if e[1] == "end" else 1))
        now, kind, p = events.pop(0)
        if kind == "arrive":
            run = (p[1], p[2], now)
            if running is None:
                running = start(run, now)
            else:
                if pending is not None:
                    log.append(("cancel_pending", now, pending[0], pending[1]))
                pending = run
        else:
            log.append(("end", now, p[0], p[1]))
            running = None
            if pending is not None:
                running = start(pending, now)
                pending = None
    return log


durs = {"O": 3.2, "Z": 19.0}
rows = []
print("день  | расписание O / Z (UTC, мин после ночи) | вариант: O-прогонов Z-прогонов отменено-pending | слияние Z(dispatch)+Z(cron)")
for d in sorted(O):
    if d not in Z or d < dt.date(2026, 10, 1):
        continue
    oc, od = O[d]
    zc, zd = Z[d]
    durs["O"], durs["Z"] = max(od, 2.5), max(zd, 15)
    morning = dt.datetime(d.year, d.month, d.day, 4, 50, 30, tzinfo=dt.timezone.utc)
    evening = dt.datetime(d.year, d.month, d.day, 17, 50, 35, tzinfo=dt.timezone.utc)
    line = f"{d:%d.%m} | O {oc:%H:%M} Z {zc:%H:%M} (Z-O {((zc - oc).total_seconds() / 60):.0f} мин, O {od:.1f} мин, Z {zd:.1f} мин) |"
    for v in ("base", "cda", "a8b"):
        arr = [(oc, "O", "schedule"), (zc, "Z", "schedule")]
        if v != "base":
            arr += [(morning, "O", "push"), (evening, "O", "push")]
        log = simulate(arr, v)
        no = sum(1 for e in log if e[0] == "start" and e[2] == "O")
        nz = sum(1 for e in log if e[0] == "start" and e[2] == "Z")
        nc = sum(1 for e in log if e[0] == "cancel_pending")
        line += f" {v}: O{no} Z{nz} c{nc};"
    rows.append(line)
    print(line)

print()
print("Стресс S1 (Codex P2): в 04:45 ручной ozon-snapshots (19 мин), съём 04:50, расписание O без опоздания 04:55, Z 05:53")
for v in ("cda", "a8b"):
    d = dt.date(2026, 10, 17)
    base_t = dt.datetime(d.year, d.month, d.day, tzinfo=dt.timezone.utc)
    durs["O"], durs["Z"] = 3.2, 19.0
    arr = [(base_t + dt.timedelta(hours=4, minutes=45), "Z", "manual"), (base_t + dt.timedelta(hours=4, minutes=50), "O", "push"),
           (base_t + dt.timedelta(hours=4, minutes=55), "O", "schedule"), (base_t + dt.timedelta(hours=5, minutes=53), "Z", "schedule")]
    log = simulate(arr, v)
    print(f"  {v}: " + "; ".join(f"{k} {t:%H:%M:%S} {wf}/{ev}" for k, t, wf, ev in log if k != "end"))
print("Стресс S2: в 04:45 ручной orders (3 мин) и сразу ручной ozon (19 мин) как 16.10 06:35, съём 04:50")
for v in ("cda", "a8b"):
    arr = [(base_t + dt.timedelta(hours=4, minutes=45), "O", "manual"), (base_t + dt.timedelta(hours=4, minutes=45, seconds=2), "Z", "manual"),
           (base_t + dt.timedelta(hours=4, minutes=50), "O", "push")]
    log = simulate(arr, v)
    print(f"  {v}: " + "; ".join(f"{k} {t:%H:%M:%S} {wf}/{ev}" for k, t, wf, ev in log if k != "end"))
