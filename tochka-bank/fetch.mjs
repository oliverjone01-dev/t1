#!/usr/bin/env node
// ============================================================================
// Точка Банк - ежедневный синк: остаток по расчётным счетам + поступления за день.
// Паттерн yandex-direct/dashboard/make-snapshots.mjs: API -> JSON-снимок в data/.
// Read-only: только чтение счетов и выписки, никаких платежей/мутаций.
//
// Секреты (GitHub Secrets / env), в клиентский HTML НЕ попадают:
//   TOCHKA_TOKEN            - Bearer access-token (JWT), выпущен в ЛК Точки. Режим A.
//   -- ИЛИ авто-рефреш (Режим B), если статический токен живёт 24ч и синк ежедневный:
//   TOCHKA_REFRESH_TOKEN    - refresh-token (живёт 30 дней)
//   TOCHKA_CLIENT_ID        - client_id приложения (ЛК -> Интеграции)
//   TOCHKA_CLIENT_SECRET    - client_secret приложения
//   -- необязательные:
//   TOCHKA_CUSTOMER_CODE    - код клиента (фильтр счетов, если их несколько владельцев)
//   TOCHKA_ACCOUNT_FILTER   - подстрока accountId/номера, оставить только нужные р/с
//   TOCHKA_API_BASE         - по умолчанию https://enter.tochka.com/uapi
//   TOCHKA_API_VERSION      - по умолчанию v1.0 (Open Banking)
//   TOCHKA_TOKEN_URL        - по умолчанию https://enter.tochka.com/connect/token
//
// Выход: tochka-bank/data/latest.json + дописывает day в data/history.ndjson.
// ============================================================================
"use strict";
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA = join(ROOT, "data");
if (!existsSync(DATA)) mkdirSync(DATA, { recursive: true });

const CFG = {
  base: (process.env.TOCHKA_API_BASE || "https://enter.tochka.com/uapi").replace(/\/$/, ""),
  ver: process.env.TOCHKA_API_VERSION || "v1.0",
  tokenUrl: process.env.TOCHKA_TOKEN_URL || "https://enter.tochka.com/connect/token",
  customerCode: process.env.TOCHKA_CUSTOMER_CODE || "",
  accFilter: process.env.TOCHKA_ACCOUNT_FILTER || "",
};
const ob = p => `${CFG.base}/open-banking/${CFG.ver}${p}`;

// ---- utils ------------------------------------------------------------------
function todayUTC(offsetDays = 0) {
  // Дата в МСК (UTC+3) - банковский операционный день считаем по Москве.
  const d = new Date(Date.now() + 3 * 3600e3 + offsetDays * 86400e3);
  return d.toISOString().slice(0, 10);
}
const money = (v) => Number(v || 0);
const first = (...xs) => xs.find(x => x !== undefined && x !== null);

async function api(url, { method = "GET", token, body, timeoutMs = 30000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json; try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    if (!res.ok) {
      const err = new Error(`Tochka ${method} ${url} -> HTTP ${res.status}: ${text.slice(0, 400)}`);
      err.status = res.status; err.body = json;
      throw err;
    }
    return json;
  } finally { clearTimeout(t); }
}

// ---- auth -------------------------------------------------------------------
async function getToken() {
  // Режим B: авто-рефреш (для ежедневного headless-крона, access живёт ~24ч).
  if (process.env.TOCHKA_REFRESH_TOKEN && process.env.TOCHKA_CLIENT_ID && process.env.TOCHKA_CLIENT_SECRET) {
    const form = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.TOCHKA_REFRESH_TOKEN,
      client_id: process.env.TOCHKA_CLIENT_ID,
      client_secret: process.env.TOCHKA_CLIENT_SECRET,
    });
    const res = await fetch(CFG.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: form.toString(),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.access_token) {
      throw new Error(`Рефреш токена не удался: HTTP ${res.status} ${JSON.stringify(j).slice(0, 300)}`);
    }
    // Новый refresh_token (если ротируется) печатаем в лог-маску, чтобы владелец обновил секрет.
    if (j.refresh_token && j.refresh_token !== process.env.TOCHKA_REFRESH_TOKEN) {
      console.log("::warning::Точка выдала новый refresh_token - обнови секрет TOCHKA_REFRESH_TOKEN (значение в маске).");
      console.log(`::add-mask::${j.refresh_token}`);
    }
    return j.access_token;
  }
  // Режим A: статический токен.
  if (process.env.TOCHKA_TOKEN) return process.env.TOCHKA_TOKEN;
  throw new Error("Нет доступа к API: задай TOCHKA_TOKEN, либо TOCHKA_REFRESH_TOKEN + TOCHKA_CLIENT_ID + TOCHKA_CLIENT_SECRET.");
}

// ---- data extraction (Open Banking envelope: { Data: { ... } }) -------------
function extractAccounts(json) {
  const arr = first(json?.Data?.Account, json?.Data?.accounts, json?.accounts, []) || [];
  return arr.map(a => ({
    accountId: first(a.accountId, a.account_id, a.id),
    number: first(a.accountNumber, a.account_number, a.number, ""),
    currency: first(a.currency, a.Currency, "RUB"),
    name: first(a.nickname, a.name, a.accountType, "Расчётный счёт"),
    type: first(a.accountType, a.type, ""),
  })).filter(a => a.accountId);
}

function extractBalance(json, accountId) {
  const arr = first(json?.Data?.Balance, json?.Data?.balances, json?.balances, []) || [];
  // Берём актуальный доступный/закрывающий остаток. Приоритет: ClosingAvailable / Available / Expected.
  const pick = arr.find(b => /available|closingavailable|expected|interimavailable/i.test(String(first(b.type, b.balanceType, "")))) || arr[0] || {};
  const amt = first(pick.amount, pick.Amount, {});
  return {
    accountId,
    amount: money(first(amt.amount, amt.value, pick.value, 0)),
    currency: first(amt.currency, pick.currency, "RUB"),
    type: first(pick.type, pick.balanceType, ""),
    at: first(pick.dateTime, pick.date, ""),
  };
}

function extractTransactions(json) {
  // Выписка может прийти как { Data: { Statement: [ { Transaction:[...] } ] } } или { Data:{ Transaction:[...] } }.
  const st = first(json?.Data?.Statement, []) || [];
  let txns = first(json?.Data?.Transaction, json?.transactions, []) || [];
  if (!txns.length && Array.isArray(st)) txns = st.flatMap(s => first(s.Transaction, s.transactions, []) || []);
  const statusOf = Array.isArray(st) && st[0] ? first(st[0].status, st[0].Status, "") : first(json?.Data?.status, "");
  return { status: statusOf, txns };
}

function isCredit(t) {
  const ind = String(first(t.creditDebitIndicator, t.credit_debit_indicator, t.direction, "")).toLowerCase();
  return ind.includes("credit") || ind === "приход" || ind === "in";
}
function txnAmount(t) {
  const amt = first(t.amount, t.Amount, {});
  return money(first(amt.amount, amt.value, t.value, 0));
}
function txnMeta(t) {
  const cp = first(t.counterParty, t.counterparty, t.CreditorAccount, t.DebtorAccount, {}) || {};
  return {
    amount: txnAmount(t),
    currency: first(t.amount?.currency, t.currency, "RUB"),
    at: first(t.transactionDate, t.bookingDate, t.date, t.documentDate, ""),
    counterparty: first(cp.name, cp.Name, t.counterpartyName, t.payerName, ""),
    inn: first(cp.inn, cp.INN, ""),
    purpose: first(t.paymentPurpose, t.description, t.purpose, t.narrative, ""),
    docNumber: first(t.documentNumber, t.docNumber, ""),
  };
}

// ---- async statement (создать -> опросить -> забрать) -----------------------
async function getStatement(token, accountId, from, to) {
  const created = await api(ob(`/statements`), {
    method: "POST", token,
    body: { Data: { Statement: { accountId, startDateTime: from, endDateTime: to } } },
  });
  const stId = first(
    created?.Data?.Statement?.statementId,
    created?.Data?.statementId,
    created?.statementId,
    Array.isArray(created?.Data?.Statement) ? created.Data.Statement[0]?.statementId : undefined,
  );
  if (!stId) {
    // Некоторые контуры отдают выписку синхронно прямо в ответе POST.
    const inline = extractTransactions(created);
    if (inline.txns.length) return inline.txns;
    throw new Error(`Не получил statementId из ответа: ${JSON.stringify(created).slice(0, 300)}`);
  }
  // Опрос готовности (async): статус Completed/Ready.
  for (let i = 0; i < 20; i++) {
    const got = await api(ob(`/accounts/${accountId}/statements/${stId}`), { token });
    const { status, txns } = extractTransactions(got);
    const ready = /complete|ready|done|success/i.test(String(status)) || (!status && txns.length >= 0 && i > 0);
    if (ready || txns.length) return txns;
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error(`Выписка ${stId} не готова за отведённое время (accountId=${accountId}).`);
}

// ---- main -------------------------------------------------------------------
async function main() {
  const day = process.argv[2] || todayUTC(0); // операционный день (МСК), по умолчанию сегодня
  const from = `${day}T00:00:00Z`, to = `${day}T23:59:59Z`;
  const token = await getToken();

  const accJson = await api(ob(`/accounts${CFG.customerCode ? `?customerCode=${encodeURIComponent(CFG.customerCode)}` : ""}`), { token });
  let accounts = extractAccounts(accJson);
  if (CFG.accFilter) accounts = accounts.filter(a => `${a.accountId}${a.number}`.includes(CFG.accFilter));
  if (!accounts.length) throw new Error("API вернул 0 счетов (проверь scope на чтение счетов и TOCHKA_ACCOUNT_FILTER).");

  const out = { fetchedAt: new Date().toISOString(), day, currency: "RUB", accounts: [], incoming: { count: 0, total: 0, items: [] } };

  for (const a of accounts) {
    let balance = null, incoming = { count: 0, total: 0, items: [] };
    try {
      const bJson = await api(ob(`/accounts/${a.accountId}/balances`), { token });
      balance = extractBalance(bJson, a.accountId);
    } catch (e) { console.log(`::warning::Баланс ${a.accountId}: ${e.message}`); }
    try {
      const txns = await getStatement(token, a.accountId, from, to);
      const credits = txns.filter(isCredit).map(txnMeta).sort((x, y) => y.amount - x.amount);
      incoming = { count: credits.length, total: credits.reduce((s, t) => s + t.amount, 0), items: credits };
    } catch (e) { console.log(`::warning::Выписка ${a.accountId}: ${e.message}`); }

    out.accounts.push({ ...a, balance: balance?.amount ?? null, balanceAt: balance?.at || "", balanceType: balance?.type || "", incoming });
    out.incoming.count += incoming.count;
    out.incoming.total += incoming.total;
    out.incoming.items.push(...incoming.items.map(t => ({ ...t, account: a.number || a.accountId })));
  }
  out.incoming.items.sort((x, y) => y.amount - x.amount);
  out.balanceTotal = out.accounts.reduce((s, a) => s + money(a.balance), 0);

  writeFileSync(join(DATA, "latest.json"), JSON.stringify(out, null, 2));

  // Дневная история (идемпотентно: перезаписываем строку за day, если уже есть).
  const hp = join(DATA, "history.ndjson");
  const line = JSON.stringify({ date: day, balanceTotal: out.balanceTotal, incomingTotal: out.incoming.total, incomingCount: out.incoming.count });
  let hist = existsSync(hp) ? readFileSync(hp, "utf8").split("\n").filter(Boolean) : [];
  hist = hist.filter(l => { try { return JSON.parse(l).date !== day; } catch { return false; } });
  hist.push(line);
  writeFileSync(hp, hist.join("\n") + "\n");

  console.log(`OK ${day}: счетов ${out.accounts.length}, остаток ${out.balanceTotal.toLocaleString("ru-RU")} ₽, поступлений ${out.incoming.count} на ${out.incoming.total.toLocaleString("ru-RU")} ₽`);
}

main().catch(e => { console.error(`::error::Синк Точки упал: ${e.message}`); process.exit(1); });
