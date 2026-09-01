import { useReveal, fmt, pct, dec, scale, niceMax, zayavki, stranicy } from "./lib";
import * as D from "./data";

/* Обёртка графика: заголовок, полотно, сноска. Класс rv включает анимацию
   ровно один раз, когда график впервые попал в кадр. */
function Frame({ title, note, children, h = 260 }:
  { title: string; note?: string; children: React.ReactNode; h?: number }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <figure className="chart rv" ref={ref}>
      <figcaption className="chart__t">{title}</figcaption>
      <div className="chart__scroll" style={{ minHeight: h }}>{children}</div>
      {note && <p className="chart__n">{note}</p>}
    </figure>
  );
}

const C = {
  brass: "var(--brass)", oxide: "var(--oxide)", moss: "var(--moss)", slate: "var(--slate)",
  rule: "var(--rule)", ink: "var(--ink)", ink3: "var(--ink-3)",
  soft: { oxide: "var(--oxide-soft)", moss: "var(--moss-soft)", slate: "var(--slate-soft)", brass: "color-mix(in oklch, var(--brass) 22%, transparent)" },
};

/* ====== 1. Заявки по каналам ======
   Две панели с РАЗНЫМИ величинами и своими осями: визиты и доля обращений.
   Раньше доля рисовалась увеличенной в десять раз поверх оси, размеченной в визитах,
   и кончик полосы садился на подписанное деление как будто это визиты. Читалось неверно. */
export function ChannelBars() {
  const W = 760, rowH = 46, pad = 168, gap = 30, top = 30;
  const H = top + D.CHANNELS.length * rowH + 8;
  const visMax = niceMax(D.CHANNELS[0].visits);
  // Верх шкалы берём из самих данных: при следующем замере с долей выше 5%
  // полоса иначе молча уехала бы за пределы полотна.
  const crMax = Math.max(5, Math.ceil(Math.max(...D.CHANNELS.map((c) => (c.leads / c.visits) * 100))));
  const visRight = 470, crLeft = visRight + gap;    // граница двух панелей
  const xv = scale(0, visMax, pad, visRight - 84);
  const xc = scale(0, crMax, crLeft, W - 58);
  return (
    <Frame
      title="Откуда приходят заявки за 30 дней"
      note="Слева визиты, справа доля визитов, закончившихся заявкой. Это две разные величины, поэтому у каждой своя шкала и своя половина полотна: длину полос слева и справа между собой сравнивать нельзя."
      h={H}
    >
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Каналы: визиты и доля обращений">
        <text className="ax" x={pad} y={top - 18} fill="var(--ink-2)">визиты</text>
        <text className="ax" x={crLeft} y={top - 18} fill="var(--ink-2)">доля визитов с заявкой</text>
        {[0, visMax / 2, visMax].map((t, i) => (
          <g key={"v" + i}>
            <line className="grid" x1={xv(t)} y1={top - 8} x2={xv(t)} y2={H - 14} />
            <text className="ax" x={xv(t)} y={top - 2} textAnchor={i === 2 ? "end" : "middle"}>{fmt(t)}</text>
          </g>
        ))}
        {[0, crMax].map((t, i) => (
          <g key={"c" + i}>
            <line className="grid" x1={xc(t)} y1={top - 8} x2={xc(t)} y2={H - 14} />
            <text className="ax" x={xc(t)} y={top - 2} textAnchor="middle">{pct(t, 0)}</text>
          </g>
        ))}
        {D.CHANNELS.map((c, i) => {
          const y = top + i * rowH;
          const cr = (c.leads / c.visits) * 100;
          const col = c.accent === "moss" ? C.moss : c.accent === "oxide" ? C.oxide : C.slate;
          const soft = c.accent === "moss" ? C.soft.moss : c.accent === "oxide" ? C.soft.oxide : C.soft.slate;
          return (
            <g key={c.key} style={{ ["--i" as string]: i }}>
              <text className="lbl" x={pad - 12} y={y + 21} textAnchor="end" fill="var(--ink-2)">{c.label}</text>
              <rect className="bar" x={pad} y={y + 10} width={xv(c.visits) - pad} height={17} fill={soft} />
              <text className="ax fade" x={visRight - 6} y={y + 23} textAnchor="end">{zayavki(c.leads)}</text>
              <rect className="bar" x={crLeft} y={y + 10} width={Math.max(xc(cr) - crLeft, 1)} height={17} fill={col} />
              <text className="val fade" x={W} y={y + 23} textAnchor="end">{pct(cr, 2)}</text>
            </g>
          );
        })}
      </svg>
      <div className="legend">
        <span><i style={{ background: C.oxide }} />реклама, 150 096 ₽ за клики</span>
        <span><i style={{ background: C.moss }} />бесплатный поиск, 0 ₽ за клики</span>
        <span><i style={{ background: C.slate }} />остальные каналы</span>
      </div>
    </Frame>
  );
}

/* ====== 2. Структура расхода: одна полоса на 150 096 ₽ ====== */
export function SpendSplit() {
  const W = 760, H = 132, bar = 44, y = 30;
  const total = D.SPEND_TOTAL;
  const x = scale(0, total, 0, W);
  const cols = [C.ink, "color-mix(in oklch, var(--ink) 74%, var(--paper))", "color-mix(in oklch, var(--ink) 52%, var(--paper))", C.brass, C.slate, C.rule];
  let acc = 0;
  return (
    <Frame title="Куда ушли 150 096 ₽ за 30 дней августа" h={H}
      note="Работали восемь кампаний, все перегородочные: семь тратили деньги, восьмая, ретаргетинг, работала с нулевым расходом. Поиск забирает 75% денег и даёт 67% кликов, Товарная галерея остановлена 16 августа."
    >
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Структура рекламного расхода за 30 дней августа">
        {D.CAMPAIGNS.map((c, i) => {
          const w = x(c.spend), x0 = acc; acc += w;
          if (w < 1) return null;
          const showIn = w > 74;
          return (
            <g key={c.name} style={{ ["--i" as string]: i }}>
              <rect className="bar" x={x0} y={y} width={Math.max(w - 2, 1)} height={bar} fill={cols[i]} />
              {showIn && <text className="val fade" x={x0 + 10} y={y + 27} fill={i < 3 ? "var(--paper)" : "var(--ink)"}>{Math.round((c.spend / total) * 100)}%</text>}
              <text className="ax fade" x={Math.min(x0, W - 96)} y={y + bar + 18} fill="var(--ink-2)">{c.name.replace(" (три кампании)", "")}</text>
              <text className="ax fade" x={Math.min(x0, W - 96)} y={y + bar + 33}>{fmt(c.spend)} ₽</text>
            </g>
          );
        })}
        <text className="ax" x={0} y={16}>0 ₽</text>
        <text className="ax fade" x={W} y={y + bar + 33} textAnchor="end" style={{ ["--i" as string]: 7 }}>
          ретаргетинг: 0 ₽ при 36 переходах
        </text>
        <text className="ax" x={W} y={16} textAnchor="end">150 096 ₽</text>
      </svg>
    </Frame>
  );
}

/* ====== 3. Дневной расход и остановка Товарной галереи ====== */
export function DailySpend() {
  const W = 760, H = 260, L = 46, R = 8, T = 22, B = 34;
  const max = niceMax(Math.max(...D.DAILY.map((d) => d.total)));
  const x = scale(0, D.DAILY.length - 1, L, W - R);
  const y = scale(0, max, H - B, T);
  const line = D.DAILY.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.total).toFixed(1)}`).join(" ");
  const area = `${line} L${x(D.DAILY.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const cut = x(D.TG_STOP_INDEX);
  return (
    <Frame title="Дневной расход до и после остановки Товарной галереи"
      note="Товарная галерея остановлена 16 августа, пунктиром показаны средние по периодам. В тот же день запущена новая кампания РСЯ. Разложение изменения: Товарная галерея освободила 1 492 ₽ в день, Поиск забрал 1 184 ₽, новая РСЯ добавила 945 ₽. Без неё дневной расход упал бы на 6,6%. То есть переток на Поиск реален, а общий рост даёт новый канал, включённый в тот же день."
      h={H}
    >
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="График дневного расхода за 30 дней августа">
        {[0, max / 2, max].map((t, i) => (
          <g key={i}>
            <line className="grid" x1={L} y1={y(t)} x2={W - R} y2={y(t)} />
            <text className="ax" x={L - 8} y={y(t) + 4} textAnchor="end">{fmt(t)}</text>
          </g>
        ))}
        <rect x={L} y={T} width={cut - L} height={H - B - T} fill="color-mix(in oklch, var(--brass) 8%, transparent)" className="fade" />
        <path d={area} fill="color-mix(in oklch, var(--ink) 8%, transparent)" className="fade" />
        <path d={line} className="draw" style={{ ["--len" as string]: 2400 }} fill="none" stroke={C.ink} strokeWidth={2} strokeLinejoin="round" />
        <line x1={L} y1={y(D.DAILY_BEFORE.perDay)} x2={cut} y2={y(D.DAILY_BEFORE.perDay)} stroke={C.brass} strokeWidth={1.5} strokeDasharray="5 4" className="fade" />
        <line x1={x(D.TG_STOP_INDEX + 1)} y1={y(D.DAILY_AFTER.perDay)} x2={W - R} y2={y(D.DAILY_AFTER.perDay)} stroke={C.oxide} strokeWidth={1.5} strokeDasharray="5 4" className="fade" style={{ ["--i" as string]: 2 }} />
        <line x1={cut} y1={T} x2={cut} y2={H - B} stroke={C.ink} strokeWidth={1} className="fade" />
        <text className="ax fade" x={cut + 6} y={T + 10} fill="var(--ink-2)">16.08 остановка</text>
        <text className="val fade" x={L + 6} y={y(D.DAILY_BEFORE.perDay) + 17} fill={C.brass}>{fmt(D.DAILY_BEFORE.perDay)} ₽/день</text>
        <text className="val fade" x={W - R} y={y(D.DAILY_AFTER.perDay) - 9} textAnchor="end" fill={C.oxide}>{fmt(D.DAILY_AFTER.perDay)} ₽/день</text>
        {D.DAILY.filter((_, i) => i % 4 === 0).map((d, k) => (
          <text key={d.d} className="ax" x={x(k * 4)} y={H - 12} textAnchor="middle">{d.d}</text>
        ))}
      </svg>
    </Frame>
  );
}

/* ====== 4. Разрыв по заметности с loftcase ====== */
export function VisibilityGap() {
  const W = 760, H = 178, pad = 118, right = 74;
  const max = D.VIS_LOFTCASE.vis;
  const x = scale(0, max, pad, W - right);
  const rows = [
    { n: "GENGLASS", v: D.VIS_US.vis, p: D.VIS_US.pages, us: true, seg: [] as number[] },
    { n: "loftcase.ru", v: D.VIS_LOFTCASE.vis, p: D.VIS_LOFTCASE.pages, us: false, seg: [D.VIS_LOFTCASE.top1, D.VIS_LOFTCASE.top2] },
  ];
  return (
    <Frame title="Заметность перегородочных страниц по полным срезам: мы и loftcase.ru" h={H}
      note="Полный срез всех страниц обоих сайтов. Пятьдесят одна наша перегородочная страница даёт 217 единиц, девяносто четыре их страницы - 2 249, разрыв в 10,4 раза. Две их сильнейшие страницы, /partition и /peregorodki, дают 944 из этих 2 249, то есть 42%. Остальное в основном фильтры каталога."
    >
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Сравнение заметности с конкурентом">
        {rows.map((r, i) => {
          const y = 34 + i * 74;
          let off = pad;
          return (
            <g key={r.n} style={{ ["--i" as string]: i }}>
              <text className="lbl" x={pad - 12} y={y + 22} textAnchor="end" fill="var(--ink-2)">{r.n}</text>
              <text className="ax" x={pad - 12} y={y + 38} textAnchor="end">{stranicy(r.p)}</text>
              <rect className="bar" x={pad} y={y} width={x(r.v) - pad} height={32} fill={r.us ? C.brass : C.soft.slate} />
              {r.seg.map((s, k) => {
                const w = x(s) - pad; const x0 = off; off += w;
                return <g key={k}>
                  <rect className="bar" x={x0} y={y} width={w - 2} height={32} fill={C.slate} style={{ ["--i" as string]: k + 1 }} />
                  <text className="val fade" x={x0 + 10} y={y + 21} fill="var(--paper)">{fmt(s)}</text>
                </g>;
              })}
              <text className="val fade" x={x(r.v) + 10} y={y + 21} fill={r.us ? C.brass : "var(--ink)"}>{fmt(r.v)}</text>
            </g>
          );
        })}
        <text className="ax fade" x={pad} y={H - 6} fill="var(--ink-3)">серым выделены две страницы loftcase, дающие 944 из 2 249</text>
      </svg>
    </Frame>
  );
}

/* ====== 5. Карта рынка: органика против рекламы ====== */
export function CompetitorMap() {
  const W = 760, H = 330, L = 58, R = 150, T = 26, B = 46;
  const xm = niceMax(Math.max(...D.COMPETITORS.map((c) => c.ads)));
  const ym = niceMax(Math.max(...D.COMPETITORS.map((c) => c.t10)));
  const x = scale(0, xm, L, W - R), y = scale(0, ym, H - B, T);
  return (
    <Frame title="Карта рынка: кто живёт в выдаче, а кто в аукционе" h={H}
      note="По горизонтали - сколько запросов сайт откупает рекламой, по вертикали - сколько стоит на первой странице бесплатно. Размер точки - цитирования в ответах нейросетей. Левый верх - fdmebel: владеет выдачей и не платит вообще. Правый низ - чистые рекламщики без выдачи. Мы справа посередине: платим больше всех, кроме них."
    >
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Точечная карта конкурентов">
        {[0, ym / 2, ym].map((t, i) => (
          <g key={i}><line className="grid" x1={L} y1={y(t)} x2={W - R} y2={y(t)} />
            <text className="ax" x={L - 8} y={y(t) + 4} textAnchor="end">{fmt(t)}</text></g>
        ))}
        {[0, xm / 2, xm].map((t, i) => (
          <text key={i} className="ax" x={x(t)} y={H - B + 18} textAnchor="middle">{fmt(t)}</text>
        ))}
        <text className="ax" x={L - 8} y={T - 10} textAnchor="end">топ-10</text>
        <text className="ax" x={W - R} y={H - B + 34} textAnchor="end">рекламных запросов</text>
        {D.COMPETITORS.map((c, i) => {
          const r = 7 + Math.sqrt(c.ai) * 1.5;
          return (
            <g key={c.d} style={{ ["--i" as string]: i }}>
              <circle className="pop" cx={x(c.ads)} cy={y(c.t10)} r={r}
                fill={c.us ? C.brass : "none"} stroke={c.us ? C.brass : C.slate} strokeWidth={c.us ? 0 : 1.6}
                opacity={c.us ? 1 : 0.85} />
              <text className="lbl fade" x={x(c.ads) + r + 7} y={y(c.t10) + 4}
                fill={c.us ? "var(--ink)" : "var(--ink-2)"} fontWeight={c.us ? 600 : 400}>{c.d}</text>
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}

/* ====== 6. Цена клика по темам ====== */
export function CpcThemes() {
  const rows = [...D.THEMES].sort((a, b) => b.cpc - a.cpc);
  const W = 760, rowH = 40, pad = 190, top = 12;
  const H = top + rows.length * rowH + 12;
  const max = niceMax(Math.max(...rows.map((r) => r.cpc)));
  const x = scale(0, max, pad, W - 118);
  return (
    <Frame title="Сколько стоит клик по каждой теме" h={H}
      note="Сплошные полосы посчитаны на сотне кликов и надёжны. Полупрозрачные - на девяти и пяти кликах: направление видно, точная цифра случайна. Темы пересекаются между собой: один запрос может попасть сразу в две строки, поэтому складывать строки нельзя. Красным отмечено дороже 150 ₽ за клик."
    >
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Цена клика по темам запросов">
        {rows.map((r, i) => {
          const y = top + i * rowH;
          const hot = r.cpc > 150;
          return (
            <g key={r.theme} style={{ ["--i" as string]: i }}>
              <text className="lbl" x={pad - 12} y={y + 22} textAnchor="end" fill="var(--ink-2)">{r.theme}</text>
              <rect className="bar" x={pad} y={y + 8} width={x(r.cpc) - pad} height={22}
                fill={hot ? C.oxide : C.moss} opacity={r.solid ? 1 : 0.34} />
              <text className="val fade" x={x(r.cpc) + 10} y={y + 24}>{r.cpc} ₽</text>
              <text className="ax fade" x={W} y={y + 24} textAnchor="end">{r.clicks} кл.</text>
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}

/* ====== 7. Кликабельность на главной фразе ====== */
export function CtrPair() {
  const W = 760, H = 128;
  const max = 14;
  const x = scale(0, max, 176, W - 96);
  const rows = [
    { l: "Точная фраза «межкомнатные перегородки»", v: D.HEAD_PHRASE.ctr, n: `${D.HEAD_PHRASE.impressions} показов, ${D.HEAD_PHRASE.clicks} клика`, bad: true },
    { l: "Все наши запросы, среднее", v: D.AVG_QUERIES.ctr, n: `${fmt(D.AVG_QUERIES.impressions)} показов, ${D.AVG_QUERIES.clicks} кликов`, bad: false },
  ];
  return (
    <Frame title="Кликабельность: главный запрос ниши против среднего" h={H}
      note="Нас показывают на самом прямом запросе по нашему товару и не кликают. Значит, дело не в ставке и не в аукционе, а в тексте объявления. Оговорка: 183 показа - маленькая выборка, она показывает направление, а не точную величину."
    >
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Сравнение кликабельности">
        {rows.map((r, i) => {
          const y = 18 + i * 52;
          return (
            <g key={r.l} style={{ ["--i" as string]: i }}>
              <text className="lbl" x={164} y={y + 18} textAnchor="end" fill="var(--ink-2)">{r.l}</text>
              <rect className="bar" x={176} y={y + 4} width={x(r.v) - 176} height={26} fill={r.bad ? C.oxide : C.moss} />
              <text className="val fade" x={x(r.v) + 10} y={y + 22}>{pct(r.v, 2)}</text>
              <text className="ax fade" x={176} y={y + 44}>{r.n}</text>
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}

/* ====== 8. Цена под ключ против рынка ====== */
export function PriceDelta() {
  const W = 760, H = 210, pad = 128;
  const max = niceMax(Math.max(...D.PRICES.map((p) => p.market)));
  const x = scale(0, max, pad, W - 116);
  return (
    <Frame title="Цена под ключ: мы и средняя по рынку" h={H}
      note="Снимок цен июль 2026, сравнение внутри одного типа и одного размера: стационарная против шести компаний, распашная и раздвижная против восьми. Размеры разные, поэтому строки между собой сравнивать нельзя: стационарная дешевле не втрое, она вдвое меньше по площади."
    >
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Сравнение цен с рынком">
        {D.PRICES.map((p, i) => {
          const y = 22 + i * 60;
          return (
            <g key={p.type} style={{ ["--i" as string]: i }}>
              <text className="lbl" x={pad - 12} y={y + 15} textAnchor="end" fill="var(--ink-2)">{p.type}</text>
              <text className="ax" x={pad - 12} y={y + 31} textAnchor="end">{p.size} мм</text>
              <rect className="bar" x={pad} y={y} width={x(p.market) - pad} height={14} fill={C.soft.slate} />
              <rect className="bar" x={pad} y={y + 18} width={x(p.us) - pad} height={14} fill={C.brass} style={{ ["--i" as string]: i + 0.5 }} />
              <text className="ax fade" x={x(p.market) + 8} y={y + 12}>{fmt(p.market)} ₽</text>
              <text className="val fade" x={x(p.us) + 8} y={y + 30} fill={C.brass}>{fmt(p.us)} ₽</text>
              <text className="val fade" x={W} y={y + 22} textAnchor="end" fill={C.moss}>{dec(p.delta, 2)}%</text>
            </g>
          );
        })}
      </svg>
      <div className="legend">
        <span><i style={{ background: C.brass }} />GENGLASS</span>
        <span><i style={{ background: C.soft.slate }} />средняя по рынку</span>
      </div>
    </Frame>
  );
}

/* ====== 9. Цитируемость в ответах нейросетей ====== */
export function AiCitations() {
  const rows = [...D.COMPETITORS].filter((c) => c.pages > 0).map((c) => ({ ...c, per: c.ai / c.pages }))
    .sort((a, b) => b.per - a.per);
  const W = 760, rowH = 40, pad = 176, top = 12;
  const H = top + rows.length * rowH + 10;
  const max = 0.7;
  const x = scale(0, max, pad, W - 150);
  return (
    <Frame title="Цитирований в ответах нейросетей на одну страницу сайта" h={H}
      note={"У нас больше всех страниц в индексе (269) и втрое меньше цитирований на страницу, чем у трёх лидеров. " + D.AI_HYPOTHESIS}
    >
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Цитируемость в нейросетях">
        {rows.map((r, i) => {
          const y = top + i * rowH;
          return (
            <g key={r.d} style={{ ["--i" as string]: i }}>
              <text className="lbl" x={pad - 12} y={y + 22} textAnchor="end"
                fill={r.us ? "var(--ink)" : "var(--ink-2)"} fontWeight={r.us ? 600 : 400}>{r.d}</text>
              <rect className="bar" x={pad} y={y + 9} width={Math.max(x(r.per) - pad, 1)} height={20}
                fill={r.us ? C.brass : C.soft.slate} />
              <text className="val fade" x={x(r.per) + 10} y={y + 24}>{dec(r.per, 2)}</text>
              <text className="ax fade" x={W} y={y + 24} textAnchor="end">{r.ai} на {stranicy(r.pages)}</text>
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}

/* ====== 10. Трафик страниц раздела ====== */
export function PageTraffic() {
  const W = 760, rowH = 46, pad = 260, top = 10;
  const H = top + D.PAGE_TRAFFIC.length * rowH + 8;
  const max = niceMax(D.PAGE_TRAFFIC[0].visits);
  const x = scale(0, max, pad, W - 96);
  return (
    <Frame title="Визиты за 30 дней: четыре группы страниц из среза тридцати" h={H}
      note="Срез покрывает 1 293 визита из 8 611, это 15% трафика. Показаны четыре группы на 615 визитов, остальные 678 визитов среза сюда не вошли, крупнейший из них - главная страница, 415. Значит, 120 визитов на перегородочных страницах это нижняя граница, а не полная сумма."
    >
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Визиты по группам страниц">
        {D.PAGE_TRAFFIC.map((p, i) => {
          const y = top + i * rowH;
          const ours = p.accent === "brass";
          return (
            <g key={p.label} style={{ ["--i" as string]: i }}>
              <text className="lbl" x={pad - 12} y={y + 22} textAnchor="end"
                fill={ours ? "var(--ink)" : "var(--ink-2)"} fontWeight={ours ? 600 : 400}>{p.label}</text>
              <rect className="bar" x={pad} y={y + 9} width={x(p.visits) - pad} height={20}
                fill={ours ? C.brass : C.soft.slate} />
              <text className="val fade" x={x(p.visits) + 10} y={y + 24}>{p.visits}</text>
              <text className="ax fade" x={W} y={y + 24} textAnchor="end">{p.pages === 1 ? "одна страница" : stranicy(p.pages)}</text>
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}
