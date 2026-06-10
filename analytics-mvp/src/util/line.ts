// Определение линии по названию товара. Портировано из Code-ноды n8n (DOC_03 §2).
// Временная эвристика: после подключения таксономии (offer_id -> линия) заменится
// на точный джойн. Пока - по ключевым словам в имени.

export function lineOf(name: string): string {
  const n = (name || "").toUpperCase();
  if (n.includes("TRUBIS")) return "TRUBIS";
  if (n.includes("VIOLUR")) return "VIOLUR (столы)";
  if (n.includes("NOLVIS")) return "NOLVIS";
  if (n.includes("OSOLIS")) return "OSOLIS";
  if (n.includes("ЗЕРКАЛ")) return "зеркала";
  if (n.includes("СВЕТ") || n.includes("LED")) return "свет";
  if (n.includes("СТОЛ") || n.includes("KONUX")) return "столы";
  return "прочее";
}
