#!/usr/bin/env python3
"""Датчик контекста для скилла pereezd (хук UserPromptSubmit).

Перед каждым сообщением пользователя смотрит в транскрипт сессии, берёт размер
контекста из usage последнего ответа модели и, если сессия упёрлась в предел,
подмешивает в контекст указание выполнить переезд в новую сессию.

Пороги (токены контекста), переопределяются переменными окружения:
  PEREEZD_SOFT  - 400000: предложить переезд на ближайшей точке сохранения
  PEREEZD_HARD  - 500000: переезд обязателен до начала работы над запросом
  PEREEZD_IDLE_MIN - 60: пауза в минутах, после которой кэш уже остыл
  PEREEZD_IDLE_CTX - 100000: при остывшем кэше и таком контексте переезд почти бесплатен

Отключить разово: в сообщении написать «без переезда».
Хук никогда не блокирует сообщение: при любой ошибке молча выходит с кодом 0.
"""
import json
import os
import sys
from datetime import datetime, timezone

SOFT = int(os.environ.get("PEREEZD_SOFT", 400_000))
HARD = int(os.environ.get("PEREEZD_HARD", 500_000))
IDLE_MIN = int(os.environ.get("PEREEZD_IDLE_MIN", 60))
IDLE_CTX = int(os.environ.get("PEREEZD_IDLE_CTX", 100_000))


def last_main_usage(path):
    """Возвращает (контекст в токенах, время ответа) последнего ответа основной ветки."""
    last = None
    with open(path, encoding="utf-8") as f:
        for line in f:
            if '"assistant"' not in line or '"usage"' not in line:
                continue
            try:
                row = json.loads(line)
            except ValueError:
                continue
            if row.get("type") != "assistant" or row.get("isSidechain"):
                continue
            usage = (row.get("message") or {}).get("usage") or {}
            ctx = (
                usage.get("input_tokens", 0)
                + usage.get("cache_read_input_tokens", 0)
                + usage.get("cache_creation_input_tokens", 0)
            )
            if ctx:
                last = (ctx, row.get("timestamp"))
    return last


def minutes_since(ts):
    if not ts:
        return 0
    then = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    return (datetime.now(timezone.utc) - then).total_seconds() / 60


def main():
    data = json.load(sys.stdin)
    if "без переезда" in (data.get("prompt") or "").lower():
        return
    path = data.get("transcript_path")
    if not path or not os.path.exists(path):
        return
    found = last_main_usage(path)
    if not found:
        return
    ctx, ts = found
    idle = minutes_since(ts)
    k = f"{ctx // 1000}K"

    if ctx >= HARD:
        msg = (
            f"[pereezd] Контекст сессии {k} токенов, это выше жёсткого порога {HARD // 1000}K. "
            "ПЕРЕЕЗД ОБЯЗАТЕЛЕН: сначала выполни скилл pereezd (сохранить, передать, открыть "
            "новую сессию), а запрос пользователя передай в новую сессию дословно как первую "
            "задачу. Если сейчас идёт незавершённая правка - сначала доведи её до коммита."
        )
    elif idle >= IDLE_MIN and ctx >= IDLE_CTX:
        msg = (
            f"[pereezd] Контекст {k}, пауза {int(idle)} мин: кэш остыл, следующий ход перечитает "
            "весь контекст по полной цене. Сейчас самый дешёвый момент для переезда. Если запрос "
            "начинает новую задачу или не требует памяти этой сессии - выполни скилл pereezd."
        )
    elif ctx >= SOFT:
        msg = (
            f"[pereezd] Контекст {k} из порога {HARD // 1000}K. Закончи текущий шаг и на ближайшей "
            "точке сохранения (коммит, закрытая подзадача, смена темы) выполни скилл pereezd, "
            "не дожидаясь жёсткого порога."
        )
    else:
        return

    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": msg,
        }
    }, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
