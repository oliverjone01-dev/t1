#!/usr/bin/env node
// Отправка сводки Точки (остаток + поступления) в Telegram.
// Читает data/latest.json, шлёт сообщение через Telegram Bot API (sendMessage).
// Секреты (env / GitHub Secrets), в репозиторий/HTML не пишутся:
//   TG_BOT_TOKEN  - токен бота от @BotFather
//   TG_CHAT_ID    - id чата/канала (напр. -100123... для группы, или личный id)
// Необязательно: TG_THREAD_ID (topic id в супергруппе).
"use strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const d = JSON.parse(readFileSync(join(ROOT, "data/latest.json"), "utf8"));

// Псевдонимы счетов: accounts.json = { "последние 4 цифры": "Название" }. Только отображение,
// на банк никак не влияет. Если файла нет или названия нет - показываем тип счёта из API.
let ALIASES = {};
try { ALIASES = JSON.parse(readFileSync(join(ROOT, "accounts.json"), "utf8")); } catch {}

const rub = (v) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
const esc = (s) => String(s ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const fmtDay = (s) => s ? String(s).slice(0, 10).split("-").reverse().join(".") : "-";
// Хвост НОМЕРА СЧЁТА (часть до "/"), а не БИК. accountId в Точке = "{номер}/{БИК}",
// поэтому берём часть до слэша, иначе у всех счетов совпадёт хвост БИК.
const acctTail = (a) => String(a.number || a.accountId || "").split("/")[0].replace(/\D/g, "").slice(-4);
const acctLabel = (a) => {
  const alias = ALIASES[acctTail(a)];
  return String(alias || a.name || "Счёт").trim();
};

function buildMessage() {
  if (d.pending || !d.fetchedAt) {
    return "🏦 <b>Точка Банк</b>\nПайплайн готов, данные ещё не загружены. Добавь доступ и запусти синк.";
  }
  const tag = d.sandbox ? " <i>(песочница)</i>" : "";
  const lines = [];
  lines.push(`🏦 <b>Точка Банк - сводка за ${fmtDay(d.day)}</b>${tag}`);
  lines.push("");
  lines.push(`💰 <b>Остаток по счетам:</b> ${rub(d.balanceTotal)} ₽`);
  for (const a of (d.accounts || [])) {
    lines.push(`   • ${esc(acctLabel(a))} <code>•••${esc(acctTail(a))}</code>: ${rub(a.balance)} ₽`);
  }
  lines.push("");
  const inc = d.incoming || { count: 0, total: 0, items: [] };
  lines.push(`📥 <b>Поступления за день:</b> +${rub(inc.total)} ₽ (${inc.count})`);
  const top = (inc.items || []).slice(0, 10);
  const shortDay = (s) => { const p = String(s || "").slice(0, 10).split("-"); return p.length === 3 && p[0] ? `${p[2]}.${p[1]}` : ""; };
  for (const t of top) {
    const when = shortDay(t.at) ? `${shortDay(t.at)} · ` : "";
    const who = esc(t.counterparty || "Контрагент не указан");
    const purpose = t.purpose ? ` - ${esc(String(t.purpose).slice(0, 90))}` : "";
    lines.push(`   • +${rub(t.amount)} ₽ · ${when}${who}${purpose}`);
  }
  if ((inc.items || []).length > top.length) lines.push(`   …и ещё ${inc.items.length - top.length}`);
  return lines.join("\n");
}

async function main() {
  const token = process.env.TG_BOT_TOKEN, chat = process.env.TG_CHAT_ID;
  const text = buildMessage();
  if (!token || !chat) {
    // Без секретов - только печатаем, что отправили бы (для проверки формата в логах).
    console.log("TG_BOT_TOKEN/TG_CHAT_ID не заданы - сообщение НЕ отправлено. Превью:\n" + text);
    return;
  }
  const body = {
    chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true,
    ...(process.env.TG_THREAD_ID ? { message_thread_id: Number(process.env.TG_THREAD_ID) } : {}),
  };
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.ok) {
    console.error(`::error::Telegram sendMessage: HTTP ${res.status} ${JSON.stringify(j).slice(0, 300)}`);
    process.exit(1);
  }
  console.log(`Отправлено в Telegram (chat ${chat}, message_id ${j.result?.message_id}).`);
}

main().catch(e => { console.error(`::error::notify упал: ${e.message}`); process.exit(1); });
