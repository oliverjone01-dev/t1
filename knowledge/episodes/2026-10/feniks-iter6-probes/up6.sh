#!/bin/bash
# FENIKS iter6: upstream CPO builders (main code, unchanged by the branch) on the committed September xlsx.
# (a) one copy in tools/cpo/raw -> are data/cpo_orders.ndjson and data/cpo_sku_daily.ndjson reproduced byte for byte?
# (b) the same export twice (re-export named to sort first) -> what changes, and does the tab rule (orders set) change?
S=/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad/i6
for c in a b; do
  U="$S/up_$c"; rm -rf "$U"; mkdir -p "$U"
  tar -C "$S/post" --exclude='analytics-mvp/node_modules' --exclude='analytics-mvp/public' -cf - analytics-mvp | tar -C "$U" -xf -
  mkdir -p "$U/analytics-mvp/tools/cpo/raw"
  cp "$U/analytics-mvp/data/raw/ozon-cpo/2026-09_cpo_orders.xlsx" "$U/analytics-mvp/tools/cpo/raw/2026-09_cpo_orders.xlsx"
  if [ "$c" = b ]; then cp "$U/analytics-mvp/data/raw/ozon-cpo/2026-09_cpo_orders.xlsx" "$U/analytics-mvp/tools/cpo/raw/2026-09-reexport.xlsx"; fi
  cd "$U/analytics-mvp" || exit 9
  echo "== case $c"
  python3 tools/orders/build_order_joins.py --cpo-only 2>&1 | tail -2
  python3 tools/cpo/build_cpo_sku_daily.py 2>&1 | tail -2
  for f in cpo_orders.ndjson cpo_sku_daily.ndjson; do
    if cmp -s "$S/post/analytics-mvp/data/$f" "$U/analytics-mvp/data/$f"; then echo "  $f: identical to committed"; else echo "  $f: DIFFERS from committed"; fi
  done
done
