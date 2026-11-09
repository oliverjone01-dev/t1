import { validateBoard, STATUSES } from "./model.mjs?rev=20261109-telegram-tabs-1";
import { parseAssignee } from "./people.mjs?rev=20261109-telegram-tabs-1";
export const EDIT_FIELDS = [
  "title",
  "unit",
  "status",
  "owner",
  "due",
  "priority",
  "description",
  "comment",
];
export const editorValues = (task) =>
  Object.fromEntries(
    EDIT_FIELDS.map((key) => [key, String(task?.[key] || "")]),
  );
export function editConflicts(current, base, values) {
  if (!current) return [];
  const remote = editorValues(current),
    before = editorValues(base),
    local = editorValues(values);
  return EDIT_FIELDS.filter(
    (key) =>
      local[key] !== before[key] &&
      remote[key] !== before[key] &&
      remote[key] !== local[key],
  ).map((field) => ({
    field,
    base: before[field],
    local: local[field],
    remote: remote[field],
  }));
}
export function resumeDraft(current, draft) {
  if (!current && draft)
    return {
      values: { ...draft.values },
      base: { ...draft.base },
      conflicts: [],
    };
  const values = editorValues(current),
    base = { ...values };
  if (draft)
    for (const key of EDIT_FIELDS)
      if (draft.values[key] !== draft.base[key]) {
        values[key] = draft.values[key];
        base[key] = draft.base[key];
      }
  return { values, base, conflicts: editConflicts(current, base, values) };
}
export function planEdit({
  tasks,
  id = null,
  base,
  values,
  createId,
  forceNew = false,
}) {
  const old = tasks.find((task) => task.id === id);
  if (id !== null && !old && !forceNew) return { kind: "missing" };
  const data = editorValues(values);
  data.title = data.title.trim();
  data.unit = data.unit.trim();
  data.owner = data.owner.trim();
  if (!data.title)
    return {
      kind: "invalid",
      field: "title",
      message: "Введите название задачи.",
    };
  if (
    (!old || data.owner !== old.owner || forceNew) &&
    parseAssignee(data.owner) === null
  )
    return {
      kind: "invalid",
      field: "owner",
      message:
        "Укажите одного человека, например Иван Раюшкин. Пояснения добавьте в комментарий.",
    };
  if (!old || data.owner !== old.owner || forceNew)
    data.owner = parseAssignee(data.owner);
  if (!STATUSES.includes(data.status) && data.status !== old?.status)
    return {
      kind: "invalid",
      field: "status",
      message: "Выберите статус из списка.",
    };
  const conflicts = forceNew ? [] : editConflicts(old, base, data);
  if (conflicts.length) return { kind: "conflict", conflicts };
  const changed = EDIT_FIELDS.filter(
    (key) => data[key] !== editorValues(base)[key],
  );
  const task = {
    ...(old && !forceNew ? old : { id: createId(), positions: {} }),
    ...(old && !forceNew
      ? Object.fromEntries(changed.map((key) => [key, data[key]]))
      : data),
  };
  task.priority ||= null;
  if (old && !forceNew) {
    task.positions = structuredClone(old.positions || {});
    if (task.owner !== old.owner) delete task.positions.owners;
    if (task.due !== old.due) delete task.positions.time;
    if (task.priority !== old.priority) delete task.positions.priority;
  }
  try {
    const next = validateBoard(
      old && !forceNew
        ? tasks.map((item) => (item.id === id ? task : item))
        : [...tasks, task],
    );
    return {
      kind: old && !forceNew ? "update" : "create",
      task: next.find((item) => item.id === task.id),
      tasks: next,
    };
  } catch (error) {
    return { kind: "invalid", message: error.message };
  }
}

export class DraftStore {
  constructor(storage, prefix) {
    this.storage = storage;
    this.prefix = prefix + ".draft.";
  }
  key(id) {
    return (
      this.prefix + (id === null ? "new" : "task-" + encodeURIComponent(id))
    );
  }
  read(id) {
    const raw = this.storage.getItem(this.key(id));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (
      data?.version !== 1 ||
      data.id !== id ||
      !data.values ||
      !data.base ||
      !Number.isFinite(data.updatedAt)
    )
      throw new Error(
        "Черновик повреждён. Исходная копия оставлена на устройстве.",
      );
    return {
      ...data,
      values: editorValues(data.values),
      base: editorValues(data.base),
    };
  }
  save(id, base, values, updatedAt = Date.now()) {
    try {
      this.read(id);
      const record = {
        version: 1,
        id,
        base: editorValues(base),
        values: editorValues(values),
        updatedAt,
      };
      if (EDIT_FIELDS.every((key) => record.base[key] === record.values[key])) {
        this.remove(id);
        return { ok: true };
      }
      this.storage.setItem(this.key(id), JSON.stringify(record));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  }
  remove(id) {
    this.storage.removeItem(this.key(id));
  }
  list() {
    const drafts = [],
      errors = [];
    try {
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (!key?.startsWith(this.prefix)) continue;
        try {
          const suffix = key.slice(this.prefix.length),
            id = suffix === "new" ? null : decodeURIComponent(suffix.slice(5));
          const draft = this.read(id);
          if (draft) drafts.push(draft);
        } catch {
          errors.push(key);
        }
      }
    } catch {
      errors.push("storage-unavailable");
    }
    return { drafts: drafts.sort((a, b) => b.updatedAt - a.updatedAt), errors };
  }
}
