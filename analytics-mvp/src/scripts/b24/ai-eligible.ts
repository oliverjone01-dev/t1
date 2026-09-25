// Что считается диалогом, который ИИ должен разобрать. Одно правило на счётчик покрытия
// (score-dialog.ts) и на очередь разбора (dump-dialogs.ts), иначе галочка и очередь разойдутся.
//
// Раньше в счёт шли только реплики переписки, и сделки, где разговор шёл по телефону,
// оставались без разбора: расшифровка звонка, резюме BitrixGPT или заметка с итогом
// разговора - такой же материал для оценки менеджера, как сообщение в мессенджере.
type E = { type: string; body?: string; dealId?: string; leadId?: string };

export const isMsg = (e: E) => e.type.startsWith("Сообщение") || e.type === "Письмо" || e.type === "Мессенджер ОЛ";
// Разговор: расшифровка, резюме звонка или развёрнутая заметка (сюда вставляют расшифровки
// и итоги встреч). Короткие заметки вида «не отвечает» - не разговор.
export const TALK_NOTE_MIN = 300;
export const isTalk = (e: E) => e.type === "Транскрипт звонка" || e.type === "Резюме BitrixGPT"
  || (e.type === "Комментарий-заметка" && String(e.body || "").length >= TALK_NOTE_MIN);
// Подлежит разбору: две единицы общения, либо хотя бы один записанный разговор.
export const isEligible = (msg: number, talk: number) => msg + talk >= 2 || talk >= 1;

// Ключ диалога: переписка лида, конвертированного в сделку, живёт в сделке - так же,
// как её группирует дашборд.
export const makeKey = (events: E[]) => {
  const l2d: Record<string, string> = {};
  for (const e of events) if (e.dealId && e.leadId) l2d[e.leadId] = e.dealId;
  return (e: E) => e.dealId ? "D" + e.dealId : e.leadId && l2d[e.leadId] ? "D" + l2d[e.leadId] : "L" + e.leadId;
};
