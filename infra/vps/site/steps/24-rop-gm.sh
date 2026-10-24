# sections: rop-gm
# Порт шага «Build ROP-GM dashboard (isolated, /rop-gm/)» из deploy-pages.yml.
# Запечённый HTML лежит в данных ветки rop-gm-dashboard-v1 (его пишет задача rop-gm-snapshot).
src="$(gg_src rop-gm-dashboard-v1)/analytics-mvp/public/rop-gm-command.html"
[ -s "$src" ] || gg_die "нет $src"
mkdir -p "$SITE/rop-gm"
cp "$src" "$SITE/rop-gm/index.html"
stamp=$(grep -m1 -o '"bakedAt":"[^"]*"' "$src" | cut -d'"' -f4 || true)
printf '%s' "$stamp" >"$SITE/rop-gm/v.txt"
gg_log "РОП Glass Memory: /rop-gm/, сборка ${stamp:-без штампа}"
