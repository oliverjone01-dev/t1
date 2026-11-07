import {
  CARD,
  STATUSES,
  STATUS_LANES,
  statusGroup,
  localDate,
  createLayout,
  moveTask,
  validateBoard,
  groupFor,
  dropTarget,
  fitCamera,
  importBoard,
} from "./model.mjs?rev=20261107-view-1";
import { SyncEngine } from "./sync-engine.mjs?rev=20261107-view-1";
import { TeamSyncEngine } from "./team-engine.mjs?rev=20261107-view-1";
import { TeamDraftStore } from "./team-drafts.mjs?rev=20261107-view-1";
import { BoardViewer } from "./board-viewer.mjs?rev=20261107-view-1";
import { remoteChanges } from "./changes.mjs?rev=20261107-view-1";
import { TeamApi } from "./team-api.mjs?rev=20261107-view-1";
import { TeamSourceBridge } from "./team-source.mjs?rev=20261107-view-1";
import { GROUP_NAMES, groupValue } from "./team-model.mjs?rev=20261107-view-1";
import { GoogleAuth } from "./google-auth.mjs?rev=20261107-view-1";
import { SheetsApi } from "./sheets-api.mjs?rev=20261107-view-1";
import { FIELD_NAMES, comparable } from "./sync-model.mjs?rev=20261107-view-1";
import { dataSignature, writeBoard } from "./storage.mjs?rev=20261107-view-1";
import { ChangeInbox, CHANGE_FIELDS } from "./changes.mjs?rev=20261107-view-1";
import {
  DraftStore,
  EDIT_FIELDS,
  editorValues,
  resumeDraft,
  editConflicts,
  planEdit,
} from "./editor.mjs?rev=20261107-view-1";
import { parseAssignee } from "./people.mjs?rev=20261107-view-1";
import {
  matchesTask,
  matchesWords,
  cleanPreferences,
  emptyState,
  importSummary,
  demoTasks,
  synchronizationHint,
} from "./ui-model.mjs?rev=20261107-view-1";
import { icon } from "./icons.mjs?rev=20261107-view-1";
const $ = (selector) => document.querySelector(selector),
  $$ = (selector) => [...document.querySelectorAll(selector)];
const DEMO = new URLSearchParams(location.search).get("demo") === "1";
const STORAGE = DEMO
    ? "gengroup.task-canvas.demo.v1"
    : "gengroup.task-canvas.team.v2",
  PREFS = "gengroup.task-canvas.preferences.v1";
const VIEW_STORAGE = "gengroup.task-canvas.public-view.v1";
let accessMode = DEMO ? "edit" : "view",
  viewer = null,
  editorLocalBoard = { tasks: [], owners: [] },
  viewerState = { status: "view-loading" },
  viewerReadAt = 0,
  viewerHasBaseline = false,
  lastPublicBoard = null,
  lastPublicChanges = [];
const canEdit = () =>
  DEMO || (accessMode === "edit" && !!cloudEngine?.connected);
function requireEditor() {
  if (canEdit()) return true;
  showDialog("cloud-dialog");
  text("#google-error", "Для изменения общей доски войдите через свой Google.");
  return false;
}
const today = () => localDate(),
  esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const text = (selector, value) => {
  const el = $(selector);
  if (el.textContent !== String(value)) el.textContent = value;
};
let storage;
try {
  storage = globalThis.localStorage;
} catch {
  const unavailable = () => {
    throw new Error("Хранилище браузера недоступно.");
  };
  storage = {
    getItem: unavailable,
    setItem: unavailable,
    removeItem: unavailable,
    key: unavailable,
    get length() {
      return unavailable();
    },
  };
}
const drafts = DEMO
    ? new DraftStore(storage, STORAGE)
    : new TeamDraftStore(storage, STORAGE),
  memoryDrafts = new Map();
function draftRecords() {
  const result = drafts.list(),
    byId = new Map(
      result.drafts.map((record) => [record.key || record.id, record]),
    );
  for (const [id, record] of memoryDrafts) byId.set(id, record);
  return {
    ...result,
    drafts: [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt),
  };
}
let tasks = [],
  extraOwners = [],
  mode = "priority",
  lastCanvasMode = "priority",
  camera = { x: 32, y: 24, z: 1 },
  selected = null,
  editing = null,
  editingBase = null,
  editingVersionBasis = null;
let history = [],
  future = [],
  layout,
  gesture = null,
  space = false,
  storageFailed = false,
  toastTimer,
  stateLoadError = false,
  storageConflict = false,
  unsavedChanges = false,
  draftFailed = false;
let freshBoard = true;
let cloudEngine = null,
  cloudCache = null,
  googleAuth = null,
  inbox = new ChangeInbox(),
  cloudRenderNeeded = false,
  renderedDay = null;
let syncState = { status: "local", pending: 0, conflicts: [], lastReadAt: 0 },
  storedSignature = dataSignature({ tasks: [], owners: [] });
let preferences = cleanPreferences(null),
  importPlan = null,
  changesSignature = "",
  connectionAttempt = 0,
  connecting = false;
try {
  const raw =
    storage.getItem(STORAGE) ||
    (!DEMO ? storage.getItem("gengroup.task-canvas.v1") : null);
  if (raw) {
    const state = JSON.parse(raw);
    freshBoard = false;
    storedSignature = dataSignature(state);
    tasks = validateBoard(state);
    extraOwners = Array.isArray(state.owners)
      ? state.owners.filter((o) => typeof o === "string")
      : [];
    cloudCache = DEMO ? null : state.cloud || null;
    inbox = new ChangeInbox(state.changes);
    mode = ["priority", "owners", "time", "list"].includes(state.mode)
      ? state.mode
      : "priority";
    lastCanvasMode = ["priority", "owners", "time"].includes(
      state.lastCanvasMode,
    )
      ? state.lastCanvasMode
      : mode === "list"
        ? "priority"
        : mode;
    if (
      state.camera &&
      ["x", "y", "z"].every((k) => Number.isFinite(state.camera[k]))
    )
      camera = {
        x: state.camera.x,
        y: state.camera.y,
        z: Math.max(0.0001, Math.min(2, state.camera.z)),
      };
  } else {
    if (DEMO) tasks = demoTasks();
    if (matchMedia("(max-width:767px)").matches) mode = "list";
  }
} catch {
  stateLoadError = true;
  storageFailed = true;
}
try {
  preferences = cleanPreferences(JSON.parse(storage.getItem(PREFS) || "{}"));
} catch {}
if (!DEMO) {
  editorLocalBoard = {
    tasks: structuredClone(tasks),
    owners: [...extraOwners],
  };
  tasks = [];
  extraOwners = [];
  inbox = new ChangeInbox();
  try {
    const saved = JSON.parse(storage.getItem(VIEW_STORAGE) || "null");
    if (saved?.version === 1) {
      tasks = validateBoard(saved);
      extraOwners = Array.isArray(saved.owners)
        ? saved.owners.filter((v) => typeof v === "string")
        : [];
      viewerReadAt = Number.isFinite(saved.lastReadAt) ? saved.lastReadAt : 0;
      viewerHasBaseline = true;
      inbox = new ChangeInbox(saved.changes);
      if (["priority", "owners", "time", "list"].includes(saved.mode))
        mode = saved.mode;
      if (["priority", "owners", "time"].includes(saved.lastCanvasMode))
        lastCanvasMode = saved.lastCanvasMode;
      if (
        saved.camera &&
        ["x", "y", "z"].every((k) => Number.isFinite(saved.camera[k]))
      )
        camera = saved.camera;
    }
  } catch {}
}
if (!DEMO && viewerHasBaseline) {
  lastPublicBoard = { tasks: structuredClone(tasks), owners: [...extraOwners] };
  lastPublicChanges = inbox.snapshot();
}
$$("[data-icon]").forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
$("#demo-banner").hidden = !DEMO;
$("#google-connect").hidden = DEMO;
$("#changes-open").hidden = DEMO;
function toast(message) {
  text("#toast", message);
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 5000);
}
function renderAlert() {
  const message = stateLoadError
    ? "Сохранённая копия повреждена. Она не перезаписана."
    : storageConflict
      ? "Доска изменена в другой вкладке. Скачайте текущую копию и обновите страницу."
      : storageFailed
        ? "Не удалось сохранить на устройстве. Скачайте копию перед закрытием."
        : "";
  text("#app-alert-text", message);
  $("#app-alert").hidden = !message;
}
function persist() {
  if (!DEMO && accessMode !== "edit") {
    if (accessMode === "view")
      try {
        storage.setItem(
          VIEW_STORAGE,
          JSON.stringify({
            version: 1,
            tasks,
            owners: extraOwners,
            mode,
            lastCanvasMode,
            camera,
            changes: inbox.snapshot(),
            lastReadAt: viewerReadAt,
          }),
        );
      } catch {}
    return true;
  }
  if (!DEMO)
    editorLocalBoard = {
      tasks: structuredClone(tasks),
      owners: [...extraOwners],
    };
  if (storageConflict || stateLoadError) {
    text("#save-state", "Не сохранено - скачайте копию");
    renderAlert();
    return false;
  }
  const state = {
    version: 1,
    tasks,
    owners: extraOwners,
    mode,
    lastCanvasMode,
    camera,
    cloud: DEMO ? null : cloudEngine?.snapshot() || cloudCache,
    changes: inbox.snapshot(),
  };
  const result = DEMO
    ? writeBoard(storage, STORAGE, state, storedSignature)
    : (() => {
        try {
          storage.setItem(STORAGE, JSON.stringify(state));
          return { ok: true, signature: dataSignature(state) };
        } catch (error) {
          return { ok: false, reason: "storage", message: error.message };
        }
      })();
  if (result.ok) {
    storedSignature = result.signature;
    storageFailed = false;
    unsavedChanges = false;
    text(
      "#save-state",
      DEMO
        ? "Демонстрация на устройстве"
        : cloudEngine?.enabled
          ? "Локальная копия сохранена"
          : "Сохранено на устройстве",
    );
    renderAlert();
    return true;
  }
  storageConflict = result.reason === "conflict";
  storageFailed = !storageConflict;
  text("#save-state", "Не сохранено - скачайте копию");
  renderAlert();
  return false;
}
function savedToast(message) {
  toast(
    storageConflict || stateLoadError || storageFailed
      ? "Изменения только в памяти. Скачайте копию перед закрытием."
      : message,
  );
}
const snapshot = () => JSON.stringify({ tasks, owners: extraOwners });
async function change(fn, versionBasis = null) {
  if (!requireEditor()) return false;
  const basis = cloudEngine?.managed ? cloudEngine.capture() : null;
  const before = snapshot();
  try {
    fn();
    tasks = validateBoard(tasks);
  } catch (error) {
    const previous = JSON.parse(before);
    tasks = previous.tasks;
    extraOwners = previous.owners;
    throw error;
  }
  let ok = true;
  if (snapshot() !== before) {
    const undo = cloudEngine?.managed
      ? {
          before: JSON.parse(before),
          after: JSON.parse(snapshot()),
          basis: null,
        }
      : before;
    history.push(undo);
    if (history.length > 50) history.shift();
    future = [];
    unsavedChanges = true;
    try {
      if (cloudEngine?.managed)
        await cloudEngine.changed({
          basis,
          desired: { tasks: structuredClone(tasks), owners: [...extraOwners] },
          versionBasis,
        });
      else cloudEngine?.changed();
      ok = persist();
      if (cloudEngine?.managed) {
        unsavedChanges = false;
        ok = true;
        undo.basis = cloudEngine.capture();
      }
    } catch (error) {
      cloudEngine?.reproject();
      toast(error.message);
      ok = false;
    }
  } else if (storageFailed || unsavedChanges) ok = persist();
  render();
  return ok;
}
async function restore(from, to) {
  if (!requireEditor()) return;
  if (!from.length) return;
  if (!cloudEngine?.managed) {
    to.push(snapshot());
    const state = JSON.parse(from.pop());
    tasks = state.tasks;
    extraOwners = state.owners;
    cloudEngine?.changed();
    persist();
    render();
    return;
  }
  const record = from.pop(),
    desired = { tasks: structuredClone(tasks), owners: [...extraOwners] },
    before = new Map(record.before.tasks.map((t) => [t.id, t])),
    after = new Map(record.after.tasks.map((t) => [t.id, t]));
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const b = before.get(id),
      a = after.get(id),
      index = desired.tasks.findIndex((t) => t.id === id);
    if (!b && a) {
      if (index >= 0) desired.tasks.splice(index, 1);
      continue;
    }
    if (b && !a) {
      if (index < 0) desired.tasks.push(b);
      continue;
    }
    if (index < 0) continue;
    for (const key of Object.keys(b))
      if (JSON.stringify(b[key]) !== JSON.stringify(a[key])) {
        if (key === "positions") {
          for (const view of new Set([
            ...Object.keys(b.positions),
            ...Object.keys(a.positions),
          ]))
            if (
              JSON.stringify(b.positions[view]) !==
              JSON.stringify(a.positions[view])
            ) {
              if (b.positions[view])
                desired.tasks[index].positions[view] = structuredClone(
                  b.positions[view],
                );
              else delete desired.tasks[index].positions[view];
            }
        } else desired.tasks[index][key] = structuredClone(b[key]);
      }
  }
  desired.owners = [
    ...new Set([
      ...desired.owners.filter(
        (name) =>
          !record.after.owners.includes(name) ||
          record.before.owners.includes(name),
      ),
      ...record.before.owners.filter(
        (name) => !record.after.owners.includes(name),
      ),
    ]),
  ];
  const current = { tasks: structuredClone(tasks), owners: [...extraOwners] },
    basis = cloudEngine.capture();
  try {
    await cloudEngine.changed({ basis, desired, versionBasis: record.basis });
    to.push({ before: current, after: desired, basis: cloudEngine.capture() });
    persist();
    render();
    toast("Отмена сохранена. При параллельной правке появится выбор версии.");
  } catch (error) {
    from.push(record);
    toast(error.message);
  }
}
function applyPreferences() {
  document.documentElement.dataset.theme =
    preferences.theme === "system"
      ? matchMedia("(prefers-color-scheme:dark)").matches
        ? "dark"
        : "light"
      : preferences.theme;
  document.documentElement.dataset.density = preferences.density;
  $("#theme-choice").value = preferences.theme;
  $("#density-choice").value = preferences.density;
  document.querySelector('meta[name="theme-color"]').content = getComputedStyle(
    document.documentElement,
  )
    .getPropertyValue("--bg")
    .trim();
}
applyPreferences();
matchMedia("(prefers-color-scheme:dark)").addEventListener(
  "change",
  applyPreferences,
);
for (const id of ["theme-choice", "density-choice"])
  $(`#${id}`).onchange = () => {
    preferences = cleanPreferences({
      theme: $("#theme-choice").value,
      density: $("#density-choice").value,
    });
    applyPreferences();
    try {
      storage.setItem(PREFS, JSON.stringify(preferences));
      text("#preferences-error", "");
    } catch {
      text(
        "#preferences-error",
        "Настройки применены, но не сохранились на устройстве.",
      );
    }
  };
function showDialog(id) {
  const dialog = $("#" + id);
  if (!dialog.open) dialog.showModal();
}
function closeDialog(id) {
  if (id === "editor") saveDraft();
  if (id === "cloud-dialog") cancelConnection();
  $("#" + id).close();
}
$$("[data-close]").forEach(
  (b) => (b.onclick = () => closeDialog(b.dataset.close)),
);
$$("dialog").forEach((dialog) =>
  dialog.addEventListener("cancel", () => {
    if (dialog.id === "editor") saveDraft();
    if (dialog.id === "cloud-dialog") cancelConnection();
  }),
);
$("#editor").addEventListener("close", () => {
  renderDraftBanner();
  if (cloudEngine?.connected) cloudEngine.later(250);
});
$("#appearance-open").onclick = () => showDialog("appearance-dialog");
$("#help-open").onclick = () => showDialog("help-dialog");
function placeFilters() {
  const mobile = matchMedia("(max-width:767px)").matches;
  const slot = $(mobile ? "#mobile-filters-slot" : "#desktop-filters-slot");
  if ($("#filter-panel").parentElement !== slot)
    slot.append($("#filter-panel"));
  if (!mobile && $("#filters-dialog").open) $("#filters-dialog").close();
}
placeFilters();
matchMedia("(max-width:767px)").addEventListener("change", placeFilters);
$("#filters-open").onclick = () => showDialog("filters-dialog");
function setOptions(select, html) {
  if (select.dataset.options === html) return;
  const value = select.value;
  select.innerHTML = html;
  select.dataset.options = html;
  if ([...select.options].some((o) => o.value === value)) select.value = value;
}
function updateOptions() {
  const units = [...new Set(tasks.map((t) => t.unit).filter(Boolean))].sort(),
    owners = [
      ...new Set([
        ...tasks.map((t) => t.owner).filter(Boolean),
        ...extraOwners,
      ]),
    ].sort();
  for (const [id, values, label] of [
    ["unit-filter", units, "Все юниты"],
    ["owner-filter", owners, "Вся команда"],
  ])
    setOptions(
      $("#" + id),
      `<option value="">${label}</option>` +
        (id === "owner-filter"
          ? '<option value="__none">Без ответственного</option>'
          : "") +
        values
          .map(
            (v) =>
              `<option value="${esc(id === "owner-filter" ? "owner:" + v : v)}">${esc(v)}</option>`,
          )
          .join(""),
    );
  setOptions(
    $("#owner-list"),
    owners.map((v) => `<option value="${esc(v)}"></option>`).join(""),
  );
  setOptions(
    $("#unit-list"),
    units.map((v) => `<option value="${esc(v)}"></option>`).join(""),
  );
}
function matchesFilters(task) {
  return (
    (!$("#unit-filter").value || task.unit === $("#unit-filter").value) &&
    (!$("#owner-filter").value ||
      ($("#owner-filter").value === "__none"
        ? !task.owner
        : `owner:${task.owner}` === $("#owner-filter").value)) &&
    matchesTask(task, $("#search").value)
  );
}
const isVisible = (task) =>
  matchesFilters(task) && (!$("#hide-done").checked || !statusGroup(task));
const formatDate = (value) =>
  value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("ru", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Без срока";
function renderProvenance() {
  if (!DEMO && accessMode === "view") {
    const checked = viewerReadAt
      ? new Date(viewerReadAt).toLocaleString("ru", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "ещё не подтверждено";
    text(
      "#data-freshness",
      (viewerState.status === "view-live"
        ? "Актуальная общая доска. "
        : viewerHasBaseline
          ? "Показана последняя доступная копия. "
          : "Подключаемся к общей доске. ") +
        `Проверено: ${checked}. Изменения таблицы поступают через подключённого участника команды.`,
    );
    return;
  }
  const source = DEMO
    ? "Демонстрационные данные"
    : syncState.lastReadAt
      ? "Google Таблица, первая вкладка"
      : "Копия на этом устройстве";
  const checked = syncState.lastReadAt
    ? `Прочитана ${new Date(syncState.lastReadAt).toLocaleString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.`
    : "Дата проверки неизвестна.";
  text(
    "#data-freshness",
    `Источник: ${source}. ${DEMO ? "Отдельная тестовая доска." : checked}${syncState.pending ? " Есть неотправленные изменения." : ""}${!DEMO && synchronizationHint(syncState) ? " " + synchronizationHint(syncState) : ""}`,
  );
}
function renderEmpty() {
  $("#add").classList.toggle("primary", tasks.length > 0);
  $("#add").classList.toggle("quiet", tasks.length === 0);
  const state =
    !DEMO && accessMode === "view" && !tasks.length
      ? {
          title:
            viewerState.status === "view-loading"
              ? "Загружаем общую доску"
              : viewerState.status === "view-live"
                ? "На доске пока нет задач"
                : "Доска пока недоступна",
          body:
            viewerState.status === "view-live"
              ? "Для добавления задачи войдите через свой Google."
              : "Просмотр работает без Google-входа. Подключаемся к общей доске.",
          action: null,
          label: "",
        }
      : emptyState({
          count: tasks.length,
          hasBaseline: !!cloudEngine?.base,
          status: syncState.status,
          demo: DEMO,
        });
  $("#empty").hidden = !state;
  if (!state) return;
  text("#empty-title", state.title);
  text("#empty-copy", state.body);
  text("#empty-import", state.label);
  $("#empty-import").hidden = !state.action;
  $("#empty-import").onclick = () =>
    state.action === "create"
      ? openTask()
      : state.action === "examples"
        ? (change(() => (tasks = demoTasks())), fit())
        : showDialog("cloud-dialog");
  $("#demo").hidden = DEMO;
  $("#empty-import-file").hidden = !state.action;
}
function cardMarkup(task) {
  const p = layout.placed.get(task.id);
  if (!p) return "";
  const notice = inbox.get(task.id),
    badge = notice
      ? notice.kind === "new"
        ? "Новая из таблицы"
        : "Обновлена из таблицы"
      : "";
  const initials = task.owner
    ? task.owner
        .split(/\s+/)
        .slice(0, 2)
        .map((s) => s[0])
        .join("")
    : "·";
  return `<article tabindex="0" role="button" aria-label="${esc(task.title)}. ${badge ? badge + ". " : ""}Открыть детали" class="task-card${selected === task.id ? " selected" : ""}${notice ? " unread-change " + (notice.kind === "new" ? "unread-new" : "unread-updated") : ""}" data-id="${esc(task.id)}" style="left:${p.x}px;top:${p.y}px">${notice ? `<span class="change-badge">${badge}</span>` : ""}<div class="card-top"><span class="unit-tag">${esc(task.unit || "Задача")}</span><span class="card-id">${task.sourceId ? "#" + esc(task.sourceId) : ""}</span><span class="status-text"><i class="status-dot ${task.status === "Готово" ? "done" : task.status === "Отменено" ? "cancelled" : task.status === "В работе" ? "working" : ""}"></i>${esc(task.status || "Не указан")}</span></div><h3>${esc(task.title)}</h3><div class="card-direction">${esc(task.direction || task.description)}</div><div class="card-bottom"><span class="avatar">${esc(initials)}</span><span class="owner-name">${esc(task.owner || (task.ownerNote ? "Уточнить ответственного" : "Не назначен"))}</span><span class="date${task.due && task.due < today() && !statusGroup(task) ? " overdue" : ""}">${esc(formatDate(task.due))}</span></div></article>`;
}
function listMarkup(visible) {
  return `<table role="table" aria-label="Задачи команды"><thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col" class="title-col">Задача</th><th role="columnheader" scope="col" class="owner-col">Ответственный</th><th role="columnheader" scope="col" class="date-col">Срок</th><th role="columnheader" scope="col" class="status-col">Статус</th></tr></thead><tbody role="rowgroup">${visible
    .map((task) => {
      const notice = inbox.get(task.id);
      return `<tr role="row" data-row="${esc(task.id)}" class="${notice ? (notice.kind === "new" ? "unread-new" : "unread-updated") : ""}"><td role="cell" data-label="Задача"><button class="row-open" data-open="${esc(task.id)}">${esc(task.title)}</button><div class="row-meta">${notice ? `<span class="row-change">${notice.kind === "new" ? "Новая" : "Обновлена"}</span>` : ""}${esc([task.unit, task.sourceId ? "#" + task.sourceId : ""].filter(Boolean).join(" · "))}</div></td><td role="cell" data-label="Ответственный">${esc(task.owner || (task.ownerNote ? "Уточнить в деталях" : "Не назначен"))}</td><td role="cell" data-label="Срок" class="${task.due && task.due < today() && !statusGroup(task) ? "overdue" : ""}">${esc(formatDate(task.due))}</td><td role="cell" data-label="Статус"><select class="row-status" ${canEdit() ? "" : "disabled"} data-status-id="${esc(task.id)}" aria-label="Статус: ${esc(task.title)}">${[
        ...new Set([...STATUSES, task.status]),
      ]
        .filter(Boolean)
        .map(
          (s) =>
            `<option${task.status === s ? " selected" : ""}>${esc(s)}</option>`,
        )
        .join("")}</select></td></tr>`;
    })
    .join("")}</tbody></table>`;
}
function render() {
  const focusedStatus = document.activeElement?.dataset?.statusId;
  cloudRenderNeeded = false;
  renderedDay = today();
  renderChanges();
  updateOptions();
  renderDraftBanner();
  const visible = tasks.filter(isVisible),
    matching = tasks.filter(matchesFilters),
    canvasMode = mode === "list" ? lastCanvasMode : mode;
  layout = createLayout(visible, canvasMode, today(), [
    ...new Set([...extraOwners, ...tasks.map((t) => t.owner).filter(Boolean)]),
  ]);
  for (const lane of STATUS_LANES)
    text(
      `[data-status-count="${lane.id}"]`,
      matching.filter((t) => statusGroup(t) === lane.id).length,
    );
  setOptions(
    $("#lane-jump"),
    '<option value="">К дорожке</option>' +
      layout.groups
        .map((g) => `<option value="${esc(g.id)}">${esc(g.title)}</option>`)
        .join(""),
  );
  text("#task-count", visible.length);
  text(
    "#task-scope",
    visible.length === tasks.length
      ? `всего задач: ${tasks.length}`
      : `показано из ${tasks.length}`,
  );
  const info = {
    priority: ["Планирование", "Приоритеты", "Перенос меняет приоритет"],
    owners: ["Ответственность", "Команда", "Перенос назначает ответственного"],
    time: ["Планирование", "Сроки", "Перенос меняет дату"],
    list: ["Все задачи", "Список", "Откройте название, чтобы изменить задачу"],
  }[mode];
  text("#view-kicker", info[0]);
  text("#view-title", info[1]);
  text(
    "#view-hint",
    canEdit() ? info[2] : "Просмотр. Откройте карточку для подробностей.",
  );
  $$("[data-mode]").forEach((el) => {
    el.classList.toggle("active", el.dataset.mode === mode);
    el.setAttribute("aria-pressed", String(el.dataset.mode === mode));
  });
  $("#new-owner").hidden = !canEdit() || mode !== "owners";
  $("#lane-jump").hidden = mode === "list";
  $("#viewport").hidden = mode === "list";
  $("#task-list").hidden = mode !== "list";
  $(".canvas-footer").hidden = mode === "list";
  $(".zoom-controls").hidden = mode === "list" || !visible.length;
  const filterCount = [
    $("#unit-filter").value,
    $("#owner-filter").value,
    $("#hide-done").checked,
  ].filter(Boolean).length;
  text("#filter-count", filterCount ? `Фильтры · ${filterCount}` : "Фильтры");
  if (mode === "list") $("#task-list").innerHTML = listMarkup(visible);
  else {
    $("#zones").innerHTML = layout.groups
      .map(
        (g, i) =>
          `<section class="zone ${g.id === "status:done" ? "green" : g.id === "status:cancelled" ? "cancelled" : ""}" data-group="${esc(g.id)}" style="left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.h}px"><div class="zone-header"><span class="zone-number">${g.symbol || String(i + 1).padStart(2, "0")}</span><div><h3>${esc(g.title)}</h3><p>${esc(g.subtitle)}</p></div><span class="zone-count">${visible.filter((t) => groupFor(t, canvasMode, today()) === g.id).length}</span></div></section>`,
      )
      .join("");
    $("#cards").innerHTML = visible.map(cardMarkup).join("");
  }
  renderEmpty();
  $("#no-results").hidden = !tasks.length || !!visible.length;
  $("#undo").disabled = !canEdit() || !history.length;
  $("#redo").disabled = !canEdit() || !future.length;
  renderProvenance();
  renderAlert();
  applyCamera();
  if (focusedStatus)
    $$("[data-status-id]")
      .find((el) => el.dataset.statusId === focusedStatus)
      ?.focus({ preventScroll: true });
}
function applyCamera() {
  $("#world").style.transform =
    `translate(${camera.x}px,${camera.y}px) scale(${camera.z})`;
  $("#viewport").style.backgroundSize = `${24 * camera.z}px ${24 * camera.z}px`;
  $("#viewport").style.backgroundPosition = `${camera.x}px ${camera.y}px`;
  text(
    "#zoom-label",
    `${camera.z < 0.01 ? (camera.z * 100).toFixed(1) : Math.round(camera.z * 100)}%`,
  );
}
function zoom(factor, point) {
  const rect = $("#viewport").getBoundingClientRect();
  point ||= { x: rect.width / 2, y: rect.height / 2 };
  const next = Math.max(0.0001, Math.min(2, camera.z * factor));
  camera.x = point.x - ((point.x - camera.x) * next) / camera.z;
  camera.y = point.y - ((point.y - camera.y) * next) / camera.z;
  camera.z = next;
  applyCamera();
}
function fit() {
  if (mode === "list") return;
  const visible = tasks.filter(isVisible);
  if (!visible.length) return;
  const rect = $("#viewport").getBoundingClientRect();
  camera = fitCamera(
    visible.map((t) => layout.placed.get(t.id)).filter(Boolean),
    rect.width,
    rect.height,
  );
  applyCamera();
  persist();
}
function worldPoint(event) {
  const r = $("#viewport").getBoundingClientRect();
  return {
    x: (event.clientX - r.left - camera.x) / camera.z,
    y: (event.clientY - r.top - camera.y) / camera.z,
  };
}
function statusDropTarget(event) {
  const button = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest("[data-status-zone]");
  return button
    ? layout.groups.find((group) => group.id === button.dataset.statusZone)
    : null;
}
$("#viewport").addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const rect = $("#viewport").getBoundingClientRect();
      zoom(Math.exp(-e.deltaY * 0.008), {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    } else {
      camera.x -= e.deltaX;
      camera.y -= e.deltaY;
      applyCamera();
    }
    clearTimeout(window.cameraSave);
    window.cameraSave = setTimeout(persist, 250);
  },
  { passive: false },
);
const touches = new Map();
let pinch = null;
$("#viewport").addEventListener("pointerdown", (e) => {
  if (e.target.closest("#empty, #no-results")) return;
  if (e.pointerType === "touch") {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) {
      if (gesture?.type === "card") {
        render();
      }
      gesture = null;
      const [a, b] = [...touches.values()];
      const r = $("#viewport").getBoundingClientRect();
      pinch = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        camera: { ...camera },
        center: { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top },
      };
      $("#viewport").setPointerCapture(e.pointerId);
      return;
    }
  }
  if (e.button !== 0 && e.button !== 1) return;
  const card = e.target.closest(".task-card");
  const p = worldPoint(e);
  if (card && !space && e.button === 0) {
    if (!canEdit()) {
      selected = card.dataset.id;
      card.focus({ preventScroll: true });
      return;
    }
    selected = card.dataset.id;
    document
      .querySelectorAll(".task-card")
      .forEach((c) => c.classList.toggle("selected", c === card));
    const original = layout.placed.get(selected);
    gesture = {
      type: "card",
      basis: cloudEngine?.managed ? cloudEngine.capture() : null,
      id: selected,
      pointer: e.pointerId,
      start: { x: e.clientX, y: e.clientY },
      dx: p.x - original.x,
      dy: p.y - original.y,
      original,
      moved: false,
      card,
    };
    card.focus({ preventScroll: true });
  } else {
    gesture = {
      type: "pan",
      pointer: e.pointerId,
      start: { x: e.clientX, y: e.clientY },
      camera: { ...camera },
    };
    $("#viewport").classList.add("panning");
  }
  (gesture.type === "card" ? card : $("#viewport")).setPointerCapture(
    e.pointerId,
  );
});
$("#viewport").addEventListener("pointermove", (e) => {
  if (touches.has(e.pointerId))
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && touches.size === 2) {
    const [a, b] = [...touches.values()];
    const r = $("#viewport").getBoundingClientRect();
    const center = { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
    const z = Math.max(
      0.0001,
      Math.min(
        2,
        (pinch.camera.z * Math.hypot(a.x - b.x, a.y - b.y)) /
          Math.max(1, pinch.distance),
      ),
    );
    camera = {
      z,
      x: center.x - ((pinch.center.x - pinch.camera.x) * z) / pinch.camera.z,
      y: center.y - ((pinch.center.y - pinch.camera.y) * z) / pinch.camera.z,
    };
    applyCamera();
    return;
  }
  if (!gesture || e.pointerId !== gesture.pointer) return;
  if (gesture.type === "pan") {
    camera.x = gesture.camera.x + e.clientX - gesture.start.x;
    camera.y = gesture.camera.y + e.clientY - gesture.start.y;
    applyCamera();
    return;
  }
  if (
    Math.hypot(e.clientX - gesture.start.x, e.clientY - gesture.start.y) < 4 &&
    !gesture.moved
  )
    return;
  gesture.moved = true;
  gesture.card.classList.add("dragging");
  const p = worldPoint(e);
  const x = p.x - gesture.dx,
    y = p.y - gesture.dy;
  gesture.card.style.left = `${x}px`;
  gesture.card.style.top = `${y}px`;
  const group =
    statusDropTarget(e) ||
    dropTarget(layout.groups, x + CARD.width / 2, y + CARD.height / 2);
  document
    .querySelectorAll(".zone")
    .forEach((el) =>
      el.classList.toggle("drop-target", el.dataset.group === group?.id),
    );
  document
    .querySelectorAll(".status-shortcut")
    .forEach((el) =>
      el.classList.toggle("drop-target", el.dataset.statusZone === group?.id),
    );
});
async function endGesture(e, cancelled = false) {
  touches.delete(e.pointerId);
  if (pinch) {
    if (touches.size < 2) {
      pinch = null;
      gesture = null;
      persist();
      render();
    }
    return;
  }
  if (!gesture || gesture.pointer !== e.pointerId) return;
  const current = gesture;
  gesture = null;
  $("#viewport").classList.remove("panning");
  if (current.type === "pan") {
    persist();
    return;
  }
  if (current.moved && !cancelled) {
    const p = worldPoint(e),
      x = p.x - current.dx,
      y = p.y - current.dy;
    const shortcut = statusDropTarget(e),
      target =
        shortcut ||
        dropTarget(layout.groups, x + CARD.width / 2, y + CARD.height / 2);
    if (target) {
      try {
        const task = tasks.find((t) => t.id === current.id);
        const index = shortcut
          ? tasks.filter(
              (t) =>
                t.id !== task.id && groupFor(t, mode, today()) === target.id,
            ).length
          : 0;
        const next = moveTask(
          task,
          mode,
          target,
          shortcut ? target.x + 24 + (index % 2) * 312 : x,
          shortcut ? target.y + 96 + Math.floor(index / 2) * 216 : y,
          today(),
        );
        if (statusGroup(next)) $("#hide-done").checked = false;
        await change(
          () => (tasks = tasks.map((t) => (t.id === current.id ? next : t))),
          current.basis,
        );
        const label = target.status
          ? `Статус: ${next.status}`
          : mode === "priority"
            ? target.title
            : mode === "owners"
              ? `Ответственный: ${next.owner || "не назначен"}`
              : `Срок: ${next.due || "не указан"}`;
        savedToast(
          statusGroup(task) && !statusGroup(next)
            ? `В работе · ${label}`
            : label,
        );
      } catch (error) {
        toast(error.message);
        render();
      }
    } else {
      render();
      toast("Поместите карточку внутрь дорожки.");
    }
  } else if (cancelled) render();
}
$("#viewport").addEventListener("pointerup", (e) => endGesture(e));
$("#viewport").addEventListener("pointercancel", (e) => endGesture(e, true));
$("#cards").addEventListener("dblclick", (e) => {
  const card = e.target.closest("[data-id]");
  if (card) openTask(card.dataset.id);
});
$("#cards").addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.code === "Space") {
    e.preventDefault();
    e.stopPropagation();
    openTask(e.target.closest("[data-id]").dataset.id);
  }
});
const field = (name) => $(`#task-form [name="${name}"]`);
const formValues = () =>
  Object.fromEntries(EDIT_FIELDS.map((key) => [key, field(key).value]));
function renderDraftBanner() {
  if (!canEdit()) {
    $("#draft-banner").hidden = true;
    return;
  }
  const result = draftRecords();
  $("#draft-banner").hidden = !result.drafts.length && !result.errors.length;
  text(
    "#draft-summary",
    result.errors.length
      ? "Часть черновиков не читается. Исходные записи оставлены на устройстве."
      : `Несохранённые черновики: ${result.drafts.length}`,
  );
}
function saveDraft() {
  if (!canEdit()) return true;
  if (!$("#editor").open) return true;
  const result = drafts.save(editing, editingBase, formValues());
  if (result.ok) memoryDrafts.delete(editing);
  else
    memoryDrafts.set(editing, {
      version: 1,
      id: editing,
      base: editorValues(editingBase),
      values: formValues(),
      updatedAt: Date.now(),
    });
  draftFailed = memoryDrafts.size > 0;
  text(
    "#draft-state",
    result.ok
      ? "Черновик сохраняется на этом устройстве"
      : "Черновик только в открытом редакторе",
  );
  if (!result.ok)
    text(
      "#editor-error",
      result.message + " Скопируйте введённый текст перед закрытием.",
    );
  renderDraftBanner();
  return result.ok;
}
function renderEditorConflicts() {
  const readOnly = !canEdit();
  $$("#task-form input, #task-form select, #task-form textarea").forEach(
    (control) => (control.disabled = readOnly),
  );
  $("#editor-signin").hidden = !readOnly;
  if (readOnly) {
    $("#save-task").hidden = true;
    $("#recreate-task").hidden = true;
    $("#delete-task").hidden = true;
    text(
      "#draft-state",
      "Только просмотр. Войдите через Google, чтобы изменить задачу.",
    );
    $("#editor-conflicts").innerHTML = "";
    return [];
  }

  const current = tasks.find((t) => t.id === editing),
    missing = editing !== null && !current;
  $("#save-task").hidden = missing;
  $("#recreate-task").hidden = !missing;
  $("#delete-task").hidden = editing === null || missing;
  if (missing)
    text(
      "#editor-error",
      "Эта задача убрана с доски. Введённый текст сохранён в черновике. Создать новую копию можно отдельной кнопкой.",
    );
  const conflicts = editConflicts(current, editingBase, formValues());
  $("#editor-conflicts").innerHTML = conflicts
    .map(
      (c) =>
        `<section class="notice"><strong>Две версии: ${esc(FIELD_NAMES[c.field] || c.field)}</strong><p>Общая версия</p><pre>${esc(c.remote || "Пусто")}</pre><p>Ваш текст</p><pre>${esc(c.local || "Пусто")}</pre><div class="editor-conflict-actions"><button type="button" class="button quiet" data-editor-field="${c.field}" data-editor-choice="remote">Взять общую версию</button><button type="button" class="button quiet" data-editor-field="${c.field}" data-editor-choice="local">Оставить мой текст</button></div></section>`,
    )
    .join("");
  return conflicts;
}
function openTask(id = null, chosenDraft = null) {
  if (id === null && !requireEditor()) return;
  editingVersionBasis = cloudEngine?.managed ? cloudEngine.capture() : null;
  editing = id;
  const current = tasks.find((t) => t.id === id);
  let draft = null;
  let draftError = "";
  try {
    draft = canEdit()
      ? chosenDraft || memoryDrafts.get(id) || drafts.read(id)
      : null;
  } catch (error) {
    draftError = error.message;
  }
  const task = current || {
    title: "",
    status: "В ожидании",
    unit: $("#unit-filter").value,
    owner: "",
    due: "",
    priority: "",
  };
  const resumed = resumeDraft(task, draft);
  if (id !== null && !current && draft) {
    resumed.values = draft.values;
    resumed.base = draft.base;
  }
  editingBase = resumed.base;
  $("#task-form").reset();
  field("status").innerHTML = [
    ...new Set([
      ...STATUSES,
      ...tasks.map((t) => t.status).filter(Boolean),
      resumed.values.status,
    ]),
  ]
    .filter(Boolean)
    .map((s) => `<option>${esc(s)}</option>`)
    .join("");
  for (const key of EDIT_FIELDS) field(key).value = resumed.values[key];
  text(
    "#editor-id",
    current?.sourceId
      ? `Задача #${current.sourceId}`
      : id
        ? "Задача"
        : "Новая задача",
  );
  text("#editor-title", id ? "Детали задачи" : "Новая задача");
  text("#editor-error", draftError);
  text(
    "#draft-state",
    draft
      ? "Восстановлен черновик на этом устройстве"
      : "Изменения до сохранения остаются в черновике",
  );
  text("#owner-note", task.ownerNote ? `Из таблицы: ${task.ownerNote}` : "");
  text("#due-note", task.dueNote ? `Исходный срок: ${task.dueNote}` : "");
  text(
    "#source-context",
    [
      task.direction && `Направление: ${task.direction}`,
      task.requester && `Постановщик: ${task.requester}`,
      task.dependency && `Зависимости и уточнения: ${task.dependency}`,
    ]
      .filter(Boolean)
      .join("\n\n") || "Дополнительного контекста нет.",
  );
  $("#source-link").hidden = !/^https?:\/\//.test(task.link || "");
  if (!$("#source-link").hidden) $("#source-link").href = task.link;
  const notice = inbox.get(id);
  $("#editor-update").hidden = !notice;
  text(
    "#editor-update",
    notice
      ? `${notice.kind === "new" ? "Новая задача из таблицы" : "Обновлено: " + notice.fields.map((f) => CHANGE_FIELDS[f]).join(", ")}. Отмечено просмотренным на этом устройстве.`
      : "",
  );
  if (notice) {
    inbox.acknowledge(id);
    render();
    persist();
  }
  renderEditorConflicts();
  showDialog("editor");
}
$("#task-form").addEventListener("input", () => {
  text("#editor-error", "");
  saveDraft();
});
$("#task-form").addEventListener("change", saveDraft);
$("#editor-conflicts").onclick = (e) => {
  const button = e.target.closest("[data-editor-field]");
  if (!button) return;
  const key = button.dataset.editorField,
    current = tasks.find((t) => t.id === editing);
  if (!current) return renderEditorConflicts();
  if (button.dataset.editorChoice === "remote")
    field(key).value = editorValues(current)[key];
  editingBase[key] = editorValues(current)[key];
  if (editingVersionBasis && cloudEngine.managed) {
    const latest = cloudEngine.capture().entries.get(editing),
      old = editingVersionBasis.entries.get(editing);
    const group = { owner: "assignment", due: "schedule" }[key] || key;
    if (latest && old) old.versions[group] = latest.versions[group];
  }
  text("#editor-error", "");
  saveDraft();
  renderEditorConflicts();
};
async function submitTask(forceNew = false) {
  if (!requireEditor()) return;
  if (submitTask.busy) return;
  const plan = planEdit({
    tasks,
    id: editing,
    base: editingBase,
    values: formValues(),
    createId: () => crypto.randomUUID(),
    forceNew,
  });
  if (plan.kind === "missing") {
    saveDraft();
    renderEditorConflicts();
    return;
  }
  if (plan.kind === "conflict") {
    text(
      "#editor-error",
      "Поля обновились в другом месте. Выберите версии ниже.",
    );
    renderEditorConflicts();
    return;
  }
  if (plan.kind === "invalid") {
    text("#editor-error", plan.message);
    if (plan.field) field(plan.field).focus();
    return;
  }
  if (statusGroup(plan.task)) $("#hide-done").checked = false;
  const before = snapshot(),
    undoCount = history.length;
  submitTask.busy = true;
  const ok = await change(() => (tasks = plan.tasks), editingVersionBasis);
  submitTask.busy = false;
  if (!ok) {
    const prior = JSON.parse(before);
    tasks = prior.tasks;
    extraOwners = prior.owners;
    if (history.length > undoCount) history.pop();
    render();
    saveDraft();
    text(
      "#editor-error",
      "Не удалось сохранить доску. Черновик оставлен. Скачайте копию доски перед закрытием.",
    );
    return;
  }
  try {
    drafts.remove(editing);
    memoryDrafts.delete(editing);
    draftFailed = memoryDrafts.size > 0;
  } catch {
    toast("Задача сохранена, но старый черновик не удалось убрать.");
  }
  $("#editor").close();
  renderDraftBanner();
  savedToast("Задача сохранена");
}
$("#task-form").onsubmit = (e) => {
  e.preventDefault();
  submitTask();
};
$("#recreate-task").onclick = () => submitTask(true);
$("#delete-task").onclick = async () => {
  if (!requireEditor()) return;
  const id = editing;
  if (!tasks.some((t) => t.id === id)) return renderEditorConflicts();
  if (
    !(await change(
      () => (tasks = tasks.filter((t) => t.id !== id)),
      editingVersionBasis,
    ))
  )
    return;
  try {
    drafts.remove(id);
    memoryDrafts.delete(id);
    draftFailed = memoryDrafts.size > 0;
  } catch {}
  $("#editor").close();
  renderDraftBanner();
  savedToast("Убрано с доски. Можно отменить. В таблице строка архивируется.");
};
$("#add").onclick = () => openTask();
$("#task-list").onclick = (e) => {
  const b = e.target.closest("[data-open]");
  if (b) openTask(b.dataset.open);
};
$("#task-list").onchange = async (e) => {
  const id = e.target.dataset.statusId;
  if (!id) return;
  const status = e.target.value;
  await change(
    () => (tasks = tasks.map((t) => (t.id === id ? { ...t, status } : t))),
  );
  savedToast("Статус изменён");
};
$("#drafts-open").onclick = () => {
  if (!requireEditor()) return;
  const result = draftRecords();
  $("#draft-list").innerHTML =
    result.drafts
      .map(
        (draft, i) =>
          `<section class="draft-item"><h3>${esc(draft.values.title || "Новая задача")}</h3><p>${esc(new Date(draft.updatedAt).toLocaleString("ru"))}${draft.id !== null && !tasks.some((t) => t.id === draft.id) ? " · Исходная задача убрана с доски" : ""}</p><button class="button quiet" data-draft="${i}">Продолжить</button> <button class="text-button" data-discard-draft="${i}">Удалить черновик</button></section>`,
      )
      .join("") +
    (result.errors.length
      ? '<p class="error">Некоторые записи повреждены. Они не были перезаписаны.</p>'
      : "");
  $("#draft-list").onclick = (e) => {
    const open = e.target.closest("[data-draft]"),
      discard = e.target.closest("[data-discard-draft]");
    const draft =
      result.drafts[
        Number(open?.dataset.draft ?? discard?.dataset.discardDraft)
      ];
    if (!draft) return;
    if (open) {
      $("#drafts-dialog").close();
      openTask(draft.id, draft);
    } else if (discard) {
      try {
        if (drafts.discard) drafts.discard(draft);
        else drafts.remove(draft.id);
        memoryDrafts.delete(draft.id);
        draftFailed = memoryDrafts.size > 0;
        renderDraftBanner();
        $("#drafts-open").click();
      } catch {
        toast("Не удалось удалить черновик.");
      }
    }
  };
  showDialog("drafts-dialog");
};
$("#new-owner").onclick = () => {
  if (!requireEditor()) return;
  text("#owner-error", "");
  $("#owner-name").value = "";
  showDialog("owner-dialog");
};
$("#owner-form").onsubmit = async (e) => {
  e.preventDefault();
  if (!requireEditor()) return;
  const name = parseAssignee($("#owner-name").value);
  if (!name) {
    text("#owner-error", "Укажите одного человека: имя или имя и фамилию.");
    return;
  }
  if (extraOwners.includes(name) || tasks.some((t) => t.owner === name)) {
    text("#owner-error", "Такая дорожка уже есть.");
    return;
  }
  if (!(await change(() => extraOwners.push(name)))) return;
  $("#owner-dialog").close();
  jumpToGroup(`owner:${name}`, true);
};
function invalidateImport() {
  importPlan = null;
  $("#import-preview").hidden = true;
  $("#import-confirm-label").hidden = true;
  $("#import-confirm").checked = false;
  text("#import-submit", "Проверить импорт");
}
function openImport() {
  if (!requireEditor()) return;
  text("#import-error", "");
  invalidateImport();
  showDialog("import-dialog");
}
$("#import-open").onclick = openImport;
$("#empty-import-file").onclick = openImport;
for (const id of ["import-text", "replace-import"])
  $("#" + id).addEventListener(
    id === "import-text" ? "input" : "change",
    invalidateImport,
  );
$("#import-file").onchange = async (e) => {
  invalidateImport();
  try {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) throw new Error("Файл больше 10 МБ.");
      $("#import-text").value = await file.text();
    }
  } catch (error) {
    text(
      "#import-error",
      error.message || "Не удалось прочитать файл. Вставьте текст.",
    );
  }
};
$("#import-submit").onclick = async () => {
  if (!requireEditor()) return;
  try {
    text("#import-error", "");
    const source = $("#import-text").value,
      replace = $("#replace-import").checked,
      signature = snapshot();
    if (
      !importPlan ||
      importPlan.source !== source ||
      importPlan.replace !== replace ||
      importPlan.signature !== signature
    ) {
      const result = importBoard(source, tasks, extraOwners, { replace });
      const summary = importSummary(tasks, result.tasks);
      importPlan = { source, replace, signature, result, summary };
      $("#import-preview").hidden = false;
      text(
        "#import-preview",
        `Добавится: ${summary.added}. Изменится: ${summary.changed}. Уберётся с доски: ${summary.removed}. После импорта: ${summary.total}.`,
      );
      $("#import-confirm-label").hidden = !summary.removed;
      text(
        "#import-confirm-text",
        `Подтверждаю: ${summary.removed} текущих задач уберутся с доски и будут архивированы в подключённой таблице.`,
      );
      $("#import-confirm").checked = false;
      text("#import-submit", "Применить импорт");
      return;
    }
    if (importPlan.summary.removed && !$("#import-confirm").checked)
      throw new Error("Подтвердите удаление задач с доски в строке выше.");
    const plan = importPlan;
    const ok = await change(() => {
      tasks = plan.result.tasks;
      extraOwners = plan.result.owners;
    });
    if (ok) {
      clearFilters();
      $("#import-dialog").close();
      invalidateImport();
      savedToast(`Импорт применён. Всего задач: ${tasks.length}.`);
    } else
      text(
        "#import-error",
        "Импорт находится в памяти. Скачайте копию доски перед закрытием.",
      );
  } catch (error) {
    text("#import-error", error.message);
  }
};
function exportBoard() {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          version: 1,
          exportedAt: new Date().toISOString(),
          tasks,
          owners: extraOwners,
          mode,
          camera,
          drafts: canEdit() ? draftRecords().drafts : [],
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = `gengroup-${DEMO ? "demo-" : ""}board-${today()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Копия доски скачана");
}
$("#export").onclick = exportBoard;
$("#alert-export").onclick = exportBoard;
$("#alert-reload").onclick = () => location.reload();
function clearFilters() {
  $("#search").value = "";
  $("#unit-filter").value = "";
  $("#owner-filter").value = "";
  $("#hide-done").checked = false;
  render();
}
$("#clear-filters").onclick = clearFilters;
$("#reset-search").onclick = clearFilters;
for (const id of ["search", "unit-filter", "owner-filter", "hide-done"])
  $("#" + id).addEventListener(id === "search" ? "input" : "change", render);
function setMode(next) {
  mode = next;
  if (next !== "list") {
    lastCanvasMode = next;
    camera = { x: 32, y: 24, z: 1 };
  }
  render();
  if (next !== "list") {
    const first =
      tasks.filter(isVisible).find((t) => !statusGroup(t)) ||
      tasks.filter(isVisible)[0];
    const p = layout.placed.get(first?.id),
      g = layout.groups.find((g) => g.id === p?.group);
    if (g) camera.x = 24 - g.x * camera.z;
    applyCamera();
  }
  persist();
}
$$("[data-mode]").forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
function jumpToGroup(id, readable = false) {
  if (mode === "list") setMode(lastCanvasMode);
  if (STATUS_LANES.some((g) => g.id === id)) {
    $("#hide-done").checked = false;
    render();
  }
  const g = layout.groups.find((g) => g.id === id);
  if (!g) return;
  if (readable) camera.z = 1;
  camera.x = 24 - g.x * camera.z;
  camera.y = 24 - g.y * camera.z;
  applyCamera();
  persist();
}
function focusTask(id) {
  clearFilters();
  selected = id;
  render();
  if (mode === "list") {
    const row = $$("[data-row]").find((el) => el.dataset.row === id);
    row?.scrollIntoView({ block: "center" });
    row?.querySelector("button")?.focus();
  } else {
    const p = layout.placed.get(id);
    if (!p) return;
    const r = $("#viewport").getBoundingClientRect();
    camera = {
      z: 1,
      x: (r.width - CARD.width) / 2 - p.x,
      y: (r.height - CARD.height) / 2 - p.y,
    };
    applyCamera();
    persist();
    $$(".task-card")
      .find((el) => el.dataset.id === id)
      ?.focus({ preventScroll: true });
  }
  toast(
    "Карточка показана. Откройте детали, чтобы погасить отметку обновления.",
  );
}
$("#lane-jump").onchange = (e) => jumpToGroup(e.target.value, true);
$$("[data-status-zone]").forEach(
  (b) => (b.onclick = () => jumpToGroup(b.dataset.statusZone, true)),
);
$("#undo").onclick = () => restore(history, future);
$("#redo").onclick = () => restore(future, history);
$("#zoom-in").onclick = () => {
  zoom(1.2);
  persist();
};
$("#zoom-out").onclick = () => {
  zoom(1 / 1.2);
  persist();
};
$("#zoom-label").onclick = () => {
  zoom(1 / camera.z);
  persist();
};
$("#fit").onclick = fit;
function renderChanges() {
  const count = inbox.size;
  text("#changes-open", count ? `Изменения · ${count}` : "Изменения");
  $("#changes-open").classList.toggle("has-changes", count > 0);
  $("#changes-open").setAttribute(
    "aria-label",
    `Изменения из таблицы${count ? ", непросмотренных карточек: " + count : ""}`,
  );
  $("#changes-read-all").disabled = !count;
  $("#changes-refresh").disabled = !cloudEngine?.connected || cloudEngine.busy;
  text(
    "#changes-refresh",
    cloudEngine?.busy ? "Проверяем..." : "Обновить сейчас",
  );
  $("#changes-connect").hidden = !!cloudEngine?.connected;
  text("#changes-sync-status", $("#cloud-label").textContent);
  text(
    "#changes-announcement",
    count
      ? `Непросмотренных карточек из таблицы: ${count}`
      : "Непросмотренных изменений нет",
  );
  if (!$("#changes-dialog").open) return;
  const signature = JSON.stringify([
    inbox.entries,
    tasks.map((t) => t.id),
    cloudEngine?.conflicts,
  ]);
  if (changesSignature === signature) return;
  changesSignature = signature;
  $("#changes-list").innerHTML = count
    ? inbox.entries
        .map((entry) => {
          const exists = tasks.some((t) => t.id === entry.id),
            conflict = cloudEngine?.conflicts.some(
              (c) => (c.taskId || c.id) === entry.id,
            );
          return `<section class="change-item"><div class="change-item-meta"><strong>${entry.kind === "new" ? "Новая задача" : entry.kind === "removed" ? "Убрана с доски" : "Задача обновлена"}</strong><time>${esc(entry.at ? new Date(entry.at).toLocaleString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "")}</time></div><h3>${esc(entry.title)}</h3><p>${esc(entry.kind === "removed" ? "Строка удалена или карточка архивирована в таблице." : entry.fields.map((f) => CHANGE_FIELDS[f]).join(", ") || "Добавлена из таблицы.")}</p><button class="text-button" data-change-id="${esc(entry.id)}">${conflict ? "Сравнить версии" : exists ? "Показать задачу" : "Отметить просмотренным"}</button></section>`;
        })
        .join("")
    : '<p class="changes-empty">Все изменения просмотрены. Новые обновления появятся здесь и на карточках.</p>';
}
$("#changes-open").onclick = () => {
  changesSignature = "";
  showDialog("changes-dialog");
  renderChanges();
};
$("#changes-connect").onclick = () => {
  $("#changes-dialog").close();
  $("#google-connect").click();
};
$("#changes-refresh").onclick = async () => {
  await cloudEngine?.flush();
  renderChanges();
};
$("#changes-read-all").onclick = () => {
  inbox.clear();
  render();
  persist();
};
$("#changes-list").onclick = (e) => {
  const b = e.target.closest("[data-change-id]");
  if (!b) return;
  const id = b.dataset.changeId;
  if (cloudEngine?.conflicts.some((c) => (c.taskId || c.id) === id)) {
    $("#changes-dialog").close();
    openConflicts();
    return;
  }
  if (!tasks.some((t) => t.id === id)) {
    inbox.acknowledge(id);
    render();
    persist();
    return;
  }
  $("#changes-dialog").close();
  focusTask(id);
};
let commandItems = [],
  commandIndex = 0;
function availableCommands() {
  return [
    {
      title: "Новая задача",
      detail: "Создать карточку",
      run: () => openTask(),
    },
    {
      title: "Подключить Google / синхронизация",
      detail: "Общая таблица",
      run: () =>
        DEMO
          ? toast("Демонстрация работает отдельно от Google")
          : $("#google-connect").click(),
    },
    {
      title: "Импорт задач из копии",
      detail: "JSON, CSV, строки таблицы",
      run: openImport,
    },
    {
      title: "Скачать резервную копию",
      detail: "JSON на это устройство",
      run: exportBoard,
    },
    ...["priority", "owners", "time", "list"].map((m, i) => ({
      title: ["Приоритеты", "Команда и ответственные", "Сроки", "Список задач"][
        i
      ],
      detail: "Вид доски",
      run: () => setMode(m),
    })),
    {
      title: "Вид и настройки темы",
      detail: "Светлая, тёмная, системная; плотность",
      run: () => showDialog("appearance-dialog"),
    },
    {
      title: "Черновики",
      detail: "Продолжить несохранённое",
      run: () => $("#drafts-open").click(),
    },
    {
      title: "Помощь и клавиши",
      detail: "Работа с доской",
      run: () => showDialog("help-dialog"),
    },
  ];
}
function renderCommands() {
  const q = $("#command-query").value;
  commandItems = [
    ...availableCommands().filter((c) =>
      matchesWords(c.title + " " + c.detail, q),
    ),
    ...tasks
      .filter((t) => matchesTask(t, q))
      .slice(0, 40)
      .map((t) => ({
        title: t.title,
        detail: [t.owner || "Не назначен", t.unit, t.status]
          .filter(Boolean)
          .join(" · "),
        run: () => {
          clearFilters();
          openTask(t.id);
        },
      })),
  ];
  commandIndex = Math.min(commandIndex, Math.max(0, commandItems.length - 1));
  $("#command-results").innerHTML = commandItems.length
    ? commandItems
        .map(
          (item, i) =>
            `<div id="command-${i}" role="option" aria-selected="${i === commandIndex}" class="command-option" data-command="${i}"><span>${icon(i < availableCommands().length ? "command" : "grid")}</span><span><strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small></span></div>`,
        )
        .join("")
    : "<p>Ничего не найдено. Попробуйте другие слова.</p>";
  if (commandItems.length)
    $("#command-query").setAttribute(
      "aria-activedescendant",
      `command-${commandIndex}`,
    );
  else $("#command-query").removeAttribute("aria-activedescendant");
}
function openCommands() {
  const open = $("dialog[open]");
  if (open) closeDialog(open.id);
  $("#command-query").value = "";
  commandIndex = 0;
  renderCommands();
  showDialog("commands-dialog");
  $("#command-query").focus();
}
function runCommand(index) {
  const item = commandItems[index];
  if (!item) return;
  $("#commands-dialog").close();
  item.run();
}
$("#commands-open").onclick = openCommands;
$("#command-query").oninput = () => {
  commandIndex = 0;
  renderCommands();
};
$("#command-query").onkeydown = (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    commandIndex = Math.max(
      0,
      Math.min(
        commandItems.length - 1,
        commandIndex + (e.key === "ArrowDown" ? 1 : -1),
      ),
    );
    renderCommands();
    $("#command-" + commandIndex)?.scrollIntoView({ block: "nearest" });
  }
  if (e.key === "Enter") {
    e.preventDefault();
    runCommand(commandIndex);
  }
};
$("#command-results").onclick = (e) => {
  const el = e.target.closest("[data-command]");
  if (el) runCommand(Number(el.dataset.command));
};
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.code === "KeyK") {
    e.preventDefault();
    openCommands();
    return;
  }
  const typing = e.target.closest("input,textarea,select,[contenteditable]");
  if (typing || $("dialog[open]")) return;
  if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
    e.preventDefault();
    e.shiftKey ? restore(future, history) : restore(history, future);
    return;
  }
  if (e.code === "Space" && !e.target.closest("button,a,.task-card")) {
    e.preventDefault();
    space = true;
    $("#viewport").classList.add("hand");
  }
  if (e.key === "/") {
    e.preventDefault();
    $("#search").focus();
  }
  if (mode === "list") return;
  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.code === "KeyF") {
    e.preventDefault();
    fit();
  }
  if (["+", "=", "-"].includes(e.key)) {
    e.preventDefault();
    zoom(e.key === "-" ? 1 / 1.2 : 1.2);
    persist();
  }
  if (e.key === "Escape") {
    selected = null;
    render();
  }
  if (
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) &&
    e.target.closest("#viewport")
  ) {
    e.preventDefault();
    const d = e.shiftKey ? 160 : 64;
    if (e.key === "ArrowUp") camera.y += d;
    if (e.key === "ArrowDown") camera.y -= d;
    if (e.key === "ArrowLeft") camera.x += d;
    if (e.key === "ArrowRight") camera.x -= d;
    applyCamera();
    persist();
  }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    space = false;
    $("#viewport").classList.remove("hand");
  }
});
window.addEventListener("blur", () => {
  space = false;
  touches.clear();
  pinch = null;
  if (gesture) {
    gesture = null;
    render();
  }
  $("#viewport").classList.remove("hand", "panning");
});
window.addEventListener("storage", (e) => {
  if (e.key?.startsWith(STORAGE + ".draft.")) {
    renderDraftBanner();
    return;
  }
  if (e.key === PREFS) {
    try {
      preferences = cleanPreferences(JSON.parse(e.newValue || "{}"));
      applyPreferences();
    } catch {}
    return;
  }
  if (e.key !== STORAGE && e.key !== null) return;
  if (!DEMO) {
    cloudEngine
      ?.ready()
      .then(() => {
        if (canEdit()) cloudEngine.reproject();
        else renderViewerState();
      })
      .catch((error) => toast(error.message));
    return;
  }
  try {
    const incoming = e.newValue
      ? dataSignature(JSON.parse(e.newValue))
      : dataSignature({ tasks: [], owners: [] });
    if (incoming === storedSignature) return;
  } catch {}
  storageConflict = true;
  cloudEngine?.disconnect();
  text("#save-state", "Доска изменена в другой вкладке");
  renderAlert();
  toast("Доска изменена в другой вкладке. Скачайте копию и обновите страницу.");
});
window.addEventListener("beforeunload", (e) => {
  if (unsavedChanges || draftFailed) {
    e.preventDefault();
    e.returnValue = "";
  }
});
function cloudState(state) {
  syncState = state;
  const label =
    {
      local: "Локальная доска",
      signin: "Нужен вход Google",
      pending: "Ожидает отправки",
      syncing: "Синхронизация...",
      synced: state.managed ? "Сохранено для команды" : "Сохранено в Google",
      offline: "Нет связи с Google",
      conflict: "Нужно сравнить версии",
      "cache-error": "Ошибка очереди",
    }[state.status] || "Google Таблица";
  text("#cloud-label", DEMO ? "Демонстрация" : label);
  $("#google-connect").setAttribute("aria-label", "Google: " + label);
  $("#google-connect").title = label;
  text(
    "#google-label",
    state.status === "synced"
      ? "Google · сохранено"
      : state.status === "syncing"
        ? "Google · проверка"
        : state.status === "conflict"
          ? "Google · конфликт"
          : "Подключить Google",
  );
  text(
    "#cloud-status",
    DEMO
      ? "Отдельные тестовые данные. Синхронизация выключена."
      : state.message ||
          (state.status === "synced"
            ? state.managed
              ? "Командная база подтвердила правки. Таблица: " +
                (state.sourceState?.status === "synced"
                  ? "обновлена"
                  : state.sourceState?.status === "signin"
                    ? "нужен повторный вход Google"
                    : "ожидает синхронизации") +
                "."
              : "Изменения подтверждены чтением из таблицы."
            : state.status === "syncing"
              ? "Проверяем таблицу и сохраняем правки."
              : state.status === "signin" && state.pending
                ? `Изменений ждут подключения: ${state.pending}.`
                : state.status === "conflict"
                  ? `Полей для сравнения: ${state.conflicts.length}.`
                  : "Подключите Google для общей работы на устройствах."),
  );
  text(
    "#connection-explanation",
    label + ". " + $("#cloud-status").textContent,
  );
  for (const id of ["cloud-dot", "header-cloud-dot"])
    $("#" + id).className =
      "connection-dot " +
      (state.status === "synced"
        ? "cloud-online"
        : ["local", "signin"].includes(state.status)
          ? ""
          : "cloud-warning");
  $("#cloud-conflicts").hidden = !state.conflicts.length;
  $("#cloud-recovery").hidden = state.status !== "cache-error";
  $("#google-authorize").disabled =
    connecting || state.status === "cache-error";
  renderChanges();
  renderProvenance();
  renderEmpty();
}
function renderViewerState(state = viewerState) {
  if (DEMO || accessMode !== "view") return;
  viewerState = { ...viewerState, ...state };
  const labels = {
    "view-loading": "Загрузка доски...",
    "view-live": "Актуальная доска · просмотр",
    "view-offline": "Нет сети · сохранённая копия",
    "view-error": "Просмотр не подключён",
  };
  const label = labels[viewerState.status] || "Просмотр доски";
  syncState = {
    status: viewerState.status,
    pending: 0,
    conflicts: [],
    lastReadAt: viewerReadAt,
  };
  text("#cloud-label", label);
  text("#google-label", "Войти для правок");
  text("#save-state", "Только просмотр");
  $("#google-connect").setAttribute(
    "aria-label",
    "Войти через Google для редактирования",
  );
  $("#google-connect").title = "Войти через свой Google для редактирования";
  const pending = cloudEngine?.pending() || 0;
  const message =
    viewerState.status === "view-live"
      ? "Обновления появляются автоматически. Для редактирования войдите через свой Google."
      : viewerState.message ||
        (viewerHasBaseline
          ? "Подключение восстанавливается. Показана последняя подтверждённая копия."
          : "Подключаемся к общей доске без Google-входа.");
  text("#cloud-status", message);
  text("#connection-explanation", label + ". " + message);
  text(
    "#view-access-status",
    label +
      ". " +
      message +
      (pending
        ? " На этом устройстве есть неотправленные правки. Войдите в Google для отправки."
        : ""),
  );
  $("#view-access").hidden = false;
  $("#view-retry").hidden = !["view-error", "view-offline"].includes(
    viewerState.status,
  );
  $("#google-disconnect").hidden = true;
  $("#cloud-conflicts").hidden = true;
  $("#cloud-recovery").hidden = true;
  $("#google-authorize").disabled = connecting;
  for (const id of ["cloud-dot", "header-cloud-dot"])
    $("#" + id).className =
      "connection-dot " +
      (viewerState.status === "view-live" ? "cloud-online" : "cloud-warning");
  renderProvenance();
  renderEmpty();
}
function applyPublic(board, meta) {
  if (accessMode !== "view") return;
  inbox.receive(
    remoteChanges(
      viewerHasBaseline ? { tasks, owners: extraOwners } : null,
      board,
      { tasks, owners: extraOwners },
    ),
  );
  tasks = board.tasks;
  extraOwners = board.owners;
  if (!meta.fromCache) {
    viewerReadAt = Date.now();
    viewerHasBaseline = true;
  }
  if ($("#editor").open) {
    const current = tasks.find((t) => t.id === editing);
    if (!current) {
      $("#editor").close();
      toast("Задача убрана с общей доски.");
    } else {
      for (const key of EDIT_FIELDS)
        field(key).value = editorValues(current)[key];
      editingBase = structuredClone(current);
      text(
        "#owner-note",
        current.ownerNote ? "Из таблицы: " + current.ownerNote : "",
      );
      text(
        "#due-note",
        current.dueNote ? "Исходный срок: " + current.dueNote : "",
      );
      text(
        "#source-context",
        [
          current.direction && "Направление: " + current.direction,
          current.requester && "Постановщик: " + current.requester,
          current.dependency &&
            "Зависимости и уточнения: " + current.dependency,
        ]
          .filter(Boolean)
          .join("\n\n") || "Дополнительного контекста нет.",
      );
      $("#source-link").hidden = !/^https?:\/\//.test(current.link || "");
      if (!$("#source-link").hidden) $("#source-link").href = current.link;

      renderEditorConflicts();
    }
  }
  lastPublicBoard = { tasks: structuredClone(tasks), owners: [...extraOwners] };
  lastPublicChanges = inbox.snapshot();
  persist();
  render();
}
function startViewer() {
  accessMode = "view";
  tasks = structuredClone(lastPublicBoard?.tasks || []);
  extraOwners = [...(lastPublicBoard?.owners || [])];
  inbox = new ChangeInbox(lastPublicChanges);

  renderViewerState({ status: "view-loading", message: "" });
  render();
  viewer?.start();
}
$("#view-retry").onclick = () => viewer?.start();
$("#view-signin").onclick = () => showDialog("cloud-dialog");
$("#editor-signin").onclick = () => {
  $("#editor").close();
  showDialog("cloud-dialog");
};
const businessSignature = (board) =>
  JSON.stringify({
    tasks: board.tasks.map((t) => ({ id: t.id, ...comparable(t) })),
    owners: board.owners,
  });
function writeGuard() {
  if (DEMO || stateLoadError || (storageConflict && !cloudEngine?.managed))
    throw new Error(
      "Сохранение остановлено: сначала сохраните копию и восстановите локальное хранилище.",
    );
}
function applyCloud(board, cache) {
  if (!DEMO && accessMode === "view") return;
  writeGuard();
  const changed =
    businessSignature({ tasks, owners: extraOwners }) !==
    businessSignature(board);
  cloudRenderNeeded ||=
    renderedDay !== today() ||
    JSON.stringify(tasks) !== JSON.stringify(board.tasks) ||
    JSON.stringify(extraOwners) !== JSON.stringify(board.owners);
  tasks = board.tasks;
  extraOwners = board.owners;
  cloudCache = cache;
  if (changed && !cloudEngine?.managed) {
    history = [];
    future = [];
  }
  if ($("#editor").open) {
    const current = tasks.find((t) => t.id === editing),
      values = formValues(),
      remote = editorValues(current);
    if (current)
      for (const key of EDIT_FIELDS)
        if (values[key] === editorValues(editingBase)[key]) {
          field(key).value = remote[key];
          editingBase[key] = remote[key];
        }
    saveDraft();
    renderEditorConflicts();
  }
  persist();
  if (!gesture && cloudRenderNeeded) render();
}
cloudEngine = new (DEMO ? SyncEngine : TeamSyncEngine)({
  boardId: "1qh-pi5I76k8ssUc6DxjeytFDrAta1N4ZdmVjaUFCUYY",
  api: null,
  getLocal: () =>
    !DEMO && accessMode !== "edit"
      ? editorLocalBoard
      : { tasks, owners: extraOwners },
  apply: applyCloud,
  onState: (state) => {
    if (!DEMO && accessMode === "view") renderViewerState();
    else cloudState(state);
  },
  cache: cloudCache,
  readOnly: DEMO,
  onRemote: (changes) => {
    inbox.receive(changes);
    if (changes.length) cloudRenderNeeded = true;
  },
});
const originalFlush = cloudEngine.flush.bind(cloudEngine);
cloudEngine.flush = async () => {
  if (DEMO) return;
  if (
    !cloudEngine.managed &&
    (storageConflict || stateLoadError || storageFailed)
  ) {
    cloudEngine.disconnect();
    renderAlert();
    return;
  }
  if (
    !cloudEngine.managed &&
    (gesture || $("#editor").open || $("#import-dialog").open)
  ) {
    cloudEngine.later(1500);
    return;
  }
  return originalFlush();
};
function pendingConnection(value) {
  connecting = value;
  $("#google-pending").hidden = !value;
  $("#google-cancel").hidden = !value;
  $("#google-authorize").disabled = value || !!cloudEngine.cacheInvalid;
  text("#google-authorize", value ? "Подключаем..." : "Войти и подключить");
}
function cancelConnection() {
  connectionAttempt++;
  googleAuth?.cancelPending();
  pendingConnection(false);
}
$("#google-connect").onclick = () => {
  text("#google-error", "");
  if (cloudEngine.connected && cloudEngine.conflicts.length) openConflicts();
  else showDialog("cloud-dialog");
};
$("#google-authorize").onclick = async () => {
  if (DEMO) return;
  const attempt = ++connectionAttempt;
  pendingConnection(true);
  text("#google-error", "");
  try {
    if (!googleAuth)
      throw new Error(
        "Google ещё загружается. Повторите через несколько секунд.",
      );
    await googleAuth.authorize();
    if (attempt !== connectionAttempt) return;
    try {
      await cloudEngine.api.read();
    } catch (error) {
      if (error.status === 403 || error.status === 404) {
        $("#cloud-dialog").close();
        await googleAuth.pickFile();
      } else throw error;
    }
    if (attempt !== connectionAttempt) return;
    $("#cloud-dialog").close();
    viewer?.stop();
    accessMode = "connecting";
    await cloudEngine.connect();
    if (attempt !== connectionAttempt) {
      await cloudEngine.disconnect();
      startViewer();
      return;
    }
    accessMode = "edit";
    $("#view-access").hidden = true;
    $("#google-disconnect").hidden = false;
    persist();
    render();
    cloudState({
      ...syncState,
      ...{
        status: cloudEngine.status,
        conflicts: cloudEngine.conflicts,
        pending: cloudEngine.pending(),
        managed: true,
        lastReadAt: cloudEngine.lastReadAt,
        sourceState: cloudEngine.sourceState,
      },
    });
  } catch (error) {
    if (accessMode === "connecting") {
      await cloudEngine.disconnect();
      startViewer();
    }
    if (attempt !== connectionAttempt || error.cancelled) return;
    showDialog("cloud-dialog");
    text("#google-error", error.message);
  } finally {
    if (attempt === connectionAttempt) pendingConnection(false);
  }
};
$("#google-cancel").onclick = () => {
  cancelConnection();
  text("#google-error", "Вход отменён. Можно подключиться позже.");
};
$("#google-disconnect").onclick = async () => {
  cancelConnection();
  saveDraft();
  editorLocalBoard = {
    tasks: structuredClone(tasks),
    owners: [...extraOwners],
  };
  persist();
  accessMode = "connecting";
  googleAuth?.disconnect();
  await cloudEngine.disconnect();
  cloudCache = cloudEngine.snapshot();
  // Retain the last editable copy without replacing it with public rendering.
  try {
    const saved = JSON.parse(storage.getItem(STORAGE) || "null");
    if (saved) {
      saved.cloud = cloudCache;
      storage.setItem(STORAGE, JSON.stringify(saved));
    }
  } catch {}
  $("#cloud-dialog").close();
  if ($("#editor").open) $("#editor").close();
  startViewer();
};
$("#cloud-reset").onclick = () => {
  if (!$("#recovery-confirm").checked) {
    text("#google-error", "Подтвердите пересоздание связи в строке выше.");
    return;
  }
  exportBoard();
  cancelConnection();
  googleAuth?.disconnect();
  if (cloudEngine.managed) {
    text(
      "#google-error",
      "Общая история сохранена. Подключитесь повторно; очередь правок остаётся на устройстве.",
    );
    return;
  }
  cloudEngine.resetBaseline();
  persist();
  text(
    "#google-error",
    "Связь сброшена. Теперь можно снова подключить таблицу.",
  );
};
$("#copy-link").onclick = async () => {
  try {
    await navigator.clipboard.writeText(new URL("./", location.href).href);
    toast("Ссылка скопирована");
  } catch {
    text(
      "#google-error",
      "Скопируйте адрес доски из адресной строки браузера.",
    );
  }
};
let conflictReview = [];
function conflictText(value) {
  if (value == null) return "Убрано с доски / пусто";
  if (typeof value !== "object") return String(value);
  if (value.task)
    return (
      (value.archived ? "В архиве\n" : "На доске\n") +
      value.task.title +
      "\n" +
      (value.task.comment || "")
    );
  return Object.entries(value)
    .map(
      ([key, v]) =>
        (FIELD_NAMES[key] ||
          {
            "positions.owners": "Позиция в дорожке",
            "positions.time": "Позиция по сроку",
            "positions.priority": "Позиция в квадрате",
          }[key] ||
          key) +
        ": " +
        (v === null
          ? "Не указано"
          : typeof v === "object"
            ? JSON.stringify(v)
            : v),
    )
    .join("\n");
}
function openConflicts() {
  if (cloudEngine.managed && !cloudEngine.connected) {
    showDialog("cloud-dialog");
    text(
      "#google-error",
      "Войдите в Google, чтобы сравнить актуальные версии команды.",
    );
    return;
  }
  conflictReview = structuredClone(cloudEngine.conflicts);
  $("#conflict-list").innerHTML = conflictReview
    .map(
      (c, i) =>
        `<section class="cloud-conflict"><h3>${esc(c.title)} · ${esc(c.fieldName || GROUP_NAMES[c.field] || FIELD_NAMES[c.field] || c.field)}</h3><p>Одно поле изменили параллельно. Обе версии сохранены в истории.</p><label class="cloud-choice"><span><input type="radio" name="conflict-${i}" value="remote"> Текущая общая версия</span><pre>${esc(conflictText(c.remote))}</pre></label><label class="cloud-choice"><span><input type="radio" name="conflict-${i}" value="local"> Предложенная версия${c.actor?.name ? " · " + esc(c.actor.name) : ""}</span><pre>${esc(conflictText(c.local))}</pre></label></section>`,
    )
    .join("");
  text("#conflicts-error", "");
  showDialog("conflicts-dialog");
}
$("#cloud-conflicts").onclick = openConflicts;
$("#resolve-conflicts").onclick = async () => {
  const choices = {};
  for (const [i, c] of conflictReview.entries()) {
    const selected = $(`input[name="conflict-${i}"]:checked`);
    if (!selected) {
      text("#conflicts-error", "Выберите версию для каждого поля.");
      return;
    }
    choices[i] = selected.value;
  }
  const button = $("#resolve-conflicts");
  button.disabled = true;
  try {
    const result = await cloudEngine.resolve(choices, conflictReview);
    if (result?.stale) {
      openConflicts();
      text(
        "#conflicts-error",
        "Пока вы сравнивали, задача снова изменилась. Показаны актуальные версии. Выберите заново.",
      );
    } else {
      $("#conflicts-dialog").close();
      persist();
      cloudEngine.bridge?.wake();
      toast("Выбранные версии сохранены для команды");
    }
  } catch (error) {
    text("#conflicts-error", error.message);
  } finally {
    button.disabled = false;
  }
};
window.addEventListener("online", () => {
  if (cloudEngine.connected) cloudEngine.flush();
  else if (!DEMO && accessMode === "view") viewer?.start();
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && cloudEngine.connected) cloudEngine.flush();
});
if (!DEMO) {
  cloudEngine.bridge = new TeamSourceBridge(cloudEngine);
  cloudEngine.ready().catch((error) => toast(error.message));
  Promise.all(
    ["google-config.json", "team-config.json"].map((path) =>
      fetch("./" + path, { cache: "no-store" }).then((r) => {
        if (!r.ok) throw new Error("Настройки Google недоступны.");
        return r.json();
      }),
    ),
  )
    .then(([config, team]) => {
      googleAuth = new GoogleAuth(config);
      cloudEngine.googleAuth = googleAuth;
      cloudEngine.api = new SheetsApi(googleAuth, undefined, writeGuard);
      viewer = new BoardViewer({
        config: team,
        boardId: team.boardId,
        onData: applyPublic,
        onState: renderViewerState,
      });
      if (accessMode === "view") viewer.start();
      cloudEngine.repository = new TeamApi({
        config: team,
        boardId: team.boardId,
      });
    })
    .catch((error) => {
      text("#google-error", error.message);
      renderViewerState({ status: "view-error", message: error.message });
    });
}
render();
if (!DEMO) renderViewerState();
if (DEMO && freshBoard && !stateLoadError) setMode(mode);
if (DEMO && !stateLoadError) persist();
if (stateLoadError)
  text("#save-state", "Не удалось прочитать сохранённую доску");
