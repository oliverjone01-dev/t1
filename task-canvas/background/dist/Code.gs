var TaskCanvasBackground = (() => {
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

  // background/entry.mjs
  var entry_exports = {};
  __export(entry_exports, {
    activate: () => activate,
    check: () => check,
    prepare: () => prepare,
    run: () => run,
    stop: () => stop
  });

  // public/people.mjs?rev=20261109-weekly-1
  function parseAssignee(value) {
    const name = String(value || "").trim().replace(/\s+/g, " ");
    if (!name) return "";
    if (name.length > 80 || /;|\u2014|\u2013|\s-\s|->|\u2192|\sи\s|не указан|исполнитель|инициатор|адресат/i.test(
      name
    ))
      return null;
    return /^[\p{L} -]+$/u.test(name) ? name : null;
  }

  // public/model.mjs?rev=20261109-weekly-1
  var QUADRANTS = [
    { id: "do", title: "\u0421\u0434\u0435\u043B\u0430\u0442\u044C \u0441\u0435\u0439\u0447\u0430\u0441", subtitle: "\u0412\u0430\u0436\u043D\u043E \xB7 \u0441\u0440\u043E\u0447\u043D\u043E", color: "coral" },
    { id: "plan", title: "\u0417\u0430\u043F\u043B\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u0442\u044C", subtitle: "\u0412\u0430\u0436\u043D\u043E \xB7 \u043D\u0435 \u0441\u0440\u043E\u0447\u043D\u043E", color: "violet" },
    { id: "delegate", title: "\u0414\u0435\u043B\u0435\u0433\u0438\u0440\u043E\u0432\u0430\u0442\u044C", subtitle: "\u041D\u0435 \u0432\u0430\u0436\u043D\u043E \xB7 \u0441\u0440\u043E\u0447\u043D\u043E", color: "blue" },
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
      if (t.priority && !QUADRANTS.some((q) => q.id === t.priority)) throw new Error("\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u043F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442.");
      const result = { id: t.id, title: t.title, priority: t.priority || null, positions: {} };
      for (const key of ["sourceId", "unit", "direction", "description", "status", "owner", "ownerNote", "due", "dueNote", "comment", "dependency", "requester", "link"]) result[key] = typeof t[key] === "string" ? t[key] : "";
      for (const mode of ["priority", "owners", "time"]) {
        const p = t.positions?.[mode];
        if (p && typeof p.group === "string" && Number.isFinite(p.x) && Number.isFinite(p.y)) result.positions[mode] = { group: mode === "owners" && p.group === result.owner && result.owner ? `owner:${result.owner}` : p.group, x: Math.max(0, Math.min(1e5, p.x)), y: Math.max(0, Math.min(1e5, p.y)) };
      }
      for (const mode of ["priority", "owners", "time"]) {
        const p = t.positions?.[mode];
        if (result.positions[mode] && typeof p.order === "string" && /^[a-zA-Z0-9]{2,512}$/.test(p.order)) result.positions[mode].order = p.order;
      }
      return result;
    });
  }

  // public/sync-model.mjs?rev=20261109-weekly-1
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
    "positions"
  ];
  var FIELD_NAMES = {
    title: "\u0417\u0430\u0434\u0430\u0447\u0430",
    unit: "\u042E\u043D\u0438\u0442",
    direction: "\u041D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435",
    description: "\u041E\u0436\u0438\u0434\u0430\u0435\u043C\u044B\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442",
    status: "\u0421\u0442\u0430\u0442\u0443\u0441",
    owner: "\u041E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439",
    due: "\u0421\u0440\u043E\u043A",
    comment: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439",
    priority: "\u041F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442",
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
    unit: 1,
    direction: 2,
    title: 6,
    description: 7,
    status: 8,
    comment: 9,
    owner: 10,
    due: 11,
    priority: 16,
    positions: 17
  };
  var canonical = (value) => {
    if (value && typeof value.toJSON === "function") return canonical(value.toJSON());
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).filter((k) => value[k] !== void 0 && typeof value[k] !== "function" && typeof value[k] !== "symbol").sort().map((k) => [k, canonical(value[k])]));
    return value;
  };
  var equal = (a, b) => JSON.stringify(canonical(a ?? null)) === JSON.stringify(canonical(b ?? null));
  var comparable = (t) => t ? Object.fromEntries(
    SYNC_FIELDS.map((k) => [
      k,
      k === "positions" ? t[k] || {} : t[k] ?? (k === "priority" ? null : "")
    ])
  ) : null;
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
      } catch {
        throw new Error(`\u041F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u044B \u043F\u043E\u0437\u0438\u0446\u0438\u0438 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u0432 \u0441\u0442\u0440\u043E\u043A\u0435 ${index + 1}.`);
      }
      task.owner = parseAssignee(raw[10] || "") || "";
      task.ownerNote = raw[20] || raw[10] || "";
      task.dueNote = raw[21] || raw[11] || "";
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
        const metadata = JSON.parse(textRows[0][17]);
        owners = metadata.owners;
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
  function mergeBoards(base, local, remote) {
    const maps = [base, local, remote].map(
      (b) => new Map(b.tasks.map((t) => [t.id, t]))
    );
    const ids = [
      .../* @__PURE__ */ new Set([
        ...remote.tasks.map((t) => t.id),
        ...local.tasks.map((t) => t.id),
        ...base.tasks.map((t) => t.id)
      ])
    ];
    const tasks = [], conflicts = [], writes = [];
    for (const id of ids) {
      const [b, l, r] = maps.map((m) => m.get(id));
      if (equal(comparable(l), comparable(b))) {
        if (r) tasks.push(r);
        continue;
      }
      if (equal(comparable(l), comparable(r))) {
        if (r) tasks.push(r);
        continue;
      }
      if (!l || !r) {
        if (equal(comparable(r), comparable(b))) {
          if (l) tasks.push(l);
          writes.push({ id, type: l ? "upsert" : "archive", task: l });
        } else {
          if (l) tasks.push(l);
          conflicts.push({
            id,
            field: "task",
            title: (l || r || b).title,
            base: b || null,
            local: l || null,
            remote: r || null
          });
        }
        continue;
      }
      const merged = { ...r }, fields = [];
      for (const field of SYNC_FIELDS) {
        const bv = comparable(b)?.[field], lv = comparable(l)[field], rv = comparable(r)[field];
        if (equal(lv, bv)) merged[field] = rv;
        else if (equal(rv, bv) || equal(lv, rv)) {
          merged[field] = lv;
          if (!equal(lv, rv)) fields.push(field);
        } else {
          merged[field] = lv;
          conflicts.push({
            id,
            field,
            title: l.title,
            base: bv,
            local: lv,
            remote: rv
          });
        }
      }
      tasks.push(merged);
      if (fields.length) writes.push({ id, type: "patch", fields, task: merged });
    }
    return {
      board: {
        tasks: validateBoard(tasks),
        owners: [.../* @__PURE__ */ new Set([...remote.owners, ...local.owners])]
      },
      conflicts,
      writes
    };
  }
  function cellValue(field, value) {
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
    const cell = (row, col, value) => requests.push({
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
        if (record) cell(record.row, 19, true);
        continue;
      }
      const fields = write.type === "upsert" ? SYNC_FIELDS : write.fields;
      if (fields.includes("owner") && write.task.owner && parseAssignee(write.task.owner) === null)
        throw new Error("\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043E\u0434\u043D\u043E\u0433\u043E \u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0433\u043E \u0431\u0435\u0437 \u043F\u043E\u044F\u0441\u043D\u0435\u043D\u0438\u0439.");
      if (record) {
        if (!record.cells[18]?.formattedValue) cell(record.row, 18, write.id);
        if (record.archived) cell(record.row, 19, false);
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
          const value = cellValue(field, write.task[field]);
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
            cell(record.row, 20, record.cells[10]?.formattedValue || "");
          if (field === "due" && !record.cells[21]?.formattedValue)
            cell(record.row, 21, record.cells[11]?.formattedValue || "");
          cell(record.row, col, value);
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
            set(COLUMNS[field], cellValue(field, write.task[field]));
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
      cell(0, 17, JSON.stringify({ version: 1, owners: [...new Set(owners)] }));
    return requests;
  }

  // public/team-model.mjs?rev=20261109-weekly-1
  var TEAM_SCHEMA = 1;
  var GROUPS = {
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
      "link"
    ]
  };
  var clone = (value) => structuredClone(value);
  var valueAt = (task, path) => path.split(".").reduce((v, key) => v?.[key], task) ?? null;
  function put(task, path, value) {
    const keys = path.split("."), last = keys.pop();
    let target = task;
    for (const key of keys) target = target[key] ?? (target[key] = {});
    if (value === null) delete target[last];
    else target[last] = clone(value);
  }
  var groupValue = (task, key) => Object.fromEntries(GROUPS[key].map((path) => [path, valueAt(task, path)]));
  var normalizedTask = (task) => validateBoard([task])[0];
  function seedEntry(task, stamp = "seed", archived = false) {
    return {
      schema: TEAM_SCHEMA,
      task: normalizedTask(task),
      revision: 1,
      versions: Object.fromEntries(
        Object.keys(GROUPS).map((key) => [key, stamp])
      ),
      archived,
      lifeVersion: stamp,
      lastOperationId: stamp
    };
  }
  function validateEntry(value) {
    if (value?.schema !== TEAM_SCHEMA || !Number.isSafeInteger(value.revision) || value.revision < 1 || typeof value.archived !== "boolean" || typeof value.lifeVersion !== "string" || !value.versions || Object.keys(GROUPS).some((key) => typeof value.versions[key] !== "string"))
      throw new Error("\u041F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u0430 \u0432\u0435\u0440\u0441\u0438\u044F \u043E\u0431\u0449\u0435\u0439 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438. \u0414\u0430\u043D\u043D\u044B\u0435 \u043D\u0435 \u0437\u0430\u043C\u0435\u043D\u0435\u043D\u044B.");
    return { ...value, task: normalizedTask(value.task) };
  }
  function toBoard(entries, owners = []) {
    return {
      tasks: validateBoard(
        entries.filter((entry) => !entry.archived).map((entry) => entry.task)
      ),
      owners: [...new Set(owners)]
    };
  }
  function makeOperation(before, desired, { id, actor, submittedAt = Date.now(), includeContext = false }) {
    const common = {
      schema: TEAM_SCHEMA,
      id,
      taskId: desired?.id || before?.task.id,
      actor: clone(actor),
      submittedAt
    };
    if (!common.taskId) throw new Error("\u041D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D ID \u0437\u0430\u0434\u0430\u0447\u0438.");
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
        baseTask: clone(before.task)
      };
    }
    if (before.archived)
      return { ...common, kind: "create", task: normalizedTask(desired) };
    const task = normalizedTask(desired), groups = {};
    for (const key of Object.keys(GROUPS)) {
      if (key === "context" && !includeContext) continue;
      const base = groupValue(before.task, key), value = groupValue(task, key);
      if (!equal(base, value))
        groups[key] = { baseVersion: before.versions[key], base, value };
    }
    if (!Object.keys(groups).length) return null;
    return {
      ...common,
      kind: "edit",
      baseLife: before.lifeVersion,
      baseTask: clone(before.task),
      groups
    };
  }
  function validateOperation(op) {
    if (op?.schema !== TEAM_SCHEMA || typeof op.id !== "string" || !/^[a-zA-Z0-9_-]{8,120}$/.test(op.id) || typeof op.taskId !== "string" || !op.taskId || !op.actor?.uid || typeof op.actor.clientId !== "string" || !["create", "edit", "archive", "resolve"].includes(op.kind))
      throw new Error("\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u0430\u044F \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u044F \u043E\u0431\u0449\u0435\u0439 \u0434\u043E\u0441\u043A\u0438.");
    if (op.kind === "create") {
      if (normalizedTask(op.task).id !== op.taskId)
        throw new Error("ID \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u043D\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u0435\u0442.");
    }
    if (op.kind === "edit") {
      if (!op.groups || !Object.keys(op.groups).length)
        throw new Error("\u041F\u0443\u0441\u0442\u0430\u044F \u043F\u0440\u0430\u0432\u043A\u0430.");
      for (const [key, patch] of Object.entries(op.groups)) {
        if (!GROUPS[key] || typeof patch.baseVersion !== "string" || !patch.base || !patch.value || GROUPS[key].some(
          (path) => !Object.hasOwn(patch.base, path) || !Object.hasOwn(patch.value, path)
        ) || Object.keys(patch.value).some((path) => !GROUPS[key].includes(path)) || Object.keys(patch.base).some((path) => !GROUPS[key].includes(path)))
          throw new Error("\u041F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u044B \u043F\u043E\u043B\u044F \u043F\u0440\u0430\u0432\u043A\u0438.");
        if (key === "assignment" && parseAssignee(patch.value.owner || "") === null)
          throw new Error("\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043E\u0434\u043D\u043E\u0433\u043E \u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0433\u043E.");
      }
    }
    return op;
  }
  function applyOperation(current, input) {
    const op = validateOperation(input), conflicts = [], before = current ? validateEntry(current) : null;
    let next = before ? clone(before) : null;
    const conflict = (group, base, local, remote, remoteVersion) => conflicts.push({
      id: op.id + "_" + group,
      operationId: op.id,
      taskId: op.taskId,
      group,
      base: clone(base),
      local: clone(local),
      remote: clone(remote),
      remoteVersion,
      actor: clone(op.actor),
      status: "open"
    });
    if (op.kind === "create") {
      if (!before) next = seedEntry(op.task, op.id);
      else if (before.archived || !equal(before.task, op.task))
        conflict(
          "task",
          null,
          { task: op.task, archived: false },
          { task: before.task, archived: before.archived },
          before.lastOperationId
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
        local ? { task: normalizedTask(local), archived: op.kind === "archive" } : null,
        null,
        "missing"
      );
    } else if (op.kind === "archive") {
      if (before.archived) {
      } else if (before.revision !== op.baseRevision || before.lifeVersion !== op.baseLife)
        conflict(
          "task",
          { task: op.baseTask, archived: false },
          { task: op.baseTask, archived: true },
          { task: before.task, archived: false },
          before.lastOperationId
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
          before.lastOperationId
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
    } else throw new Error("\u0420\u0430\u0437\u0440\u0435\u0448\u0435\u043D\u0438\u0435 \u043A\u043E\u043D\u0444\u043B\u0438\u043A\u0442\u0430 \u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E\u0439 \u0442\u0440\u0430\u043D\u0437\u0430\u043A\u0446\u0438\u0438.");
    if (next) {
      next.task = normalizedTask(next.task);
      const changed = !before || !equal(next.task, before.task) || next.archived !== before.archived;
      if (changed) {
        next.revision = before ? before.revision + 1 : 1;
        next.lastOperationId = op.id;
      }
      return { entry: next, changed, conflicts };
    }
    return { entry: null, changed: false, conflicts };
  }
  function resolveConflict(current, conflict, { id, choice, expectedVersion, actor }) {
    const before = current ? validateEntry(current) : null;
    if (conflict.status !== "open")
      return { entry: before, changed: false, alreadyResolved: true };
    const version = conflict.group === "task" ? before ? before.lastOperationId : "missing" : before?.versions[conflict.group];
    if (version !== expectedVersion)
      return {
        stale: true,
        currentVersion: version,
        remote: before ? conflict.group === "task" ? { task: before.task, archived: before.archived } : groupValue(before.task, conflict.group) : null
      };
    if (!["remote", "local"].includes(choice))
      throw new Error("\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043E\u0434\u043D\u0443 \u0438\u0437 \u0432\u0435\u0440\u0441\u0438\u0439.");
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
        if (!next) throw new Error("\u0417\u0430\u0434\u0430\u0447\u0430 \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442.");
        for (const [path, value] of Object.entries(conflict.local))
          put(next.task, path, value);
        next.versions[conflict.group] = id;
      }
    }
    if (next) {
      next.task = normalizedTask(next.task);
      if (!before || !equal(next.task, before.task) || next.archived !== before.archived) {
        next.revision = (before?.revision || 0) + 1;
        next.lastOperationId = id;
      }
    }
    return {
      entry: next,
      changed: !!next && (!before || next.revision !== before.revision),
      resolution: { choice, actor, operationId: id, observedVersion: version },
      stale: false
    };
  }

  // public/team-api.mjs
  var digest = async (value) => [
    ...new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          typeof value === "string" ? value : JSON.stringify(value)
        )
      )
    )
  ].map((v) => v.toString(16).padStart(2, "0")).join("");
  var safeError = (error) => {
    if (error?.code === "permission-denied")
      return Object.assign(new Error("\u042D\u0442\u043E\u0442 Google-\u0430\u043A\u043A\u0430\u0443\u043D\u0442 \u043D\u0435 \u0432\u0445\u043E\u0434\u0438\u0442 \u0432 \u043A\u043E\u043C\u0430\u043D\u0434\u0443. \u041F\u043E\u043F\u0440\u043E\u0441\u0438\u0442\u0435 \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0430 \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432\u0430\u0448 \u0430\u0434\u0440\u0435\u0441 \u0432 \u0440\u0430\u0437\u0434\u0435\u043B\u0435 \xAB\u0414\u043E\u0441\u0442\u0443\u043F\xBB. \u041D\u0435\u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043D\u044B\u0435 \u043F\u0440\u0430\u0432\u043A\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B \u043D\u0430 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0435."), { code: "permission-denied" });
    if (error?.code === "resource-exhausted")
      return Object.assign(new Error("\u0414\u043E\u0441\u0442\u0438\u0433\u043D\u0443\u0442 \u043B\u0438\u043C\u0438\u0442 Google. \u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u043E\u0441\u0442\u0430\u043B\u0438\u0441\u044C \u0432 \u043E\u0447\u0435\u0440\u0435\u0434\u0438; \u043F\u043E\u0432\u0442\u043E\u0440\u0438\u043C \u043E\u0442\u043F\u0440\u0430\u0432\u043A\u0443 \u043F\u043E\u0437\u0436\u0435."), { code: "resource-exhausted" });
    return error;
  };
  async function firebaseSdk() {
    throw new Error("Browser Firebase SDK is not used in this worker");
  }
  var TeamApi = class {
    constructor({ config, boardId, sdk = null, db = null, user = null }) {
      this.config = config;
      this.boardId = boardId;
      this.sdk = sdk;
      this.db = db;
      this.user = user;
      this.listeners = [];
    }
    async authenticate(accessToken) {
      const generation = this.authGeneration = (this.authGeneration || 0) + 1;
      const work = async () => {
        const s = this.sdk ?? (this.sdk = await firebaseSdk());
        if (generation !== this.authGeneration)
          throw new Error("\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u043E.");
        if (!this.app) {
          this.app = s.initializeApp(this.config, "task-canvas-team");
          this.auth = s.initializeAuth(this.app, {
            persistence: s.inMemoryPersistence
          });
          this.db = s.initializeFirestore(this.app, {
            localCache: s.memoryLocalCache(),
            experimentalAutoDetectLongPolling: true
          });
        }
        const session = await s.signInWithCredential(
          this.auth,
          s.GoogleAuthProvider.credential(null, accessToken)
        );
        if (generation !== this.authGeneration) {
          await s.signOut(this.auth);
          throw new Error("\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u043E.");
        }
        this.user = session.user;
        return this.actor();
      };
      this.authChain = (this.authChain || Promise.resolve()).catch(() => {
      }).then(work);
      return this.authChain;
    }
    publicRef(collection, id) {
      return this.sdk.doc(
        this.db,
        "taskBoardViews",
        this.boardId,
        collection,
        id
      );
    }
    actor(clientId = "") {
      return {
        uid: this.user.uid,
        name: this.user.displayName || "\u0423\u0447\u0430\u0441\u0442\u043D\u0438\u043A \u043A\u043E\u043C\u0430\u043D\u0434\u044B",
        email: this.user.email || "",
        clientId
      };
    }
    root() {
      return this.sdk.doc(this.db, "taskBoards", this.boardId);
    }
    ref(collection, id) {
      return this.sdk.doc(this.db, "taskBoards", this.boardId, collection, id);
    }
    async accessInfo() {
      try {
        const doc = await this.sdk.getDocFromServer(this.root());
        return doc.data();
      } catch (error) {
        throw safeError(error);
      }
    }
    async setMember(email, enabled, operationId = crypto.randomUUID()) {
      email = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 Google-\u0430\u0434\u0440\u0435\u0441.");
      const s = this.sdk, event = this.ref("accessEvents", operationId), actor = this.actor();
      return this.transact(async (tx) => {
        const [root, receipt] = await Promise.all([tx.get(this.root()), tx.get(event)]);
        if (receipt.exists()) {
          if (receipt.data().email !== email || receipt.data().enabled !== enabled) throw new Error("\u042D\u0442\u043E\u0442 ID \u0443\u0436\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D \u0434\u043B\u044F \u0434\u0440\u0443\u0433\u043E\u0433\u043E \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u0434\u043E\u0441\u0442\u0443\u043F\u0430.");
          return root.data();
        }
        const data = root.data();
        if (data.ownerEmail !== actor.email.toLowerCase()) throw new Error("\u0423\u043F\u0440\u0430\u0432\u043B\u044F\u0442\u044C \u0434\u043E\u0441\u0442\u0443\u043F\u043E\u043C \u043C\u043E\u0436\u0435\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u0432\u043B\u0430\u0434\u0435\u043B\u0435\u0446 \u0434\u043E\u0441\u043A\u0438.");
        if (email === data.ownerEmail) throw new Error("\u0414\u043E\u0441\u0442\u0443\u043F \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u0442\u0441\u044F \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u043E.");
        const members = new Set(data.members || []);
        enabled ? members.add(email) : members.delete(email);
        if (members.size > 200) throw new Error("\u0412 \u0441\u043F\u0438\u0441\u043A\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u0434\u043E 200 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u043E\u0432.");
        const after = [...members].sort(), revision = data.accessRevision + 1;
        tx.update(this.root(), { members: after, accessRevision: revision, lastAccessEvent: operationId });
        tx.set(event, { email, enabled, before: data.members, after, revision, actor, createdAt: s.serverTimestamp() });
        return { ...data, members: after, accessRevision: revision };
      }, this.root(), "accessRevision").catch((error) => {
        throw safeError(error);
      });
    }
    async taskRef(id) {
      return this.ref("tasks", await digest(id));
    }
    async read() {
      const s = this.sdk;
      const [root, tasks, lanes, conflicts, source] = await Promise.all([
        s.getDoc(this.root()),
        s.getDocs(s.collection(this.db, "taskBoards", this.boardId, "tasks")),
        s.getDoc(this.ref("meta", "lanes")),
        s.getDocs(
          s.query(
            s.collection(this.db, "taskBoards", this.boardId, "conflicts"),
            s.where("status", "==", "open")
          )
        ),
        s.getDoc(this.ref("meta", "source"))
      ]);
      if (!root.exists() || !root.data().ready)
        throw new Error(
          "\u041A\u043E\u043C\u0430\u043D\u0434\u043D\u0430\u044F \u0434\u043E\u0441\u043A\u0430 \u0435\u0449\u0451 \u043D\u0435 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u0430. \u041B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0435 \u0437\u0430\u0434\u0430\u0447\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B."
        );
      return {
        entries: tasks.docs.map((d) => validateEntry(d.data())),
        lanes: lanes.exists() ? lanes.data() : { items: [], revision: 0 },
        conflicts: conflicts.docs.map((d) => ({ ...d.data(), id: d.id })),
        root: root.data(),
        source: source.exists() ? source.data() : { status: "pending", checkedAt: 0 }
      };
    }
    subscribe(onData, onError) {
      const s = this.sdk, state = {};
      const caches = {};
      const emit = () => {
        if (state.entries && state.lanes && state.conflicts && state.root) {
          onData({ ...state, fromCache: Object.values(caches).some(Boolean) });
        }
      };
      const watch = (ref, key, convert) => this.listeners.push(
        s.onSnapshot(
          ref,
          { includeMetadataChanges: true },
          (snapshot) => {
            state[key] = convert(snapshot);
            caches[key] = snapshot.metadata.fromCache;
            emit();
          },
          (error) => onError(safeError(error))
        )
      );
      watch(this.root(), "root", (d) => d.exists() ? d.data() : null);
      watch(
        s.collection(this.db, "taskBoards", this.boardId, "tasks"),
        "entries",
        (d) => d.docs.map((row) => validateEntry(row.data()))
      );
      watch(
        this.ref("meta", "lanes"),
        "lanes",
        (d) => d.exists() ? d.data() : { items: [], revision: 0 }
      );
      watch(
        s.query(
          s.collection(this.db, "taskBoards", this.boardId, "conflicts"),
          s.where("status", "==", "open")
        ),
        "conflicts",
        (d) => d.docs.map((row) => ({ ...row.data(), id: row.id }))
      );
      watch(
        this.ref("meta", "source"),
        "source",
        (d) => d.exists() ? d.data() : { status: "pending", checkedAt: 0 }
      );
      return () => {
        this.listeners.splice(0).forEach((unsubscribe) => unsubscribe());
      };
    }
    checkActor(op) {
      if (!this.user || op.actor.uid !== this.user.uid)
        throw new Error(
          "\u041D\u0435\u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043D\u0430\u044F \u043F\u0440\u0430\u0432\u043A\u0430 \u043F\u0440\u0438\u043D\u0430\u0434\u043B\u0435\u0436\u0438\u0442 \u0434\u0440\u0443\u0433\u043E\u043C\u0443 Google-\u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0443. \u0412\u043E\u0439\u0434\u0438\u0442\u0435 \u0432 \u043D\u0435\u0433\u043E, \u0447\u0442\u043E\u0431\u044B \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C."
        );
    }
    writeRevision(tx, taskRef, before, after, op) {
      const s = this.sdk;
      const view = this.publicRef("tasks", taskRef.id);
      if (after.archived) tx.delete(view);
      else
        tx.set(view, { schema: 1, revision: after.revision, task: after.task });
      tx.set(taskRef, {
        ...after,
        updatedAt: s.serverTimestamp(),
        actor: op.actor
      });
      tx.set(s.doc(taskRef, "versions", String(after.revision)), {
        schema: 1,
        taskId: op.taskId,
        revision: after.revision,
        before: before ? {
          task: before.task,
          archived: before.archived,
          versions: before.versions
        } : null,
        after: {
          task: after.task,
          archived: after.archived,
          versions: after.versions
        },
        operationId: op.id,
        actor: op.actor,
        createdAt: s.serverTimestamp()
      });
    }
    async transact(work, watchedRef, revisionField = "revision") {
      let observed = watchedRef ? (await this.sdk.getDoc(watchedRef)).data()?.[revisionField] : null;
      for (let attempt = 0; ; attempt++) {
        try {
          return await this.sdk.runTransaction(this.db, work);
        } catch (error) {
          if (attempt >= 7 || !["aborted", "permission-denied"].includes(error.code))
            throw error;
          if (error.code === "permission-denied") {
            if (!watchedRef) throw error;
            const current = (await this.sdk.getDocFromServer(watchedRef)).data()?.[revisionField];
            if (current === observed) throw error;
            observed = current;
          }
          await new Promise(
            (resolve) => setTimeout(resolve, 30 + Math.random() * 150)
          );
        }
      }
    }
    async submit(input) {
      const op = validateOperation(input);
      this.checkActor(op);
      const s = this.sdk, taskRef = await this.taskRef(op.taskId), receipt = this.ref("operations", op.id), hash = await digest(op);
      try {
        return await this.transact(async (tx) => {
          const seen = await tx.get(receipt);
          if (seen.exists()) {
            if (seen.data().digest !== hash)
              throw new Error(
                "\u041F\u043E\u0432\u0442\u043E\u0440\u043D\u044B\u0439 ID \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0434\u0440\u0443\u0433\u0443\u044E \u043F\u0440\u0430\u0432\u043A\u0443. \u0418\u0441\u0445\u043E\u0434\u043D\u0430\u044F \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u044F \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430."
              );
            return seen.data().result;
          }
          const doc = await tx.get(taskRef), before = doc.exists() ? validateEntry(doc.data()) : null, result = applyOperation(before, op);
          if (result.changed)
            this.writeRevision(tx, taskRef, before, result.entry, op);
          for (const conflict of result.conflicts)
            tx.set(this.ref("conflicts", conflict.id), {
              ...conflict,
              title: op.task?.title || before?.task.title || op.taskId,
              taskKey: taskRef.id,
              createdAt: s.serverTimestamp()
            });
          const acknowledgement = {
            changed: result.changed,
            conflictIds: result.conflicts.map((c) => c.id),
            revision: result.entry?.revision || 0
          };
          tx.set(receipt, {
            protocol: 3,
            schema: 1,
            digest: hash,
            taskId: op.taskId,
            actor: op.actor,
            request: op,
            result: acknowledgement,
            createdAt: s.serverTimestamp()
          });
          return acknowledgement;
        }, taskRef);
      } catch (error) {
        throw safeError(error);
      }
    }
    async resolve(id, { operationId, choice, expectedVersion, actor }) {
      const s = this.sdk, ref = this.ref("conflicts", id), receipt = this.ref("operations", operationId);
      this.checkActor({ actor });
      const hash = await digest({ id, choice, expectedVersion, actor });
      try {
        return await s.runTransaction(this.db, async (tx) => {
          const [seen, conflictDoc] = await Promise.all([
            tx.get(receipt),
            tx.get(ref)
          ]);
          if (seen.exists()) {
            if (seen.data().digest !== hash)
              throw new Error("\u041F\u043E\u0432\u0442\u043E\u0440\u043D\u044B\u0439 ID \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0434\u0440\u0443\u0433\u043E\u0439 \u0432\u044B\u0431\u043E\u0440.");
            return seen.data().result;
          }
          if (!conflictDoc.exists()) throw new Error("\u041A\u043E\u043D\u0444\u043B\u0438\u043A\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D.");
          const conflict = conflictDoc.data(), taskRef = await this.taskRef(conflict.taskId), doc = await tx.get(taskRef), before = doc.exists() ? validateEntry(doc.data()) : null;
          const result = resolveConflict(before, conflict, {
            id: operationId,
            choice,
            expectedVersion,
            actor
          });
          if (result.stale) return result;
          if (result.changed)
            this.writeRevision(tx, taskRef, before, result.entry, {
              id: operationId,
              taskId: conflict.taskId,
              actor
            });
          const acknowledgement = {
            changed: result.changed,
            conflictIds: [],
            revision: result.entry?.revision || 0
          };
          if (conflict.status === "open")
            tx.update(ref, {
              status: "resolved",
              resolution: result.resolution || {
                choice: "already-resolved",
                actor,
                operationId
              },
              resolvedAt: s.serverTimestamp()
            });
          tx.set(receipt, {
            protocol: 3,
            schema: 1,
            digest: hash,
            taskId: conflict.taskId,
            actor,
            request: { kind: "resolve", conflictId: id, choice, expectedVersion },
            result: acknowledgement,
            createdAt: s.serverTimestamp()
          });
          return acknowledgement;
        });
      } catch (error) {
        throw safeError(error);
      }
    }
    async changeLanes(op) {
      this.checkActor(op);
      const s = this.sdk, ref = this.ref("meta", "lanes"), receipt = this.ref("operations", op.id), hash = await digest(op);
      return s.runTransaction(this.db, async (tx) => {
        const [seen, doc] = await Promise.all([tx.get(receipt), tx.get(ref)]);
        if (seen.exists()) {
          if (seen.data().digest !== hash)
            throw new Error("\u041F\u043E\u0432\u0442\u043E\u0440\u043D\u044B\u0439 ID \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0434\u0440\u0443\u0433\u0438\u0435 \u0434\u043E\u0440\u043E\u0436\u043A\u0438.");
          return seen.data().result;
        }
        const before = doc.exists() ? doc.data() : { items: [], revision: 0 };
        const items = [
          .../* @__PURE__ */ new Set([
            ...(before.items || []).filter((name) => !op.remove.includes(name)),
            ...op.add
          ])
        ].sort();
        const changed = !equal(items, [...before.items].sort()), revision = before.revision + (changed ? 1 : 0);
        if (changed) {
          tx.set(this.publicRef("meta", "lanes"), { items, revision });
          tx.set(ref, {
            items,
            revision,
            lastOperationId: op.id,
            updatedAt: s.serverTimestamp()
          });
          tx.set(this.ref("laneVersions", String(revision)), {
            before: before.items,
            after: items,
            revision,
            operationId: op.id,
            actor: op.actor,
            createdAt: s.serverTimestamp()
          });
        }
        const ack = { changed, revision, conflictIds: [] };
        tx.set(receipt, {
          protocol: 3,
          schema: 1,
          digest: hash,
          taskId: "__lanes",
          actor: op.actor,
          request: op,
          result: ack,
          createdAt: s.serverTimestamp()
        });
        return ack;
      });
    }
    async history(taskId, count = 20) {
      const s = this.sdk, ref = await this.taskRef(taskId), rows = await s.getDocs(
        s.query(
          s.collection(ref, "versions"),
          s.orderBy("revision", "desc"),
          s.limit(count)
        )
      );
      return rows.docs.map((d) => d.data());
    }
    async acquireBridge(clientId) {
      const s = this.sdk, ref = this.ref("meta", "bridgeLease");
      try {
        return await s.runTransaction(this.db, async (tx) => {
          const doc = await tx.get(ref), lease = doc.exists() ? doc.data() : null;
          if (lease && lease.protocol === 3 && lease.holder !== clientId && Date.now() - (lease.acquiredAt?.toMillis?.() || 0) < 12e4)
            return false;
          tx.set(ref, {
            holder: clientId,
            protocol: 3,
            uid: this.user.uid,
            acquiredAt: s.serverTimestamp()
          });
          return true;
        });
      } catch (error) {
        if (error.code === "permission-denied") return false;
        throw error;
      }
    }
    async releaseBridge(clientId) {
      const s = this.sdk, ref = this.ref("meta", "bridgeLease");
      return s.runTransaction(this.db, async (tx) => {
        const doc = await tx.get(ref);
        if (doc.exists() && doc.data().holder === clientId) tx.delete(ref);
      });
    }
    async markSheetObserved(entries, clientId) {
      const s = this.sdk;
      for (const chunk of Array.from(
        { length: Math.ceil(entries.length / 5) },
        (_, i) => entries.slice(i * 5, i * 5 + 5)
      )) {
        await s.runTransaction(this.db, async (tx) => {
          const lease = await tx.get(this.ref("meta", "bridgeLease"));
          if (!lease.exists() || lease.data().holder !== clientId)
            throw new Error("\u0421\u0432\u044F\u0437\u044C \u0441 \u0442\u0430\u0431\u043B\u0438\u0446\u0435\u0439 \u043F\u0435\u0440\u0435\u0434\u0430\u043D\u0430 \u0434\u0440\u0443\u0433\u043E\u0439 \u0432\u043A\u043B\u0430\u0434\u043A\u0435.");
          const rows = await Promise.all(
            chunk.map(async (row) => {
              const ref = await this.taskRef(row.id), doc = await tx.get(ref);
              return { ref, doc, row };
            })
          );
          for (const { ref, doc, row } of rows)
            if (doc.exists()) {
              const current = validateEntry(doc.data());
              tx.update(ref, {
                sheet: {
                  present: row.present,
                  task: row.task,
                  versions: row.versions,
                  revision: row.revision,
                  lifeVersion: row.lifeVersion || current.lifeVersion,
                  checkedAt: Date.now(),
                  observer: clientId
                },
                sheetAck: row.acknowledgedVersion || ""
              });
            }
        });
      }
    }
    async sourceState(status, message = "", checkedAt = Date.now()) {
      const batch = this.sdk.writeBatch(this.db);
      batch.set(
        this.ref("meta", "source"),
        { status, message, checkedAt },
        { merge: true }
      );
      batch.set(this.publicRef("meta", "source"), { status, checkedAt });
      await batch.commit();
    }
    async disconnect() {
      this.authGeneration = (this.authGeneration || 0) + 1;
      this.user = null;
      this.listeners.splice(0).forEach((fn) => fn());
      this.authChain = (this.authChain || Promise.resolve()).catch(() => {
      }).then(async () => {
        if (this.auth) await this.sdk.signOut(this.auth);
      });
      return this.authChain;
    }
  };

  // public/team-api.mjs?rev=20261109-weekly-1
  var digest2 = async (value) => [
    ...new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          typeof value === "string" ? value : JSON.stringify(value)
        )
      )
    )
  ].map((v) => v.toString(16).padStart(2, "0")).join("");

  // public/team-source.mjs
  var clone2 = (value) => structuredClone(value);
  function copyGroup(target, source, group) {
    for (const path of GROUPS[group]) {
      const keys = path.split("."), last = keys.pop();
      let to = target, from = source;
      for (const key of keys) {
        to = to[key] ?? (to[key] = {});
        from = from?.[key];
      }
      if (from?.[last] === void 0) delete to[last];
      else to[last] = clone2(from[last]);
    }
  }
  var TeamSourceBridge = class {
    constructor(engine, { now = () => Date.now() } = {}) {
      this.engine = engine;
      this.now = now;
      this.lastPublishedAt = 0;
      this.lastPublishedStatus = null;
      this.retryDelay = 3e4;
      this.running = false;
      this.busy = false;
      this.generation = 0;
    }
    start() {
      if (this.engine.accessRoot?.background?.enabled) return;
      if (this.engine.accessRoot?.ownerEmail && this.engine.actor.email?.toLowerCase() !== this.engine.accessRoot.ownerEmail) return;
      this.running = true;
      this.generation++;
      this.later(0);
    }
    stop() {
      this.running = false;
      this.generation++;
      clearTimeout(this.timer);
      if (this.engine.repository?.user)
        return this.engine.repository.releaseBridge(this.engine.clientId).catch(() => {
        });
    }
    later(delay = 3e4) {
      clearTimeout(this.timer);
      if (this.running) this.timer = setTimeout(() => this.tick(), delay);
    }
    wake() {
      if (!this.busy) this.later(800);
    }
    async tick() {
      const e = this.engine, generation = this.generation;
      if (e.accessRoot?.background?.enabled) {
        this.running = false;
        return;
      }
      if (!this.running || this.busy || !e.connected) return;
      this.busy = true;
      const active = () => {
        if (!this.running || generation !== this.generation || !e.connected)
          throw new Error("\u0421\u0432\u044F\u0437\u044C \u0441 \u0442\u0430\u0431\u043B\u0438\u0446\u0435\u0439 \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430.");
      };
      const checkpoint = (entry, record) => ({
        id: entry.task.id,
        present: !!record && !record.archived,
        task: clone2(record?.task || entry.task),
        versions: clone2(entry.versions),
        revision: entry.revision,
        lifeVersion: entry.lifeVersion,
        acknowledgedVersion: entry.lastOperationId
      });
      try {
        if (!await e.repository.acquireBridge(e.clientId)) return;
        active();
        const before = {
          entries: [...e.entries.values()].map(clone2),
          lanes: { items: [...e.owners] },
          conflicts: clone2(e.rawConflicts)
        };
        let source = await e.api.read();
        active();
        if (e.api.ensureTeamProtocol) {
          await e.api.ensureTeamProtocol(source);
          active();
        }
        const records = new Map(source.records.map((row) => [row.id, row])), current = new Map(before.entries.map((row) => [row.task.id, row]));
        const observed = [];
        for (const entry of before.entries) {
          const row = records.get(entry.task.id), old = entry.sheet;
          if (!old) {
            if (row) {
              const options = {
                id: "source-pending",
                actor: e.actor,
                submittedAt: 0,
                includeContext: true
              };
              let operation2;
              if (row.archived) {
                operation2 = entry.archived ? null : makeOperation(entry, null, options);
                if (operation2) operation2.baseRevision = 0;
              } else if (!entry.archived && equal(comparable(entry.task), comparable(row.task)))
                operation2 = makeOperation(entry, row.task, options);
              else
                operation2 = {
                  schema: 1,
                  id: "source-pending",
                  kind: "create",
                  taskId: row.id,
                  task: row.task,
                  actor: e.actor,
                  submittedAt: 0
                };
              if (operation2) {
                operation2.id = "source-" + await digest2({ ...operation2, id: void 0 });
                await e.repository.submit(operation2);
              }
              observed.push({ entry, row });
            }
            continue;
          }
          const present = !!row && !row.archived;
          if (old.present === present && (!present || equal(old.task, row.task)))
            continue;
          const base = {
            ...entry,
            task: old.task,
            versions: old.versions,
            revision: old.revision,
            lifeVersion: old.lifeVersion || entry.lifeVersion,
            archived: !old.present && entry.archived
          };
          let operation = makeOperation(base, present ? row.task : null, {
            id: "source-pending",
            actor: e.actor,
            submittedAt: 0,
            includeContext: true
          });
          if (present && !old.present && !equal(comparable(entry.task), comparable(row.task)))
            operation = {
              schema: 1,
              id: "source-pending",
              kind: "create",
              taskId: row.id,
              task: row.task,
              actor: e.actor,
              submittedAt: 0
            };
          if (operation) {
            operation.id = "source-" + await digest2({ ...operation, id: void 0 });
            await e.repository.submit(operation);
          }
          observed.push({ entry, row });
          active();
        }
        for (const row of source.records)
          if (!current.has(row.id)) {
            const operation = {
              schema: 1,
              id: "source-pending",
              kind: "create",
              taskId: row.id,
              task: row.task,
              actor: e.actor,
              submittedAt: 0
            };
            operation.id = "source-" + await digest2({ ...operation, id: void 0 });
            await e.repository.submit(operation);
            if (row.archived) {
              const archive = makeOperation(
                seedEntry(row.task, operation.id),
                null,
                { id: operation.id + "a", actor: e.actor, submittedAt: 0 }
              );
              await e.repository.submit(archive);
            }
            observed.push({ entry: seedEntry(row.task), row });
            active();
          }
        let canonical2 = observed.length ? await e.repository.read() : before;
        active();
        if (observed.length) {
          const byId2 = new Map(
            canonical2.entries.map((row) => [row.task.id, row])
          );
          await e.repository.markSheetObserved(
            observed.map(({ entry, row }) => {
              const latest = byId2.get(entry.task.id) || entry, result = checkpoint(latest, row);
              if (row && entry.sheet) {
                for (const group of Object.keys(GROUPS))
                  if (!equal(
                    groupValue(row.task, group),
                    groupValue(latest.task, group)
                  ))
                    result.versions[group] = entry.sheet.versions[group];
              }
              if (latest.archived !== !result.present) {
                result.revision = entry.sheet?.revision || entry.revision;
                result.lifeVersion = entry.sheet?.lifeVersion || entry.lifeVersion;
              }
              return result;
            }),
            e.clientId
          );
        }
        const newOwners = source.board.owners.filter(
          (name) => !canonical2.lanes.items.includes(name)
        );
        if (newOwners.length)
          await e.repository.changeLanes({
            schema: 1,
            id: crypto.randomUUID(),
            kind: "lanes",
            taskId: "__lanes",
            actor: e.actor,
            add: newOwners,
            remove: [],
            submittedAt: Date.now()
          });
        const projected = canonical2.entries.map(clone2), byId = new Map(projected.map((row) => [row.task.id, row]));
        for (const conflict of canonical2.conflicts) {
          if (!String(conflict.operationId).startsWith("source-")) continue;
          const entry = byId.get(conflict.taskId), row = records.get(conflict.taskId);
          if (!entry) continue;
          if (conflict.group === "task") {
            entry.archived = !row || row.archived;
            if (row) entry.task = clone2(row.task);
          } else if (row) copyGroup(entry.task, row.task, conflict.group);
        }
        const target = toBoard(projected, canonical2.lanes.items), plan = mergeBoards(source.board, target, source.board);
        const unobserved = canonical2.entries.filter(
          (entry) => !entry.sheet && !records.has(entry.task.id)
        );
        if (unobserved.length)
          await e.repository.markSheetObserved(
            unobserved.map((entry) => checkpoint(entry, null)),
            e.clientId
          );
        if (plan.writes.length || !equal(source.board.owners, target.owners)) {
          active();
          if (!await e.repository.acquireBridge(e.clientId)) return;
          active();
          await e.api.write(source, plan.writes, target.owners);
          active();
          source = await e.api.read();
          active();
        }
        const actual = new Map(source.records.map((row) => [row.id, row])), acks = [];
        for (const entry of canonical2.entries) {
          const row = actual.get(entry.task.id), present = !!row && !row.archived;
          if (entry.archived !== !present || present && !equal(comparable(entry.task), comparable(row.task)))
            continue;
          const saved = entry.sheet;
          if (saved?.present === present && saved?.revision === entry.revision && equal(saved?.task, row?.task || entry.task))
            continue;
          const ack = checkpoint(entry, row);
          ack.task = clone2(entry.task);
          acks.push(ack);
        }
        if (acks.length) await e.repository.markSheetObserved(acks, e.clientId);
        active();
        const checkedAt = this.now();
        e.sourceState = { status: "synced", checkedAt, message: "" };
        if (observed.length || acks.length || plan.writes.length || newOwners.length || this.lastPublishedStatus !== "synced" || checkedAt - this.lastPublishedAt >= 3e5) {
          await e.repository.sourceState("synced", "", checkedAt);
          this.lastPublishedAt = checkedAt;
          this.lastPublishedStatus = "synced";
        }
        this.retryDelay = 3e4;
        e.state(e.status, e.message);
      } catch (error) {
        if (generation !== this.generation) return;
        e.sourceState = {
          status: error.auth ? "signin" : "offline",
          message: error.message,
          checkedAt: e.sourceState.checkedAt || 0
        };
        e.state(e.status, e.message);
        if (error.code === "resource-exhausted") this.retryDelay = Math.min(3e5, this.retryDelay * 2);
        if (error.code !== "resource-exhausted" && (this.lastPublishedStatus !== e.sourceState.status || this.now() - this.lastPublishedAt >= 3e5)) {
          try {
            await e.repository.sourceState(e.sourceState.status, error.message, e.sourceState.checkedAt);
            this.lastPublishedAt = this.now();
            this.lastPublishedStatus = e.sourceState.status;
          } catch {
          }
        }
      } finally {
        this.busy = false;
        this.later(this.retryDelay);
      }
    }
  };

  // public/storage-mode.mjs?rev=20261109-weekly-1
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
      const metadata = await this.request(
        "?fields=spreadsheetId,sheets(properties)"
      );
      const tabs = metadata.sheets.map((s) => s.properties).sort((a, b) => a.index - b.index), tab = tabs[0];
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
      for (const [i, cell] of (grid?.rowData?.[0]?.values || []).entries()) rows[1][(grid.startColumn ?? 16) + i] = cell;
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
      const cell = snapshot.rows?.[2]?.[17];
      if ((cell?.formattedValue || cell?.userEnteredValue?.stringValue) === "\u041F\u043E\u0437\u0438\u0446\u0438\u0438 \xB7 \u043A\u043E\u043C\u0430\u043D\u0434\u0430 v3") return;
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

  // public/storage-mode.mjs
  var MODES2 = Object.freeze({ sheets: "Google \u0422\u0430\u0431\u043B\u0438\u0446\u0430", firestore: "\u041A\u043E\u043C\u0430\u043D\u0434\u043D\u044B\u0439 \xB7 Firestore" });
  var LEGACY_CONTROL2 = Object.freeze({ request: { schema: 1, mode: "firestore", epoch: "legacy", at: 0 }, ack: { schema: 1, mode: "firestore", epoch: "legacy", at: 0 } });
  var modePending = (control) => control.request.epoch !== control.ack.epoch || control.request.mode !== control.ack.mode;

  // background/firestore-rest.mjs
  var STAMP = Object.freeze({ __serverTimestamp: true });
  var RestTimestamp = class {
    constructor(value) {
      this.value = value;
    }
    toMillis() {
      return Date.parse(this.value);
    }
    toJSON() {
      return { __timestamp: this.value };
    }
  };
  function encode(value) {
    if (value === null) return { nullValue: null };
    if (value instanceof RestTimestamp || value?.__timestamp) return { timestampValue: value.value || value.__timestamp };
    if (typeof value === "boolean") return { booleanValue: value };
    if (typeof value === "number") return Number.isSafeInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
    if (typeof value === "string") return { stringValue: value };
    if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
    if (value && typeof value === "object") return { mapValue: { fields: encodeFields(value) } };
    throw new Error("Unsupported Firestore value");
  }
  var encodeFields = (value) => Object.fromEntries(Object.entries(value).filter(([, v]) => v !== void 0).map(([k, v]) => [k, encode(v)]));
  function decode(v) {
    if ("nullValue" in v) return null;
    if ("stringValue" in v) return v.stringValue;
    if ("booleanValue" in v) return v.booleanValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return Number(v.doubleValue);
    if ("timestampValue" in v) return new RestTimestamp(v.timestampValue);
    if ("arrayValue" in v) return (v.arrayValue.values || []).map(decode);
    if ("mapValue" in v) return decodeFields(v.mapValue.fields || {});
    throw new Error("Unsupported Firestore response");
  }
  var decodeFields = (fields) => Object.fromEntries(Object.entries(fields || {}).map(([k, v]) => [k, decode(v)]));
  function splitTransforms(value, prefix = "", transforms = []) {
    const result = {};
    for (const [key, v] of Object.entries(value)) {
      if (v === void 0) continue;
      const path = prefix ? prefix + "." + key : key;
      if (v?.__serverTimestamp) {
        transforms.push({ fieldPath: path, setToServerValue: "REQUEST_TIME" });
        continue;
      }
      result[key] = v && typeof v === "object" && !Array.isArray(v) && !(v instanceof RestTimestamp) && !v.__timestamp ? splitTransforms(v, path, transforms) : v;
    }
    return result;
  }
  var snap = (ref, doc) => ({ id: ref.id, ref, updateTime: doc?.updateTime, exists: () => !!doc, data: () => doc ? decodeFields(doc.fields) : void 0 });
  var FirestoreRest = class {
    constructor({ project, board, request, now = () => Date.now(), sleep = () => {
    }, seed = null }) {
      Object.assign(this, { project, board, request, now, sleep });
      this.documents = `projects/${project}/databases/(default)/documents`;
      this.base = "https://firestore.googleapis.com/v1/" + this.documents;
      this.taskPath = `taskBoards/${board}/tasks`;
      this.tasks = new Map((seed?.tasks || []).map((d) => [d.name.split("/documents/")[1], d]));
      this.cursor = seed?.cursor || null;
      this.loaded = !!seed;
    }
    ref(...parts) {
      const first = parts[0], path = (first?.path ? first.path + "/" : "") + parts.slice(first?.path ? 1 : 0).filter((p) => typeof p === "string").join("/");
      if (![`taskBoards/${this.board}`, `taskBoardViews/${this.board}`].some((p) => path === p || path.startsWith(p + "/")) || path.split("/").some((p) => p === ".." || p === "." || p.includes("%"))) throw new Error("Unexpected board path");
      return { path, id: path.split("/").at(-1) };
    }
    name(ref) {
      return this.documents + "/" + ref.path;
    }
    async get(ref) {
      try {
        return snap(ref, this.request(this.base + "/" + ref.path));
      } catch (error) {
        if (error.status === 404) return snap(ref, null);
        throw error;
      }
    }
    async refresh() {
      const query = { from: [{ collectionId: "tasks" }] };
      if (this.cursor) query.where = { fieldFilter: { field: { fieldPath: "updatedAt" }, op: "GREATER_THAN_OR_EQUAL", value: { timestampValue: this.cursor } } };
      const rows = this.request(this.base + `/taskBoards/${this.board}:runQuery`, { structuredQuery: query });
      if (!Array.isArray(rows)) throw new Error("Invalid Firestore query response");
      let watermark = null;
      for (const row of rows) {
        if (row.readTime && (!watermark || row.readTime < watermark)) watermark = row.readTime;
        if (row.document) this.tasks.set(row.document.name.split("/documents/")[1], row.document);
      }
      if (!watermark) throw new Error("Firestore query omitted its read timestamp");
      this.cursor = new Date(Date.parse(watermark) - 1).toISOString();
      this.loaded = true;
    }
    snapshot() {
      return { cursor: this.cursor, tasks: [...this.tasks.values()] };
    }
    async docs(ref) {
      if (ref.path === this.taskPath && !ref.constraints?.length) {
        if (!this.loaded) await this.refresh();
        return { docs: [...this.tasks].map(([path, doc]) => snap(this.ref(path), doc)) };
      }
      const parts = ref.path.split("/"), collectionId = parts.pop(), parent = parts.length ? "/" + parts.join("/") : "";
      const query = { from: [{ collectionId }] }, filters = [];
      for (const c of ref.constraints || []) {
        if (c.type === "where") filters.push({ fieldFilter: { field: { fieldPath: c.field }, op: { "==": "EQUAL", ">=": "GREATER_THAN_OR_EQUAL" }[c.op], value: encode(c.value) } });
        if (c.type === "limit") query.limit = c.value;
        if (c.type === "orderBy") query.orderBy = [{ field: { fieldPath: c.field }, direction: c.direction === "desc" ? "DESCENDING" : "ASCENDING" }];
      }
      if (filters.length) query.where = filters.length === 1 ? filters[0] : { compositeFilter: { op: "AND", filters } };
      const rows = this.request(this.base + parent + ":runQuery", { structuredQuery: query });
      return { docs: rows.filter((r) => r.document).map((r) => snap(this.ref(r.document.name.split("/documents/")[1]), r.document)) };
    }
    write(ref, data, kind = "set", merge = false) {
      if (kind === "delete") return { delete: this.name(ref) };
      const transforms = [], plain = splitTransforms(data, "", transforms);
      const result = { update: { name: this.name(ref), fields: encodeFields(plain) } };
      if (kind === "update") result.currentDocument = { exists: true };
      if (kind === "update" || merge) result.updateMask = { fieldPaths: [...Object.keys(plain), ...transforms.map((t) => t.fieldPath)] };
      if (transforms.length) result.updateTransforms = transforms;
      return result;
    }
    async commit(writes, transaction) {
      if (!writes.length && !transaction) return;
      const response = this.request(this.base + ":commit", { writes, ...transaction ? { transaction } : {} });
      for (let i = 0; i < writes.length; i++) {
        const w = writes[i], name = w.update?.name || w.delete, path = name?.split("/documents/")[1];
        if (!path?.startsWith(this.taskPath + "/") || path.slice(this.taskPath.length + 1).includes("/")) continue;
        if (w.delete) {
          this.tasks.delete(path);
          continue;
        }
        let fields = w.update.fields;
        if (w.updateMask) {
          fields = { ...this.tasks.get(path)?.fields || {}, ...fields };
        }
        for (const t of w.updateTransforms || []) fields[t.fieldPath] = { timestampValue: response.commitTime };
        this.tasks.set(path, { name, fields, updateTime: response.writeResults?.[i]?.updateTime || response.commitTime });
      }
      return response;
    }
    async transaction(callback) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const { transaction } = this.request(this.base + ":beginTransaction", { options: { readWrite: {} } });
        const writes = [];
        try {
          const tx = { get: async (ref) => {
            const rows = this.request(this.base + ":batchGet", { documents: [this.name(ref)], transaction });
            if (!Array.isArray(rows) || rows.length !== 1 || !rows[0].found && !rows[0].missing) throw new Error("Invalid transactional read");
            return snap(ref, rows[0].found || null);
          }, set: (ref, data, opts) => writes.push(this.write(ref, data, "set", !!opts?.merge)), update: (ref, data) => writes.push(this.write(ref, data, "update")), delete: (ref) => writes.push(this.write(ref, null, "delete")) };
          const result = await callback(tx);
          await this.commit(writes, transaction);
          return result;
        } catch (error) {
          try {
            this.request(this.base + ":rollback", { transaction });
          } catch {
          }
          if (error.code !== "aborted" || attempt === 4) throw error;
          this.sleep(50 * (attempt + 1));
        }
      }
    }
    sdk() {
      return { doc: (first, ...p) => this.ref(...first?.path ? [first, ...p] : p), collection: (first, ...p) => this.ref(...first?.path ? [first, ...p] : p), getDoc: (ref) => this.get(ref), getDocFromServer: (ref) => this.get(ref), getDocs: (ref) => this.docs(ref), query: (ref, ...constraints) => ({ ...ref, constraints }), where: (field, op, value) => ({ type: "where", field, op, value }), limit: (value) => ({ type: "limit", value }), orderBy: (field, direction) => ({ type: "orderBy", field, direction }), serverTimestamp: () => STAMP, runTransaction: (_, fn) => this.transaction(fn), writeBatch: () => {
        const writes = [];
        return { set: (ref, data, opts) => writes.push(this.write(ref, data, "set", !!opts?.merge)), update: (ref, data) => writes.push(this.write(ref, data, "update")), delete: (ref) => writes.push(this.write(ref, null, "delete")), commit: () => this.commit(writes) };
      } };
    }
  };

  // background/worker.mjs
  var CONFIG = Object.freeze({ project: "my-project-1539119750357", board: "1qh-pi5I76k8ssUc6DxjeytFDrAta1N4ZdmVjaUFCUYY", protocol: 1, intervalMinutes: 5 });
  function installPolyfills(g) {
    if (!globalThis.structuredClone) globalThis.structuredClone = (v) => JSON.parse(JSON.stringify(v));
    if (!globalThis.TextEncoder) globalThis.TextEncoder = class {
      encode(s) {
        return new Uint8Array(g.Utilities.newBlob(s).getBytes());
      }
    };
    if (!globalThis.crypto) globalThis.crypto = { randomUUID: () => g.Utilities.getUuid(), subtle: { digest: async (_, bytes) => new Uint8Array(g.Utilities.computeDigest(g.Utilities.DigestAlgorithm.SHA_256, [...bytes].map((x) => x > 127 ? x - 256 : x))).buffer } };
    if (!globalThis.URLSearchParams) globalThis.URLSearchParams = class {
      constructor(v) {
        this.v = v;
      }
      toString() {
        return Object.entries(this.v).map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v)).join("&");
      }
    };
    if (!Array.prototype.at) Array.prototype.at = function(n) {
      return this[n < 0 ? this.length + n : n];
    };
  }
  function createHttp({ fetch: fetch2, token, project = CONFIG.project, board = CONFIG.board, deadline = Infinity, now = () => Date.now(), stats = { calls: 0 } }) {
    return (url, body) => {
      if (now() > deadline) throw Object.assign(new Error("Run budget reached; resume next tick."), { code: "deadline-exceeded" });
      const allowed = [`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`, `https://sheets.googleapis.com/v4/spreadsheets/${board}`];
      if (!allowed.some((p) => url === p || url.startsWith(p + "/") || url.startsWith(p + ":") || url.startsWith(p + "?"))) throw new Error("Unexpected Google API destination");
      stats.calls++;
      const r = fetch2(url, { method: body ? "post" : "get", headers: { Authorization: "Bearer " + token() }, contentType: "application/json", ...body ? { payload: JSON.stringify(body) } : {}, muteHttpExceptions: true, followRedirects: false });
      const status = r.getResponseCode();
      let data;
      try {
        data = JSON.parse(r.getContentText());
      } catch {
        data = null;
      }
      if (status < 200 || status >= 300) {
        const code = { 401: "unauthenticated", 403: "permission-denied", 404: "not-found", 409: "aborted", 412: "aborted", 429: "resource-exhausted", 503: "unavailable" }[status] || "internal";
        throw Object.assign(new Error(status === 429 ? "Google quota reached; background sync will retry later." : data?.error?.message || `Google API error ${status}`), { status, code, auth: status === 401 });
      }
      if (data === null) throw new Error("Invalid Google API response");
      return data;
    };
  }
  var PackedCache = class {
    constructor(cache, utilities) {
      this.c = cache;
      this.u = utilities;
    }
    read() {
      try {
        const m = JSON.parse(this.c.get("task-canvas-cache-manifest") || "null");
        if (!m || m.schema !== 1 || m.chunks < 1 || m.chunks > 100) return null;
        const keys = Array.from({ length: m.chunks }, (_, i) => m.id + ":" + i), parts = this.c.getAll(keys);
        if (keys.some((k) => typeof parts[k] !== "string")) return null;
        return JSON.parse(this.u.ungzip(this.u.newBlob(this.u.base64Decode(keys.map((k) => parts[k]).join("")))).getDataAsString());
      } catch {
        return null;
      }
    }
    write(snapshot) {
      const text = this.u.base64Encode(this.u.gzip(this.u.newBlob(JSON.stringify(snapshot))).getBytes()), id = "task-canvas-cache:" + this.u.getUuid(), values = {}, chunks = Math.ceil(text.length / 8e4);
      if (chunks > 100) throw new Error("Cache capacity exceeded; cursor not advanced.");
      for (let i = 0; i < chunks; i++) values[id + ":" + i] = text.slice(i * 8e4, (i + 1) * 8e4);
      this.c.putAll(values, 21600);
      this.c.put("task-canvas-cache-manifest", JSON.stringify({ schema: 1, id, chunks }), 21600);
    }
  };
  function createWorker(g, { now = () => Date.now(), logger = (m) => console.log(m) } = {}) {
    installPolyfills(g);
    const props = g.PropertiesService.getScriptProperties(), scriptId = g.ScriptApp.getScriptId(), owner = () => g.Session.getEffectiveUser().getEmail().toLowerCase(), rootPath = `taskBoards/${CONFIG.board}`, clientId = "apps-script-" + scriptId.slice(-32), actor = { uid: clientId, name: "Google \u0422\u0430\u0431\u043B\u0438\u0446\u0430 \xB7 \u0444\u043E\u043D", clientId };
    function connection(deadline = now() + 1e5, seed = null) {
      let token;
      const stats = { calls: 0 }, request = createHttp({ fetch: (...a) => g.UrlFetchApp.fetch(...a), token: () => token ?? (token = g.ScriptApp.getOAuthToken()), deadline, now, stats });
      const rest = new FirestoreRest({ ...CONFIG, request, now, sleep: (ms) => g.Utilities.sleep(ms), seed }), sdk = rest.sdk();
      class BackgroundRepository extends TeamApi {
        async transact(fn) {
          return rest.transaction(fn);
        }
        async acquireBridge(holder) {
          return rest.transaction(async (tx) => {
            await tx.get(this.ref("meta", "bridgeLease"));
            tx.set(this.ref("meta", "bridgeLease"), { holder, protocol: 4, uid: actor.uid, acquiredAt: sdk.serverTimestamp() });
            return true;
          });
        }
        async sourceState(status, message = "", checkedAt = now()) {
          await super.sourceState(status, message, checkedAt);
          props.setProperty("sourcePublished", JSON.stringify({ status, checkedAt }));
        }
      }
      class BackgroundSheets extends SheetsApi {
        async request(path, body) {
          return request(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.board}` + path, body);
        }
        async write(snapshot, writes, owners) {
          const control = await this.readStorageControl();
          if (control.request.mode !== "firestore" || this.expectedEpoch && control.request.epoch !== this.expectedEpoch) throw new Error("Storage mode changed; Sheet projection paused.");
          return super.write(snapshot, writes, owners);
        }
      }
      return { rest, repository: new BackgroundRepository({ boardId: CONFIG.board, sdk, db: {}, user: { uid: actor.uid, email: owner(), displayName: actor.name } }), sheets: new BackgroundSheets(null), stats };
    }
    async function probe() {
      const c = connection(), root = await c.rest.get(c.rest.ref(rootPath));
      if (!root.exists() || root.data().ownerEmail !== owner()) throw new Error("Only the board owner can configure background sync.");
      const sheet = await c.sheets.read();
      return { c, root, sheet };
    }
    async function prepare2() {
      let sheet, ownerCheck = "confirmed";
      try {
        ({ sheet } = await probe());
      } catch (error) {
        if (error.code !== "resource-exhausted") throw error;
        sheet = await connection().sheets.read();
        ownerCheck = "deferred-quota";
      }
      const existing = g.ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === "syncTasksInBackground" && String(t.getEventType()) === "CLOCK");
      if (props.getProperty("timerProtocol") !== "2" || !existing.length) {
        for (const t of existing) g.ScriptApp.deleteTrigger(t);
        g.ScriptApp.newTrigger("syncTasksInBackground").timeBased().everyMinutes(1).create();
        props.setProperty("timerProtocol", "2");
      } else for (const t of existing.slice(1)) g.ScriptApp.deleteTrigger(t);
      props.setProperty("prepared", JSON.stringify({ scriptId, owner: owner(), ownerCheck, protocol: 1, at: now() }));
      const result = { status: "prepared", scriptId, ownerCheck, intervalMinutes: 5, sheetTitle: sheet.title };
      logger(JSON.stringify(result));
      return result;
    }
    async function activate2() {
      const p = JSON.parse(props.getProperty("prepared") || "null");
      if (p?.scriptId !== scriptId || p.owner !== owner()) throw new Error("Run prepareBackgroundSync first.");
      if (!g.ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === "syncTasksInBackground" && String(t.getEventType()) === "CLOCK")) throw new Error("Timer missing.");
      const { c, root } = await probe();
      if (root.data().backgroundProtocol !== 1) throw new Error("Deploy the browser lease fence before activation.");
      const background = { provider: "apps-script", enabled: true, protocol: 1, scriptId, intervalMinutes: 5, startAfter: now() + 15e4 };
      if (root.data().background?.enabled && root.data().background.scriptId === scriptId) return { status: "already-active" };
      await c.rest.commit([{ ...c.rest.write(c.rest.ref(rootPath), { background }, "update"), currentDocument: { updateTime: root.updateTime } }, c.rest.write(c.rest.ref(`taskBoardViews/${CONFIG.board}`), { background: { provider: "apps-script", intervalMinutes: 5 } }, "update")]);
      props.deleteProperty("nextRunAt");
      props.setProperty("lastRun", JSON.stringify({ status: "handoff-wait", at: now(), nextRunAt: background.startAfter }));
      logger("Activated; browser writers fenced, first write waits 150 seconds.");
      return { status: "handoff-wait", startAfter: background.startAfter };
    }
    async function run2() {
      const lock = g.LockService.getScriptLock();
      if (!lock.tryLock(1)) return { status: "busy" };
      const start = now();
      props.setProperty("lastTick", String(start));
      let c, status = "error", result;
      try {
        const prepared = JSON.parse(props.getProperty("prepared") || "null");
        if (prepared?.owner !== owner() || prepared?.scriptId !== scriptId) throw new Error("Worker owner is not prepared.");
        const packed = new PackedCache(g.CacheService.getScriptCache(), g.Utilities), seed = packed.read();
        c = connection(start + 1e5, seed?.scriptId === scriptId ? seed.snapshot : null);
        const control = await c.sheets.readStorageControl(), requested = control.request;
        if (props.getProperty("requestedEpoch") !== requested.epoch) {
          props.setProperty("requestedEpoch", requested.epoch);
          props.deleteProperty("nextRunAt");
        }
        const mirror = async (mode) => {
          await c.rest.commit([c.rest.write(c.rest.ref(rootPath), { storageMode: mode, storageEpoch: requested.epoch }, "update"), c.rest.write(c.rest.ref(`taskBoardViews/${CONFIG.board}`), { storageMode: mode, storageEpoch: requested.epoch }, "update")]);
        };
        const acknowledge = async () => {
          const latest = await c.sheets.readStorageControl();
          if (latest.request.epoch !== requested.epoch) throw new Error("Storage request superseded; will retry the latest choice.");
          await c.sheets.acknowledgeStorageMode(requested);
          props.setProperty("modeAck", requested.epoch);
        };
        if (requested.mode === "sheets") {
          if (modePending(control) || props.getProperty("modeAck") !== requested.epoch) {
            await mirror("sheets");
            await acknowledge();
          }
          props.setProperty("quotaAttempts", "0");
          status = "sheets-only";
          result = { status, at: now(), mode: "sheets", calls: c.stats.calls };
          return result;
        }
        const next = Number(props.getProperty("nextRunAt") || 0);
        if (next > start) return { status: "backoff", nextRunAt: next };
        c.sheets.expectedEpoch = requested.epoch;
        const root = await c.rest.get(c.rest.ref(rootPath)), data = root.data(), bg = data?.background;
        if (data?.ownerEmail !== owner()) throw new Error("The trigger owner no longer owns the board.");
        if (!bg?.enabled || bg.provider !== "apps-script" || bg.scriptId !== scriptId || bg.protocol !== 1) return { status: "disabled" };
        if (start < bg.startAfter) return { status: "handoff-wait", nextRunAt: bg.startAfter };
        await c.rest.refresh();
        const remote = await c.repository.read();
        const engine = { clientId, actor, connected: true, status: "synced", message: "", api: c.sheets, repository: c.repository, entries: new Map(remote.entries.map((e) => [e.task.id, e])), owners: remote.lanes.items || [], rawConflicts: remote.conflicts, sourceState: remote.source, state: () => {
        } };
        const bridge = new TeamSourceBridge(engine, { now });
        bridge.running = true;
        bridge.later = () => {
        };
        const last = JSON.parse(props.getProperty("sourcePublished") || "null");
        bridge.lastPublishedAt = last?.checkedAt || 0;
        bridge.lastPublishedStatus = last?.status || null;
        await bridge.tick();
        if (engine.sourceState.status !== "synced") throw Object.assign(new Error(engine.sourceState.message || "Source sync failed"), { code: engine.sourceState.message?.includes("quota") ? "resource-exhausted" : "unavailable" });
        if (modePending(control)) {
          await mirror("firestore");
          await acknowledge();
        }
        packed.write({ scriptId, snapshot: c.rest.snapshot() });
        props.setProperty("quotaAttempts", "0");
        status = "synced";
        result = { status, at: now(), calls: c.stats.calls, records: c.rest.tasks.size };
        return result;
      } catch (error) {
        status = error.code === "resource-exhausted" ? "quota-wait" : "error";
        const attempts = Math.min(6, Number(props.getProperty("quotaAttempts") || 0) + 1);
        props.setProperty("quotaAttempts", String(attempts));
        const delay = status === "quota-wait" ? Math.min(9e5, 3e5 * 2 ** (attempts - 1)) : 3e5;
        props.setProperty("nextRunAt", String(now() + delay));
        result = { status, at: now(), error: String(error.message || error).slice(0, 600), nextRunAt: now() + delay };
        return result;
      } finally {
        if (result) {
          if (status === "synced") props.setProperty("nextRunAt", String(now() + Math.max(3e5, Math.max(1, now() - start) * 24)));
          props.setProperty("lastRun", JSON.stringify({ ...result, durationMs: now() - start, calls: c?.stats.calls || 0 }));
          logger(JSON.stringify({ ...result, durationMs: now() - start }));
        }
        lock.releaseLock();
      }
    }
    async function stop2() {
      const lock = g.LockService.getScriptLock();
      if (!lock.tryLock(1e3)) throw new Error("A sync run is still active; retry stop after it finishes.");
      try {
        const c = connection(), ref = c.rest.ref(rootPath), doc = await c.rest.get(ref);
        if (doc.data()?.ownerEmail !== owner() || doc.data()?.background?.scriptId !== scriptId) throw new Error("Only this worker owner can stop it.");
        await c.rest.commit([{ ...c.rest.write(ref, { background: { ...doc.data().background, enabled: false } }, "update"), currentDocument: { updateTime: doc.updateTime } }, c.rest.write(c.rest.ref(`taskBoardViews/${CONFIG.board}`), { background: { provider: "browser", intervalMinutes: 0 } }, "update")]);
        for (const t of g.ScriptApp.getProjectTriggers()) if (t.getHandlerFunction() === "syncTasksInBackground") g.ScriptApp.deleteTrigger(t);
        return { status: "stopped" };
      } finally {
        lock.releaseLock();
      }
    }
    function check2() {
      const result = { scriptId, lastTick: Number(props.getProperty("lastTick") || 0), lastRun: JSON.parse(props.getProperty("lastRun") || "null"), timerCount: g.ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === "syncTasksInBackground" && String(t.getEventType()) === "CLOCK").length };
      logger(JSON.stringify(result));
      return result;
    }
    return { prepare: prepare2, activate: activate2, run: run2, check: check2, stop: stop2 };
  }

  // background/entry.mjs
  var services = () => ({ Utilities, ScriptApp, PropertiesService, CacheService, LockService, UrlFetchApp, Session });
  var prepare = () => createWorker(services()).prepare();
  var activate = () => createWorker(services()).activate();
  var run = () => createWorker(services()).run();
  var check = () => createWorker(services()).check();
  var stop = () => createWorker(services()).stop();
  return __toCommonJS(entry_exports);
})();

function prepareBackgroundSync(){return TaskCanvasBackground.prepare();}
function activateBackgroundSync(){return TaskCanvasBackground.activate();}
function syncTasksInBackground(){return TaskCanvasBackground.run();}
function checkBackgroundSync(){return TaskCanvasBackground.check();}
function stopBackgroundSync(){return TaskCanvasBackground.stop();}
