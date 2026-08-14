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

// Названия и порядок счетов: accounts.json = { accounts: [ {tail, label}, ... ] }. Только
// отображение, на банк не влияет. Счета не из списка идут после, в порядке банка.
let ACCOUNTS_CFG = [];
try {
  const cfg = JSON.parse(readFileSync(join(ROOT, "accounts.json"), "utf8"));
  ACCOUNTS_CFG = Array.isArray(cfg.accounts) ? cfg.accounts : [];
} catch {}
const labelByTail = new Map(ACCOUNTS_CFG.map(x => [String(x.tail), x.label]));
const orderByTail = new Map(ACCOUNTS_CFG.map((x, i) => [String(x.tail), i]));

const rub = (v) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
const esc = (s) => String(s ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const fmtDay = (s) => s ? String(s).slice(0, 10).split("-").reverse().join(".") : "-";
// Хвост НОМЕРА СЧЁТА (часть до "/"), а не БИК. accountId в Точке = "{номер}/{БИК}",
// поэтому берём часть до слэша, иначе у всех счетов совпадёт хвост БИК.
const acctTail = (a) => String(a.number || a.accountId || "").split("/")[0].replace(/\D/g, "").slice(-4);
const acctLabel = (a) => String(labelByTail.get(acctTail(a)) || a.name || "Счёт").trim();
const acctOrder = (a) => orderByTail.has(acctTail(a)) ? orderByTail.get(acctTail(a)) : 999;

function buildMessage() {
  if (d.pending || !d.fetchedAt) {
    return "🏦 <b>Точка Банк</b>\nПайплайн готов, данные ещё не загружены. Добавь доступ и запусти синк.";
  }
  const tag = d.sandbox ? " <i>(песочница)</i>" : "";
  const lines = [];
  lines.push(`🏦 <b>Точка Банк - сводка за ${fmtDay(d.day)}</b>${tag}`);
  lines.push("");
  lines.push(`💰 <b>Остаток по счетам:</b> ${rub(d.balanceTotal)} ₽`);
  const accountsOrdered = [...(d.accounts || [])].sort((a, b) => acctOrder(a) - acctOrder(b));
  if (accountsOrdered.length) {
    // Таблица в моноширинном блоке: название | счёт | сумма выровнены по колонкам.
    const rows = accountsOrdered.map(a => ({ label: acctLabel(a), tail: acctTail(a), amt: `${rub(a.balance)} ₽` }));
    const lw = Math.max(...rows.map(r => r.label.length));
    const aw = Math.max(...rows.map(r => r.amt.length));
    const table = rows.map(r => `${r.label.padEnd(lw)}  •••${r.tail}  ${r.amt.padStart(aw)}`).join("\n");
    lines.push(`<pre>${esc(table)}</pre>`);
  }
  lines.push("");
  const inc = d.incoming || { count: 0, total: 0, items: [] };
  lines.push(`📥 <b>Поступления за день:</b> +${rub(inc.total)} ₽ (${inc.count})`);
  const top = (inc.items || []).slice(0, 10);
  const shortDay = (s) => {
    s = String(s || "").slice(0, 10);
    if (s.includes("-")) { const p = s.split("-"); return p.length === 3 && p[0] ? `${p[2]}.${p[1]}` : ""; }
    if (s.includes(".")) { const p = s.split("."); return p.length >= 2 ? `${p[0]}.${p[1]}` : ""; }
    return "";
  };
  for (const t of top) {
    // сумма · дата · плательщик - назначение. Плательщика/дату опускаем, если их нет.
    const head = [`+${rub(t.amount)} ₽`];
    if (shortDay(t.at)) head.push(shortDay(t.at));
    if (t.counterparty) head.push(esc(t.counterparty));
    let line = `   • ${head.join(" · ")}`;
    if (t.purpose) line += ` - ${esc(String(t.purpose).slice(0, 90))}`;
    lines.push(line);
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
