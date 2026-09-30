# sections-from: .gg/managers.txt
# Порт шага «Build MANAGER dashboards (isolated, /rop-<surname>/)» из deploy-pages.yml.
# Страницы собирает задача rop-snapshot в cache/site-managers (по одной папке rop-<фамилия>).
# Список разделов пишем в .gg/managers.txt: если шаг упадёт, build.sh перенесёт эти разделы
# из прошлой сборки (ростер меняется сам, поэтому списком, а не строкой «# sections:»).
src="$GG_ROOT/cache/site-managers"
[ -d "$src" ] || gg_die "нет $src (задача rop-snapshot ещё не собирала дашборды менеджеров)"
mkdir -p "$SITE/.gg"
n=0
: >"$SITE/.gg/managers.txt"
for d in "$src"/rop-*/; do
  s=$(basename "$d")
  [ -s "$d/index.html" ] || continue
  cp -al "$d" "$SITE/$s"   # жёсткие ссылки: 25 страниц по ~12 МБ не копируются на каждую сборку
  printf '%s\n' "$s" >>"$SITE/.gg/managers.txt"
  n=$((n + 1))
done
[ "$n" -gt 0 ] || gg_die "в $src нет ни одной страницы менеджера"
gg_log "Менеджеры: $n разделов /rop-<фамилия>/"
