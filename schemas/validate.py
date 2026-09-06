#!/usr/bin/env python3
"""validate.py - CLI-валидатор JSON-артефактов GENGROUP по схемам из schemas/.

Executable enforcement для Protocol 13 (A2A), Step 12.5 (audit-report),
Council (council-vote), Roadmap (roadmap-entry) и Protocol 14 (agent-trace).

Usage:
    python3 schemas/validate.py <schema> <file.json | ->      # '-' читает stdin
    python3 schemas/validate.py <schema> --jsonl <file.jsonl>  # построчно
    python3 schemas/validate.py --list

<schema> - имя без расширения (audit-report, a2a-message, council-vote,
roadmap-entry, agent-trace) или путь к .json-схеме.

Exit codes: 0 valid · 1 invalid · 2 usage / load error.

Если установлен пакет jsonschema - используется он (Draft 2020-12).
Иначе работает встроенный валидатор для подмножества Draft 2020-12,
которое реально используют наши схемы: type, const, enum, pattern, min/max,
exclusiveMin/Max, minLength/maxLength, minItems/maxItems, items, required,
properties, patternProperties, additionalProperties, allOf/anyOf/oneOf,
if/then/else. format проверяется только для date и date-time (мягко).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

SCHEMA_DIR = Path(__file__).resolve().parent

# ---------------------------------------------------------------------------
# Встроенный валидатор (fallback без зависимостей)
# ---------------------------------------------------------------------------

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_DATETIME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?([Zz]|[+-]\d{2}:?\d{2})?$")


def _is_type(value, t: str) -> bool:
    if t == "object":
        return isinstance(value, dict)
    if t == "array":
        return isinstance(value, list)
    if t == "string":
        return isinstance(value, str)
    if t == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if t == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if t == "boolean":
        return isinstance(value, bool)
    if t == "null":
        return value is None
    return True


def _errors(value, schema, path: str) -> list[str]:
    """Возвращает список ошибок. Пустой список = valid."""
    if schema is True or schema == {}:
        return []
    if schema is False:
        return [f"{path}: schema is false (значение запрещено)"]
    errs: list[str] = []
    s = schema

    if "type" in s:
        types = s["type"] if isinstance(s["type"], list) else [s["type"]]
        if not any(_is_type(value, t) for t in types):
            errs.append(f"{path}: ожидался тип {'/'.join(types)}, получен {type(value).__name__}")
            return errs  # дальнейшие проверки бессмысленны

    if "const" in s and value != s["const"]:
        errs.append(f"{path}: должно быть равно {s['const']!r}, получено {value!r}")
    if "enum" in s and value not in s["enum"]:
        errs.append(f"{path}: {value!r} не входит в {s['enum']}")

    if isinstance(value, str):
        if "pattern" in s and not re.search(s["pattern"], value):
            errs.append(f"{path}: {value!r} не соответствует pattern {s['pattern']!r}")
        if "minLength" in s and len(value) < s["minLength"]:
            errs.append(f"{path}: длина {len(value)} < minLength {s['minLength']}")
        if "maxLength" in s and len(value) > s["maxLength"]:
            errs.append(f"{path}: длина {len(value)} > maxLength {s['maxLength']}")
        fmt = s.get("format")
        if fmt == "date" and not _DATE_RE.match(value):
            errs.append(f"{path}: {value!r} не формат date (YYYY-MM-DD)")
        elif fmt == "date-time" and not _DATETIME_RE.match(value):
            errs.append(f"{path}: {value!r} не формат date-time (ISO 8601)")

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in s and value < s["minimum"]:
            errs.append(f"{path}: {value} < minimum {s['minimum']}")
        if "maximum" in s and value > s["maximum"]:
            errs.append(f"{path}: {value} > maximum {s['maximum']}")
        if "exclusiveMinimum" in s and value <= s["exclusiveMinimum"]:
            errs.append(f"{path}: {value} <= exclusiveMinimum {s['exclusiveMinimum']}")
        if "exclusiveMaximum" in s and value >= s["exclusiveMaximum"]:
            errs.append(f"{path}: {value} >= exclusiveMaximum {s['exclusiveMaximum']}")

    if isinstance(value, list):
        if "minItems" in s and len(value) < s["minItems"]:
            errs.append(f"{path}: {len(value)} элементов < minItems {s['minItems']}")
        if "maxItems" in s and len(value) > s["maxItems"]:
            errs.append(f"{path}: {len(value)} элементов > maxItems {s['maxItems']}")
        if "items" in s:
            for i, item in enumerate(value):
                errs.extend(_errors(item, s["items"], f"{path}[{i}]"))

    if isinstance(value, dict):
        for req in s.get("required", []):
            if req not in value:
                errs.append(f"{path}: отсутствует обязательное поле '{req}'")
        props = s.get("properties", {})
        pprops = s.get("patternProperties", {})
        for key, sub in value.items():
            matched = False
            if key in props:
                matched = True
                errs.extend(_errors(sub, props[key], f"{path}.{key}"))
            for pat, psub in pprops.items():
                if re.search(pat, key):
                    matched = True
                    errs.extend(_errors(sub, psub, f"{path}.{key}"))
            if not matched:
                ap = s.get("additionalProperties", True)
                if ap is False:
                    errs.append(f"{path}: поле '{key}' не разрешено (additionalProperties=false)")
                elif isinstance(ap, dict):
                    errs.extend(_errors(sub, ap, f"{path}.{key}"))

    for sub in s.get("allOf", []):
        errs.extend(_errors(value, sub, path))
    if "anyOf" in s:
        if not any(not _errors(value, sub, path) for sub in s["anyOf"]):
            errs.append(f"{path}: не подходит ни под один вариант anyOf")
    if "oneOf" in s:
        ok = sum(1 for sub in s["oneOf"] if not _errors(value, sub, path))
        if ok != 1:
            errs.append(f"{path}: подходит под {ok} вариантов oneOf, нужен ровно 1")
    if "if" in s:
        if not _errors(value, s["if"], path):
            if "then" in s:
                errs.extend(_errors(value, s["then"], path))
        elif "else" in s:
            errs.extend(_errors(value, s["else"], path))
    return errs


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def resolve_schema(name: str) -> Path:
    p = Path(name)
    if p.suffix == ".json" and p.exists():
        return p
    cand = SCHEMA_DIR / f"{name}.json"
    if cand.exists():
        return cand
    raise FileNotFoundError(f"схема '{name}' не найдена (ищу {cand})")


def validate(instance, schema: dict) -> list[str]:
    """Список ошибок (пустой = valid). jsonschema если есть, иначе fallback."""
    try:
        from jsonschema import Draft202012Validator  # type: ignore
    except ImportError:
        return _errors(instance, schema, "$")
    v = Draft202012Validator(schema)
    return [f"$.{'.'.join(str(x) for x in e.absolute_path) or ''}: {e.message}" for e in v.iter_errors(instance)]


def list_schemas() -> list[str]:
    return sorted(p.stem for p in SCHEMA_DIR.glob("*.json"))


def main(argv: list[str]) -> int:
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 2
    if argv[0] == "--list":
        print("\n".join(list_schemas()))
        return 0
    if len(argv) < 2:
        print("usage: validate.py <schema> <file.json | - | --jsonl file>", file=sys.stderr)
        return 2

    try:
        schema = json.loads(resolve_schema(argv[0]).read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        print(f"LOAD ERROR: {e}", file=sys.stderr)
        return 2

    jsonl = False
    src = argv[1]
    if src == "--jsonl":
        if len(argv) < 3:
            print("usage: validate.py <schema> --jsonl <file>", file=sys.stderr)
            return 2
        jsonl, src = True, argv[2]

    try:
        raw = sys.stdin.read() if src == "-" else Path(src).read_text(encoding="utf-8")
    except Exception as e:  # noqa: BLE001
        print(f"READ ERROR: {e}", file=sys.stderr)
        return 2

    failures = 0
    if jsonl:
        for n, line in enumerate(raw.splitlines(), 1):
            if not line.strip():
                continue
            try:
                inst = json.loads(line)
            except json.JSONDecodeError as e:
                print(f"line {n}: INVALID JSON ({e})")
                failures += 1
                continue
            errs = validate(inst, schema)
            if errs:
                failures += 1
                print(f"line {n}: INVALID")
                for err in errs[:8]:
                    print(f"  - {err}")
        total = sum(1 for line in raw.splitlines() if line.strip())
        print(f"{total - failures}/{total} строк valid по схеме {argv[0]}")
        return 1 if failures else 0

    try:
        inst = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"INVALID JSON: {e}", file=sys.stderr)
        return 1
    errs = validate(inst, schema)
    if errs:
        print(f"INVALID ({len(errs)} ошибок) по схеме {argv[0]}:")
        for err in errs[:20]:
            print(f"  - {err}")
        return 1
    print(f"VALID по схеме {argv[0]}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
