import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

/* Тема применяется до первой отрисовки, чтобы не мигнуть светлым в тёмной системе. */
try {
  const saved = localStorage.getItem("gg-theme");
  if (saved === "light" || saved === "dark") document.documentElement.setAttribute("data-theme", saved);
} catch { /* приватный режим или блокировка хранилища: остаёмся на системной теме */ }

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
