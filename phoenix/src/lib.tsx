import { useEffect, useRef, useState, type ReactNode } from "react";

/* ---------- форматирование ---------- */
export const nf = new Intl.NumberFormat("ru-RU");
export const fmt = (n: number) => nf.format(Math.round(n));
export const pct = (n: number, d = 1) => n.toFixed(d).replace(".", ",") + "%";
export const dec = (n: number, d = 2) => n.toFixed(d).replace(".", ",");

/* ---------- появление при прокрутке ----------
   Один общий наблюдатель на страницу: дешевле, чем по одному на элемент. */
const seen = new WeakSet<Element>();
let io: IntersectionObserver | null = null;
function observer() {
  if (io) return io;
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !seen.has(e.target)) {
          seen.add(e.target);
          e.target.classList.add("in");
          e.target.dispatchEvent(new CustomEvent("reveal"));
          io!.unobserve(e.target);
        }
      }
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
  );
  return io;
}

export function useReveal<T extends HTMLElement>(delay = 0) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (delay) el.style.transitionDelay = `${delay}ms`;
    observer().observe(el);
    return () => observer().unobserve(el);
  }, [delay]);
  return ref;
}

export function Reveal({ children, delay = 0, as: As = "div", className = "" }:
  { children: ReactNode; delay?: number; as?: any; className?: string }) {
  const ref = useReveal<HTMLDivElement>(delay);
  return <As ref={ref} className={`rv ${className}`}>{children}</As>;
}

/* ---------- счётчик ----------
   Число доезжает до значения на out-quint. При prefers-reduced-motion
   показываем сразу конечное значение: анимация тут украшение, а не смысл. */
export function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const o = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); o.disconnect(); } },
      { threshold: 0.25 }
    );
    o.observe(el);
    return () => o.disconnect();
  }, []);
  return [ref, inView] as const;
}

export function Num({ v, dur = 1100, format = fmt, suffix = "", className = "" }:
  { v: number; dur?: number; format?: (n: number) => string; suffix?: string; className?: string }) {
  const [ref, inView] = useInView<HTMLSpanElement>();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setN(v); return; }
    let raf = 0; const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setN(v * (1 - Math.pow(1 - p, 5)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, v, dur]);
  return <span ref={ref} className={className}>{format(n)}{suffix}</span>;
}

/* ---------- метка источника ---------- */
export function T({ k, title }: { k: "d" | "h"; title?: string }) {
  return (
    <span className={`tag tag--${k}`} title={title ?? (k === "d" ? "Данные: цифра с указанным источником" : "Гипотеза: оценка или цель, требует проверки")}>
      {k === "d" ? "данные" : "гипотеза"}
    </span>
  );
}

/* ---------- шкалы для графиков ---------- */
export const scale = (d0: number, d1: number, r0: number, r1: number) =>
  (v: number) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);

/* «Красивый» верхний предел оси: не 150096, а 160000. */
export function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / (p / 2)) * (p / 2);
}

/* Русские окончания: «1 заявка», «2 заявки», «5 заявок».
   Без этого текст спотыкается на каждой единице и двойке. */
export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
export const zayavki = (n: number) => `${n} ${plural(n, "заявка", "заявки", "заявок")}`;
export const stranicy = (n: number) => `${n} ${plural(n, "страница", "страницы", "страниц")}`;
export const zaprosy = (n: number) => `${n} ${plural(n, "запрос", "запроса", "запросов")}`;
