#!/usr/bin/env bash
# smoke.sh - воспроизводимый смоук GEO-monster: все 7 экранов рендерятся в headless
# Chromium, гейт без пароля закрыт. Нужен chromium/headless_shell (есть в контейнере
# Claude по /opt/pw-browsers и в GitHub Actions через playwright browsers).
# Запуск: bash gg-seo-geo-monster/scripts/smoke.sh [путь-к-chromium]
set -euo pipefail
cd "$(dirname "$0")/../public"

CH="${1:-}"
if [ -z "$CH" ]; then
  CH=$(find /opt/pw-browsers -name headless_shell -o -name chrome 2>/dev/null | head -1 || true)
fi
[ -x "$CH" ] || { echo "chromium не найден: передай путь аргументом"; exit 2; }

python3 -m http.server 8099 >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
sleep 1

FAIL=0
for route in dash sem geo forge ext reports admin; do
  OUT=$("$CH" --headless=new --disable-gpu --no-sandbox --virtual-time-budget=7000 \
    --dump-dom "http://localhost:8099/?gate=skip#/$route" 2>/dev/null)
  M=$(echo "$OUT" | grep -cE 'class="card|kcol|out-block|plat |badge-demo' || true)
  if [ "$M" -lt 1 ]; then echo "FAIL route=$route (нет контента)"; FAIL=1; else echo "OK   route=$route markers=$M"; fi
done

# гейт: без пароля приложение скрыто
G=$("$CH" --headless=new --disable-gpu --no-sandbox --virtual-time-budget=4000 --dump-dom "http://localhost:8099/" 2>/dev/null)
echo "$G" | grep -q 'id="gateForm"' && echo "$G" | grep -q '<div class="app" id="app" hidden' \
  && echo "OK   gate закрыт без пароля" || { echo "FAIL gate"; FAIL=1; }

# em dash в клиентских файлах
if grep -l "$(printf '—')" app.js forge.js app.css index.html 2>/dev/null; then
  echo "FAIL em dash найден"; FAIL=1
else echo "OK   em dash 0"; fi

exit $FAIL
