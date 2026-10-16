#!/usr/bin/env bash
# Пробы ФЕНИКСА к фиксу гейта «OZON байт-в-байт» (ветка claude/ym-ozon-gate-resnap, аудит 15.10.2026,
# отчёт knowledge/episodes/2026-10/feniks-audit-ym-ozon-gate-resnap-20261015.md).
# Харнесс исполняет НАСТОЯЩИЕ шаги ym-snapshots.yml (yaml.safe_load из ревизии), строкой вызова GitHub
# для `shell: bash`: bash --noprofile --norc -eo pipefail. До фикса - 9a3a212 (origin/main), после - bc7096b.
# Запуск из корня репозитория: bash knowledge/episodes/2026-10/feniks-probes-ym-ozon-gate-resnap/run_all.sh
set -u
D="$(cd "$(dirname "$0")" && pwd)"
OUT="$(mktemp -d)"
export HARNESS_DIR="$OUT"
for rev in 9a3a212 ${REV_AFTER:-bc7096b}; do
  python3 -I "$D/yml_gate_harness.py" "$rev" all > "$OUT/res_$rev.jsonl" || { echo "харнесс упал на $rev"; exit 1; }
done
python3 -I - "$OUT" <<'PY'
import json, sys
out = sys.argv[1]
rows = {}
for rev in ("9a3a212", __import__("os").environ.get("REV_AFTER", "bc7096b")):
    for line in open(f"{out}/res_{rev}.jsonl"):
        d = json.loads(line); rows.setdefault(d["scenario"], {})[rev] = d
cell = lambda d: f"inter_rc={d['inter_rc']} push/fetch/reset={d['push_calls']}/{d['fetch_calls']}/{d['reset_calls']} gate={d['gate'][:4]}"
print(f"{'сценарий':30} | {'до фикса 9a3a212':44} | {'после фикса bc7096b':44} | data-ym на remote")
for sc, v in rows.items():
    print(f"{sc:30} | {cell(v['9a3a212']):44} | {cell(v[__import__("os").environ.get("REV_AFTER", "bc7096b")]):44} | {v[__import__("os").environ.get("REV_AFTER", "bc7096b")]['remote_main']['data-ym/orders.ndjson']}")
PY
echo "песочницы: $OUT"
