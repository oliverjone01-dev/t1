# sections: pto
# Порт шага «Build PTO dashboard (isolated, /pto/)» из deploy-pages.yml: публичная сборка из git ветки
# pto-dashboard-v1 (данные запечены при коммите). Гейт как в GitHub: если в страницу попали данные
# уровня клиента (ссылки на сделки, менеджер, бюджет) - шаг падает, /pto/ остаётся прошлым.
src="$(gg_src pto-dashboard-v1)/analytics-mvp/public/pto-command.html"
[ -s "$src" ] || gg_die "нет $src"
if grep -qE 'crm/deal/details|"mgr"|"budget"' "$src"; then
  gg_die "в сборке ПТО найдены клиентские поля - публикация отменена"
fi
mkdir -p "$SITE/pto"
cp "$src" "$SITE/pto/index.html"
stamp=$(grep -m1 -o '"bakedAt":"[^"]*"' "$src" | cut -d'"' -f4 || true)
printf '%s' "$stamp" >"$SITE/pto/v.txt"
gg_log "ПТО: /pto/, сборка ${stamp:-без штампа}"
