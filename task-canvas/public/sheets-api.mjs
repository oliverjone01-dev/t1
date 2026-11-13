import {
  SHEET_ID,
  TAB_ID,
  TELEGRAM_TAB_ID,
  combineSheets,
  decodeSheet,
  buildWriteRequests,
} from "./sync-model.mjs?rev=20261111-status-8";
import {readModeControl,modeWriteRequest,assertSheetWriter} from './storage-mode.mjs?rev=20261111-status-8';
import {taskClaim,isClaimCollision} from './sheets-claims.mjs?rev=20261111-status-8';
export class SheetsApi {
  constructor(
    auth,
    fetcher = (...args) => fetch(...args),
    beforeWrite = () => {},
  ) {
    this.auth = auth;
    this.fetcher = fetcher;
    this.beforeWrite = beforeWrite;
  }
  async request(path, body) {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 18000);
    try {
      const response = await this.fetcher(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}${path}`,
        {
          method: body ? "POST" : "GET",
          headers: {
            Authorization: `Bearer ${this.auth.getToken()}`,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
          redirect: "error",
          cache: "no-store",
        },
      );
      const data = await response.json();
      if (!response.ok) {
        const e = new Error(
          response.status === 401
            ? "Войдите в Google повторно."
            : response.status === 429
              ? "Google ограничил частоту запросов. Изменения остаются на устройстве."
              : data.error?.message ||
                `Google вернул ошибку ${response.status}.`,
        );
        e.status = response.status;
        e.auth = response.status === 401;
        if(e.auth)this.auth.invalidate?.();
        throw e;
      }
      return data;
    } catch (error) {
      if (error.name === "AbortError")
        throw new Error(
          "Google не ответил вовремя. Проверим результат перед повторной записью.",
        );
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  async read() {
    const metadata = await this.request(
      "?fields=spreadsheetId,sheets(properties)",
    );
    const tabs = metadata.sheets
        .map((s) => s.properties)
        .sort((a, b) => a.index - b.index),
      tab = tabs[0];
    if (tab?.sheetId !== TAB_ID)
      throw new Error(
        "Первой стала другая вкладка. Синхронизация остановлена, чтобы не изменить чужие данные.",
      );
    const telegram = tabs.find(t=>t.sheetId===TELEGRAM_TAB_ID);
    if(!telegram)throw new Error('Вкладка новых задач Telegram недоступна. Данные доски сохранены без усечения.');
    const snapshots=await Promise.all([tab,telegram].map(t=>this.readTab(t)));
    return combineSheets(...snapshots);
  }
  async readTab(tab) {
    if (tab.gridProperties.columnCount < 22)
      throw new Error("Служебные колонки таблицы ещё не настроены.");
    if (tab.gridProperties.rowCount > 2500)
      throw new Error(
        "Вкладка больше 2500 строк. Синхронизация остановлена без усечения данных.",
      );
    const range = `'${tab.title.replace(/'/g, "''")}'!A1:V${tab.gridProperties.rowCount}`;
    const params = new URLSearchParams({
      ranges: range,
      fields:
        "sheets(data(startRow,rowData(values(userEnteredValue,effectiveValue,formattedValue,dataValidation,userEnteredFormat,chipRuns))))",
    });
    const data = await this.request(`?${params}`),
      grid = data.sheets?.[0]?.data?.[0];
    const rows = Array.from({ length: tab.gridProperties.rowCount }, () => []);
    (grid?.rowData || []).forEach(
      (row, i) => (rows[(grid.startRow || 0) + i] = row.values || []),
    );
    return decodeSheet({
      sheetId: tab.sheetId,
      rows,
      title: tab.title,
      rowCount: tab.gridProperties.rowCount,
    });
  }
  async readStorageControl() {
    const data=await this.request(':getByDataFilter?fields=sheets(data(startRow,startColumn,rowData(values(formattedValue,userEnteredValue))))',{dataFilters:[{gridRange:{sheetId:TAB_ID,startRowIndex:1,endRowIndex:2,startColumnIndex:16,endColumnIndex:18}}],includeGridData:true});
    const grid=data.sheets?.[0]?.data?.[0],rows=[[],[]];
    for(const [i,cell] of (grid?.rowData?.[0]?.values||[]).entries())rows[1][(grid.startColumn??16)+i]=cell;
    return readModeControl(rows);
  }
  async requestStorageMode(mode,by) {
    const value={schema:1,mode,epoch:crypto.randomUUID(),at:Date.now(),by};
    await this.request(':batchUpdate',{requests:[modeWriteRequest(16,value,TAB_ID)]});return value;
  }
  async acknowledgeStorageMode(request) {
    await this.request(':batchUpdate',{requests:[modeWriteRequest(17,{schema:1,mode:request.mode,epoch:request.epoch,at:Date.now()},TAB_ID)]});
  }
  async ensureTeamProtocol(snapshot) {
    const cell=snapshot.rows?.[2]?.[17];
    if((cell?.formattedValue||cell?.userEnteredValue?.stringValue)==='Позиции · команда v3')return;
    this.beforeWrite();
    await this.request(':batchUpdate',{requests:[{updateCells:{range:{sheetId:TAB_ID,startRowIndex:2,endRowIndex:3,startColumnIndex:17,endColumnIndex:18},rows:[{values:[{userEnteredValue:{stringValue:'Позиции · команда v3'}}]}],fields:'userEnteredValue'}}]});
  }
  async write(snapshot, writes, owners) {
    const requests = buildWriteRequests(snapshot, writes, owners);
    if (!requests.length) return;
    this.beforeWrite();
    await this.request(":batchUpdate", { requests });
  }
}

export class DirectSheetsApi extends SheetsApi {
  async write(snapshot,writes,owners){
    assertSheetWriter(await this.readStorageControl());
    const requests=buildWriteRequests(snapshot,writes,owners);
    if(!requests.length)return;
    const existing=new Set(snapshot.records.map(r=>r.id));
    const created=[...new Set(writes.filter(w=>w.type!=='archive'&&!existing.has(w.id)).map(w=>w.id))];
    const claims=await Promise.all(created.map(id=>taskClaim(id,TAB_ID)));
    this.beforeWrite();
    try{return await this.request(':batchUpdate',{requests:[...claims,...requests]})}
    catch(error){
      if(!claims.length||!isClaimCollision(error))throw error;
      // The whole batch was rejected, including unrelated cell edits. Reread
      // before asking the engine to merge; never acknowledge the rejected batch.
      const fresh=await this.read(),present=new Set(fresh.records.map(r=>r.id));
      if(created.some(id=>present.has(id)))throw Object.assign(new Error('Задача уже сохранена с другого устройства. Сверяем правки.'),{retryMerge:true});
      throw new Error('Повреждены служебные записи: ID задачи зарезервирован, но строка не найдена. Правки сохранены на устройстве; восстановите строку в таблице.');
    }
  }
}
