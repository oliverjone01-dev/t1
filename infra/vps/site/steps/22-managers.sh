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
# Строка списка: «слаг<TAB>имя» (имя берёт сводка в Telegram). Без roster.tsv - только слаги.
for d in "$src"/rop-*/; do
  s=$(basename "$d")
  [ -s "$d/index.html" ] || continue
  cp -al "$d" "$SITE/$s"   # жёсткие ссылки: страницы по ~5 МБ не копируются на каждую сборку
  name=$(awk -F'\t' -v s="$s" '$1==s{print $2; exit}' "$src/roster.tsv" 2>/dev/null || true)
  printf '%s\t%s\n' "$s" "$name" >>"$SITE/.gg/managers.txt"
  n=$((n + 1))
done
# кого из списка РОПа нет (меньше 5 сделок или сбой сборки) - для сводки
awk -F'\t' '$1=="-"{print $2}' "$src/roster.tsv" 2>/dev/null >"$SITE/.gg/managers-missing.txt" || true
[ "$n" -gt 0 ] || gg_die "в $src нет ни одной страницы менеджера"
gg_log "Менеджеры: $n разделов /rop-<фамилия>/"
