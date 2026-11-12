import {installGroupedBoard} from './grouped-board.mjs?rev=20261112-groups-11';
import {installWorkspaceShell} from './workspace-shell.mjs?rev=20261112-groups-11';
import {installDisplayControls} from './display-controls.mjs?rev=20261113-groups-12';
import {taskSections,effectiveGroup,canReorderPresentation,reconcileRegistry,terminalRegistry,presentationRegistry} from './display-model.mjs?rev=20261113-groups-12';
import {googleStatusLabel} from './sync-indicator.mjs?rev=20261111-status-8';
import {installThemeToggle} from './appearance.mjs?rev=20261111-status-8';
import {workProgress,installExecutionControls} from './work-progress.mjs?rev=20261111-status-8';
import {installRangePicker} from './range-picker.mjs?rev=20261111-status-8';
import {createdDay,overlapsRange} from './task-dates.mjs?rev=20261111-status-8';
import {installPriorityEditor,editorBlocksSync} from './priority-editor.mjs?rev=20261111-status-8';
import {installGantt} from './gantt.mjs?rev=20261112-groups-11';
import {statusBadge,installQuickControls} from './quick-controls.mjs?rev=20261111-status-8';
import {temperature,trackStatus,inWeek,weekStart,observedTask,registryMatch} from './task-signals.mjs?rev=20261111-status-8';
import {installPlanningDrag} from './planning-drag.mjs?rev=20261112-groups-11';
import {Directory} from './directory.mjs?rev=20261111-status-8';
import {installCalendar} from './calendar.mjs?rev=20261113-groups-12';
import {installProductivity} from './productivity.mjs?rev=20261113-groups-12';
import {PublicSheetsApi,SheetViewer} from './sheet-viewer.mjs?rev=20261111-status-8';
import {MODES,MODE_OWNER,LEGACY_CONTROL,modePending} from './storage-mode.mjs?rev=20261111-status-8';
import {renderBoard} from './board-ui.mjs?rev=20261111-status-8';
import {ordered,reorderTasks,orderKey} from './order.mjs?rev=20261111-status-8';
import {
  QUADRANTS,
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
  importBoard,parseDelimited,
} from "./model.mjs?rev=20261111-status-8";
import { SyncEngine } from "./sync-engine.mjs?rev=20261111-status-8";
import { TeamSyncEngine } from "./team-engine.mjs?rev=20261111-status-8";
import { TeamDraftStore } from "./team-drafts.mjs?rev=20261111-status-8";
import { BoardViewer } from "./board-viewer.mjs?rev=20261111-status-8";
import { remoteChanges } from "./changes.mjs?rev=20261111-status-8";
import { TeamApi } from "./team-api.mjs?rev=20261111-status-8";
import { TeamSourceBridge } from "./team-source.mjs?rev=20261111-status-8";
import { GROUP_NAMES, groupValue } from "./team-model.mjs?rev=20261111-status-8";
import { GoogleAuth } from "./google-auth.mjs?rev=20261111-status-8";
import { SheetsApi, DirectSheetsApi } from "./sheets-api.mjs?rev=20261111-status-8";
import { FIELD_NAMES, comparable, mergeBoards } from "./sync-model.mjs?rev=20261111-status-8";
import { dataSignature, writeBoard } from "./storage.mjs?rev=20261111-status-8";
import { ChangeInbox, CHANGE_FIELDS } from "./changes.mjs?rev=20261111-status-8";
import {
  DraftStore,
  EDIT_FIELDS,
  editorValues,
  resumeDraft,
  editConflicts,
  planEdit,
} from "./editor.mjs?rev=20261111-status-8";
import { parseAssignee } from "./people.mjs?rev=20261111-status-8";
import {
  matchesTask,
  matchesWords,
  cleanPreferences,
  emptyState,
  importSummary,
  demoTasks,
  synchronizationHint,
} from "./ui-model.mjs?rev=20261111-status-8";
import { icon } from "./icons.mjs?rev=20261111-status-8";
const $ = (selector) => document.querySelector(selector),
  $$ = (selector) => [...document.querySelectorAll(selector)];
const DEMO = new URLSearchParams(location.search).get("demo") === "1";
const MODE_KEY='gengroup.task-canvas.storage-mode.v1';
const publicSheets=new PublicSheetsApi();
let modeBootstrap=null,storageControl=structuredClone(LEGACY_CONTROL),modeReadError='';
if(!DEMO){
 try{modeBootstrap=await publicSheets.read();storageControl=modeBootstrap.control;localStorage.setItem(MODE_KEY,JSON.stringify(storageControl))}
 catch(error){modeReadError=error.message;try{const cached=JSON.parse(localStorage.getItem(MODE_KEY)||'null');if(cached?.ack&&Object.hasOwn(MODES,cached.ack.mode))storageControl=cached}catch{}}
}
const STORAGE_MODE=DEMO?'demo':storageControl.ack.mode;
const SHEETS_ONLY=STORAGE_MODE==='sheets';
const STORAGE = DEMO
    ? "gengroup.task-canvas.demo.v1"
    : SHEETS_ONLY ? "gengroup.task-canvas.sheets.v1" : "gengroup.task-canvas.team.v2",
  PREFS = "gengroup.task-canvas.preferences.v1";
const VIEW_STORAGE = SHEETS_ONLY?"gengroup.task-canvas.sheet-view.v1":"gengroup.task-canvas.public-view.v1";
let accessMode = DEMO ? "edit" : "view",
  viewer = null,
  editorLocalBoard = { tasks: [], owners: [] },
  viewerState = { status: "view-loading" },
  viewerReadAt = 0,
  viewerHasBaseline = false,
  lastPublicBoard = null,
  lastPublicChanges = [];
const canEdit = () =>
  DEMO || (accessMode === "edit" && (!!cloudEngine?.connected || SHEETS_ONLY&&googleAuth?.rememberedEmail===MODE_OWNER&&cloudEngine?.enabled) && !modePending(storageControl) && storageControl.ack.mode===STORAGE_MODE);
const directory=new Directory();
const personName=value=>directory.name(value),personAvatar=value=>directory.avatar(value);
let productivity=null,calendar=null,gantt=null,groupedBoard=null,priorityEditor=null;
let archiveScope="",dateRange={from:"",to:""},rangePicker=null,displayControls=null,signalState=new Map();
function setDateRange(range,syncCalendar=true){dateRange={...range};if(syncCalendar)calendar?.setRange(range);rangePicker?.render();render()}
const effectiveTask=t=>observedTask(t,signalState.get(t.id));
const currentGroup=()=>displayControls?.group()||effectiveGroup(mode,'auto');
const currentSort=()=>productivity?.sortKind()||'manual';
function usesGroupedBoard(){const native={priority:'priority',owners:'owner',time:'day'}[mode];return !!native&&(currentGroup()!==native||currentSort()!=='manual'||mode!=='priority'&&displayControls?.view()!=='detailed')}
function presentationTask(t){return {...effectiveTask(t),displayOwner:personName(t.owner),ownerKey:directory.resolve(t.owner)?.id||'',avatar:personAvatar(t.owner)}}
function presentationOrder(items,view=mode){if(currentSort()!=='manual')return productivity.sort(items);if(['calendar','time','owners'].includes(view))return ordered(items,view==='owners'?'owners':'time',today());return view==='gantt'?items:productivity?.sort(items)||items}
const canReorderView=()=>canReorderPresentation(currentSort(),currentGroup());

let selectedIds=new Set(), selectionAnchor=null, matrixBasis=null, matrixFocus=null, matrixDragging=false, matrixMutationBusy=false;
function selectTask(id,range=false){
  if(!canEdit())return;
  if(range && selectionAnchor){
    const task=tasks.find(t=>t.id===id), group=task&&groupFor(task,'priority',today());
    const presented=presentationOrder(tasks.filter(isVisible).map(presentationTask)),sections=taskSections(presented,currentGroup());const ids=(usesGroupedBoard()||mode==='list'?sections.find(s=>s.items.some(t=>t.id===id))?.items||[]:ordered(tasks.filter(t=>isVisible(t)&&groupFor(t,'priority',today())===group),'priority',today())).map(t=>t.id);
    const a=ids.indexOf(selectionAnchor), b=ids.indexOf(id);
    if(a>=0&&b>=0)ids.slice(Math.min(a,b),Math.max(a,b)+1).forEach(x=>selectedIds.add(x));
    else selectedIds.has(id)?selectedIds.delete(id):selectedIds.add(id);
  }else selectedIds.has(id)?selectedIds.delete(id):selectedIds.add(id);
  selectionAnchor=id;render();
}
function renderMatrix(){
  const visible=tasks.filter(isVisible), ids=new Set(visible.map(t=>t.id));
  selectedIds=new Set([...selectedIds].filter(id=>ids.has(id)));
  if(!canEdit())selectedIds.clear();
  renderBoard($('#board-ui'),{active:mode==='priority'&&!usesGroupedBoard(),openId:$('#editor').open?editing:null,busy:matrixMutationBusy,tasks:visible.map(t=>({...effectiveTask(t),owner:personName(t.owner)})),avatars:Object.fromEntries(directory.people.filter(p=>directory.resolve(p.name)?.id===p.id).map(p=>[p.name,p.avatar])),today:today(),editable:canEdit(),selection:[...selectedIds],focus:matrixFocus,
    notices:Object.fromEntries(visible.filter(t=>inbox.get(t.id)).map(t=>[t.id,inbox.get(t.id).kind])),
    onImportance:(id,value)=>change(()=>{tasks=tasks.map(t=>t.id===id?{...t,importance:Number(value)}:t)}),onStatus:setTaskStatus,onOpen:openTask,onSelect:selectTask,pins:productivity?.pins()||[],onPin:id=>productivity?.togglePin(id),onBulkEdit:()=>productivity?.openBulk(),
    onSelectGroup:(ids,enabled)=>{for(const id of ids)enabled?selectedIds.add(id):selectedIds.delete(id);render()},
    onClear:()=>{selectedIds.clear();render()},
    onDragStart:(ids)=>{selectedIds=new Set(ids);matrixBasis=cloudEngine?.managed?cloudEngine.capture():null;matrixDragging=true},
    onDragCancel:()=>{matrixBasis=null;matrixDragging=false;render()},
    onMove:moveSelection,onEdge:moveSelectionEdge});
}
async function moveSelection(ids,groupId,beforeId=null){
  const basis=matrixBasis;matrixBasis=null;matrixDragging=false;
  if(!requireEditor()||matrixMutationBusy)return;
  const group=[{id:'inbox'},...QUADRANTS,...STATUS_LANES].find(g=>g.id===groupId);
  if(!group)return;
  matrixMutationBusy=true;renderMatrix();
  try{
    const ok=await change(()=>{tasks=reorderTasks(tasks,ids,group,beforeId,today())},basis);
    if(!ok)return;
    if(groupId.startsWith('status:')){$('#hide-done').checked=false;selectedIds.clear();}
    render();savedToast(`Перемещено задач: ${ids.length}`);
  }catch(error){toast(error.message)}finally{matrixMutationBusy=false;render()}
}
async function moveSelectionEdge(edge){
  const ids=[...selectedIds],groups=new Set(tasks.filter(t=>selectedIds.has(t.id)).map(t=>groupFor(t,'priority',today())));
  if(groups.size!==1){toast('Для изменения очередности выберите задачи одного квадрата.');return}
  const group=[...groups][0], rest=ordered(tasks.filter(t=>!selectedIds.has(t.id)&&groupFor(t,'priority',today())===group),'priority',today());
  await moveSelection(ids,group,edge==='start'?rest[0]?.id||null:null);
}
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
    (!DEMO&&!SHEETS_ONLY ? storage.getItem("gengroup.task-canvas.v1") : null);
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
    mode = ["priority", "owners", "time", "list", "calendar", "gantt"].includes(state.mode)
      ? state.mode
      : "priority";
    lastCanvasMode = ["priority", "owners", "time"].includes(
      state.lastCanvasMode,
    )
      ? state.lastCanvasMode
      : ["list","calendar","gantt"].includes(mode)
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
      if (["priority", "owners", "time", "list", "calendar", "gantt"].includes(saved.mode))
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
  const result = DEMO||SHEETS_ONLY
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
    const statusBefore=new Map(JSON.parse(before).tasks.map(t=>[t.id,t]));
    tasks=tasks.map(t=>statusBefore.get(t.id)?.status!==t.status?trackStatus(statusBefore.get(t.id),t):t);
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
  const themeButton=$("#appearance-open"),dark=document.documentElement.dataset.theme==='dark';
  themeButton.setAttribute('aria-label',dark?'Включить светлую тему':'Включить тёмную тему');themeButton.setAttribute('aria-pressed',String(dark));themeButton.title=themeButton.getAttribute('aria-label');themeButton.innerHTML=icon(dark?'sun':'moon');
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
  if(id === "editor" && priorityEditor) priorityEditor.open();
  else if (!dialog.open) dialog.showModal();
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
  if($("#editor").open)return;
  renderDraftBanner();
  if (cloudEngine?.connected) cloudEngine.later(250);
});
$("#settings-open").onclick=()=>showDialog("appearance-dialog");
installThemeToggle({button:$("#appearance-open"),storage,onChange:theme=>{preferences=cleanPreferences({...preferences,theme});applyPreferences()},onError:()=>toast("Тема не сохранилась: хранилище браузера недоступно.")});
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
$("#filters-open").onclick = () => {$("#mobile-filters-slot").append($("#filter-panel"));showDialog("filters-dialog")};
$("#filters-dialog").addEventListener("close",placeFilters);
function setOptions(select, html) {
  if (select.dataset.options === html) return;
  const value = select.value;
  select.innerHTML = html;
  select.dataset.options = html;
  if (value && select.tagName === "SELECT" && ["owner-filter","unit-filter","department-filter"].includes(select.id) && ![...select.options].some(o=>o.value===value)) select.add(new Option(value.replace(/^owner:/, "")+" · нет на доске",value));
  if ([...select.options].some((o) => o.value === value)) select.value = value;
}
function updateOptions() {
  const units = [...new Set(tasks.map((t) => t.unit).filter(Boolean))].sort(),
    owners = [
      ...new Set([
        ...tasks.map((t) => personName(t.owner)).filter(Boolean),
        ...extraOwners.map(personName),
        ...directory.names(),
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
  setOptions($("#department-filter"),`<option value="">Все отделы</option>`+[...new Set([...directory.departments,...directory.people.flatMap(p=>p.department.split(" · ").filter(Boolean))])].sort().map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join(""));
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
    (!$("#department-filter").value || (directory.resolve(task.owner)?.department||"").split(" · ").includes($("#department-filter").value)) &&
    (!$("#unit-filter").value || task.unit === $("#unit-filter").value) &&
    (!$("#owner-filter").value ||
      ($("#owner-filter").value === "__none"
        ? !task.owner
        : personName(task.owner) === personName($("#owner-filter").value.replace(/^owner:/,"")))) &&
    matchesTask({...task,owner:personName(task.owner)+" "+task.owner}, $("#search").value) && (productivity?.matches(task)??true)
  );
}
const isVisible = task=>matchesFilters(task)&&presentationRegistry(effectiveTask(task),{...dateRange,archive:archiveScope,hideDone:$('#hide-done').checked});
const formatDate = (value) =>
  value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("ru", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Без срока";
function renderSourceBadge(){
 $('#cloud-status').hidden=!DEMO&&accessMode==='view';
 const viewing=accessMode==='view',status=DEMO?'demo':viewing?viewerState.status:syncState.status;
 const stamp=viewing?viewerReadAt:syncState.lastReadAt,at=stamp?new Date(stamp).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'}):'';
 const labels={'view-live':'Просмотр','view-loading':'Подключение','view-offline':'Копия','view-error':'Нет связи',synced:'Сохранено',syncing:'Сохраняем',pending:'Есть правки',signin:'Нужен вход',offline:'Нет связи',conflict:'Конфликт','cache-error':'Ошибка очереди',local:'На устройстве',demo:'Демонстрация'};
 const ok=['view-live','synced','demo'].includes(status),label=labels[status]||'Подключение';
 text('#source-summary',label+(at&&['view-live','synced','view-offline'].includes(status)?' · '+at:''));
 $('#source-info').dataset.state=ok?'ready':['view-loading','syncing'].includes(status)?'loading':'warning';
 $('#source-info').setAttribute('aria-label',label+'. Открыть состояние сохранения и доступа');
 $('#summary-dot').className='connection-dot '+(ok?'cloud-online':'cloud-warning');
}
function renderProvenance() {
  renderSourceBadge();
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
        `Проверено: ${checked}. `+(SHEETS_ONLY
          ? 'Источник — Google Таблица. Проверяем автоматически раз в 30 секунд.'
          : viewerState.background?.provider==='apps-script'
          ? (viewerState.source?.status==='synced'?'Таблица проверяется в фоне, обычно раз в 5 минут.':viewerState.source?.status==='signin'?'Фоновому обмену нужно повторное разрешение владельца.':'Фоновый обмен с таблицей ожидает восстановления связи.')
          : 'Изменения таблицы поступают через подключённого участника команды.'),
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
  return `<article tabindex="0" role="button" aria-label="${esc(task.title)}. ${badge ? badge + ". " : ""}Открыть детали" class="task-card${selected === task.id || selectedIds.has(task.id) ? " selected" : ""}${notice ? " unread-change " + (notice.kind === "new" ? "unread-new" : "unread-updated") : ""}" data-task-status="${esc(task.status)}" data-id="${esc(task.id)}" style="left:${p.x}px;top:${p.y}px">${notice ? `<span class="change-badge">${badge}</span>` : ""}<div class="card-top"><span class="unit-tag">${esc(task.unit || "Задача")}</span><span class="card-id">${task.sourceId ? "#" + esc(task.sourceId) : ""}</span>${statusBadge(task,canEdit())}</div><h3>${esc(task.title)}</h3><div class="card-direction">${esc(task.direction || task.description)}</div><div class="card-signals">${workProgress(task,canEdit())}${temperature(task,canEdit())}</div><div class="card-bottom"><span class="avatar">${personAvatar(task.owner)?`<img src="${esc(personAvatar(task.owner))}" alt="" loading="lazy">`:esc(initials)}</span><span class="owner-name">${esc(personName(task.owner) || (task.ownerNote ? "Уточнить ответственного" : "Не назначен"))}</span><span class="date${task.due && task.due < today() && !statusGroup(task) ? " overdue" : ""}">${esc(formatDate(task.due))}</span></div></article>`;
}
function listMarkup(visible) {
  const sections=taskSections(visible.map(presentationTask),currentGroup());
  return `<table role="table" aria-label="Задачи команды"><thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col" class="title-col">Задача</th><th role="columnheader" scope="col" class="owner-col">Ответственный</th><th role="columnheader" scope="col" class="created-col">Поставлена</th><th role="columnheader" scope="col" class="date-col">Срок</th><th role="columnheader" scope="col" class="status-col">Статус</th></tr></thead><tbody role="rowgroup">${sections.map(section=>(section.label?`<tr class="list-section"><th scope="rowgroup" colspan="5">${esc(section.label)} <span>${section.items.length}</span></th></tr>`:"" )+section.items
    .map((task) => {
      const notice = inbox.get(task.id);
      return `<tr role="row" data-task-status="${esc(task.status)}" data-row="${esc(task.id)}" data-drop-task="${esc(task.id)}" class="${notice ? (notice.kind === "new" ? "unread-new" : "unread-updated") : ""}"><td role="cell" data-label="Задача"><div class="list-task-main"><div class="list-task-tools">${canEdit()?`<input type="checkbox" data-select="${esc(task.id)}" ${selectedIds.has(task.id)?"checked":""} aria-label="Выбрать: ${esc(task.title)}"/>`:""}${canEdit()&&canReorderView()?`<button class="planning-grip" data-plan-grip="${esc(task.id)}" aria-label="Переместить в списке: ${esc(task.title)}" title="Очередь внутри приоритета. Пробел и стрелки — с клавиатуры.">${icon('grip')}</button>`:""}${workProgress(task,canEdit())}${temperature(task,canEdit())}</div><div class="list-task-copy"><button class="row-open" data-open="${esc(task.id)}">${esc(task.title)}</button><div class="row-meta">${notice ? `<span class="row-change">${notice.kind === "new" ? "Новая" : "Обновлена"}</span>` : ""}${esc([task.unit, task.sourceId ? "#" + task.sourceId : ""].filter(Boolean).join(" · "))}</div></div></div></td><td role="cell" data-label="Ответственный">${personAvatar(task.owner)?`<img class="inline-avatar" src="${esc(personAvatar(task.owner))}" alt="" loading="lazy">`:""}${esc(personName(task.owner) || (task.ownerNote ? "Уточнить в деталях" : "Не назначен"))}</td><td role="cell" data-label="Поставлена">${task.createdAt?esc(formatDate(createdDay(task.createdAt))):"—"}</td><td role="cell" data-label="Срок" class="${task.due && task.due < today() && !statusGroup(task) ? "overdue" : ""}">${esc(formatDate(task.due))}</td><td role="cell" data-label="Статус">${statusBadge(task,canEdit())}</td></tr>`;
    })
    .join("")).join("")}</tbody></table>`;
}
function renderWorkEditor(){if(!$('#editor').open)return;const current=tasks.find(t=>t.id===editing);$('#editor-work').innerHTML=current?workProgress(current,canEdit()):'';if(current){const base=editorValues(editingBase);for(const key of ['status','progress'])if(field(key).value===base[key]){field(key).value=editorValues(current)[key];editingBase[key]=editorValues(current)[key];}}text('#editor-progress-value',field('progress').value+'%');}
function renderCreatedAt(task){const value=task?.createdAt;field('createdAt').value=value?formatDate(createdDay(value))+(value.includes('T')?' · '+new Intl.DateTimeFormat('ru',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'}).format(new Date(value))+' МСК':''):'';field('createdAt').readOnly=true;text('#created-note',task?'Дата исходного сообщения или создания задачи. Синхронизируется с таблицей.':'Дата появится при создании задачи.')}
function renderRegistry(){
 const pool=tasks.filter(t=>matchesFilters(t)&&overlapsRange(t,dateRange.from,dateRange.to)).map(effectiveTask),count=options=>pool.filter(t=>presentationRegistry(t,{...options,hideDone:terminalRegistry(options.archive)?false:$('#hide-done').checked})).length;
 const options=[['','Текущие задачи',count({})],...STATUSES.map(status=>['status:'+status,status,count({archive:'status:'+status})]),['done','Архив · Готово',count({archive:'done'})],['cancelled','Архив · Отменено',count({archive:'cancelled'})],['all','Все с архивом',count({archive:'all'})]];
 setOptions($('#archive-scope'),options.map(([v,label,n])=>`<option value="${esc(v)}">${esc(label)} · ${n} шт</option>`).join(''));$('#archive-scope').value=archiveScope;
}
function render() {
  if(matrixDragging)return;
  document.body.dataset.boardMode=mode;
  const focusedStatus = document.activeElement?.dataset?.statusId;
  cloudRenderNeeded = false;
  renderedDay = today();
  text("#registry-note",dateRange.from?"Задачи по пересечению начала и срока":"Все даты");
  rangePicker?.render();
  displayControls?.render();
  renderChanges();
  updateOptions();
  renderDraftBanner();
  renderRegistry();
  const compactCanvas=usesGroupedBoard();
  $('#board-ui').hidden=mode!=='priority'||compactCanvas;
  const visible = productivity?.sort(tasks.filter(isVisible))||tasks.filter(isVisible),
    matching = tasks.filter(t=>matchesFilters(t)&&presentationRegistry(effectiveTask(t),{...dateRange,archive:archiveScope})),
    canvasMode = ["list","calendar","gantt"].includes(mode) ? lastCanvasMode : mode;
  layout = createLayout(visible.map(t=>({...effectiveTask(t),owner:personName(t.owner)})), canvasMode, today(), [
    ...new Set([...extraOwners.map(personName), ...tasks.map((t) => personName(t.owner)).filter(Boolean)]),
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
    priority: ["Планирование", "Приоритеты", "Выделяйте задачи и переносите за ручку ⠿"],
    owners: ["Ответственность", "Команда", "Перенос назначает ответственного"],
    time: ["Планирование", "Сроки", "Перенос меняет дату"],
    gantt: ["Планирование", "Гант", "Тяните полосу для переноса, края для изменения периода"],
    calendar: ["Планирование", "Календарь", "Выберите период или откройте задачу"],
    list: ["Все задачи", "Список", "Откройте название, чтобы изменить задачу"],
  }[mode];
  text("#view-kicker", info[0]);
  text("#view-title", info[1]);
  $("#view-title").hidden=mode==="calendar";
  text(
    "#view-hint",
    canEdit() ? info[2] : "Просмотр. Откройте карточку для подробностей.",
  );
  $$("[data-mode]").forEach((el) => {
    el.classList.toggle("active", el.dataset.mode === mode);
    el.setAttribute("aria-pressed", String(el.dataset.mode === mode));
  });
  $("#new-owner").hidden = !canEdit() || mode !== "owners";
  $("#lane-jump").hidden = ["list","calendar","gantt"].includes(mode) || mode === "priority" || compactCanvas;
  $("#viewport").hidden = ["list","calendar","gantt"].includes(mode) || mode === "priority" || compactCanvas;
  $("#task-list").hidden = mode !== "list";
  $(".canvas-footer").hidden = ["list","calendar","gantt"].includes(mode) || mode === "priority" || compactCanvas;
  $(".zoom-controls").hidden = ["list","calendar","gantt"].includes(mode) || mode === "priority" || compactCanvas || !visible.length;
  const filterCount = [
    $("#search").value,
    $("#unit-filter").value,
    $("#owner-filter").value,
    $("#department-filter").value,
    dateRange.from,
    archiveScope,
    $("#hide-done").checked,
    productivity?.filterActive(),
  ].filter(Boolean).length;
  text("#filter-count", filterCount ? `Фильтры · ${filterCount}` : "Фильтры");
  if (mode === "list") $("#task-list").innerHTML = listMarkup(visible);
  else {
    $("#zones").innerHTML = layout.groups
      .map(
        (g, i) =>
          `<section class="zone ${g.id === "status:done" ? "green" : g.id === "status:cancelled" ? "cancelled" : ""}" data-group="${esc(g.id)}" style="left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.h}px"><div class="zone-header"><span class="zone-number">${g.symbol || String(i + 1).padStart(2, "0")}</span><div><h3>${g.id.startsWith("owner:")&&personAvatar(g.id.slice(6))?`<img class="team-lane-avatar" src="${esc(personAvatar(g.id.slice(6)))}" alt="" loading="lazy">`:""}${esc(g.title)}</h3><p>${esc(g.subtitle)}</p></div><span class="zone-count">${visible.filter((t) => groupFor({...t,owner:personName(t.owner)}, canvasMode, today()) === g.id).length}</span></div></section>`,
      )
      .join("");
    $("#cards").innerHTML = visible.map(cardMarkup).join("");
  }
  renderMatrix();
  renderWorkEditor();
  productivity?.render();
  calendar?.render();
  gantt?.render();
  groupedBoard?.render();
  renderEmpty();
  $("#no-results").hidden = ['calendar','gantt'].includes(mode) || !tasks.length || !!visible.length;
  if(['calendar','gantt'].includes(mode))$("#empty").hidden=true;
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
  if (["list","calendar","gantt"].includes(mode)) return;
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
  if (e.target.closest("#empty, #no-results, .temperature, .task-status")) return;
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
  if(card && canEdit() && (e.ctrlKey||e.metaKey||e.shiftKey)){e.preventDefault();selectTask(card.dataset.id,e.shiftKey);return;}
  if (card && !space && e.button === 0) {
    if (!canEdit()) {
      selected = card.dataset.id;
      card.focus({ preventScroll: true });
      return;
    }
    selected = card.dataset.id;
    if(!selectedIds.has(selected))selectedIds=new Set([selected]);
    renderMatrix();
    document
      .querySelectorAll(".task-card")
      .forEach((c) => c.classList.toggle("selected", selectedIds.has(c.dataset.id)));
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
          () => (tasks = tasks.map((t) => {
            if(!selectedIds.has(t.id))return t;
            if(t.id===current.id)return next;
            const offset=[...selectedIds].indexOf(t.id);
            return moveTask(t,mode,target,x+(offset%2)*312,y+Math.floor(offset/2)*216,today());
          })),
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
  if(e.target.closest(".temperature,.task-status"))return;
  const card = e.target.closest("[data-id]");
  if (card) openTask(card.dataset.id);
});
$("#cards").addEventListener("keydown", (e) => {
  if(e.target.closest(".temperature,.task-status"))return;
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
  if(submitTask.busy)return;
  if($("#editor").open)saveDraft();
  productivity?.beforeOpen(id);
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
  renderCreatedAt(current);
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
  productivity?.editorOpened(id);
  renderOwnerProfile();
  renderWorkEditor();
}
$("#task-form").addEventListener("input", () => {
  text("#editor-error", "");
  text("#editor-progress-value",field("progress").value+"%");
  saveDraft();
  renderOwnerProfile();
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
    const group = { owner: "assignment", due: "schedule", progress:"status" }[key] || key;
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
  return true;
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
  productivity?.reset();
  $("#search").value = "";
  $("#unit-filter").value = "";
  $("#owner-filter").value = "";
  $("#department-filter").value = "";
  archiveScope="";$("#archive-scope").value="";dateRange={from:"",to:""};calendar?.setRange(dateRange);
  $("#hide-done").checked = false;
  render();
}
$("#clear-filters").onclick = clearFilters;
$("#reset-search").onclick = clearFilters;
for (const id of ["search", "unit-filter", "owner-filter", "department-filter", "hide-done"])
  $("#" + id).addEventListener(id === "search" ? "input" : "change", ()=>{if(id==="hide-done"){const next=reconcileRegistry(archiveScope,$("#hide-done").checked,"hideDone");archiveScope=next.archive;}render()});
function setMode(next) {
  if($("#editor").open){saveDraft();$("#editor").close();}
  mode = next;
  if (!["list","calendar","gantt"].includes(next)) {
    lastCanvasMode = next;
    camera = { x: 32, y: 24, z: 1 };
  }
  render();
  if (!["list","calendar","gantt"].includes(next)) {
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
  if(mode==='priority'){ $("#hide-done").checked=false;matrixFocus={id,stamp:Date.now()};render();return;}
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
  } else if(mode==='priority'){
    const task=tasks.find(t=>t.id===id);matrixFocus={id:groupFor(task,'priority',today()),stamp:Date.now()};render();
    setTimeout(()=>{const el=$$('[data-matrix-task]').find(el=>el.dataset.matrixTask===id);el?.scrollIntoView({block:'center'});el?.querySelector('.matrix-title')?.focus()},80);
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
    ...(productivity?.commands()||[]),
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
    ...["priority", "owners", "time", "list", "calendar", "gantt"].map((m, i) => ({
      title: ["Приоритеты", "Команда и ответственные", "Сроки", "Список задач", "Календарь задач", "Диаграмма Ганта"][
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
  if (typing || e.target.closest("#editor") || $$("dialog[open]").some(d=>d.id!=="editor"||editorBlocksSync(d))) return;
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
  if (["list","calendar","gantt"].includes(mode) || mode === "priority" || e.target.closest("#board-ui")) return;
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
    if(SHEETS_ONLY){
      try{
        const incoming=JSON.parse(e.newValue||'null');
        if(!incoming)throw new Error('Локальная копия удалена в другой вкладке.');
        const signature=dataSignature(incoming);
        if(signature===storedSignature)return; // Camera/cache heartbeats are not task conflicts.
        if(!Array.isArray(incoming.owners)||incoming.owners.some(x=>typeof x!=="string"))throw new Error("Повреждены дорожки другой вкладки.");
        const board={tasks:validateBoard(incoming),owners:incoming.owners};
        if(accessMode==='view'){editorLocalBoard=board;storedSignature=signature;return;}
        if(cloudEngine.busy){sharedCacheEvent=e;return;}
        // Each cache includes its acknowledged Sheet baseline. Merge pending changes
        // from both tabs against the old baseline before replacing either copy.
        const plan=mergeBoards(cloudEngine.base||board,{tasks,owners:extraOwners},board);
        storedSignature=signature;storageConflict=false;
        cloudEngine.conflicts=[...cloudEngine.conflicts,...plan.conflicts];
        applyCloud(plan.board,cloudEngine.snapshot());
        if(plan.conflicts.length)cloudEngine.state('conflict');else {cloudEngine.changed();cloudEngine.later(0);}
      }catch{storageConflict=true;renderAlert();}
      return;
    }
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
      signin: SHEETS_ONLY&&googleAuth?.rememberedEmail?"Вход сохранён · обновите доступ Google":"Нужен вход Google",
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
  text("#google-label",googleStatusLabel(state,{editing:accessMode==='edit',remembered:!!googleAuth?.rememberedEmail}));
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
                    ? (cloudEngine.accessRoot?.background?.enabled?"фоновому обмену нужно разрешение владельца":"нужен повторный вход Google")
                    : "ожидает синхронизации") +
                "."
              : "Изменения подтверждены чтением из таблицы."
            : state.status === "pending"
              ? "Сохраняем изменения в Google."
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
  productivity?.render();
  calendar?.render();
  gantt?.render();
  groupedBoard?.render();
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
  productivity?.render();
  calendar?.render();
  gantt?.render();
  groupedBoard?.render();
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

      renderCreatedAt(current);
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
$("#source-info").onclick=()=>showDialog("source-dialog");
$("#view-signin").onclick = () => {closeDialog("source-dialog");showDialog("cloud-dialog")};
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
    renderCreatedAt(current);
    saveDraft();
    renderEditorConflicts();
  }
  persist();
  if (!gesture && cloudRenderNeeded) render();
}
cloudEngine = new (DEMO || SHEETS_ONLY ? SyncEngine : TeamSyncEngine)({
  boardId: "1qh-pi5I76k8ssUc6DxjeytFDrAta1N4ZdmVjaUFCUYY",
  api: null,
  getLocal: () =>
    !DEMO && accessMode !== "edit" && !(SHEETS_ONLY&&accessMode==='connecting')
      ? editorLocalBoard
      : { tasks, owners: extraOwners },
  apply: applyCloud,
  onState: (state) => {
    if(state.status==='access-denied'&&accessMode==='edit')queueMicrotask(revokeEditor);
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
let sharedCacheEvent=null;
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
    (gesture || editorBlocksSync($("#editor")) || $("#import-dialog").open)
  ) {
    cloudEngine.later(1500);
    return;
  }
  try{return await originalFlush()}finally{if(sharedCacheEvent){const event=sharedCacheEvent;sharedCacheEvent=null;window.dispatchEvent(new StorageEvent("storage",{key:event.key,newValue:event.newValue}));}}
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
    googleAuth.config.identityOnly=!SHEETS_ONLY&&viewerState.background?.provider==='apps-script';
    await googleAuth.authorize();
    if (attempt !== connectionAttempt) return;
    // Team membership is checked before asking for any Drive file. Team editors
    // work with the canonical board; only the owner's session bridges Sheets.
    let access;
    if(SHEETS_ONLY){
      const profile=await googleAuth.profile();
      if(profile.email.toLowerCase()!==MODE_OWNER){googleAuth.disconnect();throw new Error('Личный режим: редактирует владелец доски. Для коллег доступен просмотр по ссылке.');}
      googleAuth.remember(profile.email);
      access={ownerEmail:MODE_OWNER};
    }else{
      await cloudEngine.repository.authenticate(googleAuth.getToken());
      access=await cloudEngine.repository.accessInfo();
      googleAuth.remember(cloudEngine.repository.actor().email);
    }
    if(!access.background?.enabled && (SHEETS_ONLY||access.ownerEmail===cloudEngine.repository.actor().email.toLowerCase())){
      try { await cloudEngine.api.read(); }
      catch(error){
        if(error.status===403||error.status===404){$("#cloud-dialog").close();await googleAuth.pickFile();}
        else throw error;
      }
    }
    if (attempt !== connectionAttempt) return;
    $("#cloud-dialog").close();
    viewer?.stop();
    if(SHEETS_ONLY){tasks=structuredClone(editorLocalBoard.tasks);extraOwners=[...editorLocalBoard.owners];}
    accessMode = "connecting";
    await cloudEngine.connect();
    if (attempt !== connectionAttempt) {
      await cloudEngine.disconnect();
      startViewer();
      return;
    }
    accessMode = "edit";
    $("#access-dialog").open && openAccess();
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
        managed: !!cloudEngine.managed,
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
    text("#google-error", error.code==='resource-exhausted'?'Google временно отклоняет запросы из-за квоты проекта. Показана последняя копия; неотправленные правки сохранены. Повторите вход позже.':error.message);
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
function conflictText(value, taskId="") {
  if (value == null) return "Убрано с доски / пусто";
  if (typeof value !== "object") return String(value);
  if (value.task)
    return (
      (value.archived ? "В архиве\n" : "На доске\n") +
      value.task.title + "\n" + [value.task.status,value.task.owner,value.task.due].filter(Boolean).join(" · ") +
      "\n" + (value.task.comment || "")
    );
  return Object.entries(value).map(([key,v])=>{
    const label=FIELD_NAMES[key]||{'positions.owners':'Позиция в дорожке','positions.time':'Позиция по сроку','positions.priority':'Очередность в квадрате'}[key]||key;
    if(key==='priority')return label+': '+(QUADRANTS.find(q=>q.id===v)?.title||'Входящие');
    if(key.startsWith('positions.')&&v){
      const view=key.split('.')[1],group=[{id:'inbox',title:'Входящие'},...QUADRANTS,...STATUS_LANES].find(g=>g.id===v.group)?.title||v.group;
      if(view==='priority'&&v.order){
        const neighbours=ordered(tasks.filter(t=>t.id!==taskId&&groupFor(t,view,today())===v.group),view,today());
        const before=neighbours.filter(t=>orderKey(t,view,today())<v.order).at(-1),after=neighbours.find(t=>orderKey(t,view,today())>v.order);
        return label+': '+group+'\n'+(before?'После «'+before.title+'»':'В начале квадрата')+(after?'\nПеред «'+after.title+'»':'');
      }
      return label+': '+group+' · '+v.x+', '+v.y;
    }
    return label+': '+(v==null?'Не указано':typeof v==='object'?JSON.stringify(v):v);
  }).join('\n');
}
function openConflicts() {
  if($("#source-dialog").open)closeDialog("source-dialog");
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
        `<section class="cloud-conflict"><h3>${esc(c.title)} · ${esc(c.fieldName || GROUP_NAMES[c.field] || FIELD_NAMES[c.field] || c.field)}</h3><p>Одно поле изменили параллельно. ${cloudEngine.managed?'Обе версии сохранены в истории.':'Обе версии сохранены в очереди этого устройства.'}</p><label class="cloud-choice"><span><input type="radio" name="conflict-${i}" value="remote"> Текущая общая версия</span><pre>${esc(conflictText(c.remote,c.taskId))}</pre></label><label class="cloud-choice"><span><input type="radio" name="conflict-${i}" value="local"> Предложенная версия${c.actor?.name ? " · " + esc(c.actor.name) : ""}</span><pre>${esc(conflictText(c.local,c.taskId))}</pre></label></section>`,
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
      toast(SHEETS_ONLY?"Выбранные версии отправлены в Google Таблицу":"Выбранные версии сохранены для команды");
    }
  } catch (error) {
    text("#conflicts-error", error.message);
  } finally {
    button.disabled = false;
  }
};
window.addEventListener("online", () => {
  if (cloudEngine.connected) cloudEngine.flush();
  else if(SHEETS_ONLY&&accessMode==="edit")restorePersonalSession();
  else if (!DEMO && accessMode === "view") viewer?.start();
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && cloudEngine.connected) cloudEngine.flush();
});
if (!DEMO) {
  if(!SHEETS_ONLY){cloudEngine.bridge = new TeamSourceBridge(cloudEngine);cloudEngine.ready().catch((error) => toast(error.message));}
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
      cloudEngine.api = new (SHEETS_ONLY?DirectSheetsApi:SheetsApi)(googleAuth, undefined, writeGuard);
      viewer = SHEETS_ONLY ? new SheetViewer({api:publicSheets,initial:modeBootstrap,onData:applyPublic,onState:renderViewerState,onControl:observeStorageControl}) : new BoardViewer({
        config: team,
        boardId: team.boardId,
        onData: applyPublic,
        onState: renderViewerState,
      });
      if (accessMode === "view") viewer.start();
      if(SHEETS_ONLY)queueMicrotask(restorePersonalSession);
      if(!SHEETS_ONLY)cloudEngine.repository = new TeamApi({
        config: team,
        boardId: team.boardId,
      });
    })
    .catch((error) => {
      text("#google-error", error.message);
      renderViewerState({ status: "view-error", message: error.message });
    });
}
let renewingSession=null;
async function restorePersonalSession(){
 if(!googleAuth||!SHEETS_ONLY||modePending(storageControl))return;
 let valid=googleAuth.restore();const remembered=googleAuth.rememberedEmail===MODE_OWNER;
 if(!valid&&!remembered)return;
 let message='Вход сохранён. При следующем изменении обновим разрешение Google.';
 if(valid){
  try{const p=await googleAuth.profile();if(p.email.toLowerCase()!==MODE_OWNER){googleAuth.disconnect();return}}
  catch(error){
   if(error.identity){googleAuth.disconnect();return}
   if(!remembered||!cloudEngine.base||stateLoadError){text('#google-error',error.message);return}
   valid=false;message=error.message;
  }
 }
 if(!valid&&(!cloudEngine.base||stateLoadError))return;
 try{
  viewer?.stop();tasks=structuredClone(editorLocalBoard.tasks);extraOwners=[...editorLocalBoard.owners];accessMode='connecting';
  if(valid)await cloudEngine.connect();else {cloudEngine.enabled=true;cloudEngine.state('signin',message);}
  accessMode='edit';$('#view-access').hidden=true;$('#google-disconnect').hidden=false;persist();render();cloudState({...syncState,status:cloudEngine.status,conflicts:cloudEngine.conflicts,pending:cloudEngine.pending()});
 }catch(error){text('#google-error',error.message);startViewer()}
}
function renewPersonalSession(){
 if(renewingSession||!SHEETS_ONLY||accessMode!=='edit'||!googleAuth?.needsRefresh())return;
 // Start inside the trusted user event: GIS requires a user gesture for renewal.
 renewingSession=googleAuth.authorize().then(async()=>{
  const p=await googleAuth.profile();if(p.email.toLowerCase()!==MODE_OWNER){googleAuth.disconnect();throw new Error('Выберите Google-аккаунт владельца доски.');}
  googleAuth.remember(p.email);
  if(cloudEngine.connected)await cloudEngine.flush();else await cloudEngine.connect();
  render();
 }).catch(error=>{if(!error.cancelled){text('#google-error',error.message);toast('Правки сохранены на устройстве. '+error.message)}}).finally(()=>{renewingSession=null});
}
document.addEventListener('click',e=>{if(e.isTrusted&&!e.target.closest('#google-disconnect,#google-authorize,#google-cancel,#cloud-reset'))renewPersonalSession()},true);
document.addEventListener('keydown',e=>{if(e.isTrusted&&!e.repeat&&e.key==='Enter')renewPersonalSession()},true);
window.addEventListener('storage',e=>{if(e.key!==googleAuth?.sessionKey)return;if(e.newValue){googleAuth.restore();if(SHEETS_ONLY&&accessMode==='edit'&&!cloudEngine.connected&&!googleAuth.needsRefresh(5000))cloudEngine.connect()}else if(SHEETS_ONLY&&accessMode==='edit'){$('#google-disconnect').click()}});
if(SHEETS_ONLY){text('#cloud-title','Личная доска · Google Таблица');text('#cloud-mode-note','Правки до отправки и черновики сохраняются на этом устройстве. История версий таблицы доступна в Google. Общая история Firestore в личном режиме не ведётся.');text('#cloud-mode-description','Вы редактируете через свой Google, коллеги смотрят по ссылке без входа. Карточки и порядок сохраняются прямо в таблице. Firestore в этом режиме не используется.');}
productivity=installProductivity({storage,storageKey:STORAGE,esc,toast,today,canEdit,requireEditor,personName,
 isGrouped:usesGroupedBoard,viewState:()=>({department:$('#department-filter').value,...dateRange,archive:archiveScope,group:displayControls?.requestedGroup()||'auto'}),restoreView:v=>{const sel=$('#department-filter');if(v.department&&![...sel.options].some(o=>o.value===v.department))sel.add(new Option(v.department+' · нет на доске',v.department));sel.value=v.department;archiveScope=v.archive;dateRange={from:v.from,to:v.to};calendar?.setRange(dateRange);displayControls?.setGroup(v.group,v.mode,false)},
 tasks:()=>tasks,mode:()=>mode,selection:()=>[...selectedIds],editing:()=>editing,
 visible:()=>productivity?.sort(tasks.filter(isVisible))||tasks.filter(isVisible),unread:id=>inbox.get(id),
 render,setMode,clearFilters,openTask,saveDraft,submitTask,field,
 loaded:()=>DEMO||viewerState.status==='view-live'||syncState.status==='synced',
 capture:()=>cloudEngine?.managed?cloudEngine.capture():null,
 commit:(update,basis)=>change(()=>{tasks=update(tasks)},basis),
 selectAll:ids=>{ids.forEach(id=>selectedIds.add(id));render()},
 clearSelection:()=>{selectedIds.clear();render()},
 hasNewDraft:()=>{try{return !!(memoryDrafts.get(null)||drafts.read(null))}catch{return true}},
});
installExecutionControls({canEdit,tasks:()=>tasks,capture:()=>cloudEngine?.managed?cloudEngine.capture():null,commit:(update,basis)=>change(()=>{tasks=update(tasks)},basis),toast});
installQuickControls({canEdit,tasks:()=>tasks,capture:()=>cloudEngine?.managed?cloudEngine.capture():null,commit:(update,basis)=>change(()=>{tasks=update(tasks)},basis),toast});
priorityEditor=installPriorityEditor({dialog:$('#editor'),area:$('.board-area'),mode:()=>mode,save:saveDraft,taskId:()=>editing,onToggle:renderMatrix});
installWorkspaceShell({storage,toast});
displayControls=installDisplayControls({storage,mode:()=>mode,range:()=>dateRange,today,setRange:setDateRange,sort:currentSort,render,toast});
groupedBoard=installGroupedBoard({active:usesGroupedBoard,group:currentGroup,sections:taskSections,tasks:()=>presentationOrder(tasks.filter(isVisible).map(presentationTask)),esc,canEdit,openTask,selection:()=>[...selectedIds],selectTask});
gantt=installGantt({esc,today,group:currentGroup,sortKind:currentSort,order:items=>presentationOrder(items,'gantt'),canReorder:canReorderView,sections:taskSections,range:()=>dateRange,setRange:setDateRange,mode:()=>mode,canEdit,visible:()=>tasks.filter(isVisible).map(presentationTask),tasks:()=>tasks,openTask,capture:()=>cloudEngine?.managed?cloudEngine.capture():null,commit:(update,basis)=>change(()=>{tasks=update(tasks)},basis),toast});
rangePicker=installRangePicker({root:$('#period-picker'),today,getRange:()=>dateRange,onChange:setDateRange,esc});
calendar=installCalendar({esc,today,group:currentGroup,order:items=>presentationOrder(items,'calendar'),canReorder:canReorderView,range:()=>dateRange,setRange:setDateRange,unfiltered:()=>tasks.filter(t=>matchesFilters(t)&&presentationRegistry(effectiveTask(t),{archive:archiveScope,hideDone:$('#hide-done').checked})).map(t=>({...presentationTask(t),owner:personName(t.owner)})),setStatus:setTaskStatus,mode:()=>mode,canEdit,visible:()=>tasks.filter(isVisible).map(t=>({...presentationTask(t),owner:personName(t.owner)})),openTask,
 createOn:date=>{if(!requireEditor())return;let existing;try{existing=memoryDrafts.get(null)||drafts.read(null)}catch{existing=true}if(existing){toast('Сначала завершите черновик новой задачи через «Черновики».');return}openTask();field('due').value=date;saveDraft();field('title').focus()},
});
installPlanningDrag({context:()=>[mode,currentSort(),currentGroup()].join('|'),tasks:()=>tasks,mode:()=>mode,sort:()=>productivity.sortKind(),personName,today,canEdit:()=>canEdit()&&canReorderView(),selection:()=>[...selectedIds],toast,
 capture:()=>cloudEngine?.managed?cloudEngine.capture():null,start:()=>{matrixDragging=true},cancel:()=>{matrixDragging=false;render()},
 commit:(update,basis)=>change(()=>{tasks=update(tasks)},basis),manualOrder:()=>productivity.manualOrder(),
});
$('#owner-note').insertAdjacentHTML('afterend','<div id="owner-profile" class="owner-profile" hidden></div>');
function renderOwnerProfile(){const input=field('owner'),person=directory.resolve(input.value),box=$('#owner-profile');if(!box)return;box.hidden=!person;if(!person)return;box.innerHTML=`${person.avatar?`<img src="${esc(person.avatar)}" alt="">`:''}<span><strong>${esc(person.name)}</strong><small>${esc(person.department)} · Bitrix24</small></span>${canEdit()&&input.value!==person.name?'<button type="button" class="text-button" id="use-full-name">Использовать полное имя</button>':''}`;const button=$('#use-full-name');if(button)button.onclick=()=>{input.value=person.name;saveDraft();renderOwnerProfile()};}
$('#source-dialog').insertAdjacentHTML('beforeend','<p id="directory-state" class="source-meta"></p>');
if(!DEMO)directory.load().then(()=>{text('#directory-state',directory.status==='ready'?`Справочник Bitrix24: ${directory.people.length} сотрудников. ${(directory.departments||[]).join(', ')}. Имена и фото обновлены ${new Date(directory.updatedAt).toLocaleDateString('ru')}.`:'Справочник сотрудников пока недоступен. Показаны имена из таблицы.');render();if($('#editor').open)renderOwnerProfile()});
render();
if (!DEMO) renderViewerState();
if (DEMO && freshBoard && !stateLoadError) setMode(mode);
if (DEMO && !stateLoadError) persist();
if (stateLoadError)
  text("#save-state", "Не удалось прочитать сохранённую доску");

// Selection is transient; it never changes another device's view.
$('#task-list').addEventListener('click',e=>{const el=e.target.closest('[data-select]');if(el)selectTask(el.dataset.select,e.shiftKey)});
let accessBusy=false, accessInfo=null;
function renderAccess(){
 const actor=canEdit()?cloudEngine.repository?.actor():null, info=accessInfo;
 const owner=!!actor?.email && actor.email.toLowerCase()===info?.ownerEmail;
 $('#access-form').hidden=!owner;
 $('#access-signin').hidden=canEdit();
 $('#access-members').innerHTML=info?`<div class="access-member"><span>${esc(info.ownerEmail)}<br><small>Владелец · управляет доступом</small></span></div>`+info.members.map(email=>`<div class="access-member"><span>${esc(email)}<br><small>Редактор</small></span>${owner?`<button class="button quiet" data-remove-member="${esc(email)}" ${accessBusy?'disabled':''}>Убрать</button>`:''}</div>`).join(''): '<p class="access-intro">Войдите аккаунтом команды, чтобы увидеть список редакторов.</p>';
 $('#access-form').querySelector('button').disabled=accessBusy;
}
async function openAccess(){
 $('#appearance-dialog').open&&closeDialog('appearance-dialog');
 accessInfo=null;text('#access-error','');showDialog('access-dialog');renderAccess();
 if(SHEETS_ONLY){accessInfo={ownerEmail:MODE_OWNER,members:[]};renderAccess();$('#access-form').hidden=true;text('#access-error','Личный режим: вы редактируете доску, коллеги смотрят по ссылке. Права на саму Google Таблицу управляются в Google.');return;}
 if(!canEdit()||DEMO)return;
 try{accessInfo=await cloudEngine.repository.accessInfo();renderAccess()}catch(error){text('#access-error',error.message)}
}
$('#access-open').onclick=openAccess;
$('#access-signin').onclick=()=>{closeDialog('access-dialog');showDialog('cloud-dialog')};
async function setMember(email,enabled){
 if(accessBusy)return;accessBusy=true;renderAccess();text('#access-error','Сохраняем доступ…');
 const operationId=crypto.randomUUID();
 try{accessInfo=await cloudEngine.repository.setMember(email,enabled,operationId);$('#access-email').value='';text('#access-error',enabled?'Редактор добавлен. Отправьте ему ссылку на доску.':'Доступ к редактированию отозван. Просмотр по ссылке остаётся.');}
 catch(error){text('#access-error',error.code==='resource-exhausted'?'Google отклонил запрос из-за квоты. Изменение списка не подтверждено. Адрес сохранён в поле; повторите позже.':error.message)}finally{accessBusy=false;renderAccess()}
}
$('#access-form').onsubmit=e=>{e.preventDefault();setMember($('#access-email').value,true)};
$('#access-members').onclick=e=>{const b=e.target.closest('[data-remove-member]');if(b)setMember(b.dataset.removeMember,false)};
async function revokeEditor(){
 if(accessMode!=='edit')return;
 saveDraft();editorLocalBoard={tasks:structuredClone(tasks),owners:[...extraOwners]};persist();
 accessMode='view';selectedIds.clear();matrixDragging=false;googleAuth?.disconnect();
 $('#editor').open&&$('#editor').close();$('#access-dialog').open&&$('#access-dialog').close();
 await cloudEngine.disconnect();startViewer();toast('Право редактирования отозвано. Неотправленные правки сохранены на устройстве.');
}

let modeBusy=false,modeMonitor=null,modeReloading=false;
function renderStorageMode(){
 $('#storage-open').hidden=DEMO;
 text('#storage-label',SHEETS_ONLY?'Google Таблица':'Firestore');
 const pending=modePending(storageControl),target=storageControl.request.mode;
 text('#storage-current','Сейчас: '+MODES[storageControl.ack.mode]);
 text('#storage-state',pending?'Переключаем на «'+MODES[target]+'». Дождитесь подтверждения фонового обработчика; обычно до минуты. При исчерпанной квоте включение Firestore подождёт её сброса.':modeReadError||'Режим сохранён в таблице и действует на всех устройствах.');
 for(const input of $$('[name="storage-choice"]')){if(!$('#storage-dialog').open)input.checked=input.value===storageControl.ack.mode;input.disabled=modeBusy||pending;}
 $('#storage-apply').disabled=modeBusy||pending||DEMO;
 text('#storage-apply',modeBusy?'Сохраняем…':pending?'Переключение…':'Сохранить режим');
 $('#storage-cancel-change').hidden=!pending;$('#storage-cancel-change').disabled=modeBusy;text('#storage-cancel-change','Остаться в режиме «'+MODES[storageControl.ack.mode]+'»');
}
function observeStorageControl(control){
 storageControl=control;modeReadError='';try{storage.setItem(MODE_KEY,JSON.stringify(control))}catch{}
 renderStorageMode();
 if(modePending(control)){
   if(accessMode==='edit'){saveDraft();persist();cloudEngine?.disconnect();selectedIds.clear();render();}
   return;
 }
 if(control.ack.mode!==STORAGE_MODE&&!modeReloading){
   if(cloudEngine?.pending()){modeReadError='Есть неотправленные правки текущего режима. Они сохранены на устройстве. Скачайте копию перед переходом.';renderStorageMode();return;}
   modeReloading=true;persist();location.reload();
 }
}
async function monitorStorageMode(){
 try{observeStorageControl(await publicSheets.control())}catch(error){modeReadError=error.message;renderStorageMode()}
 modeMonitor=setTimeout(monitorStorageMode,30000);
}
$('#storage-open').onclick=()=>{closeDialog('appearance-dialog');renderStorageMode();for(const input of $$('[name="storage-choice"]'))input.checked=input.value===storageControl.ack.mode;showDialog('storage-dialog')};
async function changeStorageMode(target,cancelPending=false){
 if(!Object.hasOwn(MODES,target)||(target===storageControl.ack.mode&&!modePending(storageControl)))return closeDialog('storage-dialog');
 modeBusy=true;modeReadError='';renderStorageMode();
 try{
  if(cloudEngine?.pending()){await cloudEngine.flush();if(cloudEngine.pending())throw new Error('Есть неотправленные правки. Сначала дождитесь их сохранения или скачайте копию; переключение их не удаляет.');}
  if(!googleAuth)throw new Error('Google ещё загружается. Повторите через несколько секунд.');
  googleAuth.config.identityOnly=false;await googleAuth.authorize();
  const profile=await googleAuth.profile();if(profile.email.toLowerCase()!==MODE_OWNER)throw new Error('Режим хранения меняет владелец доски.');
  const api=new SheetsApi(googleAuth),current=await api.readStorageControl();
  if(modePending(current)&&(!cancelPending||target!==current.ack.mode))throw new Error('Предыдущее переключение ещё не завершено.');
  saveDraft();persist();const request=await api.requestStorageMode(target,profile.email);observeStorageControl({...current,request});
  clearTimeout(modeMonitor);modeMonitor=setTimeout(monitorStorageMode,1500);
 }catch(error){modeReadError=error.message}finally{modeBusy=false;renderStorageMode()}
}
$('#storage-apply').onclick=()=>changeStorageMode($('[name="storage-choice"]:checked')?.value);
$('#storage-cancel-change').onclick=()=>changeStorageMode(storageControl.ack.mode,true);
renderStorageMode();if(!DEMO)modeMonitor=setTimeout(monitorStorageMode,30000);

// Open links from the weekly report after the source finishes loading.
const linkedTask=new URLSearchParams(location.search).get("task");
if(linkedTask){let attempts=0;const timer=setInterval(()=>{if(tasks.some(t=>t.id===linkedTask)){clearInterval(timer);openTask(linkedTask);const desiredStatus=new URLSearchParams(location.search).get("setStatus");if(canEdit()&&["Готово","Отменено"].includes(desiredStatus)){field("status").value=desiredStatus;saveDraft()}const desiredImportance=new URLSearchParams(location.search).get("setImportance");if(canEdit()&&desiredImportance!==null&&/^[0-5]$/.test(desiredImportance)){field("importance").value=desiredImportance==="0"?"":desiredImportance;saveDraft();field("importance").focus()}const desiredProgress=new URLSearchParams(location.search).get("setProgress");if(canEdit()&&desiredProgress!==null&&/^(100|[1-9]?\d)$/.test(desiredProgress)){field("progress").value=desiredProgress;saveDraft();field("progress").focus()}const desiredAction=new URLSearchParams(location.search).get("setWorkAction");if(canEdit()&&["play","pause"].includes(desiredAction)){field("status").value=desiredAction==="play"?"В работе":"Приостановлено";saveDraft();field("status").focus()}}else if(++attempts>=60)clearInterval(timer)},1000);}

function setTaskStatus(id,status){if(!STATUSES.includes(status))return;return change(()=>{tasks=tasks.map(t=>t.id===id?{...t,status}:t)})}
document.addEventListener('change',e=>{const el=e.target;if(el?.dataset?.importanceId){e.stopPropagation();change(()=>{tasks=tasks.map(t=>t.id===decodeURIComponent(el.dataset.importanceId)?{...t,importance:Number(el.value)}:t)})}},true);
$('#archive-scope').onchange=e=>{const next=reconcileRegistry(e.target.value,$('#hide-done').checked,'archive');archiveScope=next.archive;$('#hide-done').checked=next.hideDone;render()};

async function refreshSignalState(){if(DEMO)return;try{const c=new AbortController(),timer=setTimeout(()=>c.abort(),18000);let r;try{r=await fetch('https://docs.google.com/spreadsheets/d/1qh-pi5I76k8ssUc6DxjeytFDrAta1N4ZdmVjaUFCUYY/export?format=csv&gid=1909260103&range=A1:D2500&_='+Date.now(),{credentials:'omit',cache:'no-store',signal:c.signal})}finally{clearTimeout(timer)}if(!r.ok)throw Error();const rows=parseDelimited(await r.text(),',');if(rows[0]?.[0]!=='Проверено'||rows.length>=2500)throw Error();signalState=new Map(rows.slice(2).filter(r=>r[2]).map(r=>[r[2],JSON.parse(r[3])]));render()}catch{if(archiveScope)text('#registry-note','Архив не обновлён: проверьте соединение с таблицей.')}finally{setTimeout(refreshSignalState,30000)}}
if(!DEMO)refreshSignalState();
