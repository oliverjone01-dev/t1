// Локальное хранилище (SQLite). История с пола данных, идемпотентный upsert.
// Натуральные ключи (date+sku) -> повтор синка за дату не плодит дубли (DOC_05 §7, ТЗ §5).

import Database from "better-sqlite3";
import type { SkuDaily, PriceSnap, StockSnap, Window } from "./types.js";

export class Store {
  private db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS fct_sku_daily (
        date TEXT NOT NULL,
        sku TEXT NOT NULL,
        offer_id TEXT,
        name TEXT,
        line TEXT,
        revenue REAL DEFAULT 0,
        units REAL DEFAULT 0,
        views REAL DEFAULT 0,
        to_cart REAL DEFAULT 0,
        delivered REAL DEFAULT 0,
        returns REAL DEFAULT 0,
        cancellations REAL DEFAULT 0,
        PRIMARY KEY (date, sku)
      );
      CREATE TABLE IF NOT EXISTS snap_price (
        date TEXT NOT NULL,
        sku TEXT NOT NULL,
        price_index_value REAL,
        color_index TEXT,
        PRIMARY KEY (date, sku)
      );
      CREATE TABLE IF NOT EXISTS snap_stock (
        date TEXT NOT NULL,
        sku TEXT NOT NULL,
        present REAL DEFAULT 0,
        reserved REAL DEFAULT 0,
        PRIMARY KEY (date, sku)
      );
      CREATE TABLE IF NOT EXISTS reconciled_pnl (
        period_month TEXT PRIMARY KEY,
        realization REAL,
        net_profit REAL,
        source TEXT DEFAULT 'signed_act'
      );
    `);
  }

  upsertSkuDaily(rows: SkuDaily[]): number {
    const stmt = this.db.prepare(`
      INSERT INTO fct_sku_daily
        (date, sku, offer_id, name, line, revenue, units, views, to_cart, delivered, returns, cancellations)
      VALUES
        (@date, @sku, @offer_id, @name, @line, @revenue, @units, @views, @to_cart, @delivered, @returns, @cancellations)
      ON CONFLICT(date, sku) DO UPDATE SET
        offer_id=excluded.offer_id, name=excluded.name, line=excluded.line,
        revenue=excluded.revenue, units=excluded.units, views=excluded.views,
        to_cart=excluded.to_cart, delivered=excluded.delivered,
        returns=excluded.returns, cancellations=excluded.cancellations
    `);
    const tx = this.db.transaction((rs: SkuDaily[]) => {
      for (const r of rs) stmt.run(r);
    });
    tx(rows);
    return rows.length;
  }

  upsertPrice(rows: PriceSnap[]): number {
    const stmt = this.db.prepare(`
      INSERT INTO snap_price (date, sku, price_index_value, color_index)
      VALUES (@date, @sku, @price_index_value, @color_index)
      ON CONFLICT(date, sku) DO UPDATE SET
        price_index_value=excluded.price_index_value, color_index=excluded.color_index
    `);
    const tx = this.db.transaction((rs: PriceSnap[]) => {
      for (const r of rs) stmt.run(r);
    });
    tx(rows);
    return rows.length;
  }

  upsertStock(rows: StockSnap[]): number {
    const stmt = this.db.prepare(`
      INSERT INTO snap_stock (date, sku, present, reserved)
      VALUES (@date, @sku, @present, @reserved)
      ON CONFLICT(date, sku) DO UPDATE SET
        present=excluded.present, reserved=excluded.reserved
    `);
    const tx = this.db.transaction((rs: StockSnap[]) => {
      for (const r of rs) stmt.run(r);
    });
    tx(rows);
    return rows.length;
  }

  // Сырые дневные строки SKU за окно (для витрины и сравнения периодов).
  skuDailyInWindow(w: Window): SkuDaily[] {
    return this.db
      .prepare(`SELECT * FROM fct_sku_daily WHERE date >= ? AND date <= ? ORDER BY date, sku`)
      .all(w.from, w.to) as SkuDaily[];
  }

  countSkuDaily(): number {
    return (this.db.prepare(`SELECT COUNT(*) AS n FROM fct_sku_daily`).get() as { n: number }).n;
  }

  // Даты, по которым уже есть данные - чекпойнт для идемпотентного бэкфилла (S3).
  distinctDates(): string[] {
    return (this.db.prepare(`SELECT DISTINCT date FROM fct_sku_daily ORDER BY date`).all() as { date: string }[])
      .map((r) => r.date);
  }

  // Вся история строк - для экспорта в текстовый снапшот (персистентность в Git).
  allSkuDaily(): SkuDaily[] {
    return this.db.prepare(`SELECT * FROM fct_sku_daily ORDER BY date, sku`).all() as SkuDaily[];
  }

  // Дневной оборот - для DQ-проверки на провал объёма.
  dailyRevenue(): Array<{ date: string; revenue: number }> {
    return this.db
      .prepare(`SELECT date, SUM(revenue) AS revenue FROM fct_sku_daily GROUP BY date ORDER BY date`)
      .all() as Array<{ date: string; revenue: number }>;
  }

  close(): void {
    this.db.close();
  }
}
