#!/usr/bin/env bash
# Проверка переноса снимков при конфликте push-а в ym-snapshots.yml.
#
# Шаг коммита не мержит снимки построчно (это генерируемые файлы), а переносит свои поверх свежего
# remote. Прежде он делал это заменой каталога целиком - и стирал файлы, которых нет у него.
# checkout берёт КОММИТ ЗАПУСКА, а не голову ветки, поэтому прогон из очереди приходит со старым
# деревом. Живой факт 2026-09-16: прогон 35085836231 впервые собрал акт по стоимости услуг, а
# следующий, 35087166394, снёс services_monthly.ndjson и services_state.json.
set -u
S="$(mktemp -d)"; fails=0
check () { # check <описание> <ожидание: keep|gone> <файл>
  if [ -e "$S/work/data-ym/$3" ]; then got=keep; else got=gone; fi
  if [ "$got" = "$2" ]; then echo "  OK     $1"; else echo "  ПРОВАЛ $1 (ожидалось $2, вышло $got)"; fails=$((fails+1)); fi
}

setup () { # remote уже несёт чужой файл, наше дерево - старое
  rm -rf "$S/work" "$S/keep"
  mkdir -p "$S/work/data-ym" "$S/keep"
  echo "старое" > "$S/work/data-ym/orders.ndjson"      # наше, свежее по содержимому
  echo "чужое"  > "$S/work/data-ym/services.ndjson"    # чужое, пришло с remote при reset
  cp -r "$S/work/data-ym" "$S/keep/"                   # /tmp/ym-keep снят ДО reset
  rm -f "$S/keep/data-ym/services.ndjson"              # у нас этого файла нет
  echo "новое" > "$S/keep/data-ym/orders.ndjson"
}

echo "прежний способ - замена каталога целиком:"
setup
rm -rf "$S/work/data-ym" && cp -r "$S/keep/data-ym" "$S/work/"
check "наш файл обновился        " keep orders.ndjson
check "чужой файл ПОТЕРЯН        " gone services.ndjson
[ "$(cat "$S/work/data-ym/orders.ndjson")" = "новое" ] || { echo "  ПРОВАЛ наш файл не обновился"; fails=$((fails+1)); }

echo "новый способ - наложение:"
setup
cp -r "$S/keep/data-ym/." "$S/work/data-ym/"
check "наш файл обновился        " keep orders.ndjson
check "чужой файл СОХРАНЁН       " keep services.ndjson
if [ "$(cat "$S/work/data-ym/orders.ndjson")" = "новое" ]; then echo "  OK     наше победило по имени"; else echo "  ПРОВАЛ наше не победило"; fails=$((fails+1)); fi
if [ "$(cat "$S/work/data-ym/services.ndjson")" = "чужое" ]; then echo "  OK     чужое не тронуто"; else echo "  ПРОВАЛ чужое испорчено"; fails=$((fails+1)); fi

rm -rf "$S"
if [ "$fails" -eq 0 ]; then echo "ВСЁ СОШЛОСЬ: наложение сохраняет чужие файлы, замена каталога их теряла"; else echo "ПРОВАЛОВ: $fails"; exit 1; fi
