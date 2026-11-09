var TelegramTaskIntake = (() => {
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

  // telegram/entry.mjs
  var entry_exports = {};
  __export(entry_exports, {
    check: () => check,
    prepare: () => prepare,
    retryPending: () => retryPending,
    run: () => run,
    start: () => start,
    stop: () => stop
  });

  // public/people.mjs?rev=20261109-telegram-tabs-1
  function parseAssignee(value) {
    const name = String(value || "").trim().replace(/\s+/g, " ");
    if (!name) return "";
    if (name.length > 80 || /;|\u2014|\u2013|\s-\s|->|\u2192|\sи\s|не указан|исполнитель|инициатор|адресат/i.test(
      name
    ))
      return null;
    return /^[\p{L} -]+$/u.test(name) ? name : null;
  }

  // public/model.mjs?rev=20261109-telegram-tabs-1
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

  // public/sync-model.mjs?rev=20261109-telegram-tabs-1
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
  function combineSheets(primary, telegram2) {
    const records = [...primary.records, ...telegram2.records];
    if (new Set(records.map((r) => r.id)).size !== records.length)
      throw new Error("ID \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u0442\u0441\u044F \u0432 \u0434\u0432\u0443\u0445 \u0432\u043A\u043B\u0430\u0434\u043A\u0430\u0445. \u0423\u0441\u0442\u0440\u0430\u043D\u0438\u0442\u0435 \u0434\u0443\u0431\u043B\u044C \u0432 \u0442\u0430\u0431\u043B\u0438\u0446\u0435.");
    return { ...primary, records, sourceTabs: [TAB_ID, TELEGRAM_TAB_ID], board: {
      tasks: validateBoard(records.filter((r) => !r.archived).map((r) => r.task)),
      owners: primary.board.owners
    } };
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
        const set2 = (col, value) => values[col].userEnteredValue = typeof value === "boolean" ? { boolValue: value } : { stringValue: String(value || "") };
        set2(0, write.task.sourceId || `\u0414-${write.id.slice(0, 8)}`);
        set2(4, write.task.link);
        set2(5, write.task.requester);
        set2(12, write.task.dependency);
        for (const field of SYNC_FIELDS)
          if (COLUMNS[field] !== void 0)
            set2(COLUMNS[field], cellValue(field, write.task[field]));
        values[3].userEnteredValue = {
          formulaValue: '=INDIRECT("B"&ROW())&INDIRECT("C"&ROW())'
        };
        set2(18, write.id);
        set2(19, false);
        set2(20, write.task.ownerNote);
        set2(21, write.task.dueNote);
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

  // public/storage-mode.mjs?rev=20261109-telegram-tabs-1
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
      const telegram2 = tabs.find((t) => t.sheetId === TELEGRAM_TAB_ID);
      if (!telegram2) throw new Error("\u0412\u043A\u043B\u0430\u0434\u043A\u0430 \u043D\u043E\u0432\u044B\u0445 \u0437\u0430\u0434\u0430\u0447 Telegram \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430. \u0414\u0430\u043D\u043D\u044B\u0435 \u0434\u043E\u0441\u043A\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B \u0431\u0435\u0437 \u0443\u0441\u0435\u0447\u0435\u043D\u0438\u044F.");
      const snapshots = await Promise.all([tab, telegram2].map((t) => this.readTab(t)));
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

  // public/sync-model.mjs
  var SHEET_ID2 = "1qh-pi5I76k8ssUc6DxjeytFDrAta1N4ZdmVjaUFCUYY";
  var TAB_ID2 = 1102202601;
  var TELEGRAM_TAB_ID2 = 1478506234;
  var SYNC_FIELDS2 = [
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
  var FIELD_NAMES2 = {
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
  var PRIORITY_LABELS2 = {
    do: "\u0412\u0430\u0436\u043D\u043E \xB7 \u0441\u0440\u043E\u0447\u043D\u043E",
    plan: "\u0412\u0430\u0436\u043D\u043E \xB7 \u043D\u0435 \u0441\u0440\u043E\u0447\u043D\u043E",
    delegate: "\u041D\u0435 \u0432\u0430\u0436\u043D\u043E \xB7 \u0441\u0440\u043E\u0447\u043D\u043E",
    later: "\u041D\u0435 \u0432\u0430\u0436\u043D\u043E \xB7 \u043D\u0435 \u0441\u0440\u043E\u0447\u043D\u043E"
  };
  var COLUMNS2 = {
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
  var canonical2 = (value) => {
    if (value && typeof value.toJSON === "function") return canonical2(value.toJSON());
    if (Array.isArray(value)) return value.map(canonical2);
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).filter((k) => value[k] !== void 0 && typeof value[k] !== "function" && typeof value[k] !== "symbol").sort().map((k) => [k, canonical2(value[k])]));
    return value;
  };
  var equal2 = (a, b) => JSON.stringify(canonical2(a ?? null)) === JSON.stringify(canonical2(b ?? null));
  function cellValue2(field, value) {
    if (field === "priority") return value ? PRIORITY_LABELS2[value] : "";
    if (field === "positions") return JSON.stringify(value || {});
    if (field === "due") return value ? value.split("-").reverse().join(".") : "";
    if (field === "unit") return value ? `${value} / ` : "";
    if (field === "status" && (!value || value === "\u041D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D")) return "";
    return value || "";
  }
  function buildWriteRequests2(snapshot, writes, owners) {
    const requests = [], byId = new Map(snapshot.records.map((r) => [r.id, r]));
    let targetSheetId = TAB_ID2;
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
      targetSheetId = record?.sheetId ?? (write.id.startsWith("tg-") ? TELEGRAM_TAB_ID2 : TAB_ID2);
      if (![TAB_ID2, TELEGRAM_TAB_ID2].includes(targetSheetId)) throw new Error("\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u0432\u043A\u043B\u0430\u0434\u043A\u0430 \u0437\u0430\u0434\u0430\u0447\u0438.");
      if (write.type === "archive") {
        if (record) cell(record.row, 19, true);
        continue;
      }
      const fields = write.type === "upsert" ? SYNC_FIELDS2 : write.fields;
      if (fields.includes("owner") && write.task.owner && parseAssignee(write.task.owner) === null)
        throw new Error("\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043E\u0434\u043D\u043E\u0433\u043E \u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0433\u043E \u0431\u0435\u0437 \u043F\u043E\u044F\u0441\u043D\u0435\u043D\u0438\u0439.");
      if (record) {
        if (!record.cells[18]?.formattedValue) cell(record.row, 18, write.id);
        if (record.archived) cell(record.row, 19, false);
        for (const field of fields) {
          const col = COLUMNS2[field];
          if (col === void 0) continue;
          const existing = record.cells[col] || {};
          if (existing.chipRuns?.length)
            throw new Error(
              `\u041F\u043E\u043B\u0435 \xAB${FIELD_NAMES2[field]}\xBB \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0443\u043C\u043D\u0443\u044E \u043C\u0435\u0442\u043A\u0443. \u0418\u0437\u043C\u0435\u043D\u0438\u0442\u0435 \u0435\u0433\u043E \u0432 \u0442\u0430\u0431\u043B\u0438\u0446\u0435.`
            );
          if (existing.userEnteredValue?.formulaValue)
            throw new Error(
              `\u041F\u043E\u043B\u0435 \xAB${FIELD_NAMES2[field]}\xBB \u0441\u0442\u0440\u043E\u043A\u0438 ${record.row + 1} \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0444\u043E\u0440\u043C\u0443\u043B\u0443. \u0418\u0437\u043C\u0435\u043D\u0438\u0442\u0435 \u0435\u0433\u043E \u0432 \u0442\u0430\u0431\u043B\u0438\u0446\u0435.`
            );
          const value = cellValue2(field, write.task[field]);
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
        const template = snapshot.records.find((r) => (r.sheetId ?? TAB_ID2) === targetSheetId)?.cells || [];
        const values = Array.from({ length: 22 }, (_, col) => ({
          userEnteredFormat: template[col]?.userEnteredFormat || {},
          ...template[col]?.dataValidation ? { dataValidation: template[col].dataValidation } : {}
        }));
        const set2 = (col, value) => values[col].userEnteredValue = typeof value === "boolean" ? { boolValue: value } : { stringValue: String(value || "") };
        set2(0, write.task.sourceId || `\u0414-${write.id.slice(0, 8)}`);
        set2(4, write.task.link);
        set2(5, write.task.requester);
        set2(12, write.task.dependency);
        for (const field of SYNC_FIELDS2)
          if (COLUMNS2[field] !== void 0)
            set2(COLUMNS2[field], cellValue2(field, write.task[field]));
        values[3].userEnteredValue = {
          formulaValue: '=INDIRECT("B"&ROW())&INDIRECT("C"&ROW())'
        };
        set2(18, write.id);
        set2(19, false);
        set2(20, write.task.ownerNote);
        set2(21, write.task.dueNote);
        requests.push({
          appendCells: {
            sheetId: targetSheetId,
            rows: [{ values }],
            fields: "userEnteredValue,userEnteredFormat,dataValidation"
          }
        });
      }
    }
    targetSheetId = TAB_ID2;
    if (!equal2(
      [...new Set(owners)].sort(),
      [...new Set(snapshot.board.owners)].sort()
    ))
      cell(0, 17, JSON.stringify({ version: 1, owners: [...new Set(owners)] }));
    return requests;
  }

  // public/people.mjs
  function parseAssignee2(value) {
    const name = String(value || "").trim().replace(/\s+/g, " ");
    if (!name) return "";
    if (name.length > 80 || /;|\u2014|\u2013|\s-\s|->|\u2192|\sи\s|не указан|исполнитель|инициатор|адресат/i.test(
      name
    ))
      return null;
    return /^[\p{L} -]+$/u.test(name) ? name : null;
  }

  // telegram/intake.mjs
  var GROUP_ID = "-5372356223";
  var imperative = /^(?:сделайте|сделай|подготовьте|подготовь|проверьте|проверь|согласуйте|согласуй|обновите|обнови|соберите|собери|отправьте|отправь|запустите|запусти|добавьте|добавь|исправьте|исправь|составьте|составь|разработайте|разработай|разместите|размести|закажите|закажи|свяжись)(?=\s|$)/iu;
  var infinitive = /^[а-яё]+(?:ть|ться|ти|чь)(?=\s|$)/iu;
  var requestPattern = /^(?:нужно|надо|необходимо|прошу|поручаю|можешь|можете|давайте)\s+(?:пожалуйста[, ]+)?(.+)/iu;
  var isAction = (body) => imperative.test(body) || infinitive.test(body.match(requestPattern)?.[1] || "");
  function extractTask(text, { date = /* @__PURE__ */ new Date(), owners = { "\u043A\u0430\u0442\u044F": "\u0415\u043A\u0430\u0442\u0435\u0440\u0438\u043D\u0430 \u041C\u0430\u0448\u043A\u043E\u0432\u0430" }, botUsername = "" } = {}) {
    text = String(text || "").trim();
    if (!text) return null;
    let body = text, owner = "", explicit = false;
    const command = body.match(/^(?:\/task(?:@[a-z0-9_]+)?|#задача)(?:\s+|$)/iu);
    if (command?.[0].includes("@") && command[0].split("@")[1].trim().toLowerCase() !== botUsername.toLowerCase()) return null;
    if (command) {
      explicit = true;
      body = body.slice(command[0].length).trim();
    }
    const address = body.match(/^(@?[\p{L}\p{N}_-]+(?: [\p{L}-]+)?),\s*/u);
    if (address && isAction(body.slice(address[0].length).replace(/^пожалуйста[, ]+/iu, ""))) {
      const key = address[1].toLocaleLowerCase("ru");
      owner = Object.hasOwn(owners, key) ? owners[key] : "";
      body = body.slice(address[0].length);
    }
    if (owner && parseAssignee2(owner) === null) throw Error("OWNER_MAP_INVALID");
    const action = body.replace(/^пожалуйста[, ]+/iu, "");
    if (!explicit) {
      if (/^(?:не\s|не\s+надо|отмен|уже\s|готово|сделал|сделано)/iu.test(action)) return null;
      if (!isAction(action)) return null;
    }
    if (body.length < 4) return null;
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const part = (key) => parts.find((p) => p.type === key).value;
    const today = `${part("year")}-${part("month")}-${part("day")}`;
    let due = "";
    if (/(?:^|\s)(?:до\s+)?завтра(?=$|[\s.,!?])/iu.test(body)) {
      const d = /* @__PURE__ */ new Date(today + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() + 1);
      due = d.toISOString().slice(0, 10);
    } else if (/(?:^|\s)(?:до\s+)?сегодня(?=$|[\s.,!?])/iu.test(body)) due = today;
    const rawDate = body.match(/(?:до|срок[: ]+)\s*(\d{1,2})[.](\d{1,2})(?:[.](\d{4}))?(?=$|[\s.,!?])/iu);
    if (rawDate) {
      const iso = `${rawDate[3] || today.slice(0, 4)}-${rawDate[2].padStart(2, "0")}-${rawDate[1].padStart(2, "0")}`;
      const d = /* @__PURE__ */ new Date(iso + "T12:00:00Z");
      if (Number.isFinite(+d) && d.toISOString().slice(0, 10) === iso) due = iso;
    }
    return { title: body.split("\n")[0].slice(0, 300), description: text, owner, due, status: "\u0412 \u043E\u0436\u0438\u0434\u0430\u043D\u0438\u0438", priority: "", positions: {}, unit: "", direction: "", comment: "" };
  }
  function taskFromUpdate(update, config2) {
    const m = update.message;
    if (!m || String(m.chat?.id) !== config2.chatId || m.from?.is_bot || m.sender_chat || m.forward_origin || !Number.isSafeInteger(m.date) || m.date < config2.startedAt) return null;
    if (!Number.isSafeInteger(m.message_id) || !Number.isSafeInteger(update.update_id)) return null;
    const task = extractTask(m.text || m.caption, { date: new Date(m.date * 1e3), owners: config2.owners, botUsername: config2.botUsername });
    if (!task) return null;
    const link = m.chat.username ? `https://t.me/${m.chat.username}/${m.message_id}` : String(m.chat.id).startsWith("-100") ? `https://t.me/c/${String(m.chat.id).slice(4)}/${m.message_id}` : "";
    return { ...task, id: `tg-${m.chat.id}-${m.message_id}`, sourceId: `\u0422\u0413-${m.message_id}`, requester: [m.from?.first_name, m.from?.last_name].filter(Boolean).join(" "), link, telegramText: m.text || m.caption, sentAt: new Date(m.date * 1e3).toISOString() };
  }
  function appendRequests(snapshot, task) {
    if (snapshot.records.some((r) => r.id === task.id)) return [];
    const requests = buildWriteRequests2(snapshot, [{ id: task.id, type: "upsert", task }], snapshot.board.owners);
    const values = requests.find((r) => r.appendCells).appendCells.rows[0].values;
    for (const [col, value] of [[13, task.sentAt], [14, task.telegramText], [15, task.link || `Telegram \xB7 ${GROUP_ID} \xB7 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 ${task.sourceId}`]]) values[col].userEnteredValue = { stringValue: value };
    return requests;
  }
  async function processUpdates(updates, { config: config2, state: state2, read, append, shouldStop = () => false }) {
    let snapshot = null, added = 0;
    const getSnapshot = async () => snapshot ?? (snapshot = await read());
    const pending = state2.pending();
    if (pending) {
      if (!(await getSnapshot()).records.some((r) => r.id === pending.id)) throw Error("WRITE_UNCERTAIN: \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0441\u0442\u0440\u043E\u043A\u0443 \u0432 \u0442\u0430\u0431\u043B\u0438\u0446\u0435; \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043F\u043E\u0432\u0442\u043E\u0440 \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D");
      state2.clearPending();
    }
    for (const update of [...updates].sort((a, b) => a.update_id - b.update_id)) {
      if (shouldStop()) break;
      if (!Number.isSafeInteger(update.update_id) || update.update_id < state2.offset()) continue;
      const task = taskFromUpdate(update, config2);
      if (task) {
        const s = await getSnapshot(), requests = appendRequests(s, task);
        if (requests.length) {
          state2.setPending({ id: task.id, updateId: update.update_id, task });
          await append(requests);
          s.records.push({ id: task.id });
          state2.clearPending();
          added++;
        }
      }
      state2.setOffset(update.update_id + 1);
    }
    return { added };
  }

  // telegram/entry.mjs
  if (typeof globalThis.URLSearchParams === "undefined") globalThis.URLSearchParams = class {
    constructor(values) {
      this.values = values;
    }
    toString() {
      return Object.entries(this.values).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
    }
  };
  if (typeof globalThis.structuredClone === "undefined") globalThis.structuredClone = (value) => JSON.parse(JSON.stringify(value));
  var props = () => PropertiesService.getScriptProperties();
  var get = (key) => props().getProperty(`TELEGRAM_${key}`);
  var set = (key, value) => props().setProperty(`TELEGRAM_${key}`, String(value));
  var remove = (key) => props().deleteProperty(`TELEGRAM_${key}`);
  var HANDLER = "pollTelegramTasks";
  function fetchJson(url, options, label) {
    let response;
    try {
      response = UrlFetchApp.fetch(url, { ...options, muteHttpExceptions: true, followRedirects: false });
    } catch {
      throw Error(`${label}_NETWORK`);
    }
    const status = response.getResponseCode();
    let data;
    try {
      data = JSON.parse(response.getContentText());
    } catch {
      throw Error(`${label}_RESPONSE`);
    }
    if (status < 200 || status >= 300 || data.ok === false) {
      const retry = Number(data.parameters?.retry_after);
      if (label === "TELEGRAM" && retry > 0) set("RETRY_AFTER", Date.now() + Math.min(retry, 86400) * 1e3);
      throw Error(`${label}_HTTP_${status}`);
    }
    return data;
  }
  var GoogleSheet = class extends SheetsApi {
    constructor() {
      super({});
    }
    async request(path, body) {
      if (!path.startsWith("?") && path !== ":batchUpdate") throw Error("SHEETS_PATH_REJECTED");
      return fetchJson(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID2}${path}`, {
        method: body ? "post" : "get",
        headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
        ...body ? { contentType: "application/json", payload: JSON.stringify(body) } : {}
      }, "SHEETS");
    }
  };
  function telegram(method, body = {}) {
    if (!["getMe", "getChat", "getChatMember", "getWebhookInfo", "getUpdates"].includes(method)) throw Error("TELEGRAM_METHOD_REJECTED");
    const token = get("BOT_TOKEN");
    if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token || "")) throw Error("BOT_TOKEN_MISSING");
    return fetchJson(`https://api.telegram.org/bot${token}/${method}`, { method: "post", contentType: "application/json", payload: JSON.stringify(body) }, "TELEGRAM").result;
  }
  function state() {
    return {
      offset: () => Number(get("OFFSET") || 0),
      setOffset: (value) => set("OFFSET", value),
      pending: () => {
        const n = Number(get("PENDING_PARTS") || 0);
        if (!n) return null;
        let value = "";
        for (let i = 0; i < n; i++) value += get(`PENDING_${i}`) || "";
        return JSON.parse(value);
      },
      setPending: (value) => {
        const json = JSON.stringify(value), n = Math.ceil(json.length / 1800);
        for (let i = 0; i < n; i++) set(`PENDING_${i}`, json.slice(i * 1800, (i + 1) * 1800));
        set("PENDING_PARTS", n);
      },
      clearPending: () => {
        const n = Number(get("PENDING_PARTS") || 0);
        remove("PENDING_PARTS");
        for (let i = 0; i < n; i++) remove(`PENDING_${i}`);
      }
    };
  }
  function config() {
    const owners = JSON.parse(get("OWNER_MAP") || '{"\u043A\u0430\u0442\u044F":"\u0415\u043A\u0430\u0442\u0435\u0440\u0438\u043D\u0430 \u041C\u0430\u0448\u043A\u043E\u0432\u0430"}');
    if (!owners || Array.isArray(owners) || typeof owners !== "object") throw Error("OWNER_MAP_INVALID");
    return { chatId: GROUP_ID, startedAt: Number(get("STARTED_AT")), botUsername: (get("BOT_USERNAME") || "").replace(/^@/, ""), owners: Object.fromEntries(Object.entries(owners).map(([k, v]) => [k.toLocaleLowerCase("ru"), v])) };
  }
  async function locked(fn) {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(1e3)) return { busy: true };
    try {
      return await fn();
    } finally {
      lock.releaseLock();
    }
  }
  async function prepare() {
    const me = telegram("getMe"), expected = get("BOT_USERNAME");
    if (!expected || me.username.toLowerCase() !== expected.replace(/^@/, "").toLowerCase()) throw Error("BOT_USERNAME_MISMATCH");
    if (telegram("getWebhookInfo").url) throw Error("BOT_HAS_WEBHOOK_USE_A_DEDICATED_BOT");
    const chat = telegram("getChat", { chat_id: GROUP_ID });
    if (String(chat.id) !== GROUP_ID || !["group", "supergroup"].includes(chat.type)) throw Error("GROUP_MISMATCH");
    const member = telegram("getChatMember", { chat_id: GROUP_ID, user_id: me.id });
    if (!["member", "administrator", "creator"].includes(member.status)) throw Error("ADD_BOT_TO_GROUP");
    if (!me.can_read_all_group_messages && !["administrator", "creator"].includes(member.status)) throw Error("DISABLE_BOT_PRIVACY");
    config();
    const snapshot = await new GoogleSheet().read();
    return { bot: `@${me.username}`, groupId: GROUP_ID, sheet: SHEET_ID2, tasks: snapshot.records.length, ready: true };
  }
  async function start() {
    return locked(async () => {
      const verified = await prepare();
      set("VERIFIED_BOT_ID", get("BOT_TOKEN").split(":")[0]);
      if (!get("STARTED_AT")) set("STARTED_AT", Math.floor(Date.now() / 1e3));
      if (!ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === HANDLER)) ScriptApp.newTrigger(HANDLER).timeBased().everyMinutes(1).create();
      set("ENABLED", "true");
      return { ...verified, enabled: true };
    });
  }
  async function run() {
    return locked(async () => {
      if (get("ENABLED") !== "true") return { enabled: false };
      if (Number(get("RETRY_AFTER") || 0) > Date.now()) return { rateLimited: true };
      const began = Date.now();
      try {
        const cfg = config();
        if (!Number.isSafeInteger(cfg.startedAt) || cfg.startedAt <= 0) throw Error("START_REQUIRED");
        if (get("BOT_TOKEN")?.split(":")[0] !== get("VERIFIED_BOT_ID")) throw Error("START_REQUIRED");
        const sheet = new GoogleSheet(), cursor = state();
        const updates = telegram("getUpdates", { offset: cursor.offset(), limit: 50, timeout: 0, allowed_updates: ["message"] });
        const result = await processUpdates(updates, { config: cfg, state: cursor, read: () => sheet.read(), append: (requests) => sheet.request(":batchUpdate", { requests }), shouldStop: () => Date.now() - began > 45e3 });
        set("LAST_OK", (/* @__PURE__ */ new Date()).toISOString());
        set("LAST_ADDED", result.added);
        remove("LAST_ERROR");
        return result;
      } catch (error) {
        const code = String(error.message).match(/^(?:WRITE_UNCERTAIN|OWNER_MAP_INVALID|START_REQUIRED|BOT_TOKEN_MISSING|(?:TELEGRAM|SHEETS)_(?:NETWORK|RESPONSE|HTTP_\d+))\b/)?.[0] || "INTAKE_FAILED";
        set("LAST_ERROR", code);
        set("LAST_ERROR_AT", (/* @__PURE__ */ new Date()).toISOString());
        throw Error(code);
      }
    });
  }
  async function stop() {
    return locked(async () => {
      set("ENABLED", "false");
      for (const t of ScriptApp.getProjectTriggers()) if (t.getHandlerFunction() === HANDLER) ScriptApp.deleteTrigger(t);
      return { enabled: false };
    });
  }
  function check() {
    const pending = state().pending();
    return {
      enabled: get("ENABLED") === "true",
      groupId: GROUP_ID,
      bot: get("BOT_USERNAME"),
      lastSuccess: get("LAST_OK"),
      lastAdded: Number(get("LAST_ADDED") || 0),
      lastError: get("LAST_ERROR"),
      lastErrorAt: get("LAST_ERROR_AT"),
      pending: pending ? { id: pending.id, updateId: pending.updateId } : null
    };
  }
  async function retryPending() {
    return locked(async () => {
      const cursor = state(), pending = cursor.pending();
      if (!pending) return { pending: false };
      if (get("RETRY_PENDING_ID") !== pending.id) throw Error("CONFIRM_PENDING_ID_IN_SCRIPT_PROPERTIES");
      const sheet = new GoogleSheet(), snapshot = await sheet.read();
      const requests = appendRequests(snapshot, pending.task);
      if (requests.length) await sheet.request(":batchUpdate", { requests });
      cursor.setOffset(Math.max(cursor.offset(), pending.updateId + 1));
      cursor.clearPending();
      remove("RETRY_PENDING_ID");
      return { recovered: true };
    });
  }
  return __toCommonJS(entry_exports);
})();

async function prepareTelegramIntake(){const result=await TelegramTaskIntake.prepare();console.log(JSON.stringify(result));return result;}

async function startTelegramIntake(){const result=await TelegramTaskIntake.start();console.log(JSON.stringify(result));return result;}

async function pollTelegramTasks(){const result=await TelegramTaskIntake.run();console.log(JSON.stringify(result));return result;}

async function stopTelegramIntake(){const result=await TelegramTaskIntake.stop();console.log(JSON.stringify(result));return result;}

async function checkTelegramIntake(){const result=await TelegramTaskIntake.check();console.log(JSON.stringify(result));return result;}

async function retryPendingTelegramTask(){const result=await TelegramTaskIntake.retryPending();console.log(JSON.stringify(result));return result;}
