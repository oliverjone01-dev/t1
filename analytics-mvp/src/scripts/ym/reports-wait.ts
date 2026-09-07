// Ожидание окна лимита Маркета. Вынесено отдельно, чтобы тестироваться без сети и без сна:
// вызывающий передаёт waitMs и функцию оставшегося времени.
//
// Живой факт 2026-09-07: продьюсер выходил на первом же 420, шаг реализации отрабатывал 1 мин 49 с,
// прогон использовал 10 минут из 120 доступных, и бэкфилл августа стоял на 0 из 7 магазинов. Лимит
// Маркета (1 генерация на 2 минуты на кабинет) надо ПЕРЕЖИДАТЬ, а не считать отказом.
import { isRateLimit } from "./reports-lib.js";

export const RATE_LIMITED = Symbol("rate-limited");
export interface WaitOpts { waitMs: number; timeLeft: () => number; sleep?: (ms: number) => Promise<void> }

export async function retryOnRateLimit<T>(fn: () => Promise<T>, what: string, o: WaitOpts): Promise<T | typeof RATE_LIMITED> {
  const sleep = o.sleep || ((ms: number) => new Promise<void>((res) => setTimeout(res, ms)));
  for (;;) {
    try { return await fn(); }
    catch (e) {
      if (!isRateLimit(e)) throw e;
      // Ждём только если после ожидания останется запас на саму генерацию (до 15 мин на отчёт).
      if (o.timeLeft() < o.waitMs + 60_000) {
        console.warn(`::warning::${what}: лимит Маркета, до дедлайна прогона ${Math.round(o.timeLeft() / 1000)} с - остальное доберёт следующий прогон`);
        return RATE_LIMITED;
      }
      console.log(`  ${what}: лимит Маркета, жду ${Math.round(o.waitMs / 1000)} с (до дедлайна ${Math.round(o.timeLeft() / 60000)} мин)`);
      await sleep(o.waitMs);
    }
  }
}
