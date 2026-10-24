# Порт .github/workflows/econ-recon.yml: разведка связей сделка <-> СП <-> поля денег по окну сделок
# (econ-recon.json + история econ-control-history.json) и экран «Контроль заполнения»
# (public/econ-control.html, на сайте главная /economics/ и /econ-control/).
# В GitHub по ручному запуску дополнительно выгружались база дизайнеров (designers.json) и полная
# карта полей (field-map.json). Здесь то же по ECON_FULL=1:  ECON_FULL=1 gg-job econ-recon
# Их падение, как в GitHub (continue-on-error), разведку не валит.
: "${B24_WEBHOOK_URL:?нет B24_WEBHOOK_URL в /etc/gg/secrets.env}"
export B24_PORTAL=${B24_PORTAL:-https://glassmemory.bitrix24.ru}
export ECON_WINDOW_DAYS=${ECON_WINDOW_DAYS:-60}

cd analytics-mvp || exit 1
if [ "${ECON_FULL:-}" = 1 ]; then
  if npx tsx src/scripts/b24/designers.ts; then
    gg_log "База дизайнеров: $(du -hL economics/data/designers.json | cut -f1)"
  else
    gg_warn "база дизайнеров не выгружена (разведка продолжается)"
  fi
fi
npx tsx src/scripts/b24/econ-recon.ts
gg_log "Размер JSON: $(du -hL economics/data/econ-recon.json | cut -f1)"
if [ "${ECON_FULL:-}" = 1 ]; then
  if FIELDMAP_SINCE=2026-01-01 npx tsx src/scripts/b24/field-map.ts; then
    gg_log "Карта полей: $(du -hL economics/data/field-map.json | cut -f1)"
  else
    gg_warn "карта полей не выгружена (разведка продолжается)"
  fi
fi
node economics/build-econ-control.mjs
gg_log "Экран: $(du -hL public/econ-control.html | cut -f1)"
