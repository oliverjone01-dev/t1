// Маска контактных данных в снимках для дашбордов (решение ЯДИ 29.09: в дашбордах нужны
// статистика и переписка, а не контакты). Телефон: +79055170727 -> +7905****27,
// почта: nick_dw@mail.ru -> ni****@mail.ru, номер карты: 5469 4000 3022 4138 -> ****4138.
// Маска детерминированная: один и тот же номер всегда даёт одну и ту же строку, поэтому
// сопоставление звонка с расшифровкой «по номеру» продолжает работать на масках.
// Не трогает: даты, суммы, ID сделок, трек-номера (12 цифр), артикулы с буквами.

// Номер может быть разбит пробелами и тире («7 (9 36) 2 6 6- 50--0 7»), стоять в звёздочках
// (жирный шрифт из писем) или с добавочным («218-00-22*226»). Маску повторно не трогает:
// в «8905****80» всего 6 цифр, это не номер. Суммы, даты, ID, размеры и трек-номера не номера.
const PHONE = /(?<![\p{L}\p{N}_+])((?:\+|&#43;\s?)?\d[\d \-()\u00a0]{8,26}\d)(?!\d)/gu;
const EMAIL = /([\p{L}\p{N}_.+-]{1,64})@([\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)+)/gu;
const CARD = /(?<!\d)(\d{4})[ -]?(\d{4})[ -]?(\d{4})[ -]?(\d{4})(?!\d)/g;

const isPhoneDigits = (d, plus) =>
  (d.length === 11 && (d[0] === '7' || d[0] === '8') && '3489'.includes(d[1])) ||
  (d.length === 10 && d[0] === '9') ||
  (plus && d.length >= 11 && d.length <= 13);

// Ссылки не трогаем целиком: в них длинные ID (2ГИС, фото Битрикса), похожие на номер или карту.
const URL_RE = /(?:https?:\/\/|www\.)[^\s"'<>]+/g;

export function maskText(s) {
  if (typeof s !== 'string' || s.length < 6) return s;
  if (s.includes('http') || s.includes('www.')) {
    let res = '', last = 0;
    // в ссылке маскируем только почту (mailto, «написать письмо»), цифры ID не трогаем
    for (const m of s.matchAll(URL_RE)) { res += maskPlain(s.slice(last, m.index)) + maskEmails(m[0]); last = m.index + m[0].length; }
    return res + maskPlain(s.slice(last));
  }
  return maskPlain(s);
}

const maskEmails = (t) => (t.includes('@') ? t.replace(EMAIL, (m, local, dom) => (local.length <= 2 ? local[0] : local.slice(0, 2)) + '****@' + dom) : t);

function maskPlain(s) {
  if (!s || s.length < 6) return s;
  let out = s;
  if (out.includes('@')) out = out.replace(EMAIL, (m, local, dom) => (local.length <= 2 ? local[0] : local.slice(0, 2)) + '****@' + dom);
  if (/\d/.test(out)) {
    out = out.replace(CARD, (m, a, b, c, d) => '****' + d);
    out = out.replace(PHONE, (m) => {
      const plus = m.startsWith('+') || m.startsWith('&#43;');
      const d = m.replace(/^&#43;/, '').replace(/\D/g, '');
      if (!isPhoneDigits(d, plus)) return m;
      // Суммы с разделителем тысяч и их диапазоны («90 000 - 95 000») - не номер.
      if (!plus && m.split(/\s*-+\s*/).every((p) => /^\d{1,3}(?:[ \u00a0]\d{3})+$/.test(p.trim()))) return m;
      return (plus ? '+' : '') + d.slice(0, 4) + '****' + d.slice(-2);
    });
  }
  return out;
}

// Рекурсивно по всем строкам объекта (ключи не трогаем). Числа остаются числами.
// skip - имена полей, которые не маскируются: например «source» в rop.json хранит НАШИ
// номера и почты («Звонок на номер: 7495…», «Почта info@…») - по ним считаются каналы.
export function maskDeep(v, skip) {
  if (typeof v === 'string') return maskText(v);
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) v[i] = maskDeep(v[i], skip); return v; }
  if (v && typeof v === 'object') { for (const k of Object.keys(v)) { if (skip && skip.has(k)) continue; v[k] = maskDeep(v[k], skip); } return v; }
  return v;
}
