import {
  validateBoard,
  fromSheet,
  parseDeadline,
} from "./model.mjs?rev=20261109-telegram-tabs-1";
import { parseAssignee } from "./people.mjs?rev=20261109-telegram-tabs-1";
export const SHEET_ID = "1qh-pi5I76k8ssUc6DxjeytFDrAta1N4ZdmVjaUFCUYY";
export const TAB_ID = 1102202601;
export const TELEGRAM_TAB_ID = 1478506234;
export const SERVICE_HEADERS = [
  "Приоритет · доска",
  "Позиции · доска",
  "ID карточки",
  "Архив · доска",
  "Ответственный · источник",
  "Срок · источник",
];
export const SYNC_FIELDS = [
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
];
export const FIELD_NAMES = {
  title: "Задача",
  unit: "Юнит",
  direction: "Направление",
  description: "Ожидаемый результат",
  status: "Статус",
  owner: "Ответственный",
  due: "Срок",
  comment: "Комментарий",
  priority: "Приоритет",
  positions: "Расположение",
  task: "Задача целиком",
};
export const PRIORITY_LABELS = {
  do: "Важно · срочно",
  plan: "Важно · не срочно",
  delegate: "Не важно · срочно",
  later: "Не важно · не срочно",
};
export const COLUMNS = {
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
};
// Firestore map field order is not significant. Preserve array order and the
// original JSON treatment of undefined, but never manufacture a Sheet edit
// merely because the server serialized map keys in a different order.
const canonical = value => {
  if(value && typeof value.toJSON==='function')return canonical(value.toJSON());
  if(Array.isArray(value))return value.map(canonical);
  if(value && typeof value==='object')return Object.fromEntries(Object.keys(value).filter(k=>value[k]!==undefined&&typeof value[k]!=='function'&&typeof value[k]!=='symbol').sort().map(k=>[k,canonical(value[k])]));
  return value;
};
export const equal = (a,b) => JSON.stringify(canonical(a??null))===JSON.stringify(canonical(b??null));
export const comparable = (t) =>
  t
    ? Object.fromEntries(
        SYNC_FIELDS.map((k) => [
          k,
          k === "positions"
            ? t[k] || {}
            : (t[k] ?? (k === "priority" ? null : "")),
        ]),
      )
    : null;
export function decodeSheet(sheet, year = new Date().getFullYear()) {
  const rows = sheet.rows;
  const textRows = rows.map((r) =>
    r.map((c) =>
      String(
        c.formattedValue ??
          c.userEnteredValue?.stringValue ??
          c.userEnteredValue?.numberValue ??
          "",
      ),
    ),
  );
  const headers = textRows[2]?.slice(16, 22);
  if (
    !equal(headers, SERVICE_HEADERS) &&
    !equal(headers,SERVICE_HEADERS.map((value,index)=>index===1?'Позиции · команда v3':value)) &&
    !equal(
      headers,
      SERVICE_HEADERS.map((value, index) =>
        index === 1 ? "Позиции · команда v2" : value,
      ),
    )
  )
    throw new Error(
      "Служебные колонки таблицы не настроены. Рабочие данные не изменены.",
    );
  const seen = new Set(),
    records = [];
  for (let index = 3; index < rows.length; index++) {
    const raw = textRows[index];
    if (!raw[0] && !raw[2] && !raw[6] && !raw[18]) continue;
    if (!raw[2] && !raw[6]) continue; // Empty ID placeholders are not tasks.
    if (!raw[0] && !raw[18])
      throw new Error(
        `У задачи в строке ${index + 1} нет ID. Укажите его в таблице.`,
      );
    const id = raw[18] || `sheet-${raw[0]}`;
    if (seen.has(id))
      throw new Error(
        `В таблице повторяется ID карточки: ${id}. Синхронизация остановлена.`,
      );
    seen.add(id);
    const source = raw.slice(0, 16);
    source[0] ||= id;
    const valueRows = [textRows[2].slice(0, 16), source];
    const task = fromSheet(valueRows, year)[0];
    if (!task) continue;
    task.id = id;
    task.sourceId = raw[0] || "";
    const priority = raw[16] || "";
    task.priority =
      Object.entries(PRIORITY_LABELS).find(
        ([key, label]) => priority === label || priority === key,
      )?.[0] || null;
    if (priority && priority !== "Входящие" && !task.priority)
      throw new Error(`Неизвестный приоритет в строке ${index + 1}.`);
    try {
      task.positions = raw[17] ? JSON.parse(raw[17]) : {};
    } catch {
      throw new Error(`Повреждены позиции карточки в строке ${index + 1}.`);
    }
    task.owner = parseAssignee(raw[10] || "") || "";
    task.ownerNote = raw[20] || raw[10] || "";
    task.dueNote = raw[21] || raw[11] || "";
    const dueCell = rows[index][11];
    if (
      ["DATE", "DATE_TIME"].includes(
        dueCell?.userEnteredFormat?.numberFormat?.type,
      ) &&
      typeof dueCell.effectiveValue?.numberValue === "number"
    ) {
      task.due = new Date(
        Date.UTC(1899, 11, 30) +
          Math.floor(dueCell.effectiveValue.numberValue) * 86400000,
      )
        .toISOString()
        .slice(0, 10);
    } else task.due = parseDeadline(raw[11] || "", year);
    const archived =
      /^(true|да|1)$/i.test(raw[19] || "") ||
      rows[index][19]?.effectiveValue?.boolValue === true;
    records.push({
      id,
      sheetId: sheet.sheetId ?? TAB_ID,
      row: index,
      cells: rows[index],
      task: validateBoard([task])[0],
      archived,
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
      throw new Error("Повреждены настройки дорожек в ячейке R1.");
    }
  }
  return {
    ...sheet,
    records,
    board: {
      tasks: records.filter((r) => !r.archived).map((r) => r.task),
      owners,
    },
  };
}
export function combineSheets(primary, telegram) {
  const records = [...primary.records, ...telegram.records];
  if (new Set(records.map(r => r.id)).size !== records.length)
    throw new Error('ID карточки повторяется в двух вкладках. Устраните дубль в таблице.');
  return {...primary, records, sourceTabs:[TAB_ID,TELEGRAM_TAB_ID], board:{
    tasks:validateBoard(records.filter(r=>!r.archived).map(r=>r.task)),
    owners:primary.board.owners,
  }};
}
export function bootstrapBoard(local, remote) {
  const localMap = new Map(local.tasks.map((t) => [t.id, t]));
  const remoteIds = new Set(remote.tasks.map((t) => t.id));
  const tasks = remote.tasks.map((task) => {
    const existing = localMap.get(task.id);
    if (!existing) return task;
    return {
      ...task,
      priority: task.priority || existing.priority || null,
      positions: Object.keys(task.positions || {}).length
        ? task.positions
        : existing.positions || {},
    };
  });
  // Locally created cards survive first connection; source records removed in Sheets do not reappear.
  for (const task of local.tasks)
    if (
      !remoteIds.has(task.id) &&
      !task.id.startsWith("sheet-") &&
      !task.id.startsWith("example-")
    )
      tasks.push(task);
  return {
    tasks: validateBoard(tasks),
    owners: [...new Set([...remote.owners, ...local.owners])],
  };
}
export function mergeBoards(base, local, remote) {
  const maps = [base, local, remote].map(
    (b) => new Map(b.tasks.map((t) => [t.id, t])),
  );
  const ids = [
    ...new Set([
      ...remote.tasks.map((t) => t.id),
      ...local.tasks.map((t) => t.id),
      ...base.tasks.map((t) => t.id),
    ]),
  ];
  const tasks = [],
    conflicts = [],
    writes = [];
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
          remote: r || null,
        });
      }
      continue;
    }
    const merged = { ...r },
      fields = [];
    for (const field of SYNC_FIELDS) {
      const bv = comparable(b)?.[field],
        lv = comparable(l)[field],
        rv = comparable(r)[field];
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
          remote: rv,
        });
      }
    }
    tasks.push(merged);
    if (fields.length) writes.push({ id, type: "patch", fields, task: merged });
  }
  return {
    board: {
      tasks: validateBoard(tasks),
      owners: [...new Set([...remote.owners, ...local.owners])],
    },
    conflicts,
    writes,
  };
}
export function cellValue(field, value) {
  if (field === "priority") return value ? PRIORITY_LABELS[value] : "";
  if (field === "positions") return JSON.stringify(value || {});
  if (field === "due") return value ? value.split("-").reverse().join(".") : "";
  if (field === "unit") return value ? `${value} / ` : "";
  if (field === "status" && (!value || value === "Не указан")) return "";
  return value || "";
}
export function buildWriteRequests(snapshot, writes, owners) {
  const requests = [],
    byId = new Map(snapshot.records.map((r) => [r.id, r]));
  let targetSheetId = TAB_ID;
  const cell = (row, col, value) =>
    requests.push({
      updateCells: {
        start: { sheetId: targetSheetId, rowIndex: row, columnIndex: col },
        rows: [
          {
            values: [
              {
                userEnteredValue:
                  typeof value === "boolean"
                    ? { boolValue: value }
                    : value === ""
                      ? undefined
                      : { stringValue: String(value) },
              },
            ],
          },
        ],
        fields: "userEnteredValue",
      },
    });
  for (const write of writes) {
    const record = byId.get(write.id);
    targetSheetId = record?.sheetId ?? (write.id.startsWith('tg-') ? TELEGRAM_TAB_ID : TAB_ID);
    if (![TAB_ID, TELEGRAM_TAB_ID].includes(targetSheetId)) throw new Error('Неизвестная вкладка задачи.');
    if (write.type === "archive") {
      if (record) cell(record.row, 19, true);
      continue;
    }
    const fields = write.type === "upsert" ? SYNC_FIELDS : write.fields;
    if (
      fields.includes("owner") &&
      write.task.owner &&
      parseAssignee(write.task.owner) === null
    )
      throw new Error("Укажите одного ответственного без пояснений.");
    if (record) {
      if (!record.cells[18]?.formattedValue) cell(record.row, 18, write.id);
      if (record.archived) cell(record.row, 19, false);
      for (const field of fields) {
        const col = COLUMNS[field];
        if (col === undefined) continue;
        const existing = record.cells[col] || {};
        if (existing.chipRuns?.length)
          throw new Error(
            `Поле «${FIELD_NAMES[field]}» содержит умную метку. Измените его в таблице.`,
          );
        if (existing.userEnteredValue?.formulaValue)
          throw new Error(
            `Поле «${FIELD_NAMES[field]}» строки ${record.row + 1} содержит формулу. Измените его в таблице.`,
          );
        const value = cellValue(field, write.task[field]);
        if (field === "owner" && value && parseAssignee(value) === null)
          throw new Error(
            "Укажите одного ответственного без пояснений. Дополнительный текст сохраните в комментарии.",
          );
        const rule = existing.dataValidation;
        if (
          value &&
          rule?.strict &&
          rule.condition?.type === "ONE_OF_LIST" &&
          !rule.condition.values.some((v) => v.userEnteredValue === value)
        )
          throw new Error(
            `Значение «${value}» не разрешено в строке ${record.row + 1}.`,
          );
        if (field === "owner" && !record.cells[20]?.formattedValue)
          cell(record.row, 20, record.cells[10]?.formattedValue || "");
        if (field === "due" && !record.cells[21]?.formattedValue)
          cell(record.row, 21, record.cells[11]?.formattedValue || "");
        cell(record.row, col, value);
      }
    } else {
      const template = snapshot.records.find(r=>(r.sheetId??TAB_ID)===targetSheetId)?.cells || [];
      const values = Array.from({ length: 22 }, (_, col) => ({
        userEnteredFormat: template[col]?.userEnteredFormat || {},
        ...(template[col]?.dataValidation
          ? { dataValidation: template[col].dataValidation }
          : {}),
      }));
      const set = (col, value) =>
        (values[col].userEnteredValue =
          typeof value === "boolean"
            ? { boolValue: value }
            : { stringValue: String(value || "") });
      set(0, write.task.sourceId || `Д-${write.id.slice(0, 8)}`);
      set(4, write.task.link);
      set(5, write.task.requester);
      set(12, write.task.dependency);
      for (const field of SYNC_FIELDS)
        if (COLUMNS[field] !== undefined)
          set(COLUMNS[field], cellValue(field, write.task[field]));
      values[3].userEnteredValue = {
        formulaValue: '=INDIRECT("B"&ROW())&INDIRECT("C"&ROW())',
      };
      set(18, write.id);
      set(19, false);
      set(20, write.task.ownerNote);
      set(21, write.task.dueNote);
      requests.push({
        appendCells: {
          sheetId: targetSheetId,
          rows: [{ values }],
          fields: "userEnteredValue,userEnteredFormat,dataValidation",
        },
      });
    }
  }
  targetSheetId = TAB_ID;
  if (
    !equal(
      [...new Set(owners)].sort(),
      [...new Set(snapshot.board.owners)].sort(),
    )
  )
    cell(0, 17, JSON.stringify({ version: 1, owners: [...new Set(owners)] }));
  return requests;
}
