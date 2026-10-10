#!/usr/bin/env bash
# Сверка экономики сделок: данные сервера vs данные GitHub (ветка economics-dashboard-v1 в зеркале),
# итог в группу алертов. Запуск от gg или root, без аргументов:
#   bash "$(dirname "$(readlink -f /usr/local/bin/gg-job)")/../tools/econ-compare.sh"
# Снимок GitHub берётся из зеркала, его обновляет gg-poll (раз в несколько минут).
# Сверяет по ID сделок (кто есть только там или только тут), сумму бюджета, время снимков,
# и что страницы /economics/ и /econ-control/ на сервере собраны.
# Оговорка К5: оба снимка из одного Bitrix24 одним кодом - это проверка переноса сборщика,
# а не правильности цифр дашборда. Расхождения из-за разного времени снимков нормальны.
set -uo pipefail
set -a; . /etc/gg/secrets.env; set +a
GG_ROOT=${GG_ROOT:-/srv/gg}
site=$(readlink -f "$GG_ROOT/www/current")
d="$GG_ROOT/data/economics-dashboard-v1/analytics-mvp/economics/data"
t=$(mktemp -d); trap 'rm -rf "$t"' EXIT
nl=$'\n'
msg="📏 Сверка экономики: сервер vs GitHub ($(date -u '+%d.%m %H:%M') UTC)"
for f in econ-recon economics; do
  git --git-dir="$GG_ROOT/git/t1.git" show "refs/heads/economics-dashboard-v1:analytics-mvp/economics/data/$f.json" >"$t/gh.json" 2>/dev/null \
    || { msg+="${nl}⚠️ $f: нет файла в ветке GitHub"; continue; }
  [ -s "$d/$f.json" ] || { msg+="${nl}⚠️ $f: нет файла на сервере"; continue; }
  msg+="${nl}${nl}$(node -e '
    const fs = require("fs");
    const [name, a, b] = process.argv.slice(1);
    const S = JSON.parse(fs.readFileSync(a)), G = JSON.parse(fs.readFileSync(b));
    const ids = j => new Map((j.deals || []).map(x => [String(x.id), x]));
    const s = ids(S), g = ids(G);
    const onlyS = [...s.keys()].filter(k => !g.has(k)), onlyG = [...g.keys()].filter(k => !s.has(k));
    const sum = m => Math.round([...m.values()].reduce((t, x) => t + (Number(x.budget) || 0), 0));
    const both = [...s.keys()].filter(k => g.has(k));
    const budDiff = both.filter(k => Number(s.get(k).budget || 0) !== Number(g.get(k).budget || 0)).length;
    const fmt = n => n.toLocaleString("ru-RU");
    const hm = x => String(x || "?").slice(5, 16).replace("T", " ");
    const ok = onlyG.length === 0 ? "✅" : "⚠️";
    console.log(`${ok} ${name}: снимок сервер ${hm(S.generated_at)} / GitHub ${hm(G.generated_at)} UTC` +
      `\nсделок сервер ${fmt(s.size)} / GitHub ${fmt(g.size)}; только на сервере ${onlyS.length}, только в GitHub ${onlyG.length}` +
      (onlyG.length ? ` (${onlyG.slice(0, 5).join(", ")})` : "") +
      `\nбюджет сервер ${fmt(sum(s))} / GitHub ${fmt(sum(g))} ₽; бюджет изменился у ${budDiff}`);
  ' "$f" "$d/$f.json" "$t/gh.json" 2>&1)"
done
msg+="${nl}"
for s in economics econ-control; do
  if [ -s "$site/$s/index.html" ]; then
    msg+="${nl}✅ /$s/: $(stat -c%s "$site/$s/index.html") байт, сборка $(cut -c1-16 "$site/$s/v.txt" 2>/dev/null | tr T ' ') UTC"
  else
    msg+="${nl}⚠️ /$s/ на сервере не собран (gg-job econ-recon)"
  fi
done
[ -s "$site/economics/layers.html" ] && msg+="${nl}✅ /economics/layers.html: $(stat -c%s "$site/economics/layers.html") байт" \
  || msg+="${nl}⚠️ /economics/layers.html не собран (gg-job economics-snapshot)"
msg+="${nl}${nl}Норма: «только в GitHub» = 0; «только на сервере» = сделки, созданные между снимками."
printf '%s\n' "$msg"
curl -fsS -m 30 -o /dev/null -X POST "https://api.telegram.org/bot${GG_ALERT_BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${GG_ALERT_CHAT_ID}" --data-urlencode "text=[$(hostname -s)] $msg" \
  && echo "отправлено в группу алертов" || echo "Telegram не принял сообщение"
