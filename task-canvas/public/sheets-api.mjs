import {
  SHEET_ID,
  TAB_ID,
  decodeSheet,
  buildWriteRequests,
} from "./sync-model.mjs?rev=20261106-team-1";
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
      rows,
      title: tab.title,
      rowCount: tab.gridProperties.rowCount,
    });
  }
  async write(snapshot, writes, owners) {
    const requests = buildWriteRequests(snapshot, writes, owners);
    if (!requests.length) return;
    this.beforeWrite();
    await this.request(":batchUpdate", { requests });
  }
}
