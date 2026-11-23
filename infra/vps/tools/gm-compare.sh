#!/usr/bin/env bash
# Сверка РОП Glass Memory: rop-gm.json сервера vs ветка rop-gm-dashboard-v1 в зеркале (её пишет GitHub),
# итог в группу алертов. Запуск от gg или root, без аргументов:
#   bash "$(dirname "$(readlink -f /usr/local/bin/gg-job)")/../tools/gm-compare.sh"
# По ID: сделки, лиды, карточки производства - кто только тут/только там; сумма бюджета сделок.
# Снимок GitHub берётся из зеркала, его обновляет gg-poll (раз в несколько минут).
# Оговорка К5: один Bitrix24, один код - проверка переноса сборщика, а не цифр дашборда.
set -uo pipefail
set -a; . /etc/gg/secrets.env; set +a
GG_ROOT=${GG_ROOT:-/srv/gg}
site=$(readlink -f "$GG_ROOT/www/current")
srv="$GG_ROOT/data/rop-gm-dashboard-v1/analytics-mvp/rop/data/rop-gm.json"
t=$(mktemp -d); trap 'rm -rf "$t"' EXIT
nl=$'\n'
msg="📏 Сверка РОП Glass Memory: сервер vs GitHub ($(date -u '+%d.%m %H:%M') UTC)"
if ! git --git-dir="$GG_ROOT/git/t1.git" show "refs/heads/rop-gm-dashboard-v1:analytics-mvp/rop/data/rop-gm.json" >"$t/gh.json" 2>/dev/null; then
  msg+="${nl}⚠️ нет rop-gm.json в ветке GitHub"
elif [ ! -s "$srv" ]; then
  msg+="${nl}⚠️ нет rop-gm.json на сервере (gg-job rop-gm-snapshot)"
else
  msg+="${nl}$(node -e '
    const fs = require("fs");
    const S = JSON.parse(fs.readFileSync(process.argv[1])), G = JSON.parse(fs.readFileSync(process.argv[2]));
    const hm = x => String(x || "?").slice(5, 16).replace("T", " ");
    const fmt = n => n.toLocaleString("ru-RU");
    let out = `снимок сервер ${hm(S.generated_at)} / GitHub ${hm(G.generated_at)} UTC`;
    for (const [k, name] of [["deals", "сделки"], ["leads", "лиды"], ["prodItems", "карточки производства"]]) {
      const s = new Map((S[k] || []).map(x => [String(x.id), x])), g = new Map((G[k] || []).map(x => [String(x.id), x]));
      const onlyS = [...s.keys()].filter(i => !g.has(i)), onlyG = [...g.keys()].filter(i => !s.has(i));
      out += `\n\n${onlyG.length ? "⚠️" : "✅"} ${name}: сервер ${fmt(s.size)} / GitHub ${fmt(g.size)}; только на сервере ${onlyS.length}, только в GitHub ${onlyG.length}` +
        (onlyG.length ? ` (${onlyG.slice(0, 5).join(", ")})` : "");
      if (k === "deals") {
        const sum = m => Math.round([...m.values()].reduce((t, x) => t + (Number(x.budget) || 0), 0));
        const both = [...s.keys()].filter(i => g.has(i));
        const ch = both.filter(i => Number(s.get(i).budget || 0) !== Number(g.get(i).budget || 0)).length;
        out += `\nбюджет сервер ${fmt(sum(s))} / GitHub ${fmt(sum(g))} ₽; изменился у ${ch}`;
      }
    }
    console.log(out);
  ' "$srv" "$t/gh.json" 2>&1)"
fi
if [ -s "$site/rop-gm/index.html" ]; then
  msg+="${nl}${nl}✅ /rop-gm/: $(stat -c%s "$site/rop-gm/index.html") байт, сборка $(cut -c1-16 "$site/rop-gm/v.txt" 2>/dev/null | tr T ' ') UTC"
else
  msg+="${nl}${nl}⚠️ /rop-gm/ на сервере не собран"
fi
msg+="${nl}${nl}Норма: «только в GitHub» = 0; «только на сервере» = созданные между снимками."
printf '%s\n' "$msg"
curl -fsS -m 30 -o /dev/null -X POST "https://api.telegram.org/bot${GG_ALERT_BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${GG_ALERT_CHAT_ID}" --data-urlencode "text=[$(hostname -s)] $msg" \
  && echo "отправлено в группу алертов" || echo "Telegram не принял сообщение"
