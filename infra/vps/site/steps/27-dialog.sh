# sections: dialog
# Порт шага «Build DIALOG page (isolated, /dialog/)» из deploy-pages.yml. Страницу (~100 МБ) печёт задача
# dialog-snapshot. Сайт пересобирается после каждой задачи, поэтому неизменную страницу не копируем,
# а берём жёсткой ссылкой из прошлой сборки (сборки сайта не меняются после публикации).
src="$(gg_src dialog-export-v1)/analytics-mvp/public/dialog.html"
[ -s "$src" ] || gg_die "нет $src"
stamp=$(grep -m1 -o 'const BAKED_AT = "[^"]*"' "$src" | cut -d'"' -f2 || true)
mkdir -p "$SITE/dialog"
prev="${GG_SITE_PREV:-}/dialog"
if [ -n "${GG_SITE_PREV:-}" ] && [ -n "$stamp" ] && [ "$(cat "$prev/v.txt" 2>/dev/null)" = "$stamp" ] \
  && [ "$(stat -c%s "$prev/index.html" 2>/dev/null)" = "$(stat -Lc%s "$src")" ]; then
  ln "$prev/index.html" "$SITE/dialog/index.html"
  gg_log "Диалоги: /dialog/ без изменений, сборка $stamp (ссылка на прошлую)"
else
  cp "$src" "$SITE/dialog/index.html"
  gg_log "Диалоги: /dialog/, сборка ${stamp:-без штампа} ($(du -h "$SITE/dialog/index.html" | cut -f1))"
fi
printf '%s' "$stamp" >"$SITE/dialog/v.txt"
