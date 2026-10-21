cd "$GITHUB_WORKSPACE"
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add analytics-mvp/data/orders_daily.ndjson analytics-mvp/data/orders_accrual_types.json analytics-mvp/data/pnl_sku_accrual_daily.ndjson analytics-mvp/data/acq_sku_daily.ndjson analytics-mvp/data/buyer_delivery_daily.ndjson analytics-mvp/data/buyer_delivery_orders.ndjson analytics-mvp/data/partner_daily.ndjson analytics-mvp/data/partner_orders.ndjson analytics-mvp/data/pnl_channel_accrual_daily.ndjson analytics-mvp/data/pnl_account_accrual_daily.ndjson analytics-mvp/data/coinv_calibration.json analytics-mvp/data/realization_monthly.ndjson analytics-mvp/data/pnl_account_accrual_types.json analytics-mvp/data/realization_daily.ndjson
# Финансовые collectors пишут through/loaded_at только после успешной записи данных.
# Все три могли завершиться ошибкой: тогда файла в старом checkout ещё нет.
if [ -f analytics-mvp/data/collector_status.json ]; then
  git add analytics-mvp/data/collector_status.json
fi
