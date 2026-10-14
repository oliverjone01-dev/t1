#!/bin/bash
# FENIKS iter6: copy pre/post sandboxes without node_modules, mutate CPO inputs identically, build both, compare pages.
S=/tmp/claude-0/-home-user-t1/14242375-b0a2-5b30-b172-6a38ff5cb418/scratchpad/i6
rm -rf "$S/fzpre" "$S/fzpost"
for x in pre post; do
  mkdir -p "$S/fz$x"
  tar -C "$S/$x" --exclude='analytics-mvp/node_modules' -cf - analytics-mvp | tar -C "$S/fz$x" -xf -
  ln -s /home/user/t1/analytics-mvp/node_modules "$S/fz$x/analytics-mvp/node_modules"
done
python3 "$S/fuzz6.py" fzpre fzpost
for f in orders_daily.ndjson cpo_orders.ndjson cpo_sku_daily.ndjson; do
  cmp "$S/fzpre/analytics-mvp/data/$f" "$S/fzpost/analytics-mvp/data/$f" && echo "inputs identical: $f"
done
for s in fzpre fzpost; do bash "$S/build6.sh" $s; done
python3 "$S/bytecmp6.py" fzpre fzpost 2>&1 | head -5 | cut -c1-300
