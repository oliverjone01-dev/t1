# sections: office
# Порт шага «Build OFFICE dashboard (isolated, /office/)» из deploy-pages.yml.
src="$(gg_src office-dashboard-v1)/analytics-mvp/public/office-command.html"
[ -s "$src" ] || gg_die "нет $src"
mkdir -p "$SITE/office"
cp "$src" "$SITE/office/index.html"
stamp=$(grep -m1 -o '"bakedAt":"[^"]*"' "$src" | cut -d'"' -f4 || true)
printf '%s' "$stamp" >"$SITE/office/v.txt"
gg_log "Офис: /office/, сборка ${stamp:-без штампа}"
