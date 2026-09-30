# Порт .github/workflows/b24-cron.yml (+ b24-snapshots.yml: тот же полный снимок, его ночной слот
# 02:17 UTC входит в это расписание). Выполняется в релизе ветки rop-dashboard-v1, где
# analytics-mvp/rop/data и public/rop-command.html - ссылки на серверные данные.
# Пушей в GitHub и dispatch деплоя больше нет: данные коммитит gg-job в локальный git данных,
# сайт пересобирается сам (site=yes в jobs.conf).
: "${B24_WEBHOOK_URL:?нет B24_WEBHOOK_URL в /etc/gg/secrets.env}"
export B24_PORTAL=${B24_PORTAL:-https://glassmemory.bitrix24.ru}

cd analytics-mvp || exit 1
npx tsx src/scripts/b24/fetch-rop.ts
gg_log "Размер данных: $(du -hL rop/data/rop.json | cut -f1)"
npx tsx src/scripts/b24/build-rop.ts
gg_log "Дашборд: $(du -hL public/rop-command.html | cut -f1)"

# Офис-дашборд (ветка office-dashboard-v1): свежий снимок лидов + план, пересборка.
# Как в GitHub: падение офиса не валит снимок РОПа.
office=$(gg_src office-dashboard-v1)/analytics-mvp
if cp rop/data/rop.json "$office/rop/data/rop.json" \
  && { cp rop/plan/plan.json "$office/rop/plan/plan.json" 2>/dev/null || true; } \
  && (cd "$office" && npx tsx src/scripts/b24/build-office.ts); then
  gg_log "Офис-дашборд пересобран"
else
  gg_warn "офис-дашборд не пересобран (снимок РОПа при этом сохранён)"
fi

# Личные дашборды менеджеров (ветка manager-lakomova): тот же снимок РОПа, /rop-<фамилия>/.
# Кого собираем: ровно список продавцов дашборда РОП (PLAN_MGRS в шаблоне rop-dashboard-v1),
# ЯДИ 30.09: «сколько в РОП, столько и делаем». В GitHub собирались все со сделками (21 на 30.09,
# с уволенными); их страницы остаются на github.io и доступны через прокси до конца переезда.
# Как в GitHub: падение не валит снимок РОПа. Страницы (~12 МБ на менеджера)
# кладём в cache, а не в git данных: их всегда можно пересобрать из rop.json, а git за неделю
# вырос бы на гигабайты. Шаг сайта 22-managers забирает их оттуда.
out="$GG_ROOT/cache/site-managers"
rm -rf "$out.new"; mkdir -p "$out.new"
# gg_src при отсутствии релиза завершает скрипт - проверяем папку сами, чтобы не уронить снимок
mgr="$GG_ROOT/src/manager-lakomova/current/analytics-mvp"
if [ ! -d "$mgr" ]; then
  gg_warn "нет релиза manager-lakomova - дашборды менеджеров пропущены"
elif ! only=$(grep -o 'const PLAN_MGRS=\[[^]]*\]' rop/rop-command.template.html | grep -o '"[^"]*"' | tr -d '"' | paste -sd,) \
  || [ -z "$only" ]; then
  gg_warn "не нашёл список продавцов (PLAN_MGRS) в шаблоне РОПа - дашборды менеджеров пропущены"
elif cp rop/data/rop.json "$mgr/rop/data/rop.json" \
  && (cd "$mgr" && OUT_DIR="$out.new" MIN_DEALS=5 ONLY="$only" node src/scripts/b24/build-managers-all.mjs); then
  gg_log "Продавцы из дашборда РОП: $only"
  built=$(find "$out.new" -mindepth 1 -maxdepth 1 -type d | wc -l); want=$(tr ',' '\n' <<<"$only" | wc -l)
  gg_log "Дашборды менеджеров пересобраны: $built из $want"
  [ "$built" -eq "$want" ] || gg_warn "собрано $built из $want: у кого-то из списка РОПа меньше 5 сделок или сбой сборки"
else
  gg_warn "дашборды менеджеров собраны не все (снимок РОПа при этом сохранён)"
fi
# Публикуем, если собран хоть один; иначе остаются прошлые страницы
if [ -n "$(find "$out.new" -mindepth 1 -maxdepth 1 -type d -print -quit)" ]; then
  rm -rf "$out.old"; [ -d "$out" ] && mv "$out" "$out.old"
  mv "$out.new" "$out"; rm -rf "$out.old"
else
  rm -rf "$out.new"
fi
