import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

/* Тема применяется до первой отрисовки, чтобы не мигнуть светлым в тёмной системе. */
const saved = localStorage.getItem("gg-theme");
if (saved === "light" || saved === "dark") document.documentElement.setAttribute("data-theme", saved);

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
