/* GG-MarkPlan 2026 · рендер плана + SVG-диаграмма Ганта с зависимостями.
 * Данные графика: сначала пробуем живую Google-таблицу (вкладка GANTT), при неудаче -
 * встроенный снимок window.PLAN.tasks. «Меняете таблицу - меняется график». */

(function () {
  "use strict";
  var P = window.PLAN;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var el = function (t, c, h) { var n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]; }); };
  var SVGNS = "http://www.w3.org/2000/svg";
  var sv = function (t, a) { var n = document.createElementNS(SVGNS, t); if (a) for (var k in a) n.setAttribute(k, a[k]); return n; };

  // сегодня (фиксируем в полдень, чтобы не плыло по таймзоне)
  var TODAY = new Date(); TODAY = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
  var MS = 86400000;
  function pd(s) { if (!s) return null; var m = String(s).trim().match(/(\d{4})-(\d{2})-(\d{2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]); var d = String(s).trim().match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/); if (d) { var y = +d[3]; if (y < 100) y += 2000; return new Date(y, +d[2] - 1, +d[1]); } return null; }
  function diffDays(a, b) { return Math.round((a - b) / MS); }
  var MON = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  function fmt(d) { return d.getDate() + " " + MON[d.getMonth()]; }

  /* ---------- источник данных ---------- */
  // Приоритет: CONFIG.csvUrl (опубликованный CSV) -> gviz по sheetId+лист -> снимок.
  var CONFIG = {
    csvUrl: "",
    sheetId: (P.meta && P.meta.sheetId) || "",
    ganttSheet: (P.meta && P.meta.ganttSheet) || "GANTT"
  };
  function gvizUrl() {
    if (CONFIG.csvUrl) return CONFIG.csvUrl;
    if (!CONFIG.sheetId) return "";
    return "https://docs.google.com/spreadsheets/d/" + CONFIG.sheetId +
      "/gviz/tq?tqx=out:csv&sheet=" + encodeURIComponent(CONFIG.ganttSheet);
  }
  function parseCSV(text) {
    var rows = [], row = [], cur = "", q = false, i, c;
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else { if (c === '"') q = true; else if (c === ",") { row.push(cur); cur = ""; } else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; } else if (c === "\r") { } else cur += c; }
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }
  // маппинг живой таблицы -> формат tasks. Колонки: ID,Блок,Задача,Ответственный,Старт,Дней,Зависит,Статус
  var STMAP = { "готово": "done", "done": "done", "в работе": "work", "work": "work", "план": "plan", "не начато": "plan", "plan": "plan", "к обсуждению": "talk", "talk": "talk" };
  function mapLive(rows) {
    if (!rows || rows.length < 2) return null;
    var head = rows[0].map(function (s) { return String(s).toLowerCase().trim(); });
    function col() { for (var a = 0; a < arguments.length; a++) { var idx = head.indexOf(arguments[a]); if (idx >= 0) return idx; } return -1; }
    var ci = { id: col("id", "№", "no"), b: col("блок", "block"), t: col("задача", "task"), who: col("ответственный", "кто", "owner"), start: col("старт", "начало", "start"), days: col("дней", "длит", "days"), dep: col("зависит", "зависимость", "dep"), st: col("статус", "status"), gate: col("гейт", "gate") };
    if (ci.t < 0 || ci.start < 0) return null;
    var out = [], blocks = [], bmap = {};
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r]; if (!row || !(row[ci.t] || "").trim()) continue;
      var bname = (ci.b >= 0 ? row[ci.b] : "").trim() || "Прочее";
      if (!(bname in bmap)) { bmap[bname] = blocks.length; blocks.push({ id: blocks.length, name: bname, tone: "brass" }); }
      var st = STMAP[String(ci.st >= 0 ? row[ci.st] : "").toLowerCase().trim()] || "plan";
      out.push({
        id: (ci.id >= 0 && row[ci.id]) ? String(row[ci.id]).trim() : "T" + r,
        b: bmap[bname], t: row[ci.t].trim(),
        who: ci.who >= 0 ? (row[ci.who] || "").trim() : "",
        start: (row[ci.start] || "").trim(),
        days: Math.max(1, parseInt(ci.days >= 0 ? row[ci.days] : "1", 10) || 1),
        dep: ci.dep >= 0 ? String(row[ci.dep] || "").split(/[,;]/).map(function (x) { return x.trim(); }).filter(Boolean) : [],
        st: st,
        gate: ci.gate >= 0 ? /да|yes|1|гейт/i.test(row[ci.gate] || "") : false
      });
    }
    return { tasks: out, blocksMeta: blocks };
  }
  function loadLive(cb) {
    var url = gvizUrl();
    if (!url || typeof fetch !== "function") { cb(false); return; }
    var done = false, to = setTimeout(function () { if (!done) { done = true; cb(false); } }, 6000);
    fetch(url, { cache: "no-store" }).then(function (r) { return r.ok ? r.text() : Promise.reject(); })
      .then(function (txt) {
        if (done) return; done = true; clearTimeout(to);
        var m = mapLive(parseCSV(txt));
        if (m && m.tasks.length) { P.tasks = m.tasks; P.blocksMeta = m.blocksMeta; cb(true); }
        else cb(false);
      }).catch(function () { if (!done) { done = true; clearTimeout(to); cb(false); } });
  }

  /* ---------- рендер статичных секций ---------- */
  function renderChrome() {
    $("#mast-date").textContent = "обновлено " + (P.meta.updated || "");
    $("#hero-dek").textContent = P.meta.dek || "";
    $("#hero-note").innerHTML = esc(P.meta.note || "");
    $("#foot-audit").textContent = P.meta.audit || "";
    var link = $("#sheet-link"); if (link && P.meta.sheetId) link.href = "https://docs.google.com/spreadsheets/d/" + P.meta.sheetId + "/edit";
    var nav = [["s-obzor", "Обзор"], ["s-15", "15 млн"], ["s-gantt", "График"], ["s-bloki", "Блоки"], ["s-voronka", "Воронка"], ["s-resheniya", "Решения"]];
    $("#nav").innerHTML = nav.map(function (n) { return '<a href="#' + n[0] + '">' + n[1] + "</a>"; }).join("");
    // герой-статы
    $("#hero-stats").innerHTML = P.heroStats.map(function (s) {
      return '<div class="hstat ' + (s.tone || "") + '"><span class="v tnum">' + esc(s.v) + '</span><span class="l">' + esc(s.l) + "</span></div>";
    }).join("");
    // развилка
    $("#fork").innerHTML = P.fork.map(function (f) {
      return '<div class="fcard ' + (f.tone || "") + '"><span class="ftag">' + esc(f.tag) + '</span>' +
        '<div class="fk">' + esc(f.k) + '</div><div class="ft">' + esc(f.t) + '</div><div class="fd">' + esc(f.d) + "</div></div>";
    }).join("");
    // открытые решения
    $("#open-list").innerHTML = P.decisions.map(function (d) {
      return "<li><div class=\"oh\">" + esc(d.h) + '</div><div class="od">' + esc(d.d) + "</div></li>";
    }).join("");
    // воронка
    $("#funnel").innerHTML = P.funnel.map(function (f) {
      return '<div class="fstep"><div class="fn tnum">' + f.n + '</div><div class="fbody"><div class="fk2">' + esc(f.k) +
        '</div><div class="fd2">' + esc(f.d) + '</div></div><div class="fout"><b>результат</b>' + esc(f.out) + "</div></div>";
    }).join("");
  }

  function renderScenarios() {
    var s = P.scenarios;
    var host = $("#scen"); host.innerHTML = "";
    var intro = el("div", "scen-intro"); intro.innerHTML = "<b>Уточнено Иваном:</b> " + esc(s.intro);
    host.appendChild(intro);
    var tbl = el("div", "scen-tbl");
    var body = "";
    s.groups.forEach(function (g) {
      body += '<tr class="grp"><td colspan="4">' + esc(g.name) + "</td></tr>";
      g.rows.forEach(function (r) {
        body += "<tr><td>" + esc(r.src) + '<span class="snote">' + esc(r.note) + "</span></td><td>" +
          r.pess.toFixed(1) + "</td><td><b>" + r.base.toFixed(1) + "</b></td><td>" + r.opt.toFixed(1) + "</td></tr>";
      });
      body += '<tr class="sub"><td>' + esc(g.name) + " итого</td><td>" + g.sub.pess.toFixed(1) +
        "</td><td>" + g.sub.base.toFixed(1) + "</td><td>" + g.sub.opt.toFixed(1) + "</td></tr>";
    });
    tbl.innerHTML = '<table class="mtx"><thead><tr><th>Источник, млн ₽ / мес</th><th>худший</th><th>базовый</th><th>лучший</th></tr></thead>' +
      "<tbody>" + body + "</tbody><tfoot>" +
      "<tr><td>Всего немаркетплейс ГГР</td><td>" + s.total.pess.toFixed(1) + "</td><td>" + s.total.base.toFixed(1) + "</td><td>" + s.total.opt.toFixed(1) + "</td></tr>" +
      '<tr class="tgt"><td>Цель Ивана</td><td colspan="3">' + s.target + " млн / мес - между базовым и оптимистичным</td></tr>" +
      "</tfoot></table>";
    var side = el("div", "scen-side");
    side.innerHTML = s.verdict.map(function (v) {
      return '<div class="vbox ' + (v.tone || "") + '"><div class="vh">' + esc(v.h) + '</div><div class="vv">' + esc(v.v) + '</div><div class="vd">' + esc(v.d) + "</div></div>";
    }).join("");
    host.appendChild(tbl); host.appendChild(side);
    var gi = s.gap.indexOf(":");
    $("#verdict-15").innerHTML = "<b>" + esc(s.gap.slice(0, gi)) + ":</b>" + esc(s.gap.slice(gi + 1));
  }

  /* ---------- блоки плана ---------- */
  function renderBlocks() {
    var host = $("#blocks"); host.innerHTML = "";
    P.blocksMeta.forEach(function (bm, i) {
      var ts = P.tasks.filter(function (t) { return t.b === bm.id; });
      if (!ts.length) return;
      var d = el("details", "bcard " + (bm.tone || ""));
      if (i < 2) d.open = true;
      d.innerHTML = '<summary><span class="bno tnum">' + bm.id + '</span><span class="bname">' + esc(bm.name) +
        '</span><span class="bcount tnum">' + ts.length + ' зад.</span><span class="chev">▸</span></summary>';
      var body = el("div", "btasks");
      ts.forEach(function (t) {
        var pills = statusPill(t.st) + (t.gate ? '<span class="pill gate">гейт</span>' : "");
        body.innerHTML += '<div class="trow" id="row-' + esc(t.id) + '"><div><div class="tt">' + esc(t.t) +
          '</div><div class="tmeta"><span class="who">' + esc(t.who || "-") + "</span>" + pills + "</div></div>" +
          '<div class="who tnum">' + esc(t.id) + "</div></div>";
      });
      d.appendChild(body); host.appendChild(d);
    });
  }
  function statusPill(st) {
    var m = { done: ["done", "готово"], work: ["work", "в работе"], plan: ["", "план"], talk: ["talk", "к обсуждению"] }[st] || ["", st];
    return '<span class="pill ' + m[0] + '">' + m[1] + "</span>";
  }

  /* ---------- ГАНТ ---------- */
  function renderGantt() {
    var host = $("#gantt-scroll"); host.innerHTML = "";
    // легенда
    $("#gantt-legend").innerHTML =
      '<span class="lg"><i class="st-work"></i>в работе</span>' +
      '<span class="lg"><i class="st-plan"></i>план</span>' +
      '<span class="lg"><i class="st-talk"></i>к обсуждению</span>' +
      '<span class="lg"><i class="st-done"></i>готово</span>' +
      '<span class="lg"><i class="st-gate"></i>ключевой гейт</span>';

    var tasks = P.tasks.map(function (t) { var s = pd(t.start); return { t: t, s: s, e: s ? new Date(s.getTime() + t.days * MS) : null }; })
      .filter(function (o) { return o.s; });
    if (!tasks.length) { host.innerHTML = '<div class="g-hint">Нет задач с датами.</div>'; return; }

    var minD = tasks[0].s, maxD = tasks[0].e;
    tasks.forEach(function (o) { if (o.s < minD) minD = o.s; if (o.e > maxD) maxD = o.e; });
    // выровнять к понедельнику слева, добавить поля
    var start = new Date(minD); start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 2);
    var end = new Date(maxD); end.setDate(end.getDate() + 3);
    var totalDays = diffDays(end, start);

    var Lw = 264, dw = 15, rh = 30, axisH = 46, bh = 15, padB = 44;
    var W = Lw + totalDays * dw;
    // порядок: по блокам (как в blocksMeta), внутри - по старту
    var order = [], yById = {}, rowY = axisH, blockRows = [], HH = 24;
    P.blocksMeta.forEach(function (bm) {
      var bt = tasks.filter(function (o) { return o.t.b === bm.id; }).sort(function (a, b) { return a.s - b.s; });
      if (!bt.length) return;
      var headY = rowY; rowY += HH; // строка-заголовок блока (задачи ниже, без наложения)
      bt.forEach(function (o) { o.y = rowY + rh / 2; yById[o.t.id] = o; order.push(o); rowY += rh; });
      blockRows.push({ name: bm.name, headY: headY, y0: headY, y1: rowY });
    });
    var H = rowY + padB;
    var xOf = function (d) { return Lw + diffDays(d, start) * dw; };

    var svg = sv("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, class: "gantt", role: "img", "aria-label": "Диаграмма Ганта плана" });
    var root = sv("g");

    // фон-полосы блоков
    blockRows.forEach(function (b, i) {
      if (i % 2 === 1) root.appendChild(sv("rect", { x: 0, y: b.y0, width: W, height: b.y1 - b.y0, class: "g-blockband", opacity: .45 }));
      root.appendChild(sv("rect", { x: 0, y: b.headY, width: W, height: HH, fill: "var(--paper-2)" }));
      root.appendChild(sv("line", { x1: 0, y1: b.headY, x2: W, y2: b.headY, class: "g-grid" }));
      var lab = sv("text", { x: 14, y: b.headY + 16, class: "g-block-label" }); lab.textContent = b.name; root.appendChild(lab);
    });

    // недельная/месячная сетка + ось
    var cur = new Date(start), lastMonth = -1;
    while (cur <= end) {
      var x = xOf(cur), dow = cur.getDay();
      if (dow === 1) { // понедельник - недельная линия
        root.appendChild(sv("line", { x1: x, y1: axisH - 8, x2: x, y2: H - padB + 6, class: "g-grid" }));
        var wl = sv("text", { x: x + 3, y: axisH - 12, class: "g-axis" }); wl.textContent = fmt(cur); root.appendChild(wl);
      }
      if (cur.getMonth() !== lastMonth) {
        lastMonth = cur.getMonth();
        root.appendChild(sv("line", { x1: x, y1: 6, x2: x, y2: H - padB + 6, class: "g-grid-month" }));
        var ml = sv("text", { x: x + 5, y: 18, class: "g-block-label" }); ml.textContent = MON[cur.getMonth()].toUpperCase(); root.appendChild(ml);
      }
      cur.setDate(cur.getDate() + 1);
    }
    // разделитель колонки меток
    root.appendChild(sv("line", { x1: Lw, y1: 6, x2: Lw, y2: H - padB + 6, class: "g-grid-month" }));
    // ряды-линии + подписи задач
    order.forEach(function (o) {
      root.appendChild(sv("line", { x1: 0, y1: o.y + rh / 2, x2: W, y2: o.y + rh / 2, class: "g-rowline" }));
      var name = o.t.t; if (name.length > 40) name = name.slice(0, 39) + "…";
      var tl = sv("text", { x: 14, y: o.y - 1, class: "g-row-label" }); tl.textContent = name; root.appendChild(tl);
      var wl2 = sv("text", { x: 14, y: o.y + 12, class: "g-row-who" }); wl2.textContent = (o.t.id + " · " + (o.t.who || "")); root.appendChild(wl2);
    });

    // сегодня
    if (TODAY >= start && TODAY <= end) {
      var tx = xOf(TODAY);
      root.appendChild(sv("line", { x1: tx, y1: axisH - 8, x2: tx, y2: H - padB + 6, class: "g-today" }));
      var tdl = sv("text", { x: tx + 4, y: H - padB + 20, class: "g-today-lbl" }); tdl.textContent = "сегодня"; root.appendChild(tdl);
    }

    // зависимости (рисуем ПОД барами)
    var depLayer = sv("g"); root.appendChild(depLayer);
    var deps = [];
    order.forEach(function (o) {
      (o.t.dep || []).forEach(function (pid) {
        var p = yById[pid]; if (!p) return;
        var ex = xOf(p.e), ey = p.y, sx = xOf(o.s), sy = o.y;
        var mx = ex + 9;
        var path = "M" + ex + "," + ey + " L" + mx + "," + ey + " L" + mx + "," + sy + " L" + (sx - 6) + "," + sy;
        var pe = sv("path", { d: path, class: "g-dep" });
        pe.setAttribute("data-a", pid); pe.setAttribute("data-b", o.t.id);
        depLayer.appendChild(pe);
        var ar = sv("polygon", { points: (sx - 6) + "," + (sy - 3) + " " + sx + "," + sy + " " + (sx - 6) + "," + (sy + 3), class: "g-dep-arrow" });
        ar.setAttribute("data-a", pid); ar.setAttribute("data-b", o.t.id);
        depLayer.appendChild(ar);
        deps.push({ a: pid, b: o.t.id, path: pe, arrow: ar });
      });
    });

    // бары
    var barLayer = sv("g"); root.appendChild(barLayer);
    order.forEach(function (o) {
      var x = xOf(o.s), w = Math.max(dw * o.t.days, 8), y = o.y - bh / 2;
      var g = sv("g", { class: "bar" + (o.t.key ? " key" : "") }); g.setAttribute("data-id", o.t.id);
      var fillMap = { done: "var(--forest)", work: "var(--brass)", plan: "var(--paper)", talk: "var(--paper)" };
      var rect = sv("rect", { x: x, y: y, width: w, height: bh, rx: 3, class: "b-fill", fill: fillMap[o.t.st] });
      if (o.t.st === "plan") { rect.setAttribute("stroke", "var(--line-2)"); rect.setAttribute("stroke-width", "1.5"); }
      if (o.t.st === "talk") { rect.setAttribute("stroke", "var(--line-2)"); rect.setAttribute("stroke-width", "1"); rect.setAttribute("fill", "url(#hatch)"); }
      g.appendChild(rect);
      // длительность-подпись справа от бара
      var dl = sv("text", { x: x + w + 6, y: o.y + 4, class: "g-row-who" }); dl.textContent = o.t.days + "д"; g.appendChild(dl);
      // ромб для гейта
      if (o.t.gate) {
        var d2 = bh * 0.7, cx = x, cy = o.y;
        g.appendChild(sv("polygon", { points: cx + "," + (cy - d2) + " " + (cx + d2) + "," + cy + " " + cx + "," + (cy + d2) + " " + (cx - d2) + "," + cy, fill: "var(--rust)" }));
      }
      var tt = sv("title"); tt.textContent = o.t.t + " · " + (o.t.who || "") + " · " + fmt(o.s) + "-" + fmt(new Date(o.e.getTime() - MS)) + " (" + o.t.days + "д)"; g.appendChild(tt);
      barLayer.appendChild(g);

      // интерактив
      g.addEventListener("mouseenter", function () { highlight(o.t.id); });
      g.addEventListener("mouseleave", clearHi);
      g.addEventListener("click", function () { gotoTask(o.t); });
    });

    // hatch pattern для «к обсуждению»
    var defs = sv("defs");
    var pat = sv("pattern", { id: "hatch", width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
    pat.appendChild(sv("rect", { width: 6, height: 6, fill: "var(--paper)" }));
    pat.appendChild(sv("rect", { width: 3, height: 6, fill: "var(--paper-3)" }));
    defs.appendChild(pat); svg.appendChild(defs);

    svg.appendChild(root); host.appendChild(svg);
    var hint = el("div", "g-hint", "Наведите на задачу - подсветятся её зависимости. Клик - открыть задачу в блоках. Прокрутка вправо - весь горизонт до сентября.");
    host.parentNode.appendChild(hint);

    function related(id) {
      var set = { }; set[id] = 1;
      deps.forEach(function (d) { if (d.a === id) set[d.b] = 1; if (d.b === id) set[d.a] = 1; });
      return set;
    }
    function highlight(id) {
      svg.classList.add("dim");
      var rel = related(id);
      barLayer.querySelectorAll(".bar").forEach(function (b) { b.classList.toggle("hot", rel[b.getAttribute("data-id")] === 1); });
      deps.forEach(function (d) {
        var on = d.a === id || d.b === id;
        d.path.classList.toggle("hot", on); d.arrow.classList.toggle("hot", on);
      });
    }
    function clearHi() {
      svg.classList.remove("dim");
      barLayer.querySelectorAll(".bar.hot").forEach(function (b) { b.classList.remove("hot"); });
      deps.forEach(function (d) { d.path.classList.remove("hot"); d.arrow.classList.remove("hot"); });
    }
  }

  function gotoTask(t) {
    var d = document.querySelectorAll(".bcard")[0];
    // открыть нужный блок
    document.querySelectorAll(".bcard").forEach(function (card) {
      var name = $(".bname", card).textContent;
      var bm = P.blocksMeta.filter(function (b) { return b.name === name; })[0];
      if (bm && bm.id === t.b) card.open = true;
    });
    var row = document.getElementById("row-" + t.id);
    if (row) { row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.style.transition = "background .2s"; row.style.background = "color-mix(in oklab,var(--brass-2) 26%,transparent)";
      setTimeout(function () { row.style.background = ""; }, 1100); }
  }

  /* ---------- прокрутка-подсветка навигации + reveal ---------- */
  function wireScroll() {
    var secs = ["s-obzor", "s-15", "s-gantt", "s-bloki", "s-voronka", "s-resheniya"].map(function (id) { return document.getElementById(id); }).filter(Boolean);
    var links = {}; document.querySelectorAll(".mast-nav a").forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (e) { if (e.isIntersecting) { for (var k in links) links[k].classList.remove("active"); var a = links[e.target.id]; if (a) a.classList.add("active"); } });
      }, { rootMargin: "-45% 0px -50% 0px" });
      secs.forEach(function (s) { io.observe(s); });
      var ro = new IntersectionObserver(function (ents) { ents.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); ro.unobserve(e.target); } }); }, { rootMargin: "0px 0px -8% 0px" });
      document.querySelectorAll(".band-inner,.hero-grid,.hero-note").forEach(function (n) { n.classList.add("reveal"); ro.observe(n); });
    }
  }

  /* ---------- boot ---------- */
  function render() { renderChrome(); renderScenarios(); renderGantt(); renderBlocks(); wireScroll(); }
  document.addEventListener("DOMContentLoaded", function () {
    render();
    loadLive(function (ok) {
      var badge = $("#src-badge");
      if (ok) { badge.textContent = "живая таблица"; badge.classList.add("live"); renderGantt(); renderBlocks(); }
      else { badge.textContent = "снимок"; badge.title = "Живая таблица недоступна - показан встроенный снимок. Как привязать - см. README."; }
    });
  });
})();
