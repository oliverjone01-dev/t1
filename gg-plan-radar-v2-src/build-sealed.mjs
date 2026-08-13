#!/usr/bin/env node
// Сборка запечатанной v2: исходник -> AES-256-GCM payload в gate-обёртке.
// Запуск: node gg-plan-radar-v2-src/build-sealed.mjs "<пароль>"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { seal } from "../.claude/skills/kostya-ai/scripts/seal.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const password = process.argv[2];
if (!password || password.length < 12) {
  console.error('Пароль обязателен и не короче 12 знаков: node build-sealed.mjs "<пароль>"');
  process.exit(1);
}

const src = readFileSync(join(here, "index.html"), "utf8");
// Payload = стили из head + всё содержимое body (включая скрипты - гейт их пересоздаёт).
const style = src.match(/<style>[\s\S]*?<\/style>/)[0];
const body = src.match(/<body>([\s\S]*)<\/body>/)[1];
const payload = style + "\n" + body;

const gate = readFileSync(join(root, ".claude/skills/kostya-ai/scripts/gate.html"), "utf8");
const sealed = await seal(new TextEncoder().encode(payload), password);
const out = gate
  .replaceAll("__TITLE__", "План-Радар v2 · отдел продаж GENGLASS")
  .replaceAll("__SUBTITLE__", "Калькулятор плана с разбивкой по менеджерам. Внутри персональные данные - доступ по паролю отдела.")
  .replaceAll("учебная платформа", "план-радар")
  .replaceAll("academy_pw", "planradar_pw")
  .replace("__SEALED__", JSON.stringify(sealed));

mkdirSync(join(root, "genglass-plan-calculator/v2"), { recursive: true });
writeFileSync(join(root, "genglass-plan-calculator/v2/index.html"), out);
console.error("запечатано: " + payload.length + " байт -> genglass-plan-calculator/v2/index.html");
