# sections: prod prod2
# Порт шага «Build PROD dashboard (isolated, /prod/)» из deploy-pages.yml.
# Запечённый HTML лежит в данных ветки prod-dashboard-v1 (его пишет задача prod-snapshot).
src="$(gg_src prod-dashboard-v1)/analytics-mvp/public/prod-command.html"
[ -s "$src" ] || gg_die "нет $src"
mkdir -p "$SITE/prod" "$SITE/prod2"
cp "$src" "$SITE/prod/index.html"
# /prod2/ - зеркало для обхода упрямых кэшей
cp "$src" "$SITE/prod2/index.html"
stamp=$(grep -m1 -o '"bakedAt":"[^"]*"' "$src" | cut -d'"' -f4 || true)
printf '%s' "$stamp" | tee "$SITE/prod/v.txt" >"$SITE/prod2/v.txt"
gg_log "Производство: /prod/ и /prod2/, сборка ${stamp:-без штампа}"
