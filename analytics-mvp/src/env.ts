// Лёгкая загрузка .env без зависимостей (Node 22 умеет process.loadEnvFile).
import { existsSync } from "node:fs";

export function loadEnv(path = ".env"): void {
  if (existsSync(path)) {
    // @ts-ignore - доступно в Node 20.12+/22
    process.loadEnvFile(path);
  }
}

export function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Не задана переменная окружения ${name} (заполни .env по образцу .env.example)`);
  return v;
}
