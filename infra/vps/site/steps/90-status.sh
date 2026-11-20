# sections: status
# Служебная страница /status/: когда и чем закончилась каждая задача, возраст данных,
# какие релизы веток сейчас выкачены. Нужна, чтобы видеть «данные свежие?» без SSH.
mkdir -p "$SITE/status"
now=$(date +%s)
{
  cat <<'HTML'
<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Статус сервера</title><style>
body{font:14px/1.45 system-ui,sans-serif;margin:24px;color:#1b1f24;background:#fff}
table{border-collapse:collapse;width:100%;max-width:980px}td,th{padding:6px 10px;border-bottom:1px solid #e3e6ea;text-align:left}
.ok{color:#1a7f37}.bad{color:#cf222e;font-weight:600}.old{color:#9a6700}code{font-size:12px}
@media(prefers-color-scheme:dark){body{background:#0d1117;color:#e6edf3}td,th{border-color:#30363d}}
</style></head><body>
HTML
  printf '<h1>Статус сервера</h1><p>Сборка сайта: %s UTC</p>\n' "$(date -u '+%d.%m.%Y %H:%M')"
  echo '<h2>Задачи</h2><table><tr><th>Задача</th><th>Ветка</th><th>Итог</th><th>Закончилась</th><th>Длилась</th><th>Данные</th></tr>'
  for f in "$GG_ROOT"/state/jobs/*.json; do
    [ -f "$f" ] || continue
    j=$(cat "$f")
    get() { printf '%s' "$j" | sed -n "s/.*\"$1\":\"\{0,1\}\([^\",}]*\).*/\1/p"; }
    fin=$(get finished); age=$(( (now - $(date -d "$fin" +%s 2>/dev/null || echo "$now")) / 3600 ))
    if [ "$(get ok)" = true ]; then res='<span class="ok">ok</span>'; else res="<span class=\"bad\">упала (код $(get rc))</span>"; fi
    cls=""; [ "$age" -ge 26 ] && cls=' class="old"'
    printf '<tr><td>%s</td><td><code>%s</code></td><td>%s</td><td%s>%s (%s ч назад)</td><td>%s с</td><td>%s</td></tr>\n' \
      "$(get name)" "$(get branch)" "$res" "$cls" "$fin" "$age" "$(get seconds)" "$( [ "$(get changed)" = true ] && echo обновились || echo без изменений)"
  done
  echo '</table><h2>Релизы веток</h2><table><tr><th>Ветка</th><th>Коммит</th></tr>'
  for d in "$GG_ROOT"/src/*/current; do
    [ -e "$d" ] || continue
    printf '<tr><td><code>%s</code></td><td><code>%s</code></td></tr>\n' \
      "$(basename "$(dirname "$d")" | sed 's#__#/#g')" "$(cut -c1-12 "$d/.gg-release-ok" 2>/dev/null)"
  done
  echo '</table></body></html>'
} >"$SITE/status/index.html"
