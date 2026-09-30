# sections: rop rop2
# Порт шага «Build ROP dashboard (isolated, /rop/)» из deploy-pages.yml.
# Запечённый HTML лежит в данных ветки rop-dashboard-v1 (его пишет задача rop-snapshot).
src="$(gg_src rop-dashboard-v1)/analytics-mvp/public/rop-command.html"
[ -s "$src" ] || gg_die "нет $src"
mkdir -p "$SITE/rop" "$SITE/rop2"
cp "$src" "$SITE/rop/index.html"
# /rop2/ - зеркало для обхода упрямых кэшей (прокси/CDN, игнорирующих query string)
cp "$src" "$SITE/rop2/index.html"
# v.txt = штамп сборки: страница сверяет его со своим DATA.bakedAt и перезагружается сама
stamp=$(grep -m1 -o '"bakedAt":"[^"]*"' "$src" | cut -d'"' -f4 || true)
printf '%s' "$stamp" | tee "$SITE/rop/v.txt" >"$SITE/rop2/v.txt"
gg_log "РОП: /rop/ и /rop2/, сборка ${stamp:-без штампа}"
