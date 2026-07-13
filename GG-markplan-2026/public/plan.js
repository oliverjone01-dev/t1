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
  var WD = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]; // 0=Вс
  function fmt(d) { return d.getDate() + " " + MON[d.getMonth()]; }
  // какие строки Ганта раскрыты (обоснование + автор) - переживает перерисовку
  var ganttOpen = {};
  // перенос текста по словам в N строк (для левой колонки Ганта)
  function wrapText(txt, maxChars, maxLines) {
    var words = String(txt || "").split(/\s+/).filter(Boolean), lines = [], cur = "";
    for (var i = 0; i < words.length; i++) {
      var probe = cur ? cur + " " + words[i] : words[i];
      if (probe.length <= maxChars) { cur = probe; }
      else {
        if (cur) lines.push(cur);
        cur = words[i];
        if (lines.length >= maxLines - 1) {
          var rest = words.slice(i).join(" ");
          if (rest.length > maxChars) rest = rest.slice(0, maxChars - 1) + "…";
          lines.push(rest); cur = ""; break;
        }
      }
    }
    if (cur) lines.push(cur);
    return lines.slice(0, maxLines);
  }

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
    var u = "https://docs.google.com/spreadsheets/d/" + CONFIG.sheetId + "/gviz/tq?tqx=out:csv";
    if (CONFIG.ganttSheet) u += "&sheet=" + encodeURIComponent(CONFIG.ganttSheet);
    return u; // без sheet - читается первый лист
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
  // маппинг живой таблицы -> формат tasks.
  // Колонки: ID, Б/Е, Блок, Задача, Обоснование, Автор, Ответственный, Старт, Дней, Зависит, Статус, Гейт
  var STMAP = { "готово": "done", "done": "done", "в работе": "work", "work": "work", "план": "plan", "не начато": "plan", "plan": "plan", "к обсуждению": "talk", "talk": "talk" };
  function mapLive(rows) {
    if (!rows || rows.length < 2) return null;
    var head = rows[0].map(function (s) { return String(s).toLowerCase().trim(); });
    function col() { for (var a = 0; a < arguments.length; a++) { var idx = head.indexOf(arguments[a]); if (idx >= 0) return idx; } return -1; }
    var ci = { id: col("id", "№", "no"), bu: col("б/е", "бе", "бренд", "bu"), b: col("блок", "block"), t: col("задача", "task"),
      why: col("обоснование", "зачем", "why"), author: col("автор", "предложил", "author"),
      who: col("ответственный", "кто", "owner"), start: col("старт", "начало", "start"), days: col("дней", "длит", "days"),
      dep: col("зависит", "зависимость", "dep"), st: col("статус", "status"), gate: col("гейт", "gate") };
    if (ci.t < 0 || ci.start < 0) return null;
    var out = [], blocks = [], bmap = {};
    var cell = function (row, i) { return i >= 0 ? (row[i] || "").trim() : ""; };
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r]; if (!row || !(row[ci.t] || "").trim()) continue;
      var bname = (ci.b >= 0 ? row[ci.b] : "").trim() || "Прочее";
      if (!(bname in bmap)) { bmap[bname] = blocks.length; blocks.push({ id: blocks.length, name: bname, tone: "brass" }); }
      var st = STMAP[String(ci.st >= 0 ? row[ci.st] : "").toLowerCase().trim()] || "plan";
      out.push({
        id: (ci.id >= 0 && row[ci.id]) ? String(row[ci.id]).trim() : "T" + r,
        bu: cell(row, ci.bu), b: bmap[bname], t: row[ci.t].trim(),
        why: cell(row, ci.why), author: cell(row, ci.author), who: cell(row, ci.who),
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
    var editUrl = P.meta.sheetId ? "https://docs.google.com/spreadsheets/d/" + P.meta.sheetId + "/edit" : "";
    var link = $("#sheet-link"); if (link && editUrl) link.href = editUrl;
    var top = $("#sheet-top"); if (top) { if (editUrl) top.href = editUrl; else top.style.display = "none"; }
    var nav = [["s-gantt", "График"], ["s-prioritety", "Приоритеты"], ["s-obzor", "Обзор"], ["s-15", "15 млн"], ["s-bloki", "Блоки"], ["s-voronka", "Воронка"], ["s-resheniya", "Решения"]];
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
      "<tr><td>Всего (пример структуры, не уровень)</td><td>" + s.total.pess.toFixed(1) + "</td><td>" + s.total.base.toFixed(1) + "</td><td>" + s.total.opt.toFixed(1) + "</td></tr>" +
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

  /* ---------- приоритеты (sales-director + ФЕНИКС) ---------- */
  function renderPriorities() {
    var pr = P.priorities; if (!pr) return;
    var dek = $("#prio-dek"); if (dek) dek.textContent = pr.dek || "";
    var host = $("#prio"); if (!host) return;
    host.innerHTML = pr.tiers.map(function (tr) {
      var items = tr.items.map(function (it) {
        return '<div class="pitem"><div class="pit-t">' + esc(it.t) + '</div><div class="pit-w"><b>Зачем:</b> ' + esc(it.why) + "</div></div>";
      }).join("");
      return '<div class="ptier ' + (tr.tone || "") + '">' +
        '<div class="ptier-h"><span class="ptier-k">' + esc(tr.k) + '</span><div><div class="ptier-n">' + esc(tr.name) +
        '</div><div class="ptier-hz">' + esc(tr.horizon) + '</div></div></div>' +
        '<div class="ptier-lead">' + esc(tr.lead) + '</div>' + items + "</div>";
    }).join("");
    var note = $("#prio-note"); if (note) note.innerHTML = esc(pr.note || "");
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
        body.innerHTML += '<div class="trow" id="row-' + esc(t.id) + '"><div><div class="tt">' + esc(t.t) + "</div>" +
          (t.why ? '<div class="twhy"><b>Зачем:</b> ' + esc(t.why) + "</div>" : "") +
          '<div class="tmeta">' + (t.author ? '<span class="who">' + esc(t.author) + "</span>" : "") + pills + "</div></div>" +
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
    // очистить старые подписи (карточку/подсказку) при перерисовке
    var wrap = host.parentNode;
    wrap.querySelectorAll(".g-tip,.g-hint").forEach(function (n) { n.remove(); });
    $("#gantt-legend").innerHTML =
      '<span class="lg"><i class="st-work"></i>в работе</span>' +
      '<span class="lg"><i class="st-plan"></i>план</span>' +
      '<span class="lg"><i class="st-talk"></i>к обсуждению</span>' +
      '<span class="lg"><i class="st-done"></i>готово</span>' +
      '<span class="lg"><i class="st-gate"></i>гейт</span>' +
      '<span class="lg"><i class="st-today"></i>сегодня</span>';

    var tasks = P.tasks.map(function (t) { var s = pd(t.start); return { t: t, s: s, e: s ? new Date(s.getTime() + t.days * MS) : null }; })
      .filter(function (o) { return o.s; });
    if (!tasks.length) { host.innerHTML = '<div class="g-hint">Нет задач с датами.</div>'; return; }

    var minD = tasks[0].s, maxD = tasks[0].e;
    tasks.forEach(function (o) { if (o.s < minD) minD = o.s; if (o.e > maxD) maxD = o.e; });
    var start = new Date(minD); start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 1);
    var end = new Date(maxD); end.setDate(end.getDate() + 4);
    var totalDays = diffDays(end, start);

    var HH = 34, axisH = 66, bh = 20, padB = 42;
    // левая читаемая панель: [id][Задача ...][Ответственный]; правее - календарь по дням.
    // при клике по строке вниз раскрывается обоснование + автор (мельче).
    var avail = (host.clientWidth || wrap.clientWidth || 1100);
    var Lw = Math.max(340, Math.min(Math.round(avail * 0.42), 660));
    var Rw = Math.min(150, Math.max(96, Math.round(Lw * 0.3))); // колонка «Ответственный»
    var taskX = 54, taskRight = Lw - Rw - 10;
    var dw = Math.max(16, Math.min(46, Math.floor((avail - Lw) / totalDays)));
    var W = Lw + totalDays * dw;
    // символов в строке названия задачи, обоснования (выпадашка) и ответственного
    var tCPL = Math.max(14, Math.floor((taskRight - taskX) / 6.6));
    var wCPL = Math.max(20, Math.floor((Lw - taskX - 12) / 5.2));
    var whoCPL = Math.max(7, Math.floor((Rw - 14) / 6.2));
    var toneHex = { brass: "#C9A96A", forest: "#6FC38C", sky: "#87ABC6", rust: "#E08A5F", ink: "#B6AD99" };
    var order = [], yById = {}, rowY = axisH, blockRows = [];
    P.blocksMeta.forEach(function (bm) {
      var bt = tasks.filter(function (o) { return o.t.b === bm.id; }).sort(function (a, b) { return a.s - b.s; });
      if (!bt.length) return;
      var headY = rowY; rowY += HH;
      bt.forEach(function (o) {
        o.tl = wrapText(o.t.t, tCPL, 4);
        o.exWl = o.t.why ? wrapText(o.t.why, wCPL, 6) : [];
        var open = !!ganttOpen[o.t.id];
        var h = 12 + o.tl.length * 15 + 10;
        if (open) h += 6 + o.exWl.length * 13 + (o.t.author ? 16 : 0) + 4;
        if (h < 48) h = 48;
        o.top = rowY; o.rh = h; o.y = rowY + 20;
        yById[o.t.id] = o; order.push(o); rowY += h;
      });
      blockRows.push({ bm: bm, headY: headY, y1: rowY, n: bt.length });
    });
    var H = rowY + padB;
    var xOf = function (d) { return Lw + diffDays(d, start) * dw; };

    var svg = sv("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, class: "gantt", role: "img", "aria-label": "Диаграмма Ганта плана" });
    var defs = sv("defs");
    function grad(id, c1, c2) { var g = sv("linearGradient", { id: id, x1: 0, y1: 0, x2: 0, y2: 1 }); g.appendChild(sv("stop", { offset: 0, "stop-color": c1 })); g.appendChild(sv("stop", { offset: 1, "stop-color": c2 })); defs.appendChild(g); }
    grad("g-work", "#DABB7E", "#B18B39");
    grad("g-done", "#7FCF9C", "#3E5A46");
    var pat = sv("pattern", { id: "hatch", width: 7, height: 7, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
    pat.appendChild(sv("rect", { width: 7, height: 7, fill: "var(--paper-3)" }));
    pat.appendChild(sv("rect", { width: 3.5, height: 7, fill: "var(--paper-2)" }));
    defs.appendChild(pat);
    svg.appendChild(defs);
    var root = sv("g"); svg.appendChild(root);

    // выходные - вертикальные полосы ритма
    var cur0 = new Date(start);
    while (cur0 <= end) {
      var dwk = cur0.getDay();
      if (dwk === 0 || dwk === 6) root.appendChild(sv("rect", { x: xOf(cur0), y: axisH, width: dw, height: H - axisH - padB + 6, class: "g-weekend" }));
      cur0.setDate(cur0.getDate() + 1);
    }

    // заголовки блоков: цветная точка, имя, счётчик, левый кант
    blockRows.forEach(function (b) {
      root.appendChild(sv("rect", { x: 0, y: b.headY, width: W, height: HH, class: "g-headband" }));
      root.appendChild(sv("line", { x1: 0, y1: b.headY + 0.5, x2: W, y2: b.headY + 0.5, class: "g-rail" }));
      root.appendChild(sv("circle", { cx: 21, cy: b.headY + HH / 2, r: 4, fill: toneHex[b.bm.tone] || "#C9A96A" }));
      var lab = sv("text", { x: 33, y: b.headY + HH / 2 + 4, class: "g-block-label" }); lab.textContent = b.bm.name; root.appendChild(lab);
      var cnt = sv("text", { x: Lw - 14, y: b.headY + HH / 2 + 4, class: "g-block-cnt", "text-anchor": "end" }); cnt.textContent = b.n + " задач"; root.appendChild(cnt);
      root.appendChild(sv("rect", { x: 0, y: b.headY + HH, width: 3, height: b.y1 - (b.headY + HH), fill: toneHex[b.bm.tone] || "#C9A96A", opacity: .5 }));
    });

    // ось-календарь: месяцы сверху, ниже строка дней недели и чисел; выходные выделены
    var cur = new Date(start), lastMonth = -1;
    while (cur <= end) {
      var x = xOf(cur), dow = cur.getDay(), wknd = (dow === 0 || dow === 6);
      var wd = sv("text", { x: x + dw / 2, y: 41, class: "g-day-wd" + (wknd ? " wknd" : ""), "text-anchor": "middle" }); wd.textContent = WD[dow]; root.appendChild(wd);
      var dn = sv("text", { x: x + dw / 2, y: 56, class: "g-day-num" + (wknd ? " wknd" : ""), "text-anchor": "middle" }); dn.textContent = cur.getDate(); root.appendChild(dn);
      if (dow === 1) root.appendChild(sv("line", { x1: x, y1: axisH, x2: x, y2: H - padB + 6, class: "g-grid" }));
      if (cur.getMonth() !== lastMonth) {
        lastMonth = cur.getMonth();
        root.appendChild(sv("line", { x1: x, y1: 8, x2: x, y2: H - padB + 6, class: "g-rail" }));
        var ml = sv("text", { x: x + 7, y: 22, class: "g-month" }); ml.textContent = MON[cur.getMonth()].toUpperCase(); root.appendChild(ml);
      }
      cur.setDate(cur.getDate() + 1);
    }
    root.appendChild(sv("line", { x1: 0, y1: axisH + 0.5, x2: W, y2: axisH + 0.5, class: "g-rail" }));
    root.appendChild(sv("line", { x1: Lw, y1: 8, x2: Lw, y2: H - padB + 6, class: "g-rail" }));
    // разделитель колонок «Задача | Ответственный» + заголовки колонок
    root.appendChild(sv("line", { x1: Lw - Rw, y1: axisH, x2: Lw - Rw, y2: H - padB + 6, class: "g-coldiv" }));
    var chT = sv("text", { x: taskX, y: axisH - 10, class: "g-col-head" }); chT.textContent = "Задача"; root.appendChild(chT);
    var chW = sv("text", { x: Lw - Rw + 8, y: axisH - 10, class: "g-col-head" }); chW.textContent = "Ответственный"; root.appendChild(chW);

    // подписи рядов: id-чип + Задача, справа Ответственный; по клику вниз - обоснование + автор
    order.forEach(function (o) {
      var tone = toneHex[(P.blocksMeta[o.t.b] || {}).tone] || "#C9A96A";
      var open = !!ganttOpen[o.t.id];
      root.appendChild(sv("line", { x1: 0, y1: o.top + 0.5, x2: W, y2: o.top + 0.5, class: "g-rowsep" }));
      if (open) root.appendChild(sv("rect", { x: 0, y: o.top + 1, width: Lw, height: o.rh - 1, class: "g-rowopen" }));
      // id-чип
      root.appendChild(sv("rect", { x: 14, y: o.top + 10, width: 32, height: 18, rx: 5, fill: tone, opacity: .17 }));
      var it = sv("text", { x: 30, y: o.top + 23, class: "g-id", "text-anchor": "middle" }); it.textContent = o.t.id; root.appendChild(it);
      // треугольник-раскрытие
      var cy = o.top + 17;
      var chev = sv("path", { d: open ? "M" + (taskX - 15) + "," + (cy - 3) + " h8 l-4,6 z" : "M" + (taskX - 15) + "," + (cy - 4) + " l6,4 l-6,4 z", class: "g-chevron" });
      root.appendChild(chev);
      // задача (перенос)
      o.tl.forEach(function (ln, i) {
        var tx = sv("text", { x: taskX, y: o.top + 21 + i * 15, class: "g-task-line" }); tx.textContent = ln; root.appendChild(tx);
      });
      // ответственный (правая колонка панели)
      var who = wrapText(o.t.who || "", whoCPL, 2);
      who.forEach(function (ln, i) {
        var wt = sv("text", { x: Lw - Rw + 8, y: o.top + 21 + i * 14, class: "g-who" }); wt.textContent = ln; root.appendChild(wt);
      });
      // выпадашка по клику: обоснование (мельче) + автор
      if (open) {
        var ey = o.top + 21 + o.tl.length * 15 + 10;
        o.exWl.forEach(function (ln, i) {
          var wx = sv("text", { x: taskX, y: ey + i * 13, class: "g-why-exp" }); wx.textContent = ln; root.appendChild(wx);
        });
        if (o.t.author) {
          var au = sv("text", { x: taskX, y: ey + o.exWl.length * 13 + 3, class: "g-author-exp" }); au.textContent = "предложил: " + o.t.author; root.appendChild(au);
        }
      }
    });

    // зависимости - плавные кривые под барами
    var depLayer = sv("g"); root.appendChild(depLayer);
    var deps = [];
    order.forEach(function (o) {
      (o.t.dep || []).forEach(function (pid) {
        var p = yById[pid]; if (!p) return;
        var ex = xOf(p.e), ey = p.y, sx = xOf(o.s), sy = o.y;
        var cp = Math.max(16, Math.min(64, Math.abs(sx - ex) * 0.5));
        var d = "M" + ex + "," + ey + " C" + (ex + cp) + "," + ey + " " + (sx - cp) + "," + sy + " " + (sx - 7) + "," + sy;
        var pe = sv("path", { d: d, class: "g-dep" });
        pe.setAttribute("data-a", pid); pe.setAttribute("data-b", o.t.id);
        depLayer.appendChild(pe);
        var ar = sv("polygon", { points: (sx - 7) + "," + (sy - 3.5) + " " + sx + "," + sy + " " + (sx - 7) + "," + (sy + 3.5), class: "g-dep-arrow" });
        ar.setAttribute("data-a", pid); ar.setAttribute("data-b", o.t.id);
        depLayer.appendChild(ar);
        deps.push({ a: pid, b: o.t.id, path: pe, arrow: ar });
      });
    });

    // бары - pill со статус-заливкой
    var barLayer = sv("g"); root.appendChild(barLayer);
    order.forEach(function (o) {
      var x = xOf(o.s), w = Math.max(dw * o.t.days, 11), y = o.y - bh / 2;
      var g = sv("g", { class: "bar st-" + o.t.st + (o.t.key ? " key" : "") }); g.setAttribute("data-id", o.t.id);
      var fill = o.t.st === "work" ? "url(#g-work)" : o.t.st === "done" ? "url(#g-done)" : o.t.st === "talk" ? "url(#hatch)" : "var(--paper-3)";
      var rect = sv("rect", { x: x, y: y, width: w, height: bh, rx: bh / 2, class: "b-fill", fill: fill });
      if (o.t.st === "plan" || o.t.st === "talk") { rect.setAttribute("stroke", "var(--line-2)"); rect.setAttribute("stroke-width", "1.4"); }
      g.appendChild(rect);
      if (o.t.st === "work" || o.t.st === "done") g.appendChild(sv("rect", { x: x + 2, y: y + 2, width: Math.max(w - 4, 2), height: 2, rx: 1, fill: "#ffffff", opacity: .18 }));
      var dl = sv("text", { x: x + w + 8, y: o.y + 4, class: "g-dur" }); dl.textContent = o.t.days + "д"; g.appendChild(dl);
      if (o.t.gate) { var d2 = bh * 0.6, cx = x, cy = o.y; g.appendChild(sv("polygon", { points: cx + "," + (cy - d2) + " " + (cx + d2) + "," + cy + " " + cx + "," + (cy + d2) + " " + (cx - d2) + "," + cy, class: "g-gate" })); }
      barLayer.appendChild(g);
    });

    // сегодня - линия + чип
    if (TODAY >= start && TODAY <= end) {
      var tx = xOf(TODAY);
      root.appendChild(sv("line", { x1: tx, y1: 2, x2: tx, y2: H - padB + 6, class: "g-today" }));
      root.appendChild(sv("rect", { x: tx - 27, y: 2, width: 54, height: 16, rx: 8, class: "g-today-chip" }));
      var tdl = sv("text", { x: tx, y: 13.5, class: "g-today-lbl", "text-anchor": "middle" }); tdl.textContent = "сегодня"; root.appendChild(tdl);
    }

    // прозрачные зоны-строки на всю ширину - надёжное наведение на любую точку строки
    var hitLayer = sv("g"); root.appendChild(hitLayer);
    order.forEach(function (o) {
      var hr = sv("rect", { x: 0, y: o.top, width: W, height: o.rh, fill: "transparent", class: "bar-hit" });
      hr.setAttribute("data-id", o.t.id);
      hr.addEventListener("mouseenter", function () { highlight(o.t.id); });
      hr.addEventListener("mousemove", function (ev) { showTip(ev, o); });
      hr.addEventListener("mouseleave", function () { clearHi(); hideTip(); });
      hr.addEventListener("click", function () {
        var sl = host.scrollLeft, st = host.scrollTop;
        ganttOpen[o.t.id] = !ganttOpen[o.t.id];
        renderGantt();
        var h2 = $("#gantt-scroll"); if (h2) { h2.scrollLeft = sl; h2.scrollTop = st; }
      });
      hr.style.cursor = "pointer";
      hitLayer.appendChild(hr);
    });

    host.appendChild(svg);

    // всплывающая карточка задачи
    wrap.style.position = "relative";
    var tip = el("div", "g-tip"); tip.style.display = "none"; wrap.appendChild(tip);
    function showTip(ev, o) {
      var stName = { work: "в работе", done: "готово", plan: "план", talk: "к обсуждению" }[o.t.st] || o.t.st;
      var opens = deps.filter(function (d) { return d.a === o.t.id; }).map(function (d) { return d.b; });
      var needs = o.t.dep || [];
      tip.innerHTML = '<div class="tt-h"><b>' + esc(o.t.t) + '</b><span class="tt-id">' + esc(o.t.id) + (o.t.bu ? " · " + esc(o.t.bu) : "") + (o.t.gate ? " · гейт" : "") + "</span></div>" +
        '<div class="tt-r"><span>срок</span>' + fmt(o.s) + " - " + fmt(new Date(o.e.getTime() - MS)) + " · " + o.t.days + "д</div>" +
        '<div class="tt-r"><span>статус</span>' + esc(stName) + "</div>" +
        (needs.length ? '<div class="tt-r"><span>после</span>' + esc(needs.join(", ")) + "</div>" : "") +
        (opens.length ? '<div class="tt-r"><span>откроет</span>' + esc(opens.join(", ")) + "</div>" : "") +
        '<div class="tt-r tt-hint">клик - раскрыть обоснование и автора</div>';
      tip.style.display = "block";
      var wr = wrap.getBoundingClientRect();
      var lx = ev.clientX - wr.left + 16, ty = ev.clientY - wr.top + 16;
      if (lx + 268 > wr.width) lx = ev.clientX - wr.left - 280;
      if (ty + tip.offsetHeight > wr.height) ty = ev.clientY - wr.top - tip.offsetHeight - 12;
      tip.style.left = Math.max(6, lx) + "px"; tip.style.top = Math.max(6, ty) + "px";
    }
    function hideTip() { tip.style.display = "none"; }

    wrap.appendChild(el("div", "g-hint", "Наведите на задачу - подсветится цепочка зависимостей. Клик по строке - раскрыть обоснование и автора. Прокрутка вправо - горизонт до сентября."));

    function related(id) { var set = {}; set[id] = 1; deps.forEach(function (d) { if (d.a === id) set[d.b] = 1; if (d.b === id) set[d.a] = 1; }); return set; }
    function highlight(id) {
      svg.classList.add("dim");
      var rel = related(id);
      barLayer.querySelectorAll(".bar").forEach(function (b) { b.classList.toggle("hot", rel[b.getAttribute("data-id")] === 1); });
      deps.forEach(function (d) { var on = d.a === id || d.b === id; d.path.classList.toggle("hot", on); d.arrow.classList.toggle("hot", on); });
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
    var secs = ["s-obzor", "s-15", "s-gantt", "s-prioritety", "s-bloki", "s-voronka", "s-resheniya"].map(function (id) { return document.getElementById(id); }).filter(Boolean);
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

  /* ---------- тема (как в SMM) + прогресс-бар ---------- */
  function wireTheme() {
    var R = document.documentElement;
    function cur() { return R.getAttribute("data-theme") || "dark"; }
    function sync() { document.querySelectorAll(".ttoggle button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-t") === cur()); }); }
    function set(t) { R.setAttribute("data-theme", t); try { localStorage.setItem("gg.theme", t); } catch (e) {} sync(); }
    try { var saved = localStorage.getItem("gg.theme"); if (saved === "light" || saved === "dark") R.setAttribute("data-theme", saved); } catch (e) {}
    if (!R.getAttribute("data-theme")) R.setAttribute("data-theme", "dark");
    document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest(".ttoggle button"); if (b) set(b.getAttribute("data-t")); });
    sync();
  }
  function wireProg() {
    var bar = $("#prog"); if (!bar) return;
    function upd() { var h = document.documentElement.scrollHeight - window.innerHeight; bar.style.width = (h > 0 ? (window.scrollY / h * 100) : 0) + "%"; }
    window.addEventListener("scroll", upd, { passive: true }); window.addEventListener("resize", upd); upd();
  }

  /* ---------- boot ---------- */
  function render() { renderChrome(); renderScenarios(); renderGantt(); renderPriorities(); renderBlocks(); wireScroll(); wireTheme(); wireProg(); }
  document.addEventListener("DOMContentLoaded", function () {
    render();
    var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { renderGantt(); }, 200); });
    loadLive(function (ok) {
      var badge = $("#src-badge");
      if (ok) { badge.textContent = "живая таблица"; badge.classList.add("live"); renderGantt(); renderBlocks(); }
      else { badge.textContent = "снимок"; badge.title = "Живая таблица недоступна - показан встроенный снимок. Как привязать - см. README."; }
    });
  });
})();
