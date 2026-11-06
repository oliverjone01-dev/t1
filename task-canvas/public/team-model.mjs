import { validateBoard } from "./model.mjs?rev=20261106-team-1";
import { equal } from "./sync-model.mjs?rev=20261106-team-1";
import { parseAssignee } from "./people.mjs?rev=20261106-team-1";
export const TEAM_SCHEMA = 1;
export const GROUPS = {
  title: ["title"],
  unit: ["unit"],
  direction: ["direction"],
  description: ["description"],
  comment: ["comment"],
  status: ["status"],
  assignment: ["owner", "positions.owners"],
  schedule: ["due", "positions.time"],
  priority: ["priority", "positions.priority"],
  context: [
    "sourceId",
    "ownerNote",
    "dueNote",
    "dependency",
    "requester",
    "link",
  ],
};
export const GROUP_NAMES = {
  title: "Задача",
  unit: "Юнит",
  direction: "Направление",
  description: "Ожидаемый результат",
  comment: "Комментарий",
  status: "Статус",
  assignment: "Ответственный и расположение",
  schedule: "Срок и расположение",
  priority: "Приоритет и расположение",
  context: "Контекст таблицы",
  task: "Задача целиком",
  lanes: "Дорожки команды",
};
const clone = (value) => structuredClone(value);
export const valueAt = (task, path) =>
  path.split(".").reduce((v, key) => v?.[key], task) ?? null;
function put(task, path, value) {
  const keys = path.split("."),
    last = keys.pop();
  let target = task;
  for (const key of keys) target = target[key] ??= {};
  if (value === null) delete target[last];
  else target[last] = clone(value);
}
export const groupValue = (task, key) =>
  Object.fromEntries(GROUPS[key].map((path) => [path, valueAt(task, path)]));
export const normalizedTask = (task) => validateBoard([task])[0];
export function seedEntry(task, stamp = "seed", archived = false) {
  return {
    schema: TEAM_SCHEMA,
    task: normalizedTask(task),
    revision: 1,
    versions: Object.fromEntries(
      Object.keys(GROUPS).map((key) => [key, stamp]),
    ),
    archived,
    lifeVersion: stamp,
    lastOperationId: stamp,
  };
}
export function validateEntry(value) {
  if (
    value?.schema !== TEAM_SCHEMA ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 1 ||
    typeof value.archived !== "boolean" ||
    typeof value.lifeVersion !== "string" ||
    !value.versions ||
    Object.keys(GROUPS).some((key) => typeof value.versions[key] !== "string")
  )
    throw new Error("Повреждена версия общей карточки. Данные не заменены.");
  return { ...value, task: normalizedTask(value.task) };
}
export function toBoard(entries, owners = []) {
  return {
    tasks: validateBoard(
      entries.filter((entry) => !entry.archived).map((entry) => entry.task),
    ),
    owners: [...new Set(owners)],
  };
}
export function makeOperation(
  before,
  desired,
  { id, actor, submittedAt = Date.now(), includeContext = false },
) {
  const common = {
    schema: TEAM_SCHEMA,
    id,
    taskId: desired?.id || before?.task.id,
    actor: clone(actor),
    submittedAt,
  };
  if (!common.taskId) throw new Error("Не указан ID задачи.");
  if (!before) {
    if (!desired) return null;
    return { ...common, kind: "create", task: normalizedTask(desired) };
  }
  if (!desired) {
    if (before.archived) return null;
    return {
      ...common,
      kind: "archive",
      baseLife: before.lifeVersion,
      baseRevision: before.revision,
      baseTask: clone(before.task),
    };
  }
  if (before.archived)
    return { ...common, kind: "create", task: normalizedTask(desired) };
  const task = normalizedTask(desired),
    groups = {};
  for (const key of Object.keys(GROUPS)) {
    if (key === "context" && !includeContext) continue;
    const base = groupValue(before.task, key),
      value = groupValue(task, key);
    if (!equal(base, value))
      groups[key] = { baseVersion: before.versions[key], base, value };
  }
  if (!Object.keys(groups).length) return null;
  return {
    ...common,
    kind: "edit",
    baseLife: before.lifeVersion,
    baseTask: clone(before.task),
    groups,
  };
}
export function validateOperation(op) {
  if (
    op?.schema !== TEAM_SCHEMA ||
    typeof op.id !== "string" ||
    !/^[a-zA-Z0-9_-]{8,120}$/.test(op.id) ||
    typeof op.taskId !== "string" ||
    !op.taskId ||
    !op.actor?.uid ||
    typeof op.actor.clientId !== "string" ||
    !["create", "edit", "archive", "resolve"].includes(op.kind)
  )
    throw new Error("Некорректная операция общей доски.");
  if (op.kind === "create") {
    if (normalizedTask(op.task).id !== op.taskId)
      throw new Error("ID карточки не совпадает.");
  }
  if (op.kind === "edit") {
    if (!op.groups || !Object.keys(op.groups).length)
      throw new Error("Пустая правка.");
    for (const [key, patch] of Object.entries(op.groups)) {
      if (
        !GROUPS[key] ||
        typeof patch.baseVersion !== "string" ||
        !patch.base ||
        !patch.value ||
        GROUPS[key].some(
          (path) =>
            !Object.hasOwn(patch.base, path) ||
            !Object.hasOwn(patch.value, path),
        ) ||
        Object.keys(patch.value).some((path) => !GROUPS[key].includes(path)) ||
        Object.keys(patch.base).some((path) => !GROUPS[key].includes(path))
      )
        throw new Error("Повреждены поля правки.");
      if (
        key === "assignment" &&
        parseAssignee(patch.value.owner || "") === null
      )
        throw new Error("Укажите одного ответственного.");
    }
  }
  return op;
}
export function applyOperation(current, input) {
  const op = validateOperation(input),
    conflicts = [],
    before = current ? validateEntry(current) : null;
  let next = before ? clone(before) : null;
  const conflict = (group, base, local, remote, remoteVersion) =>
    conflicts.push({
      id: op.id + "_" + group,
      operationId: op.id,
      taskId: op.taskId,
      group,
      base: clone(base),
      local: clone(local),
      remote: clone(remote),
      remoteVersion,
      actor: clone(op.actor),
      status: "open",
    });
  if (op.kind === "create") {
    if (!before) next = seedEntry(op.task, op.id);
    else if (before.archived || !equal(before.task, op.task))
      conflict(
        "task",
        null,
        { task: op.task, archived: false },
        { task: before.task, archived: before.archived },
        before.lastOperationId,
      );
  } else if (!before) {
    let local = op.baseTask ? clone(op.baseTask) : null;
    if (local && op.kind === "edit")
      for (const patch of Object.values(op.groups))
        for (const [path, value] of Object.entries(patch.value))
          put(local, path, value);
    conflict(
      "task",
      op.baseTask ? { task: op.baseTask, archived: false } : null,
      local
        ? { task: normalizedTask(local), archived: op.kind === "archive" }
        : null,
      null,
      "missing",
    );
  } else if (op.kind === "archive") {
    if (before.archived) {
    } else if (
      before.revision !== op.baseRevision ||
      before.lifeVersion !== op.baseLife
    )
      conflict(
        "task",
        { task: op.baseTask, archived: false },
        { task: op.baseTask, archived: true },
        { task: before.task, archived: false },
        before.lastOperationId,
      );
    else {
      next.archived = true;
      next.lifeVersion = op.id;
    }
  } else if (op.kind === "edit") {
    if (before.archived || before.lifeVersion !== op.baseLife) {
      let local = clone(before.task);
      for (const [key, patch] of Object.entries(op.groups))
        for (const [path, value] of Object.entries(patch.value))
          put(local, path, value);
      conflict(
        "task",
        null,
        { task: normalizedTask(local), archived: false },
        { task: before.task, archived: before.archived },
        before.lastOperationId,
      );
    } else
      for (const [key, patch] of Object.entries(op.groups)) {
        const remote = groupValue(before.task, key);
        if (equal(remote, patch.value)) continue;
        if (before.versions[key] !== patch.baseVersion)
          conflict(key, patch.base, patch.value, remote, before.versions[key]);
        else {
          for (const [path, value] of Object.entries(patch.value))
            put(next.task, path, value);
          next.versions[key] = op.id;
        }
      }
  } else throw new Error("Разрешение конфликта требует отдельной транзакции.");
  if (next) {
    next.task = normalizedTask(next.task);
    const changed =
      !before ||
      !equal(next.task, before.task) ||
      next.archived !== before.archived;
    if (changed) {
      next.revision = before ? before.revision + 1 : 1;
      next.lastOperationId = op.id;
    }
    return { entry: next, changed, conflicts };
  }
  return { entry: null, changed: false, conflicts };
}
export function resolveConflict(
  current,
  conflict,
  { id, choice, expectedVersion, actor },
) {
  const before = current ? validateEntry(current) : null;
  if (conflict.status !== "open")
    return { entry: before, changed: false, alreadyResolved: true };
  const version =
    conflict.group === "task"
      ? before
        ? before.lastOperationId
        : "missing"
      : before?.versions[conflict.group];
  if (version !== expectedVersion)
    return {
      stale: true,
      currentVersion: version,
      remote: before
        ? conflict.group === "task"
          ? { task: before.task, archived: before.archived }
          : groupValue(before.task, conflict.group)
        : null,
    };
  if (!["remote", "local"].includes(choice))
    throw new Error("Выберите одну из версий.");
  let next = before ? clone(before) : null;
  if (choice === "local") {
    if (conflict.group === "task") {
      if (conflict.local) {
        next = before ? clone(before) : seedEntry(conflict.local.task, id);
        next.task = normalizedTask(conflict.local.task);
        next.archived = !!conflict.local.archived;
        next.lifeVersion = id;
        for (const key of Object.keys(GROUPS)) next.versions[key] = id;
      } else if (next) {
        next.archived = true;
        next.lifeVersion = id;
      }
    } else {
      if (!next) throw new Error("Задача больше не существует.");
      for (const [path, value] of Object.entries(conflict.local))
        put(next.task, path, value);
      next.versions[conflict.group] = id;
    }
  }
  if (next) {
    next.task = normalizedTask(next.task);
    if (
      !before ||
      !equal(next.task, before.task) ||
      next.archived !== before.archived
    ) {
      next.revision = (before?.revision || 0) + 1;
      next.lastOperationId = id;
    }
  }
  return {
    entry: next,
    changed: !!next && (!before || next.revision !== before.revision),
    resolution: { choice, actor, operationId: id, observedVersion: version },
    stale: false,
  };
}
export function projectOperation(entry, op) {
  try {
    if (op.kind === "create") return entry || seedEntry(op.task, op.id);
    if (!entry) return null;
    const result = clone(entry);
    if (op.kind === "archive") {
      result.archived = true;
      result.lifeVersion = op.id;
      if (
        result.archived !== entry.archived ||
        !equal(result.task, entry.task)
      ) {
        result.revision = entry.revision + 1;
        result.lastOperationId = op.id;
      }
      return result;
    }
    if (op.kind === "edit") {
      result.archived = false;
      for (const [key, patch] of Object.entries(op.groups)) {
        for (const [path, value] of Object.entries(patch.value))
          put(result.task, path, value);
        result.versions[key] = op.id;
      }
      result.task = normalizedTask(result.task);
      if (
        result.archived !== entry.archived ||
        !equal(result.task, entry.task)
      ) {
        result.revision = entry.revision + 1;
        result.lastOperationId = op.id;
      }
      return result;
    }
    return result;
  } catch {
    return entry;
  }
}
