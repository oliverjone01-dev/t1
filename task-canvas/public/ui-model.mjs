import { comparable, equal } from "./sync-model.mjs?rev=20261109-gantt-1";
export const normalizeQuery = (value) =>
  String(value || "")
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .trim();
export function matchesWords(text, query) {
  const haystack = normalizeQuery(text);
  return normalizeQuery(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}
export function matchesTask(task, query) {
  const date = task.due ? task.due.split("-").reverse().join(".") : "";
  return matchesWords(
    [
      task.title,
      task.owner,
      task.ownerNote,
      task.unit,
      task.direction,
      task.description,
      task.sourceId,
      task.comment,
      task.status,
      date,
    ]
      .filter(Boolean)
      .join(" "),
    query,
  );
}
export function importSummary(before, after) {
  const existing = new Map(before.map((task) => [task.id, task])),
    incoming = new Map(after.map((task) => [task.id, task]));
  return {
    added: after.filter((task) => !existing.has(task.id)).length,
    changed: after.filter(
      (task) =>
        existing.has(task.id) &&
        !equal(comparable(task), comparable(existing.get(task.id))),
    ).length,
    removed: before.filter((task) => !incoming.has(task.id)).length,
    total: after.length,
  };
}
export function cleanPreferences(value) {
  return {
    theme: ["light", "dark", "system"].includes(value?.theme)
      ? value.theme
      : "system",
    density: ["comfortable", "compact"].includes(value?.density)
      ? value.density
      : "comfortable",
  };
}
export function emptyState({ count, hasBaseline, status, demo = false }) {
  if (count) return null;
  if (demo)
    return {
      title: "Демонстрация пока пустая",
      body: "Добавьте тестовую задачу или восстановите примеры. Рабочая таблица здесь не используется.",
      action: "examples",
      label: "Восстановить примеры",
    };
  if (status === "syncing" && !hasBaseline)
    return {
      title: "Загружаем задачи",
      body: "Читаем выбранную Google Таблицу. Локальные изменения остаются на устройстве.",
      action: null,
      label: "",
    };
  if (hasBaseline && status === "synced")
    return {
      title: "Задач пока нет",
      body: "Создайте первую задачу. После подтверждения Google она появится в общей таблице.",
      action: "create",
      label: "Новая задача",
    };
  return {
    title: "Откройте свои задачи",
    body: "Подключите Google Таблицу или импортируйте копию. Можно начать локально и подключиться позже.",
    action: "connect",
    label: "Подключить Google",
  };
}
export function demoTasks() {
  return [
    ["Подготовить план запуска", "Иван", "do", "В работе"],
    ["Согласовать материалы", "Софа", "do", "В ожидании"],
    ["Обновить каталог", "Катя", "plan", "В работе"],
    ["Подготовить презентацию", "Иван", "plan", "В ожидании"],
    ["Собрать обратную связь", "Дима", "delegate", "В ожидании"],
    ["Разобрать идеи", "", "later", "Не указан"],
    ["Опубликовать инструкцию", "Софа", "plan", "Готово"],
    ["Снять неактуальную задачу", "Катя", "later", "Отменено"],
  ].map(([title, owner, priority, status], i) => ({
    id: `example-${i}`,
    title,
    owner,
    priority,
    status,
    unit: i % 2 ? "ГГР" : "ГМ",
    due: "",
    description: "Тестовые данные демонстрации.",
    positions: {},
  }));
}

export function synchronizationHint(state) {
  return {signin:'Нужен вход Google для обновления.',offline:'Нет связи с Google. Показана последняя копия.',conflict:'Нужно сравнить версии. Откройте Google.', 'cache-error':'Очередь повреждена. Откройте Google для восстановления.',syncing:'Проверяем Google.'}[state?.status] || '';
}
