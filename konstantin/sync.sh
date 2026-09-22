#!/usr/bin/env bash
# Тянет свежие снимки дашбордов из веток данных в ./data (запускать по cron, напр. каждые 30 мин).
set -e
REPO="${REPO_DIR:-$(pwd)/repo}"
OUT="${DATA_DIR:-$(pwd)/data}"
mkdir -p "$OUT"
if [ ! -d "$REPO/.git" ]; then git clone --no-checkout "${REPO_URL:?укажи REPO_URL}" "$REPO"; fi
git -C "$REPO" fetch --depth=1 origin rop-dashboard-v1 dialog-export-v1
git -C "$REPO" show FETCH_HEAD:analytics-mvp/dialog/data/dialog.json > "$OUT/dialog.json"
git -C "$REPO" fetch --depth=1 origin rop-dashboard-v1
git -C "$REPO" show FETCH_HEAD:analytics-mvp/rop/data/rop.json > "$OUT/rop.json"
echo "снимки обновлены: $(du -h "$OUT/rop.json" | cut -f1) rop · $(du -h "$OUT/dialog.json" | cut -f1) dialog"
