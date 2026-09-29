#!/usr/bin/env python3
"""invariants.py - проверки данных для билдеров чисел (fail-closed).

Импорт: sys.path.append('.claude/skills/data-guard/scripts'); from invariants import *
Каждая функция бросает InvariantError с понятным текстом. Вызывать ДО записи результата.
Самопроверка: python3 invariants.py --selftest
"""
from __future__ import annotations

import datetime as _dt
from typing import Any, Iterable, Sequence


class InvariantError(AssertionError):
    pass


def _key(row: dict, key: Sequence[str]) -> tuple:
    return tuple(row.get(k) for k in key)


def assert_unique_key(rows: Iterable[dict], key: Sequence[str], name: str = "rows") -> None:
    """К4: ключ сущности уникален и не пустой."""
    seen, dups, nulls = set(), [], 0
    for r in rows:
        k = _key(r, key)
        if any(v is None or v == "" for v in k):
            nulls += 1
            continue
        if k in seen:
            dups.append(k)
        seen.add(k)
    if nulls or dups:
        raise InvariantError(f"{name}: ключ {list(key)} пустой в {nulls} строках, дублей {len(dups)} (примеры {dups[:3]})")


def dedup_by_key(rows: list[dict], key: Sequence[str]) -> tuple[list[dict], int]:
    """К4: дедуп только по полному объявленному ключу. Возвращает (строки, сколько удалено)."""
    seen, out = set(), []
    for r in rows:
        k = _key(r, key)
        if k in seen:
            continue
        seen.add(k)
        out.append(r)
    return out, len(rows) - len(out)


def assert_share(num: float | None, den: float | None, name: str = "share") -> float | None:
    """К2: доля 0..1, числитель не больше знаменателя. None при отсутствии данных."""
    if num is None or den is None:
        return None
    if den <= 0:
        if num == 0:
            return None
        raise InvariantError(f"{name}: знаменатель {den} при числителе {num}")
    if num < 0 or num > den:
        raise InvariantError(f"{name}: числитель {num} вне [0, {den}], популяции разные")
    return num / den


def assert_parts_sum(parts: Iterable[float], total: float, tol: float = 0.01, name: str = "parts") -> None:
    """К4: сумма частей равна итогу."""
    s = sum(parts)
    if abs(s - total) > tol:
        raise InvariantError(f"{name}: сумма частей {s:.2f} != итог {total:.2f} (разница {s - total:.2f})")


def assert_no_silent_zero(series: dict[str, Any], dates: Iterable[str], name: str = "series") -> None:
    """К7: каждый день периода есть в ряду; пропуск хранится как None, а не отсутствует и не 0 по умолчанию."""
    missing = [d for d in dates if d not in series]
    if missing:
        raise InvariantError(f"{name}: нет дней {missing[:5]} (всего {len(missing)}). Пропуск = None, не 0 и не отсутствие")


def assert_fresh(loaded_at: str | None, max_age_hours: float, now: _dt.datetime | None = None, name: str = "snapshot") -> None:
    """К7: у снимка есть loaded_at и он не старше порога."""
    if not loaded_at:
        raise InvariantError(f"{name}: нет loaded_at, свежесть неизвестна")
    ts = _dt.datetime.fromisoformat(loaded_at.replace("Z", "+00:00"))
    now = now or _dt.datetime.now(_dt.timezone.utc)
    age = (now - ts).total_seconds() / 3600
    if age > max_age_hours:
        raise InvariantError(f"{name}: снимок старше {max_age_hours} ч (возраст {age:.1f} ч)")


def merge_window(old: dict[str, Any], new: dict[str, Any], start: str, end: str,
                 allow_shrink: bool = False, min_ratio: float = 0.5) -> dict[str, Any]:
    """К7: заменяет только дни в [start, end), остальное не трогает. Обе границы обязательны.
    Пустой или сильно усохший ответ (дней в окне меньше min_ratio от старых) роняет запись,
    если явно не разрешено allow_shrink=True: так пустой ответ API не стирает окно (инцидент cron с дефолтом)."""
    if not start or not end:
        raise InvariantError("merge_window: нужны обе границы окна")
    old_in = [d for d in old if start <= d < end]
    for d in new:
        if not (start <= d < end):
            raise InvariantError(f"merge_window: новые данные за {d} вне окна [{start}, {end})")
    if not allow_shrink and old_in and len(new) < min_ratio * len(old_in):
        raise InvariantError(f"merge_window: в окне было {len(old_in)} дней, пришло {len(new)}. "
                             "Пустой или усохший ответ не перезаписывает данные; если так и надо, allow_shrink=True")
    out = {d: v for d, v in old.items() if not (start <= d < end)}
    out.update(new)
    return out


def mark_partial(buckets: list[dict], now: _dt.datetime, end_field: str = "end") -> list[dict]:
    """К7: интервал, который ещё не закончился, помечается partial=True."""
    for b in buckets:
        end = b[end_field]
        end_dt = end if isinstance(end, _dt.datetime) else _dt.datetime.fromisoformat(str(end).replace("Z", "+00:00"))
        if end_dt.tzinfo is None and now.tzinfo is not None:
            end_dt = end_dt.replace(tzinfo=now.tzinfo)
        b["partial"] = end_dt > now
    return buckets


def assert_known_codes(values: Iterable[str], dictionary: Iterable[str], name: str = "codes") -> None:
    """К6, К8: коды из справочника; незнакомый код роняет сборку, а не уходит в «прочее»."""
    known = set(dictionary)
    unknown = sorted({v for v in values if v not in known})
    if unknown:
        raise InvariantError(f"{name}: незнакомые коды {unknown[:10]} (всего {len(unknown)})")


def assert_no_overlap(periods: Iterable[tuple[str, str, str]], name: str = "periods") -> None:
    """К4: периоды действия (ключ, с, по) не пересекаются внутри ключа."""
    by_key: dict[str, list[tuple[str, str]]] = {}
    for k, a, b in periods:
        by_key.setdefault(k, []).append((a, b))
    for k, ps in by_key.items():
        ps.sort()
        for (a1, b1), (a2, _b2) in zip(ps, ps[1:]):
            if a2 < b1:
                raise InvariantError(f"{name}: у {k} пересекаются периоды [{a1},{b1}) и [{a2},...)")


def _selftest() -> None:
    import traceback

    def expect_fail(fn, *a, **kw):
        try:
            fn(*a, **kw)
        except InvariantError:
            return
        raise SystemExit(f"не упало: {fn.__name__}{a}")

    assert_unique_key([{"id": 1}, {"id": 2}], ["id"])
    expect_fail(assert_unique_key, [{"id": 1}, {"id": 1}], ["id"])
    expect_fail(assert_unique_key, [{"id": None}], ["id"])
    rows, removed = dedup_by_key([{"a": 1, "n": 1}, {"a": 1, "n": 2}, {"a": 1, "n": 1}], ["a", "n"])
    assert removed == 1 and len(rows) == 2
    assert assert_share(1, 4) == 0.25 and assert_share(None, 4) is None and assert_share(0, 0) is None
    expect_fail(assert_share, 5, 4)
    assert_parts_sum([1.0, 2.0], 3.0)
    expect_fail(assert_parts_sum, [1.0, 2.0], 3.5)
    assert_no_silent_zero({"2026-09-01": None, "2026-09-02": 5}, ["2026-09-01", "2026-09-02"])
    expect_fail(assert_no_silent_zero, {"2026-09-01": 1}, ["2026-09-01", "2026-09-02"])
    now = _dt.datetime(2026, 9, 29, 12, tzinfo=_dt.timezone.utc)
    assert_fresh("2026-09-29T10:00:00Z", 6, now)
    expect_fail(assert_fresh, "2026-09-27T10:00:00Z", 6, now)
    expect_fail(assert_fresh, None, 6, now)
    old = {"2026-02-01": 1, "2026-09-01": 2}
    merged = merge_window(old, {"2026-09-01": 3}, "2026-09-01", "2026-10-01")
    assert merged == {"2026-02-01": 1, "2026-09-01": 3}
    expect_fail(merge_window, old, {"2026-05-01": 9}, "2026-09-01", "2026-10-01")
    expect_fail(merge_window, old, {}, "", "2026-10-01")
    old30 = {f"2026-06-{d:02d}": d for d in range(1, 31)}
    expect_fail(merge_window, old30, {}, "2026-06-01", "2026-07-01")  # пустой ответ API не стирает окно
    expect_fail(merge_window, old30, {"2026-06-01": 1}, "2026-06-01", "2026-07-01")
    assert merge_window(old30, {}, "2026-06-01", "2026-07-01", allow_shrink=True) == {}
    b = mark_partial([{"end": "2026-09-29T21:00:00+00:00"}, {"end": "2026-09-28T21:00:00+00:00"}], now)
    assert b[0]["partial"] is True and b[1]["partial"] is False
    assert_known_codes(["A"], ["A", "B"])
    expect_fail(assert_known_codes, ["C"], ["A"])
    assert_no_overlap([("s", "2026-01-01", "2026-02-01"), ("s", "2026-02-01", "2026-03-01")])
    expect_fail(assert_no_overlap, [("s", "2026-01-01", "2026-02-15"), ("s", "2026-02-01", "2026-03-01")])
    print("invariants.py selftest: ok")


if __name__ == "__main__":
    import sys

    if "--selftest" in sys.argv:
        _selftest()
