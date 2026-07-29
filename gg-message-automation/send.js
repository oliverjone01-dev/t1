#!/usr/bin/env node
// Референс-отправщик для планировщика GG Message Automation.
// Читает schedule.json (выгружен из панели /messages/), берёт правила, чей cron
// совпадает с текущей минутой (UTC), и отправляет в чат через секрет из env.
// Секреты НЕ в репозитории: TG_BOT_TOKEN, B24_WEBHOOK_URL задаются в окружении.
//
// Запуск:  node gg-message-automation/send.js schedule.json
// В cron-воркфлоу дёргается по расписанию; сам файл секретов не содержит.
"use strict";

const fs = require("fs");

function cronMatch(expr, d) {
  // Минимальный матчер 5 полей: поддержка *, */N, списков "a,b", диапазонов "a-b".
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const vals = [d.getUTCMinutes(), d.getUTCHours(), d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCDay()];
  return fields.every((f, i) => {
    if (f === "*") return true;
    const v = vals[i];
    return f.split(",").some(part => {
      const step = part.match(/^\*\/(\d+)$/);
      if (step) return v % Number(step[1]) === 0;
      const range = part.match(/^(\d+)-(\d+)$/);
      if (range) return v >= +range[1] && v <= +range[2];
      return Number(part) === v;
    });
  });
}

async function sendTelegram(rule) {
  const token = process.env.TG_BOT_TOKEN;
  if (!token) throw new Error("TG_BOT_TOKEN не задан");
  // chat_id формата "$TG_BOT_TOKEN:-100..." -> берём хвост после первого ":"
  const chatId = String(rule.payload.chat_id).split(":").slice(1).join(":") || rule.payload.chat_id;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: rule.text, parse_mode: "HTML" }),
  });
  return res.ok;
}

async function sendBitrix(rule) {
  const hook = process.env.B24_WEBHOOK_URL;
  if (!hook) throw new Error("B24_WEBHOOK_URL не задан");
  const res = await fetch(`${hook.replace(/\/$/, "")}/imbot.message.add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ DIALOG_ID: rule.payload.DIALOG_ID, MESSAGE: rule.payload.MESSAGE || rule.text }),
  });
  return res.ok;
}

async function main() {
  const file = process.argv[2] || "schedule.json";
  const { rules = [] } = JSON.parse(fs.readFileSync(file, "utf8"));
  const now = new Date();
  const due = rules.filter(r => cronMatch(r.cron, now));
  if (!due.length) {
    console.log(`Нет правил на ${now.toISOString()} (всего ${rules.length})`);
    return;
  }
  for (const rule of due) {
    try {
      const ok = rule.platform === "telegram" ? await sendTelegram(rule) : await sendBitrix(rule);
      console.log(`${ok ? "OK" : "FAIL"} · ${rule.id} → ${rule.channel}`);
    } catch (e) {
      console.error(`ERROR · ${rule.id}: ${e.message}`);
      process.exitCode = 1;
    }
  }
}

main();
