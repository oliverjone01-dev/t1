if(typeof globalThis.URLSearchParams==='undefined')globalThis.URLSearchParams=class{constructor(values){this.values=values}toString(){return Object.entries(this.values).map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&')}};
if(typeof globalThis.structuredClone==='undefined')globalThis.structuredClone=v=>JSON.parse(JSON.stringify(v));
var WeeklySignalsRuntime = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // weekly/runtime.mjs
  var runtime_exports = {};
  __export(runtime_exports, {
    check: () => check,
    initialize: () => initialize,
    poll: () => poll,
    start: () => start
  });

  // public/task-dates.mjs?rev=20261110-progress-5
  function validDay(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + "T12:00:00Z")) && (/* @__PURE__ */ new Date(value + "T12:00:00Z")).toISOString().slice(0, 10) === value;
  }
  function parseCreatedAt(raw, cell2) {
    if (["DATE", "DATE_TIME"].includes(cell2?.userEnteredFormat?.numberFormat?.type) && typeof cell2.effectiveValue?.numberValue === "number") {
      const serial = cell2.effectiveValue.numberValue, date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 864e5).toISOString().slice(0, 10);
      return validDay(date) ? date : "";
    }
    const value = String(raw || "").trim();
    if (validDay(value)) return value;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && validDay(value.slice(0, 10)) && Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
    const values = [...value.matchAll(/(?:^|[\s;,])(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/g)].map((m) => {
      const date = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      if (!validDay(date)) return "";
      if (!m[4]) return date;
      if (+m[4] > 23 || +m[5] > 59 || +(m[6] || 0) > 59) return "";
      return (/* @__PURE__ */ new Date(`${date}T${m[4].padStart(2, "0")}:${m[5]}:${m[6] || "00"}+03:00`)).toISOString();
    }).filter(Boolean).sort();
    return values[0] || "";
  }

  // public/task-signals.mjs
  var terminalKind = (t) => t?.status === "\u0413\u043E\u0442\u043E\u0432\u043E" ? "done" : t?.status === "\u041E\u0442\u043C\u0435\u043D\u0435\u043D\u043E" ? "cancelled" : "";
  function trackStatus(before, task, at = (/* @__PURE__ */ new Date()).toISOString()) {
    task = { ...task, workStarted: !!task.workStarted || ["\u0412 \u0440\u0430\u0431\u043E\u0442\u0435", "\u041F\u0440\u0438\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E"].includes(task.status) || Number(task.progress) > 0 };
    const kind = terminalKind(task);
    if (!kind) return { ...task, closedAt: "", archiveKind: "" };
    return { ...task, ...task.status === "\u0413\u043E\u0442\u043E\u0432\u043E" ? { progress: 100 } : {}, closedAt: before?.status === task.status && before.closedAt ? before.closedAt : task.closedAt && task.closedAt !== before?.closedAt ? task.closedAt : at, archiveKind: before?.status === task.status ? task.archiveKind || "" : "" };
  }
  function weekStart(date) {
    const d = /* @__PURE__ */ new Date(date + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
    return d.toISOString().slice(0, 10);
  }
  function dateShift(d, n) {
    return new Date(Date.parse(d + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);
  }
  var closedDay = (t) => t.closedAt ? new Date(Date.parse(t.closedAt) + 108e5).toISOString().slice(0, 10) : "";
  function archiveEligible(task, today) {
    return !!terminalKind(task) && !!task.closedAt && closedDay(task) < dateShift(weekStart(today), -7);
  }
  function lifecycle(before, task, today, at) {
    let next = trackStatus(before, task, at);
    if (archiveEligible(next, today)) next.archiveKind = terminalKind(next);
    return next;
  }

  // public/task-signals.mjs?rev=20261110-progress-5
  function metadata(t) {
    return { ...t.start ? { start: t.start } : {}, importance: Number(t.importance) || 0, progress: Number(t.progress ?? (t.status === "\u0413\u043E\u0442\u043E\u0432\u043E" ? 100 : 0)), workStarted: !!t.workStarted, closedAt: t.closedAt || "", archiveKind: t.archiveKind || "" };
  }
  function packedPositions(t) {
    const p = structuredClone(t.positions || {}), m = metadata(t);
    if (m.start || m.importance || m.closedAt || m.archiveKind || m.progress || m.workStarted) p._task = m;
    return p;
  }

  // public/people.mjs?rev=20261110-progress-5
  function parseAssignee(value) {
    const name = String(value || "").trim().replace(/\s+/g, " ");
    if (!name) return "";
    if (name.length > 80 || /;|\u2014|\u2013|\s-\s|->|\u2192|\sи\s|не указан|исполнитель|инициатор|адресат/i.test(
      name
    ))
      return null;
    return /^[\p{L} -]+$/u.test(name) ? name : null;
  }

  // public/model.mjs?rev=20261110-progress-5
  var QUADRANTS = [
    { id: "do", title: "\u0421\u0434\u0435\u043B\u0430\u0442\u044C \u0441\u0435\u0439\u0447\u0430\u0441", subtitle: "\u0412\u0430\u0436\u043D\u043E \xB7 \u0441\u0440\u043E\u0447\u043D\u043E", color: "coral" },
    { id: "plan", title: "\u0420\u0430\u0437\u0432\u0438\u0442\u0438\u0435", subtitle: "\u0412\u0430\u0436\u043D\u043E \xB7 \u043D\u0435 \u0441\u0440\u043E\u0447\u043D\u043E", color: "violet" },
    { id: "delegate", title: "\u0421\u0434\u0435\u043B\u0430\u0442\u044C \u043F\u043E\u0437\u0436\u0435", subtitle: "\u041D\u0435 \u0432\u0430\u0436\u043D\u043E \xB7 \u0441\u0440\u043E\u0447\u043D\u043E", color: "blue" },
    { id: "later", title: "\u041E\u0442\u043B\u043E\u0436\u0438\u0442\u044C", subtitle: "\u041D\u0435 \u0432\u0430\u0436\u043D\u043E \xB7 \u043D\u0435 \u0441\u0440\u043E\u0447\u043D\u043E", color: "slate" }
  ];
  function localDate(date = /* @__PURE__ */ new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  function parseDeadline(raw, year) {
    if (!raw || /не указан|течени|ноябр.*проверяем/i.test(raw)) return "";
    const tail = raw.split(/->|→/).at(-1).trim();
    if (/\d{1,2}\.\d{1,2}(?:\.\d{4})?\s*[-\u2013\u2014]\s*\d{1,2}\.\d{1,2}|\d\s+[-\u2013\u2014]\s*\d/.test(tail)) return "";
    const m = tail.match(/^(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{4}))?(?=$|\s|\u2014|\u2013)/);
    if (!m) return "";
    const value = `${m[3] || year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    const d = /* @__PURE__ */ new Date(`${value}T12:00:00`);
    return !Number.isNaN(+d) && localDate(d) === value ? value : "";
  }
  function fromSheet(rows, year = (/* @__PURE__ */ new Date()).getFullYear()) {
    const header = rows.findIndex((r) => r.includes("ID") && r.includes("\u041D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435"));
    if (header < 0) throw new Error("\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B \u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043A\u0438 ID \u0438 \u041D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435. \u0412\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u0441\u0442\u0440\u043E\u043A\u0438 \u0432\u043C\u0435\u0441\u0442\u0435 \u0441 \u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043A\u0430\u043C\u0438.");
    const headers = rows[header];
    const at = (row, name) => String(row[headers.indexOf(name)] ?? "").trim();
    return rows.slice(header + 1).filter((r) => at(r, "ID") && (at(r, "\u0417\u0430\u0434\u0430\u0447\u0430") || at(r, "\u041D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435"))).map((row) => ({
      id: at(row, "ID \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438") || `sheet-${at(row, "ID")}`,
      sourceId: at(row, "ID"),
      title: at(row, "\u0417\u0430\u0434\u0430\u0447\u0430") || at(row, "\u041D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435"),
      unit: at(row, "\u042E\u043D\u0438\u0442").replace(/\s*\/\s*$/, ""),
      direction: at(row, "\u041D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435"),
      description: at(row, "\u041E\u0436\u0438\u0434\u0430\u0435\u043C\u044B\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442"),
      status: at(row, "\u0421\u0442\u0430\u0442\u0443\u0441") || "\u041D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D",
      owner: "",
      ownerNote: at(row, "\u041E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439"),
      due: parseDeadline(at(row, "\u0421\u0440\u043E\u043A"), year),
      dueNote: at(row, "\u0421\u0440\u043E\u043A"),
      comment: at(row, "\u041A\u043E\u043C\u043C\u0435\u043D\u0442"),
      dependency: at(row, "\u0417\u0430\u0432\u0438\u0441\u0438\u043C\u043E\u0441\u0442\u0438 \u0438 \u0443\u0442\u043E\u0447\u043D\u0435\u043D\u0438\u044F"),
      requester: at(row, "\u041F\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u0449\u0438\u043A"),
      link: /^https?:\/\//.test(at(row, "ID \u0437\u0430\u0434\u0430\u0447\u0438/ \u0441\u0441\u044B\u043B\u043A\u0430")) ? at(row, "ID \u0437\u0430\u0434\u0430\u0447\u0438/ \u0441\u0441\u044B\u043B\u043A\u0430") : "",
      createdAt: parseCreatedAt(at(row, "\u0414\u0430\u0442\u0430 \u043F\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438") || at(row, "\u0414\u0430\u0442\u0430 \u0438 \u0432\u0440\u0435\u043C\u044F \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F")),
      priority: null,
      positions: {}
    }));
  }
  function validateBoard(value) {
    const tasks = Array.isArray(value) ? value : value?.tasks;
    if (!Array.isArray(tasks) || tasks.length > 2e3) throw new Error("\u041E\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044F \u0434\u043E\u0441\u043A\u0430 \u043D\u0435 \u0431\u043E\u043B\u0435\u0435 \u0447\u0435\u043C \u0441 2000 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0430\u043C\u0438.");
    const ids = /* @__PURE__ */ new Set();
    return tasks.map((t) => {
      if (!t || typeof t.id !== "string" || !t.id || ids.has(t.id) || typeof t.title !== "string" || !t.title.trim()) throw new Error("\u0412 \u0444\u0430\u0439\u043B\u0435 \u0435\u0441\u0442\u044C \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u0431\u0435\u0437 ID, \u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043A\u0430 \u0438\u043B\u0438 \u0441 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u044E\u0449\u0438\u043C\u0441\u044F ID.");
      ids.add(t.id);
      if (t.due && (!/^\d{4}-\d{2}-\d{2}$/.test(t.due) || Number.isNaN(+/* @__PURE__ */ new Date(`${t.due}T12:00:00`)) || localDate(/* @__PURE__ */ new Date(`${t.due}T12:00:00`)) !== t.due)) throw new Error("\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442 \u0434\u0430\u0442\u044B.");
      if (t.start && (!/^\d{4}-\d{2}-\d{2}$/.test(t.start) || Number.isNaN(+/* @__PURE__ */ new Date(t.start + "T12:00:00")) || localDate(/* @__PURE__ */ new Date(t.start + "T12:00:00")) !== t.start)) throw new Error("\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u0430\u044F \u0434\u0430\u0442\u0430 \u043D\u0430\u0447\u0430\u043B\u0430.");
      if (t.start && t.due && t.start > t.due) throw new Error("\u041D\u0430\u0447\u0430\u043B\u043E \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u043F\u043E\u0437\u0436\u0435 \u0441\u0440\u043E\u043A\u0430.");
      if (t.priority && !QUADRANTS.some((q) => q.id === t.priority)) throw new Error("\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u043F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442.");
      const result = { id: t.id, title: t.title, priority: t.priority || null, positions: {} };
      const importance = Number(t.importance || 0);
      if (!Number.isInteger(importance) || importance < 0 || importance > 5) throw new Error("\u0421\u0440\u043E\u0447\u043D\u043E\u0441\u0442\u044C \u0434\u043E\u043B\u0436\u043D\u0430 \u0431\u044B\u0442\u044C \u043E\u0442 1 \u0434\u043E 5.");
      result.importance = importance;
      const progress = Number(t.progress ?? (t.status === "\u0413\u043E\u0442\u043E\u0432\u043E" ? 100 : 0));
      if (!Number.isInteger(progress) || progress < 0 || progress > 100) throw new Error("\u0413\u043E\u0442\u043E\u0432\u043D\u043E\u0441\u0442\u044C \u0434\u043E\u043B\u0436\u043D\u0430 \u0431\u044B\u0442\u044C \u043E\u0442 0 \u0434\u043E 100%.");
      if (t.workStarted !== void 0 && typeof t.workStarted !== "boolean") throw new Error("\u041F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u043E \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430.");
      result.progress = progress;
      result.workStarted = !!t.workStarted;
      if (t.createdAt && parseCreatedAt(t.createdAt) !== t.createdAt) throw new Error("\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u0430\u044F \u0434\u0430\u0442\u0430 \u043F\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438.");
      result.createdAt = t.createdAt || "";
      if (t.closedAt && (!/^\d{4}-\d{2}-\d{2}T/.test(t.closedAt) || !Number.isFinite(Date.parse(t.closedAt)))) throw new Error("\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u0430\u044F \u0434\u0430\u0442\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F.");
      result.closedAt = t.closedAt || "";
      if (t.archiveKind && !["done", "cancelled"].includes(t.archiveKind)) throw new Error("\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0430\u0440\u0445\u0438\u0432.");
      result.archiveKind = t.archiveKind || "";
      if (result.archiveKind && t.status !== (result.archiveKind === "done" ? "\u0413\u043E\u0442\u043E\u0432\u043E" : "\u041E\u0442\u043C\u0435\u043D\u0435\u043D\u043E")) throw new Error("\u0410\u0440\u0445\u0438\u0432 \u043D\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0441\u0442\u0430\u0442\u0443\u0441\u0443 \u0437\u0430\u0434\u0430\u0447\u0438.");
      for (const key of ["start", "sourceId", "unit", "direction", "description", "status", "owner", "ownerNote", "due", "dueNote", "comment", "dependency", "requester", "link"]) result[key] = typeof t[key] === "string" ? t[key] : "";
      for (const mode of ["priority", "owners", "time", "gantt"]) {
        const p = t.positions?.[mode];
        if (p && typeof p.group === "string" && Number.isFinite(p.x) && Number.isFinite(p.y)) result.positions[mode] = { group: mode === "owners" && p.group === result.owner && result.owner ? `owner:${result.owner}` : p.group, x: Math.max(0, Math.min(1e5, p.x)), y: Math.max(0, Math.min(1e5, p.y)) };
      }
      for (const mode of ["priority", "owners", "time", "gantt"]) {
        const p = t.positions?.[mode];
        if (result.positions[mode] && typeof p.order === "string" && /^[a-zA-Z0-9]{2,512}$/.test(p.order)) result.positions[mode].order = p.order;
      }
      return result;
    });
  }

  // public/sync-model.mjs?rev=20261110-progress-5
  var SHEET_ID = "1qh-pi5I76k8ssUc6DxjeytFDrAta1N4ZdmVjaUFCUYY";
  var TAB_ID = 1102202601;
  var TELEGRAM_TAB_ID = 1478506234;
  var SERVICE_HEADERS = [
    "\u041F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442 \xB7 \u0434\u043E\u0441\u043A\u0430",
    "\u041F\u043E\u0437\u0438\u0446\u0438\u0438 \xB7 \u0434\u043E\u0441\u043A\u0430",
    "ID \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438",
    "\u0410\u0440\u0445\u0438\u0432 \xB7 \u0434\u043E\u0441\u043A\u0430",
    "\u041E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439 \xB7 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A",
    "\u0421\u0440\u043E\u043A \xB7 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A"
  ];
  var SYNC_FIELDS = [
    "title",
    "unit",
    "direction",
    "description",
    "status",
    "owner",
    "due",
    "comment",
    "priority",
    "positions",
    "importance",
    "progress",
    "workStarted",
    "start",
    "createdAt",
    "closedAt",
    "archiveKind"
  ];
  var FIELD_NAMES = {
    progress: "\u0413\u043E\u0442\u043E\u0432\u043D\u043E\u0441\u0442\u044C",
    workStarted: "\u0417\u0430\u0434\u0430\u0447\u0430 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u043B\u0430\u0441\u044C",
    createdAt: "\u0414\u0430\u0442\u0430 \u043F\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438",
    title: "\u0417\u0430\u0434\u0430\u0447\u0430",
    unit: "\u042E\u043D\u0438\u0442",
    direction: "\u041D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435",
    description: "\u041E\u0436\u0438\u0434\u0430\u0435\u043C\u044B\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442",
    status: "\u0421\u0442\u0430\u0442\u0443\u0441",
    owner: "\u041E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439",
    due: "\u0421\u0440\u043E\u043A",
    comment: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439",
    priority: "\u041F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442",
    importance: "\u0421\u0440\u043E\u0447\u043D\u043E\u0441\u0442\u044C",
    start: "\u041D\u0430\u0447\u0430\u043B\u043E",
    closedAt: "\u0414\u0430\u0442\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F",
    archiveKind: "\u0410\u0440\u0445\u0438\u0432 \u0441\u0442\u0430\u0442\u0443\u0441\u0430",
    positions: "\u0420\u0430\u0441\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435",
    task: "\u0417\u0430\u0434\u0430\u0447\u0430 \u0446\u0435\u043B\u0438\u043A\u043E\u043C"
  };
  var PRIORITY_LABELS = {
    do: "\u0412\u0430\u0436\u043D\u043E \xB7 \u0441\u0440\u043E\u0447\u043D\u043E",
    plan: "\u0412\u0430\u0436\u043D\u043E \xB7 \u043D\u0435 \u0441\u0440\u043E\u0447\u043D\u043E",
    delegate: "\u041D\u0435 \u0432\u0430\u0436\u043D\u043E \xB7 \u0441\u0440\u043E\u0447\u043D\u043E",
    later: "\u041D\u0435 \u0432\u0430\u0436\u043D\u043E \xB7 \u043D\u0435 \u0441\u0440\u043E\u0447\u043D\u043E"
  };
  var COLUMNS = {
    createdAt: 13,
    unit: 1,
    direction: 2,
    title: 6,
    description: 7,
    status: 8,
    comment: 9,
    owner: 10,
    due: 11,
    priority: 16,
    positions: 17,
    start: 17,
    importance: 17,
    progress: 17,
    workStarted: 17,
    closedAt: 17,
    archiveKind: 17
  };
  var canonical = (value) => {
    if (value && typeof value.toJSON === "function") return canonical(value.toJSON());
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).filter((k) => value[k] !== void 0 && typeof value[k] !== "function" && typeof value[k] !== "symbol").sort().map((k) => [k, canonical(value[k])]));
    return value;
  };
  var equal = (a, b) => JSON.stringify(canonical(a ?? null)) === JSON.stringify(canonical(b ?? null));
  function decodeSheet(sheet, year = (/* @__PURE__ */ new Date()).getFullYear()) {
    const rows = sheet.rows;
    const textRows = rows.map(
      (r) => r.map(
        (c) => String(
          c.formattedValue ?? c.userEnteredValue?.stringValue ?? c.userEnteredValue?.numberValue ?? ""
        )
      )
    );
    const headers = textRows[2]?.slice(16, 22);
    if (!equal(headers, SERVICE_HEADERS) && !equal(headers, SERVICE_HEADERS.map((value, index) => index === 1 ? "\u041F\u043E\u0437\u0438\u0446\u0438\u0438 \xB7 \u043A\u043E\u043C\u0430\u043D\u0434\u0430 v3" : value)) && !equal(
      headers,
      SERVICE_HEADERS.map(
        (value, index) => index === 1 ? "\u041F\u043E\u0437\u0438\u0446\u0438\u0438 \xB7 \u043A\u043E\u043C\u0430\u043D\u0434\u0430 v2" : value
      )
    ))
      throw new Error(
        "\u0421\u043B\u0443\u0436\u0435\u0431\u043D\u044B\u0435 \u043A\u043E\u043B\u043E\u043D\u043A\u0438 \u0442\u0430\u0431\u043B\u0438\u0446\u044B \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u044B. \u0420\u0430\u0431\u043E\u0447\u0438\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u043D\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u044B."
      );
    const seen = /* @__PURE__ */ new Set(), records = [];
    for (let index = 3; index < rows.length; index++) {
      const raw = textRows[index];
      if (!raw[0] && !raw[2] && !raw[6] && !raw[18]) continue;
      if (!raw[2] && !raw[6]) continue;
      if (!raw[0] && !raw[18])
        throw new Error(
          `\u0423 \u0437\u0430\u0434\u0430\u0447\u0438 \u0432 \u0441\u0442\u0440\u043E\u043A\u0435 ${index + 1} \u043D\u0435\u0442 ID. \u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0435\u0433\u043E \u0432 \u0442\u0430\u0431\u043B\u0438\u0446\u0435.`
        );
      const id = raw[18] || `sheet-${raw[0]}`;
      if (seen.has(id))
        throw new Error(
          `\u0412 \u0442\u0430\u0431\u043B\u0438\u0446\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u0442\u0441\u044F ID \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438: ${id}. \u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430.`
        );
      seen.add(id);
      const source = raw.slice(0, 16);
      source[0] || (source[0] = id);
      const valueRows = [textRows[2].slice(0, 16), source];
      const task = fromSheet(valueRows, year)[0];
      if (!task) continue;
      task.id = id;
      task.sourceId = raw[0] || "";
      const priority = raw[16] || "";
      task.priority = Object.entries(PRIORITY_LABELS).find(
        ([key, label]) => priority === label || priority === key
      )?.[0] || null;
      if (priority && priority !== "\u0412\u0445\u043E\u0434\u044F\u0449\u0438\u0435" && !task.priority)
        throw new Error(`\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u043F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442 \u0432 \u0441\u0442\u0440\u043E\u043A\u0435 ${index + 1}.`);
      try {
        task.positions = raw[17] ? JSON.parse(raw[17]) : {};
        const meta = task.positions._task || {};
        task.start = meta.start || "";
        task.importance = meta.importance || 0;
        task.progress = meta.progress ?? (task.status === "\u0413\u043E\u0442\u043E\u0432\u043E" ? 100 : 0);
        task.workStarted = !!meta.workStarted;
        task.closedAt = meta.closedAt || "";
        task.archiveKind = meta.archiveKind || "";
        delete task.positions._task;
      } catch {
        throw new Error(`\u041F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u044B \u043F\u043E\u0437\u0438\u0446\u0438\u0438 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u0432 \u0441\u0442\u0440\u043E\u043A\u0435 ${index + 1}.`);
      }
      task.owner = parseAssignee(raw[10] || "") || "";
      task.ownerNote = raw[20] || raw[10] || "";
      task.dueNote = raw[21] || raw[11] || "";
      task.createdAt = parseCreatedAt(raw[13], rows[index][13]);
      const dueCell = rows[index][11];
      if (["DATE", "DATE_TIME"].includes(
        dueCell?.userEnteredFormat?.numberFormat?.type
      ) && typeof dueCell.effectiveValue?.numberValue === "number") {
        task.due = new Date(
          Date.UTC(1899, 11, 30) + Math.floor(dueCell.effectiveValue.numberValue) * 864e5
        ).toISOString().slice(0, 10);
      } else task.due = parseDeadline(raw[11] || "", year);
      const archived = /^(true|да|1)$/i.test(raw[19] || "") || rows[index][19]?.effectiveValue?.boolValue === true;
      records.push({
        id,
        sheetId: sheet.sheetId ?? TAB_ID,
        row: index,
        cells: rows[index],
        task: validateBoard([task])[0],
        archived
      });
    }
    let owners = [];
    if (textRows[0]?.[17]) {
      try {
        const metadata2 = JSON.parse(textRows[0][17]);
        owners = metadata2.owners;
        if (!Array.isArray(owners) || owners.some((o) => typeof o !== "string"))
          throw new Error();
      } catch {
        throw new Error("\u041F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u044B \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0434\u043E\u0440\u043E\u0436\u0435\u043A \u0432 \u044F\u0447\u0435\u0439\u043A\u0435 R1.");
      }
    }
    return {
      ...sheet,
      records,
      board: {
        tasks: records.filter((r) => !r.archived).map((r) => r.task),
        owners
      }
    };
  }
  function combineSheets(primary, telegram) {
    const records = [...primary.records, ...telegram.records];
    if (new Set(records.map((r) => r.id)).size !== records.length)
      throw new Error("ID \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u0442\u0441\u044F \u0432 \u0434\u0432\u0443\u0445 \u0432\u043A\u043B\u0430\u0434\u043A\u0430\u0445. \u0423\u0441\u0442\u0440\u0430\u043D\u0438\u0442\u0435 \u0434\u0443\u0431\u043B\u044C \u0432 \u0442\u0430\u0431\u043B\u0438\u0446\u0435.");
    return { ...primary, records, sourceTabs: [TAB_ID, TELEGRAM_TAB_ID], board: {
      tasks: validateBoard(records.filter((r) => !r.archived).map((r) => r.task)),
      owners: primary.board.owners
    } };
  }
  function cellValue(field, value, task) {
    if (task && ["positions", "start", "importance", "progress", "workStarted", "closedAt", "archiveKind"].includes(field)) return JSON.stringify(packedPositions(task));
    if (field === "priority") return value ? PRIORITY_LABELS[value] : "";
    if (field === "positions") return JSON.stringify(value || {});
    if (field === "due") return value ? value.split("-").reverse().join(".") : "";
    if (field === "unit") return value ? `${value} / ` : "";
    if (field === "status" && (!value || value === "\u041D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D")) return "";
    return value || "";
  }
  function buildWriteRequests(snapshot, writes, owners) {
    const requests = [], byId = new Map(snapshot.records.map((r) => [r.id, r]));
    let targetSheetId = TAB_ID;
    const cell2 = (row, col, value) => requests.push({
      updateCells: {
        start: { sheetId: targetSheetId, rowIndex: row, columnIndex: col },
        rows: [
          {
            values: [
              {
                userEnteredValue: typeof value === "boolean" ? { boolValue: value } : value === "" ? void 0 : { stringValue: String(value) }
              }
            ]
          }
        ],
        fields: "userEnteredValue"
      }
    });
    for (const write of writes) {
      const record = byId.get(write.id);
      targetSheetId = record?.sheetId ?? (write.id.startsWith("tg-") ? TELEGRAM_TAB_ID : TAB_ID);
      if (![TAB_ID, TELEGRAM_TAB_ID].includes(targetSheetId)) throw new Error("\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u0432\u043A\u043B\u0430\u0434\u043A\u0430 \u0437\u0430\u0434\u0430\u0447\u0438.");
      if (write.type === "archive") {
        if (record) cell2(record.row, 19, true);
        continue;
      }
      const fields = write.type === "upsert" ? SYNC_FIELDS : write.fields;
      if (fields.includes("owner") && write.task.owner && parseAssignee(write.task.owner) === null)
        throw new Error("\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043E\u0434\u043D\u043E\u0433\u043E \u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0433\u043E \u0431\u0435\u0437 \u043F\u043E\u044F\u0441\u043D\u0435\u043D\u0438\u0439.");
      if (record) {
        if (!record.cells[18]?.formattedValue) cell2(record.row, 18, write.id);
        if (record.archived) cell2(record.row, 19, false);
        for (const field of fields) {
          const col = COLUMNS[field];
          if (col === void 0) continue;
          const existing = record.cells[col] || {};
          if (existing.chipRuns?.length)
            throw new Error(
              `\u041F\u043E\u043B\u0435 \xAB${FIELD_NAMES[field]}\xBB \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0443\u043C\u043D\u0443\u044E \u043C\u0435\u0442\u043A\u0443. \u0418\u0437\u043C\u0435\u043D\u0438\u0442\u0435 \u0435\u0433\u043E \u0432 \u0442\u0430\u0431\u043B\u0438\u0446\u0435.`
            );
          if (existing.userEnteredValue?.formulaValue)
            throw new Error(
              `\u041F\u043E\u043B\u0435 \xAB${FIELD_NAMES[field]}\xBB \u0441\u0442\u0440\u043E\u043A\u0438 ${record.row + 1} \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0444\u043E\u0440\u043C\u0443\u043B\u0443. \u0418\u0437\u043C\u0435\u043D\u0438\u0442\u0435 \u0435\u0433\u043E \u0432 \u0442\u0430\u0431\u043B\u0438\u0446\u0435.`
            );
          const value = cellValue(field, write.task[field], write.task);
          if (field === "owner" && value && parseAssignee(value) === null)
            throw new Error(
              "\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043E\u0434\u043D\u043E\u0433\u043E \u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0433\u043E \u0431\u0435\u0437 \u043F\u043E\u044F\u0441\u043D\u0435\u043D\u0438\u0439. \u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u0442\u0435\u043A\u0441\u0442 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0432 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0438."
            );
          const rule = existing.dataValidation;
          if (value && rule?.strict && rule.condition?.type === "ONE_OF_LIST" && !rule.condition.values.some((v) => v.userEnteredValue === value))
            throw new Error(
              `\u0417\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \xAB${value}\xBB \u043D\u0435 \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043D\u043E \u0432 \u0441\u0442\u0440\u043E\u043A\u0435 ${record.row + 1}.`
            );
          if (field === "owner" && !record.cells[20]?.formattedValue)
            cell2(record.row, 20, record.cells[10]?.formattedValue || "");
          if (field === "due" && !record.cells[21]?.formattedValue)
            cell2(record.row, 21, record.cells[11]?.formattedValue || "");
          cell2(record.row, col, value);
        }
      } else {
        const template = snapshot.records.find((r) => (r.sheetId ?? TAB_ID) === targetSheetId)?.cells || [];
        const values = Array.from({ length: 22 }, (_, col) => ({
          userEnteredFormat: template[col]?.userEnteredFormat || {},
          ...template[col]?.dataValidation ? { dataValidation: template[col].dataValidation } : {}
        }));
        const set = (col, value) => values[col].userEnteredValue = typeof value === "boolean" ? { boolValue: value } : { stringValue: String(value || "") };
        set(0, write.task.sourceId || `\u0414-${write.id.slice(0, 8)}`);
        set(4, write.task.link);
        set(5, write.task.requester);
        set(12, write.task.dependency);
        for (const field of SYNC_FIELDS)
          if (COLUMNS[field] !== void 0)
            set(COLUMNS[field], cellValue(field, write.task[field], write.task));
        values[3].userEnteredValue = {
          formulaValue: '=INDIRECT("B"&ROW())&INDIRECT("C"&ROW())'
        };
        set(18, write.id);
        set(19, false);
        set(20, write.task.ownerNote);
        set(21, write.task.dueNote);
        requests.push({
          appendCells: {
            sheetId: targetSheetId,
            rows: [{ values }],
            fields: "userEnteredValue,userEnteredFormat,dataValidation"
          }
        });
      }
    }
    targetSheetId = TAB_ID;
    if (!equal(
      [...new Set(owners)].sort(),
      [...new Set(snapshot.board.owners)].sort()
    ))
      cell2(0, 17, JSON.stringify({ version: 1, owners: [...new Set(owners)] }));
    return requests;
  }

  // public/storage-mode.mjs?rev=20261110-progress-5
  var MODES = Object.freeze({ sheets: "Google \u0422\u0430\u0431\u043B\u0438\u0446\u0430", firestore: "\u041A\u043E\u043C\u0430\u043D\u0434\u043D\u044B\u0439 \xB7 Firestore" });
  var LEGACY_CONTROL = Object.freeze({ request: { schema: 1, mode: "firestore", epoch: "legacy", at: 0 }, ack: { schema: 1, mode: "firestore", epoch: "legacy", at: 0 } });
  function parseModeCell(text) {
    if (!text) return null;
    let v;
    try {
      v = JSON.parse(text);
    } catch {
      throw new Error("\u041F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u0430 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F. \u041F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u0438 \u0437\u0430\u043F\u0438\u0441\u044C \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u044B.");
    }
    if (v?.schema !== 1 || !Object.hasOwn(MODES, v.mode) || typeof v.epoch !== "string" || !v.epoch || v.epoch.length > 100 || !Number.isFinite(v.at)) throw new Error("\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F. \u0417\u0430\u043F\u0438\u0441\u044C \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430.");
    return v;
  }
  function readModeControl(rows) {
    const text = (c) => String(c?.formattedValue ?? c?.userEnteredValue?.stringValue ?? "");
    const request = parseModeCell(text(rows?.[1]?.[16])), ack = parseModeCell(text(rows?.[1]?.[17]));
    if (!request && !ack) return structuredClone(LEGACY_CONTROL);
    if (!request || !ack) throw new Error("\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043D\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0430. \u0420\u0430\u0431\u043E\u0447\u0438\u0435 \u0437\u0430\u0434\u0430\u0447\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B.");
    return { request, ack };
  }
  function modeWriteRequest(column, value, tabId) {
    return { updateCells: { range: { sheetId: tabId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: column, endColumnIndex: column + 1 }, rows: [{ values: [{ userEnteredValue: { stringValue: JSON.stringify(value) } }] }], fields: "userEnteredValue" } };
  }

  // public/sheets-api.mjs
  var SheetsApi = class {
    constructor(auth, fetcher = (...args) => fetch(...args), beforeWrite = () => {
    }) {
      this.auth = auth;
      this.fetcher = fetcher;
      this.beforeWrite = beforeWrite;
    }
    async request(path, body) {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 18e3);
      try {
        const response = await this.fetcher(
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}${path}`,
          {
            method: body ? "POST" : "GET",
            headers: {
              Authorization: `Bearer ${this.auth.getToken()}`,
              ...body ? { "Content-Type": "application/json" } : {}
            },
            body: body ? JSON.stringify(body) : void 0,
            signal: controller.signal,
            redirect: "error",
            cache: "no-store"
          }
        );
        const data = await response.json();
        if (!response.ok) {
          const e = new Error(
            response.status === 401 ? "\u0412\u043E\u0439\u0434\u0438\u0442\u0435 \u0432 Google \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E." : response.status === 429 ? "Google \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0438\u043B \u0447\u0430\u0441\u0442\u043E\u0442\u0443 \u0437\u0430\u043F\u0440\u043E\u0441\u043E\u0432. \u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u043E\u0441\u0442\u0430\u044E\u0442\u0441\u044F \u043D\u0430 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0435." : data.error?.message || `Google \u0432\u0435\u0440\u043D\u0443\u043B \u043E\u0448\u0438\u0431\u043A\u0443 ${response.status}.`
          );
          e.status = response.status;
          e.auth = response.status === 401;
          if (e.auth) this.auth.invalidate?.();
          throw e;
        }
        return data;
      } catch (error) {
        if (error.name === "AbortError")
          throw new Error(
            "Google \u043D\u0435 \u043E\u0442\u0432\u0435\u0442\u0438\u043B \u0432\u043E\u0432\u0440\u0435\u043C\u044F. \u041F\u0440\u043E\u0432\u0435\u0440\u0438\u043C \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u0435\u0440\u0435\u0434 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0439 \u0437\u0430\u043F\u0438\u0441\u044C\u044E."
          );
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }
    async read() {
      const metadata2 = await this.request(
        "?fields=spreadsheetId,sheets(properties)"
      );
      const tabs = metadata2.sheets.map((s) => s.properties).sort((a, b) => a.index - b.index), tab = tabs[0];
      if (tab?.sheetId !== TAB_ID)
        throw new Error(
          "\u041F\u0435\u0440\u0432\u043E\u0439 \u0441\u0442\u0430\u043B\u0430 \u0434\u0440\u0443\u0433\u0430\u044F \u0432\u043A\u043B\u0430\u0434\u043A\u0430. \u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430, \u0447\u0442\u043E\u0431\u044B \u043D\u0435 \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0447\u0443\u0436\u0438\u0435 \u0434\u0430\u043D\u043D\u044B\u0435."
        );
      const telegram = tabs.find((t) => t.sheetId === TELEGRAM_TAB_ID);
      if (!telegram) throw new Error("\u0412\u043A\u043B\u0430\u0434\u043A\u0430 \u043D\u043E\u0432\u044B\u0445 \u0437\u0430\u0434\u0430\u0447 Telegram \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430. \u0414\u0430\u043D\u043D\u044B\u0435 \u0434\u043E\u0441\u043A\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B \u0431\u0435\u0437 \u0443\u0441\u0435\u0447\u0435\u043D\u0438\u044F.");
      const snapshots = await Promise.all([tab, telegram].map((t) => this.readTab(t)));
      return combineSheets(...snapshots);
    }
    async readTab(tab) {
      if (tab.gridProperties.columnCount < 22)
        throw new Error("\u0421\u043B\u0443\u0436\u0435\u0431\u043D\u044B\u0435 \u043A\u043E\u043B\u043E\u043D\u043A\u0438 \u0442\u0430\u0431\u043B\u0438\u0446\u044B \u0435\u0449\u0451 \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u044B.");
      if (tab.gridProperties.rowCount > 2500)
        throw new Error(
          "\u0412\u043A\u043B\u0430\u0434\u043A\u0430 \u0431\u043E\u043B\u044C\u0448\u0435 2500 \u0441\u0442\u0440\u043E\u043A. \u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430 \u0431\u0435\u0437 \u0443\u0441\u0435\u0447\u0435\u043D\u0438\u044F \u0434\u0430\u043D\u043D\u044B\u0445."
        );
      const range = `'${tab.title.replace(/'/g, "''")}'!A1:V${tab.gridProperties.rowCount}`;
      const params = new URLSearchParams({
        ranges: range,
        fields: "sheets(data(startRow,rowData(values(userEnteredValue,effectiveValue,formattedValue,dataValidation,userEnteredFormat,chipRuns))))"
      });
      const data = await this.request(`?${params}`), grid = data.sheets?.[0]?.data?.[0];
      const rows = Array.from({ length: tab.gridProperties.rowCount }, () => []);
      (grid?.rowData || []).forEach(
        (row, i) => rows[(grid.startRow || 0) + i] = row.values || []
      );
      return decodeSheet({
        sheetId: tab.sheetId,
        rows,
        title: tab.title,
        rowCount: tab.gridProperties.rowCount
      });
    }
    async readStorageControl() {
      const data = await this.request(":getByDataFilter?fields=sheets(data(startRow,startColumn,rowData(values(formattedValue,userEnteredValue))))", { dataFilters: [{ gridRange: { sheetId: TAB_ID, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 16, endColumnIndex: 18 } }], includeGridData: true });
      const grid = data.sheets?.[0]?.data?.[0], rows = [[], []];
      for (const [i, cell2] of (grid?.rowData?.[0]?.values || []).entries()) rows[1][(grid.startColumn ?? 16) + i] = cell2;
      return readModeControl(rows);
    }
    async requestStorageMode(mode, by) {
      const value = { schema: 1, mode, epoch: crypto.randomUUID(), at: Date.now(), by };
      await this.request(":batchUpdate", { requests: [modeWriteRequest(16, value, TAB_ID)] });
      return value;
    }
    async acknowledgeStorageMode(request) {
      await this.request(":batchUpdate", { requests: [modeWriteRequest(17, { schema: 1, mode: request.mode, epoch: request.epoch, at: Date.now() }, TAB_ID)] });
    }
    async ensureTeamProtocol(snapshot) {
      const cell2 = snapshot.rows?.[2]?.[17];
      if ((cell2?.formattedValue || cell2?.userEnteredValue?.stringValue) === "\u041F\u043E\u0437\u0438\u0446\u0438\u0438 \xB7 \u043A\u043E\u043C\u0430\u043D\u0434\u0430 v3") return;
      this.beforeWrite();
      await this.request(":batchUpdate", { requests: [{ updateCells: { range: { sheetId: TAB_ID, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 17, endColumnIndex: 18 }, rows: [{ values: [{ userEnteredValue: { stringValue: "\u041F\u043E\u0437\u0438\u0446\u0438\u0438 \xB7 \u043A\u043E\u043C\u0430\u043D\u0434\u0430 v3" } }] }], fields: "userEnteredValue" } }] });
    }
    async write(snapshot, writes, owners) {
      const requests = buildWriteRequests(snapshot, writes, owners);
      if (!requests.length) return;
      this.beforeWrite();
      await this.request(":batchUpdate", { requests });
    }
  };

  // public/sync-model.mjs
  var SHEET_ID2 = "1qh-pi5I76k8ssUc6DxjeytFDrAta1N4ZdmVjaUFCUYY";

  // public/weekly-model.mjs
  var SNAPSHOT_TAB = 1909260101;
  var EVENT_TAB = 1909260102;
  var SNAPSHOT_TITLE = "\u041F\u043B\u0430\u043D-\u0444\u0430\u043A\u0442 \xB7 \u0441\u043D\u0438\u043C\u043A\u0438";
  var EVENT_TITLE = "\u041F\u043B\u0430\u043D-\u0444\u0430\u043A\u0442 \xB7 \u0441\u043E\u0431\u044B\u0442\u0438\u044F";
  var FIELDS = ["progress", "workStarted", "createdAt", "title", "owner", "ownerNote", "due", "status", "unit", "comment", "description", "archived", "importance", "start", "closedAt", "archiveKind"];
  var day = (at) => new Date(new Date(at).getTime() + 108e5).toISOString().slice(0, 10);
  function shift(date, n) {
    return new Date(Date.parse(date + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);
  }
  function weekOf(at) {
    const d = day(at);
    return shift(d, -(((/* @__PURE__ */ new Date(d + "T12:00:00Z")).getUTCDay() + 6) % 7));
  }
  function normalize(record) {
    const t = record.task || record;
    return { id: t.id, sourceId: t.sourceId || "", ...Object.fromEntries(FIELDS.map((k) => [k, k === "archived" ? !!record.archived : k === "workStarted" ? !!t.workStarted : k === "progress" ? Number(t.progress ?? (t.status === "\u0413\u043E\u0442\u043E\u0432\u043E" ? 100 : 0)) : String(t[k] || "")])) };
  }
  function changes(before, after, observedAt, previousAt) {
    const a = new Map(before.map((t) => [t.id, t])), b = new Map(after.map((t) => [t.id, t]));
    const result = [];
    for (const id of /* @__PURE__ */ new Set([...a.keys(), ...b.keys()])) {
      const from = a.get(id) || null, to = b.get(id) || null;
      if (!from || !to || FIELDS.some((k) => from[k] !== to[k])) result.push({ id, observedAt, previousAt, from, to });
    }
    return result;
  }

  // weekly/runtime.mjs
  var HANDLER = "pollTaskSignalsReports";
  var STATE_TAB = 1909260103;
  var STATE_TITLE = "\u041F\u043B\u0430\u043D-\u0444\u0430\u043A\u0442 \xB7 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435";
  var HEADERS = { [STATE_TAB]: ["\u041F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E", "\u041D\u0435\u0434\u0435\u043B\u044F", "ID \u0437\u0430\u0434\u0430\u0447\u0438", "\u0421\u043D\u0438\u043C\u043E\u043A \u0437\u0430\u0434\u0430\u0447\u0438 JSON"], [SNAPSHOT_TAB]: ["\u041D\u0435\u0434\u0435\u043B\u044F", "\u0422\u0438\u043F", "\u0417\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043E", "\u041A\u0430\u0447\u0435\u0441\u0442\u0432\u043E", "ID \u0437\u0430\u0434\u0430\u0447\u0438", "\u0417\u0430\u0434\u0430\u0447\u0430 / \u043F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u0435", "\u0421\u043D\u0438\u043C\u043E\u043A \u0437\u0430\u0434\u0430\u0447\u0438 JSON"], [EVENT_TAB]: ["\u041E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D\u043E", "\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430", "ID \u0437\u0430\u0434\u0430\u0447\u0438", "\u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435", "\u0414\u043E JSON", "\u041F\u043E\u0441\u043B\u0435 JSON"] };
  var props = () => PropertiesService.getScriptProperties();
  var Api = class extends SheetsApi {
    constructor() {
      super({});
    }
    async request(path, body) {
      if (!path.startsWith("?") && path !== ":batchUpdate") throw Error("WEEKLY_PATH");
      let r;
      try {
        r = UrlFetchApp.fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID2}${path}`, { method: body ? "post" : "get", headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` }, ...body ? { contentType: "application/json", payload: JSON.stringify(body) } : {}, muteHttpExceptions: true, followRedirects: false });
      } catch {
        throw Error("WEEKLY_NETWORK");
      }
      if (r.getResponseCode() < 200 || r.getResponseCode() > 299) throw Error("WEEKLY_HTTP_" + r.getResponseCode());
      return JSON.parse(r.getContentText());
    }
  };
  var cell = (v) => ({ userEnteredValue: { stringValue: String(v ?? "") } });
  var append = (sheetId, rows) => ({ appendCells: { sheetId, rows: rows.map((v) => ({ values: v.map(cell) })), fields: "userEnteredValue" } });
  async function lock(fn) {
    const l = LockService.getScriptLock();
    if (!l.tryLock(1e3)) return { busy: true };
    try {
      return await fn();
    } finally {
      l.releaseLock();
    }
  }
  async function ensure(api) {
    const m = await api.request("?fields=sheets(properties)");
    const requests = [];
    for (const [id, title] of [[SNAPSHOT_TAB, SNAPSHOT_TITLE], [EVENT_TAB, EVENT_TITLE], [STATE_TAB, STATE_TITLE]]) {
      const old = m.sheets.find((s) => s.properties.sheetId === id);
      if (old && old.properties.gridProperties.rowCount > 3e4) throw Error("WEEKLY_CAPACITY");
      if (old && old.properties.title !== title) throw Error("WEEKLY_TAB_ID_COLLISION");
      if (!old) {
        requests.push({ addSheet: { properties: { sheetId: id, title, gridProperties: { rowCount: 3e4, columnCount: 8, frozenRowCount: 1 } } } }, { updateCells: { start: { sheetId: id, rowIndex: 0, columnIndex: 0 }, rows: [{ values: HEADERS[id].map(cell) }], fields: "userEnteredValue" } });
      }
    }
    if (requests.length) await api.request(":batchUpdate", { requests });
  }
  async function readRows(api, id) {
    const r = await api.request("?" + new URLSearchParams({ ranges: `'${id === SNAPSHOT_TAB ? SNAPSHOT_TITLE : id === EVENT_TAB ? EVENT_TITLE : STATE_TITLE}'!A1:G30000`, fields: "sheets(data(rowData(values(formattedValue))))" }));
    return (r.sheets?.[0]?.data?.[0]?.rowData || []).map((r2) => (r2.values || []).map((c) => c.formattedValue || ""));
  }
  function pack(week, kind, at, quality, tasks, note = "") {
    return [...tasks.map((t) => [week, kind, at, quality, t.id, t.title, JSON.stringify(t)]), [week, kind, at, quality, "__meta__", note, ""]];
  }
  async function tickImpl() {
    const api = new Api();
    await ensure(api);
    const snapshot = await api.read(), at = (/* @__PURE__ */ new Date()).toISOString(), week = weekOf(at), tasks = [];
    const stateRows = await readRows(api, STATE_TAB);
    const previous = stateRows[1]?.[0] ? { at: stateRows[1][0], week: stateRows[1][1], tasks: stateRows.slice(2).filter((r) => r[2]).map((r) => JSON.parse(r[3])) } : null;
    const priorTasks = new Map((previous?.tasks || []).map((t) => [t.id, t]));
    for (const r of snapshot.records) tasks.push(normalize({ ...r, task: r.archived ? r.task : lifecycle(priorTasks.get(r.id), r.task, day(at), at) }));
    const old = await readRows(api, SNAPSHOT_TAB), eventRows = await readRows(api, EVENT_TAB);
    const seen = new Set(old.filter((r) => r[4] === "__meta__").map((r) => r[0] + "|" + r[1]));
    const seenEvents = new Set(eventRows.slice(1).map((r) => r[0] + "|" + r[2]));
    const requests = [], initial = !previous;
    const prior = shift(week, -7);
    const historicalTasks = snapshot.records.filter((r) => {
      const source = r.cells?.[13]?.formattedValue || r.cells?.[13]?.userEnteredValue?.stringValue || "";
      const dates = [...String(source).matchAll(/(\d{2})[.](\d{2})[.](\d{4})/g)].map((m) => `${m[3]}-${m[2]}-${m[1]}`);
      return !r.archived && (dates.some((d) => d >= prior && d < week) || r.task.due && r.task.due >= prior && r.task.due < week);
    }).map(normalize);
    if (initial && !seen.has(shift(week, -7) + "|reconstructed")) requests.push(append(SNAPSHOT_TAB, pack(shift(week, -7), "reconstructed", at, "unknown", historicalTasks, "\u041F\u0435\u0440\u0432\u044B\u0439 \u0441\u0431\u043E\u0440 \u043F\u043E\u0441\u043B\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u043D\u0435\u0434\u0435\u043B\u0438. \u0421\u0442\u0430\u0442\u0443\u0441\u044B \u043D\u0430 \u0434\u0430\u0442\u0443 \u0441\u0431\u043E\u0440\u0430; \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0439 \u043F\u043B\u0430\u043D \u0438 \u0434\u0430\u0442\u044B \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u044F \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u044B.")));
    const local = new Date(Date.now() + 108e5), ready = local.getUTCDay() !== 1 || local.getUTCHours() * 60 + local.getUTCMinutes() >= 585;
    if (ready && !seen.has(week + "|plan")) requests.push(append(SNAPSHOT_TAB, pack(week, "plan", at, day(at) === week && local.getUTCHours() < 10 ? "exact" : "late", tasks, "\u041F\u043B\u0430\u043D \u0444\u0438\u043A\u0441\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u043F\u043E \u0437\u0430\u0434\u0430\u0447\u0430\u043C \u0441\u043E \u0441\u0440\u043E\u043A\u043E\u043C \u0434\u043E \u043A\u043E\u043D\u0446\u0430 \u043D\u0435\u0434\u0435\u043B\u0438, \u0432\u043A\u043B\u044E\u0447\u0430\u044F \u043F\u0440\u043E\u0441\u0440\u043E\u0447\u0435\u043D\u043D\u044B\u0435. \u0417\u0430\u0434\u0430\u0447\u0438 \u0431\u0435\u0437 \u0441\u0440\u043E\u043A\u0430 \u043E\u0441\u0442\u0430\u044E\u0442\u0441\u044F \u0432 \u0441\u043F\u0438\u0441\u043A\u0435 \u0434\u043B\u044F \u0440\u0435\u0448\u0435\u043D\u0438\u044F.")));
    if (previous) {
      const diffs = changes(previous.tasks, tasks, at, previous.at);
      const rows = diffs.filter((e) => !seenEvents.has(at + "|" + e.id)).map((e) => [at, previous.at, e.id, !e.from ? "\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0430" : !e.to ? "\u0423\u0434\u0430\u043B\u0435\u043D\u0430" : Object.keys(e.to).filter((k) => e.from[k] !== e.to[k]).join(", "), JSON.stringify(e.from), JSON.stringify(e.to)]);
      if (rows.length) requests.push(append(EVENT_TAB, rows));
      if (week !== previous.week && ready) {
        let w = previous.week;
        while (w < week) {
          if (!seen.has(w + "|fact")) {
            const end = shift(w, 7) + "T00:00:00+03:00", cut = Date.parse(end);
            const history = eventRows.slice(1).filter((r) => Date.parse(r[0]) >= cut).map((r) => ({ id: r[2], from: JSON.parse(r[4]), to: JSON.parse(r[5]) }));
            let endTasks = new Map(previous.tasks.map((t) => [t.id, t]));
            for (const e of history.reverse()) {
              if (e.from) endTasks.set(e.id, e.from);
              else endTasks.delete(e.id);
            }
            requests.push(append(SNAPSHOT_TAB, pack(w, "fact", at, Date.parse(at) - Date.parse(previous.at) > 9e5 ? "gap" : "observed", [...endTasks.values()], "\u0424\u0430\u043A\u0442 \u043F\u043E \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044E, \u043D\u0430\u0431\u043B\u044E\u0434\u0430\u0432\u0448\u0435\u043C\u0443\u0441\u044F \u0434\u043E \u043A\u043E\u043D\u0446\u0430 \u0432\u043E\u0441\u043A\u0440\u0435\u0441\u0435\u043D\u044C\u044F. \u0414\u0430\u0442\u044B \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0439 \u2014 \u0432\u0440\u0435\u043C\u044F \u043E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D\u0438\u044F, \u043D\u0435 \u0442\u043E\u0447\u043D\u043E\u0435 \u0432\u0440\u0435\u043C\u044F \u043F\u0440\u0430\u0432\u043A\u0438.")));
          }
          w = shift(w, 7);
        }
      }
    }
    const stateValues = [[at, ready ? week : previous?.week || week, "__meta__", ""], ...tasks.map((t) => [at, week, t.id, JSON.stringify(t)])];
    const height = Math.max(stateValues.length, stateRows.length - 1);
    while (stateValues.length < height) stateValues.push(["", "", "", ""]);
    requests.push({ updateCells: { range: { sheetId: STATE_TAB, startRowIndex: 1, endRowIndex: 1 + height, startColumnIndex: 0, endColumnIndex: 4 }, rows: stateValues.map((r) => ({ values: r.map(cell) })), fields: "userEnteredValue" } });
    await api.request(":batchUpdate", { requests });
    props().setProperty("WEEKLY_LAST_OK", at);
    props().deleteProperty("WEEKLY_LAST_ERROR");
    return { enabled: props().getProperty("WEEKLY_ENABLED") === "true", at, tasks: tasks.length, writes: requests.length };
  }
  async function initialize() {
    return lock(async () => {
      await ensure(new Api());
      return tickImpl();
    });
  }
  async function start() {
    return lock(async () => {
      const result = await tickImpl();
      if (!ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === HANDLER)) ScriptApp.newTrigger(HANDLER).timeBased().everyMinutes(5).create();
      for (const t of ScriptApp.getProjectTriggers()) if (t.getHandlerFunction() === "pollWeeklyReports") ScriptApp.deleteTrigger(t);
      props().setProperty("WEEKLY_ENABLED", "true");
      return { ...result, enabled: true };
    });
  }
  async function poll() {
    if (props().getProperty("WEEKLY_ENABLED") !== "true") return { enabled: false };
    return lock(async () => {
      try {
        return await tickImpl();
      } catch (e) {
        const code = /^WEEKLY_[A-Z_0-9]+$/.test(e.message) ? e.message : "WEEKLY_FAILED";
        props().setProperty("WEEKLY_LAST_ERROR", code);
        throw Error(code);
      }
    });
  }
  function check() {
    return { enabled: props().getProperty("WEEKLY_ENABLED") === "true", lastSuccess: props().getProperty("WEEKLY_LAST_OK"), error: props().getProperty("WEEKLY_LAST_ERROR"), triggers: ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === HANDLER).length };
  }
  return __toCommonJS(runtime_exports);
})();

async function startTaskSignalsReports(){const result=await WeeklySignalsRuntime.start();console.log(JSON.stringify(result));return result;}

async function pollTaskSignalsReports(){const result=await WeeklySignalsRuntime.poll();console.log(JSON.stringify(result));return result;}

async function checkTaskSignalsReports(){const result=await WeeklySignalsRuntime.check();console.log(JSON.stringify(result));return result;}
