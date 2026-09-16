// Единый список вкладок шапки KATYA.
// Вынесен из build-katya.ts, чтобы страницы, которые собираются отдельным скриптом
// (build-reakciya.ts), не расходились с шапкой основных семи вкладок.
// Формат: [файл, подпись, ключ активной вкладки].
export const KPAGES: [string, string, string][] = [
  ["katya-command.html", "Командный центр", "command"],
  ["katya.html", "Обзор", "obzor"],
  ["katya-tovary.html", "Товары и заказы", "tovary"],
  ["katya-voronka.html", "Воронка", "voronka"],
  ["katya-marketing.html", "Маркетинг", "marketing"],
  ["katya-money.html", "Деньги", "money"],
  ["katya-competitors.html", "Конкуренты", "competitors"],
  ["katya-reakciya.html", "Реакция", "reakciya"],
];

// Разметка одной кнопки шапки. Держим ровно ту же, что была инлайном в banner().
export const navButton = (href: string, label: string, on: boolean): string =>
  `<a href="${href}" style="color:${on ? "#0B0F15" : "#22D3EE"};background:${on ? "#22D3EE" : "transparent"};border:1px solid #22D3EE;border-radius:7px;padding:3px 10px;text-decoration:none;white-space:nowrap">${label}</a>`;
