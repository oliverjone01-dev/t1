# sections: economics econ-control
# Порт шага «Build ECONOMICS dashboard (isolated, /economics/)» из deploy-pages.yml.
# Главная /economics/ = экран «Контроль заполнения» (решение Ивана 25.08), он же /econ-control/.
# Старый слоевой дашборд - скрытый запасной /economics/layers.html.
# Данные пишут задачи econ-recon (экран) и economics-snapshot (слоевой).
pub="$(gg_src economics-dashboard-v1)/analytics-mvp/public"
[ -s "$pub/econ-control.html" ] || gg_die "нет $pub/econ-control.html (запусти gg-job econ-recon)"
mkdir -p "$SITE/economics" "$SITE/econ-control"
cp "$pub/econ-control.html" "$SITE/economics/index.html"
cp "$pub/econ-control.html" "$SITE/econ-control/index.html"
# v.txt = bakedAt экрана: страница сверяет его со своим и перезагружается сама (как РОП)
stamp=$(grep -m1 -o '"bakedAt":"[^"]*"' "$pub/econ-control.html" | cut -d'"' -f4 || true)
printf '%s' "$stamp" | tee "$SITE/economics/v.txt" >"$SITE/econ-control/v.txt"
gg_log "Экономика: /economics/ и /econ-control/, сборка ${stamp:-без штампа}"
if [ -s "$pub/economics-command.html" ]; then
  cp "$pub/economics-command.html" "$SITE/economics/layers.html"
  gg_log "Слоевой дашборд: /economics/layers.html"
else
  gg_warn "public/economics-command.html ещё не запечён - без layers.html"
fi
