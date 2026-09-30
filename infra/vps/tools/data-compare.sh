#!/usr/bin/env bash
# Сверка снимка сервера с веткой данных GitHub (в зеркале) по ID записей, итог в группу алертов.
# Запуск от gg или root, одно слово - что сверять (prod | pto):
#   bash "$(dirname "$(readlink -f /usr/local/bin/gg-job)")/../tools/data-compare.sh" prod
# Кто только тут / только там, сумма бюджета сделок по записям, время снимков, собран ли раздел.
# Снимок GitHub берётся из зеркала, его обновляет gg-poll. Экономика и Glass Memory - econ-compare.sh, gm-compare.sh.
# Оговорка К5: один Bitrix24, один код - проверка переноса сборщика, а не цифр дашборда.
set -uo pipefail
case "${1:-}" in
  prod) title="Производство"; br=prod-dashboard-v1; file=analytics-mvp/prod/data/prod.json; secs="prod prod2" ;;
  pto)  title="ПТО (смарт «Расчёт»)"; br=pto-dashboard-v1; file=analytics-mvp/pto/data/pto.json; secs="pto" ;;
  *) echo "использование: data-compare.sh prod|pto" >&2; exit 2 ;;
esac
set -a; . /etc/gg/secrets.env; set +a
GG_ROOT=${GG_ROOT:-/srv/gg}
site=$(readlink -f "$GG_ROOT/www/current")
srv="$GG_ROOT/data/$br/$file"
t=$(mktemp -d); trap 'rm -rf "$t"' EXIT
nl=$'\n'
msg="📏 Сверка «$title»: сервер vs GitHub ($(date -u '+%d.%m %H:%M') UTC)"
if ! git --git-dir="$GG_ROOT/git/t1.git" show "refs/heads/$br:$file" >"$t/gh.json" 2>/dev/null; then
  msg+="${nl}⚠️ нет $file в ветке GitHub"
elif [ ! -s "$srv" ]; then
  msg+="${nl}⚠️ нет снимка на сервере (gg-job ${1}-snapshot)"
else
  msg+="${nl}$(node -e '
    const fs = require("fs");
    const S = JSON.parse(fs.readFileSync(process.argv[1])), G = JSON.parse(fs.readFileSync(process.argv[2]));
    const hm = x => String(x || "?").slice(5, 16).replace("T", " ");
    const fmt = n => n.toLocaleString("ru-RU");
    const s = new Map((S.items || []).map(x => [String(x.id), x])), g = new Map((G.items || []).map(x => [String(x.id), x]));
    const onlyS = [...s.keys()].filter(i => !g.has(i)), onlyG = [...g.keys()].filter(i => !s.has(i));
    const both = [...s.keys()].filter(i => g.has(i));
    const stage = both.filter(i => s.get(i).stageCode !== g.get(i).stageCode).length;
    const sum = m => { const seen = new Map(); for (const x of m.values()) if (x.dealId) seen.set(String(x.dealId), Number(x.dealBudget) || 0); return Math.round([...seen.values()].reduce((a, b) => a + b, 0)); };
    console.log(`снимок сервер ${hm(S.generated_at)} / GitHub ${hm(G.generated_at)} UTC` +
      `\n\n${onlyG.length ? "⚠️" : "✅"} карточки: сервер ${fmt(s.size)} / GitHub ${fmt(g.size)}; только на сервере ${onlyS.length}, только в GitHub ${onlyG.length}` +
      (onlyG.length ? ` (${onlyG.slice(0, 5).join(", ")})` : "") +
      `\nстадия изменилась у ${stage}` +
      `\nбюджет сделок (каждая сделка один раз) сервер ${fmt(sum(s))} / GitHub ${fmt(sum(g))} ₽`);
  ' "$srv" "$t/gh.json" 2>&1)"
fi
msg+="${nl}"
for s in $secs; do
  if [ -s "$site/$s/index.html" ]; then
    msg+="${nl}✅ /$s/: $(stat -c%s "$site/$s/index.html") байт, сборка $(cut -c1-16 "$site/$s/v.txt" 2>/dev/null | tr T ' ') UTC"
  else
    msg+="${nl}⚠️ /$s/ на сервере не собран"
  fi
done
msg+="${nl}${nl}Норма: «только в GitHub» = 0; «только на сервере» = созданные между снимками."
printf '%s\n' "$msg"
curl -fsS -m 30 -o /dev/null -X POST "https://api.telegram.org/bot${GG_ALERT_BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${GG_ALERT_CHAT_ID}" --data-urlencode "text=[$(hostname -s)] $msg" \
  && echo "отправлено в группу алертов" || echo "Telegram не принял сообщение"
