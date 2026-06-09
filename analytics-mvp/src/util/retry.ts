// Повтор с экспоненциальной паузой. Чинит дыру, на которой падал n8n:
// первый же HTTP 429 от OZON ронял весь сбор (DOC_03 не имел ретраев).

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export interface RetryOpts {
  retries?: number;
  baseMs?: number;
  maxMs?: number;
  isRetryable?: (e: unknown) => boolean;
  onRetry?: (attempt: number, delayMs: number, e: unknown) => void;
  sleep?: (ms: number) => Promise<void>;
}

// Ретраим 429, 5xx и сетевые (без статуса). 4xx (кроме 429) - нет смысла.
export function defaultRetryable(e: unknown): boolean {
  if (e instanceof HttpError) return e.status === 429 || e.status >= 500;
  return true; // сетевая ошибка без статуса
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOpts = {}): Promise<T> {
  const retries = opts.retries ?? 5;
  const baseMs = opts.baseMs ?? 1000;
  const maxMs = opts.maxMs ?? 30000;
  const isRetryable = opts.isRetryable ?? defaultRetryable;
  const sleep = opts.sleep ?? realSleep;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt === retries || !isRetryable(e)) throw e;
      // экспонента + джиттер, но не выше maxMs
      const backoff = Math.min(maxMs, baseMs * 2 ** attempt);
      const jitter = Math.floor(Math.random() * (backoff / 4));
      const delay = backoff + jitter;
      opts.onRetry?.(attempt + 1, delay, e);
      await sleep(delay);
    }
  }
  throw lastErr;
}
