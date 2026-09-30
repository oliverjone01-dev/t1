// lib-account.mjs - разбор остатка на счёте Яндекс.Директа.
// Отдельным модулем, потому что это единственное место, где логика остатка живёт:
// копии расходятся с оригиналом на граничных случаях, и именно так уже был получен
// завышенный «непокрытый» остаток в другом дашборде (К9).
// Вызов API внедряется снаружи (`live`), поэтому стенд гоняет разбор без сети.

// Остаток живёт только в Live v4: сервиса `accountmanagement` в v5 НЕТ (живая проба
// 30.09.2026 - HTTP 404). Хост `api.direct.yandex.ru` закрыт прокси контейнера, а
// `api.direct.yandex.com` открыт, и Live v4 отвечает на нём же.
// ВАЖНО: в Live v4 токен лежит в ТЕЛЕ запроса, поэтому ни тело, ни текст ответа не
// попадают в сообщение об ошибке ни при каком исходе - иначе токен уехал бы в лог.
export function makeLive(token, timeoutMs = 20000) {
  return async function live(method, param) {
    // Остаток - самое необязательное число в синке, и зависнуть из-за него весь
    // ночной прогон не должен: без таймаута отказ сети превращается не в `ok: false`,
    // а в висящий job. Отвал по таймауту ловит `readAccount` наравне с любым другим.
    const res = await fetch('https://api.direct.yandex.com/live/v4/json/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ method, token, locale: 'ru', param }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    if (res.status !== 200) throw new Error(`live/${method}: HTTP ${res.status}`);
    let j;
    try { j = JSON.parse(text); } catch { throw new Error(`live/${method}: ответ не JSON`); }
    if (j.error_code || j.error_str) throw new Error(`live/${method}: ${j.error_code} ${j.error_str || ''}`.trim());
    return j.data;
  };
}

// Директ отдаёт суммы СТРОКАМИ («52655.11»). Пропуск НЕ превращается в ноль:
// ноль на балансе читается как «реклама встала», и подставить его вместо отказа
// значит соврать в самую дорогую сторону (К7).
export function parseMoney(v) {
  if (v == null) return null;
  const t = String(v).replace(/\s/g, '').replace(',', '.');
  // Пустая строка - это ПРОПУСК, а не ноль: Number('') даёт 0, и без этой строки
  // отсутствующий остаток показал бы «денег нет».
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// Возвращает всегда объект, никогда не бросает: из-за одного числа ночной синк
// падать не должен, остальные снимки нужнее. Но и молчать нельзя - отказ уезжает
// полем `error`, а не подменяется нулём.
export async function readAccount(live) {
  try {
    // SelectionCriteria пустой НАМЕРЕННО: с явным `Logins` Директ отвечает
    // 515 «Требуется подключить общий счёт» (живая проба 30.09.2026).
    const d = await live('AccountManagement', { Action: 'Get', SelectionCriteria: {} });
    const accs = (d && d.Accounts) || [];
    const faults = ((d && d.ActionsResult) || [])
      .flatMap(r => (r.Errors || []).map(e => `${e.FaultCode} ${e.FaultString}`));
    if (accs.length !== 1) {
      // Ноль счетов - нет доступа или общий счёт не подключён. Больше одного -
      // складывать их молча нельзя (К4), это уже другой контракт.
      return { ok: false, error: `счетов в ответе ${accs.length}`, faults };
    }
    const a = accs[0];
    const balance = parseMoney(a.Amount);
    const warn = a.EmailNotification ? Number(a.EmailNotification.MoneyWarningValue) : NaN;
    const acc = {
      ok: balance != null && a.Currency === 'RUB',
      account_id: a.AccountID ?? null,
      currency: a.Currency ?? null,
      // Остаток на общем счёте. НЕ равен «сколько всего денег в Директе»:
      // AmountAvailableForTransfer (с возвратом с кампаний) обычно больше.
      balance,
      available_for_transfer: parseMoney(a.AmountAvailableForTransfer),
      day_budget: parseMoney(a.AccountDayBudget && a.AccountDayBudget.Amount),
      warning_at: Number.isFinite(warn) ? warn : null,
      // Счёт обслуживает агентство, пополнение идёт через него. Остаток в кабинете
      // агентства - ДРУГОЕ число, этим снимком не покрыто.
      agency: a.AgencyName ?? null,
      faults,
    };
    if (balance == null) acc.error = 'Amount не разобрался в число';
    else if (a.Currency !== 'RUB') acc.error = `валюта ${a.Currency}, не RUB`;
    return acc;
  } catch (e) {
    // Текст ошибки приходит уже без тела запроса, значит без токена.
    return { ok: false, error: String(e && e.message || e).slice(0, 200) };
  }
}

// Один остаток на общем счёте описывает ВСЮ рекламу только пока все кампании
// финансируются с общего счёта. Если хоть одна переедет на собственные средства
// (`CAMPAIGN_FUNDS`), остаток перестанет быть полной картиной, и это должно быть
// видно в снимке, а не всплыть в вопросе «почему цифры не бьются» (К4).
export function fundingModes(campaigns) {
  const modes = {};
  for (const c of campaigns || []) {
    const m = (c.Funds && c.Funds.Mode) || 'нет поля';
    modes[m] = (modes[m] || 0) + 1;
  }
  const keys = Object.keys(modes);
  return {
    modes,
    // true только когда ровно один режим и он общий счёт.
    all_shared: keys.length === 1 && keys[0] === 'SHARED_ACCOUNT_FUNDS',
  };
}
