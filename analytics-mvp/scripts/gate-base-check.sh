#!/usr/bin/env bash
# Проверка логики base() из ym-snapshots.yml: отличает ли она «слепок потерян» (отказ защиты,
# обязан быть блок) от «файл появился впервые» (законно, сравнивать не с чем).
S="$(mktemp -d)"
mkdir -p "$S/data-ym" "$S/base"
B="$S/base"

base () {
  if [ -f "$B/$1" ]; then echo "$B/$1"; return 0; fi
  if grep -qxF "$1" "$B/.absent" 2>/dev/null; then echo ""; return 0; fi
  if [ -f "data-ym/$1" ]; then echo "::error::слепка нет, файл есть, отсутствующим не числился" >&2; return 1; fi
  echo ""; return 0
}

fails=0
try () { # try <файл> <ожидание: pass|block> <описание>
  local b out
  if b=$(base "$1" 2>/dev/null); then out=pass; else out=block; fi
  if [ "$out" = "$2" ]; then echo "  OK   $3 -> $out"; else echo "  ПРОВАЛ $3 -> $out, ожидалось $2"; fails=$((fails+1)); fi
}

cd "$S"
: > "$B/.absent"
echo x > data-ym/netting.ndjson;          echo x > "$B/netting.ndjson"
echo services_monthly.ndjson >> "$B/.absent"; echo x > data-ym/services_monthly.ndjson
echo x > data-ym/orders.ndjson

echo "шаг слепка отработал:"
try netting.ndjson          pass  "слепок есть                        "
try services_monthly.ndjson pass  "новый источник, записан как пустой "
try orders.ndjson           block "СЛЕПОК ПОТЕРЯН, записи нет         "
try sku_views.ndjson        pass  "файла нет вовсе                    "

echo "шаг слепка НЕ отработал (.absent отсутствует):"
rm -f "$B/.absent"
try services_monthly.ndjson block "нет .absent, файл есть             "
try netting.ndjson          pass  "нет .absent, но слепок есть        "

rm -rf "$S"
if [ "$fails" -eq 0 ]; then echo "ВСЕ 6 СЛУЧАЕВ СОШЛИСЬ"; else echo "ПРОВАЛОВ: $fails"; exit 1; fi
