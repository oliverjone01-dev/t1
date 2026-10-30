#!/usr/bin/env bash
# Сверка снимка сервера с веткой данных GitHub (в зеркале) по ID записей, итог в группу алертов.
# Запуск от gg или root, одно слово - что сверять (prod | pto | dialog):
#   bash "$(dirname "$(readlink -f /usr/local/bin/gg-job)")/../tools/data-compare.sh" prod
# Кто только тут / только там, сумма бюджета сделок по записям, время снимков, собран ли раздел.
# Снимок GitHub берётся из зеркала, его обновляет gg-poll. Экономика и Glass Memory - econ-compare.sh, gm-compare.sh.
# Оговорка К5: один Bitrix24, один код - проверка переноса сборщика, а не цифр дашборда.
set -uo pipefail
case "${1:-}" in
  prod) title="Производство"; br=prod-dashboard-v1; file=analytics-mvp/prod/data/prod.json; secs="prod prod2" ;;
  pto)  title="ПТО (смарт «Расчёт»)"; br=pto-dashboard-v1; file=analytics-mvp/pto/data/pto.json; secs="pto" ;;
  dialog) title="Хронология коммуникаций"; br=dialog-export-v1; file=analytics-mvp/dialog/data/dialog.json; secs="dialog" ;;
  *) echo "использование: data-compare.sh prod|pto|dialog" >&2; exit 2 ;;
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
  msg+="${nl}$(node --max-old-space-size=3072 -e '
    const fs = require("fs");
    const S = JSON.parse(fs.readFileSync(process.argv[1])), G = JSON.parse(fs.readFileSync(process.argv[2]));
    const hm = x => String(x || "?").slice(5, 16).replace("T", " ");
    const fmt = n => n.toLocaleString("ru-RU");
    // диалоги: у событий нет id - ключ «время|тип|сделка|лид»; остальные - карточки по id
    const dlg = Array.isArray(S.events);
    const key = x => dlg ? [x.ts, x.type, x.dealId || "", x.leadId || ""].join("|") : String(x.id);
    const s = new Map((dlg ? S.events : S.items || []).map(x => [key(x), x])), g = new Map((dlg ? G.events : G.items || []).map(x => [key(x), x]));
    const onlyS = [...s.keys()].filter(i => !g.has(i)), onlyG = [...g.keys()].filter(i => !s.has(i));
    const both = [...s.keys()].filter(i => g.has(i));
    const stage = dlg ? 0 : both.filter(i => s.get(i).stageCode !== g.get(i).stageCode).length;
    const hmg = x => hm(x.generated_at || x.generatedAt);
    const sum = m => { const seen = new Map(); for (const x of m.values()) if (x.dealId) seen.set(String(x.dealId), Number(x.dealBudget) || 0); return Math.round([...seen.values()].reduce((a, b) => a + b, 0)); };
    if (dlg) {
      console.log(`снимок сервер ${hmg(S)} / GitHub ${hmg(G)} UTC; окно сервер ${S.from} - ${S.to} / GitHub ${G.from} - ${G.to}` +
        `\n\n${onlyG.length ? "⚠️" : "✅"} события: всего сервер ${fmt(S.events.length)} / GitHub ${fmt(G.events.length)}` +
        `\nуникальных (время+тип+сделка+лид) ${fmt(s.size)} / ${fmt(g.size)}; только на сервере ${onlyS.length}, только в GitHub ${onlyG.length}` +
        (onlyG.length ? `\nпример «только в GitHub»: ${onlyG.slice(0, 3).map(k => { const [t, ty, d, l] = k.split("|"); return new Date(Number(t) || t).toISOString().slice(0, 16) + " " + ty + (d ? " сделка " + d : "") + (l ? " лид " + l : ""); }).join("; ")}` : "") +
        `\nсделок в снимке сервер ${fmt(S.dealCount || 0)} / GitHub ${fmt(G.dealCount || 0)}; лидов ${fmt(S.leadCount || 0)} / ${fmt(G.leadCount || 0)}`);
      process.exit(0);
    }
    console.log(`снимок сервер ${hmg(S)} / GitHub ${hmg(G)} UTC` +
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
