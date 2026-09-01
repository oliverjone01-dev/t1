import { useEffect, useState, useCallback } from "react";
import * as S from "./sections";
import { MEASURED } from "./data";

/* Заглушка от случайных глаз. Не криптография: внутри страницы нет ничего,
   что нельзя показать команде, но финансовые цифры не должны открываться
   по прямой ссылке кому попало. Хэш тот же, что у хаба GEO-MONSTER. */
const HASH = "2ef8f96e6281d75d01cec0c80866292dbeff89683f008467ab13fae421a5f868";
const KEY = "gg-phoenix-open";

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function Gate({ onOpen }: { onOpen: () => void }) {
  const [v, setV] = useState("");
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await sha256(v.trim()) === HASH) { sessionStorage.setItem(KEY, "1"); onOpen(); }
    else setErr("Неверный пароль");
  };
  return (
    <div className="gate">
      <div className="gate__box">
        <div className="gate__mark">GENGROUP · внутренний документ</div>
        <h1>Перегородки</h1>
        <p>Разбор направления и план действий. Замер {MEASURED}. Внутри финансовые цифры, поэтому вход по паролю.</p>
        <form onSubmit={submit}>
          <input type="password" value={v} autoFocus autoComplete="current-password"
            onChange={(e) => { setV(e.target.value); setErr(""); }} placeholder="Пароль" aria-label="Пароль" />
          <button className="btn" type="submit">Открыть</button>
        </form>
        <div className="gate__err" role="alert">{err}</div>
      </div>
    </div>
  );
}

type Theme = "light" | "dark" | "system";

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try { return (localStorage.getItem("gg-theme") as Theme) ?? "system"; } catch { return "system"; }
  });
  useEffect(() => {
    const r = document.documentElement;
    if (theme === "system") r.removeAttribute("data-theme");
    else r.setAttribute("data-theme", theme);
    try { localStorage.setItem("gg-theme", theme); } catch { /* приватный режим - просто не запоминаем */ }
  }, [theme]);
  const cycle = () => setTheme(theme === "system" ? "light" : theme === "light" ? "dark" : "system");
  const label = theme === "system" ? "тема: как в системе" : theme === "light" ? "тема: светлая" : "тема: тёмная";
  const short = theme === "system" ? "тема: авто" : theme === "light" ? "тема: свет" : "тема: тьма";
  return { cycle, label, short };
}

/* Узкий экран: рельса не влезает, но навигация нужна. Родной список разделов
   открывается системным выбором - быстрее и доступнее любого своего меню. */
function TopBar({ active, progress }: { active: string; progress: number }) {
  const { cycle, short } = useTheme();
  return (
    <div className="topbar">
      <span className="topbar__mark">GENGROUP</span>
      <select value={active} aria-label="Перейти к разделу"
        onChange={(e) => document.getElementById(e.target.value)?.scrollIntoView({ block: "start" })}>
        {S.SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.n} · {s.t}</option>)}
      </select>
      <button onClick={cycle}>{short}</button>
      <div className="topbar__prog"><span style={{ transform: `scaleX(${progress})` }} /></div>
    </div>
  );
}

function Rail({ active, progress }: { active: string; progress: number }) {
  const { cycle, label } = useTheme();
  return (
    <nav className="rail" aria-label="Разделы отчёта">
      <div className="rail__mark">GENGROUP</div>
      <div className="rail__prog"><span style={{ transform: `scaleX(${progress})` }} /></div>
      <div className="rail__nav">
        {S.SECTIONS.map((s) => (
          <button key={s.id} className="rail__link" aria-current={active === s.id}
            onClick={() => document.getElementById(s.id)?.scrollIntoView({ block: "start" })}>
            <i>{s.n}</i><span>{s.t}</span>
          </button>
        ))}
      </div>
      <div className="rail__foot">
        <button className="themebtn" onClick={cycle}>{label}</button>
        <button className="themebtn" onClick={() => window.print()}>распечатать</button>
        <a className="themebtn" href="../seo/" style={{ textDecoration: "none" }}>← в хаб GEO-MONSTER</a>
      </div>
    </nav>
  );
}

export default function App() {
  const [open, setOpen] = useState(() => sessionStorage.getItem(KEY) === "1");
  const [active, setActive] = useState(S.SECTIONS[0].id);
  const [progress, setProgress] = useState(0);

  const onScroll = useCallback(() => {
    const h = document.documentElement;
    setProgress(Math.min(1, h.scrollTop / (h.scrollHeight - h.clientHeight || 1)));
    let cur = S.SECTIONS[0].id;
    for (const s of S.SECTIONS) {
      const el = document.getElementById(s.id);
      if (el && el.getBoundingClientRect().top <= 140) cur = s.id;
    }
    setActive(cur);
  }, []);

  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const h = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(onScroll); };
    window.addEventListener("scroll", h, { passive: true });
    onScroll();
    return () => { window.removeEventListener("scroll", h); cancelAnimationFrame(raf); };
  }, [open, onScroll]);

  if (!open) return <Gate onOpen={() => setOpen(true)} />;

  return (
    <div className="shell">
      <Rail active={active} progress={progress} />
      <main className="main">
        <TopBar active={active} progress={progress} />
        <S.Hero />
        <S.Glavnoe /><S.Zayavki /><S.Dengi /><S.Poisk /><S.Rynok /><S.Obyavleniya />
        <S.Cena /><S.Neiroseti /><S.PlanIyul /><S.PlanSentyabr /><S.Stop /><S.Neizvestno />
        <S.Foot />
      </main>
    </div>
  );
}
