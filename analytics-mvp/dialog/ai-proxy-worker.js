// Cloudflare Worker: прокси к Anthropic для кнопки «Получить разбор» на /dialog/.
// Смысл: ключ Anthropic лежит В СЕКРЕТЕ ВОРКЕРА (env.ANTHROPIC_API_KEY), а не в браузере.
// Страница шлёт сюда тело запроса без ключа; воркер добавляет ключ и передаёт в Anthropic.
//
// ДЕПЛОЙ (2 минуты, бесплатный тариф):
//   1. Cloudflare → Workers & Pages → Create → Worker → вставить этот код → Deploy.
//   2. Worker → Settings → Variables and Secrets → Add → Secret:
//        имя  ANTHROPIC_API_KEY   значение  sk-ant-...   → Save/Deploy.
//   3. Скопировать URL воркера (вида https://<name>.<sub>.workers.dev).
//   4. Вставить этот URL в поле «URL прокси-разбора» на панели /dialog/ (хранится в браузере),
//      либо прислать мне - вшью в страницу, поле уберём.
//
// Защита от использования как открытый релей Anthropic:
//   - CORS/Origin: принимаем только с нашего дашборда (github.io).
//   - Модель из белого списка, max_tokens ограничен.
//   - Плюс поставьте ЛИМИТ РАСХОДА на сам ключ в Anthropic Console (бэкстоп по деньгам).

const ALLOWED_ORIGIN = "https://oliverjone01-dev.github.io";
const ALLOWED_MODELS = new Set(["claude-sonnet-5", "claude-haiku-4-5"]);
const MAX_TOKENS_CAP = 12000;

export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
      "Vary": "Origin",
    };
    const json = (obj, status) => new Response(JSON.stringify(obj), { status: status || 200, headers: { ...cors, "content-type": "application/json" } });

    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return json({ error: { message: "POST only" } }, 405);

    const origin = req.headers.get("Origin") || "";
    if (origin && origin !== ALLOWED_ORIGIN) return json({ error: { message: "forbidden origin" } }, 403);
    if (!env.ANTHROPIC_API_KEY) return json({ error: { message: "proxy: секрет ANTHROPIC_API_KEY не задан в воркере" } }, 500);

    let body;
    try { body = await req.json(); } catch { return json({ error: { message: "bad json" } }, 400); }

    const model = String(body.model || "claude-sonnet-5");
    if (!ALLOWED_MODELS.has(model)) return json({ error: { message: "model not allowed: " + model } }, 400);
    const max_tokens = Math.min(Number(body.max_tokens) || 8000, MAX_TOKENS_CAP);
    if (!Array.isArray(body.messages) || !body.messages.length) return json({ error: { message: "messages required" } }, 400);

    const payload = { model, max_tokens, system: body.system, messages: body.messages };
    let r;
    try {
      r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      return json({ error: { message: "upstream fetch failed: " + (e && e.message || e) } }, 502);
    }
    const txt = await r.text();
    return new Response(txt, { status: r.status, headers: { ...cors, "content-type": "application/json" } });
  },
};
