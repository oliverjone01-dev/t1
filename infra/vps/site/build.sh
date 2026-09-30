#!/usr/bin/env bash
# Сборка сайта: выполняет site/steps/*.sh по порядку, каждый шаг изолирован (как continue-on-error
# в deploy-pages.yml). Отличие от GitHub: если шаг упал, его разделы (строка «# sections: ...» в
# шапке шага) переносятся из прошлой сборки - дашборд не пропадает с сайта, а остаётся вчерашним.
# Для разделов, которых заранее не знаем (менеджеры): «# sections-from: <файл со списком в сайте>».
# Шаг получает: SITE (куда класть файлы), функцию gg_src <ветка> (путь к релизу ветки с данными).
set -uo pipefail
. "$(dirname "$(readlink -f "$0")")/../lib/gg.sh"

SITE=${GG_SITE_OUT:?}
PREV=${GG_SITE_PREV:-}
export SITE
ok=0; fail=0; failed=()

for step in "$GG_OPS"/site/steps/*.sh; do
  name=$(basename "$step" .sh)
  if ( set -euo pipefail; . "$GG_OPS/lib/gg.sh"; . "$step" ) >"$SITE/.step-$name.log" 2>&1; then
    ok=$((ok + 1)); gg_log "шаг $name: ok"
  else
    fail=$((fail + 1)); failed+=("$name")
    gg_warn "шаг $name упал, хвост лога:"; tail -n 20 "$SITE/.step-$name.log" >&2
    for s in $(sed -n '/^# sections:/{s/^# sections:[[:space:]]*//p;q}' "$step"); do
      if [ -n "$PREV" ] && [ -d "$PREV/$s" ]; then
        rm -rf "${SITE:?}/$s"; cp -al "$PREV/$s" "$SITE/$s"
        gg_warn "раздел /$s/ взят из прошлой сборки"
      fi
    done
    # «# sections-from: <файл>» - разделы по списку из прошлой сборки (ростер, меняется сам)
    lst=$(sed -n '/^# sections-from:/{s/^# sections-from:[[:space:]]*//p;q}' "$step")
    if [ -n "$lst" ] && [ -n "$PREV" ] && [ -f "$PREV/$lst" ]; then
      while read -r s; do
        case "$s" in ''|*/*|.*) continue ;; esac
        [ -d "$PREV/$s" ] || continue
        rm -rf "${SITE:?}/$s"; cp -al "$PREV/$s" "$SITE/$s"
      done <"$PREV/$lst"
      mkdir -p "$(dirname "$SITE/$lst")"; cp "$PREV/$lst" "$SITE/$lst"
      gg_warn "разделы по списку $lst взяты из прошлой сборки"
    fi
  fi
done

mkdir -p "$SITE/.gg"
mv "$SITE"/.step-*.log "$SITE/.gg/" 2>/dev/null || true
printf '{"built":"%s","ok":%d,"failed":%d,"failed_steps":"%s"}\n' \
  "$(date -u +%FT%TZ)" "$ok" "$fail" "${failed[*]:-}" >"$SITE/.gg/build.json"
gg_log "сайт собран: шагов ok=$ok, упало=$fail ${failed[*]:-}"
[ "$ok" -gt 0 ]
