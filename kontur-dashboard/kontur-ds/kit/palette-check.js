/* Контур DS · проверка палитры графиков в браузере. Генерируется tools/build_pages.py
   из tools/validate_palette.mjs (скилл dataviz), руками не править. */
(function(g){
const BAND = { light: [0.43, 0.77], dark: [0.48, 0.67] }; // OKLCH L
const CHROMA_FLOOR = 0.10; // OKLCH C
// Delta E is Euclidean distance in OKLab ×100. The CVD thresholds are calibrated to
// the Machado-Oliveira-Fernandes (2009) severity-1.0 simulation below - the sim
// model is part of the standard, not an implementation detail (swapping in e.g.
// Viénot-1999 moves borderline pairs and would require recalibrating these).
const CVD_TARGET = 8.0, CVD_FLOOR = 6.0; // OKLab Delta E×100, min(protan, deutan), adjacent pairs
const NORMAL_FLOOR = 15.0; // OKLab Delta E×100, worst pair on the active pairlist, unsimulated vision
const CONTRAST_MIN = 3.0; // WCAG vs surface
const DEFAULT_SURFACE = { light: "#fcfcfb", dark: "#1a1a19" };
const ORDINAL_MIN_DL = 0.06; // min OKLCH delta L between adjacent steps
const ORDINAL_LIGHT_FLOOR = 2.0; // lightest step: WCAG contrast vs surface

// Machado, Oliveira & Fernandes (2009) CVD transforms at severity 1.0 (linear RGB).
const MACHADO = {
  protan: [[0.152286, 1.052583, -0.204868],
           [0.114503, 0.786281, 0.099216],
           [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968],
           [0.280085, 0.672501, 0.047413],
           [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779],
           [-0.078411, 0.930809, 0.147602],
           [0.004733, 0.691367, 0.303900]],
};

// -- color conversions ----------------------------------------------------------
const hex2srgb = (h) => { h = h.trim().replace(/^#/, ""); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255); };

// -- input boundary -- EVERY user-supplied color string (palette entries AND
// the surface, CLI and browser alike) passes these before any math:
// unguarded, parseInt propagates NaN through every check and the run fails
// OPEN. Normalization is spelled out rather than engine-native: JS trim()
// and Python str.strip() differ at the edges (trim() strips U+FEFF;
// str.strip() strips U+001C-U+001F and U+0085), so the shared set is their
// intersection - ASCII whitespace plus the Unicode space/separator
// characters both engines strip, which also covers the NBSP/em-space
// padding picked up when copy-pasting hex lists from rendered pages. Keep
// these three definitions in lockstep with the Python twin.
const WS_RUN = "[ \\t\\n\\v\\f\\r\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]+";
const stripWs = (v) => v.replace(new RegExp(`^${WS_RUN}|${WS_RUN}$`, "g"), "");
const splitColors = (raw) => (raw || "").split(",").map(stripWs).filter(Boolean);
const isHexColor = (v) => /^#?[0-9a-fA-F]{6}$/.test(v);
const s2lin = (c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const lin2s = (c) => { c = Math.max(0, Math.min(1, c)); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const lin = (h) => hex2srgb(h).map(s2lin);
const relLum = (h) => { const [r, g, b] = lin(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

function oklabFromLin([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, // L
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, // a
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s, // b
  ];
}
const oklab = (h) => oklabFromLin(lin(h));
const oklch = (h) => { const [L, a, b] = oklab(h); return [L, Math.hypot(a, b)]; };
const okhue = (h) => { const [, a, b] = oklab(h); return ((Math.atan2(b, a) * 180 / Math.PI) % 360 + 360) % 360; };

function simulate(h, kind) {
  const [r, g, b] = lin(h), M = MACHADO[kind];
  const clamp = (c) => Math.max(0, Math.min(1, c));
  return [
    clamp(M[0][0] * r + M[0][1] * g + M[0][2] * b),
    clamp(M[1][0] * r + M[1][1] * g + M[1][2] * b),
    clamp(M[2][0] * r + M[2][1] * g + M[2][2] * b),
  ];
}
function deltaE(h1, h2, kind) {
  // Euclidean distance in OKLab, ×100. No kind -> unsimulated (normal) vision.
  const a = oklabFromLin(kind ? simulate(h1, kind) : lin(h1));
  const b = oklabFromLin(kind ? simulate(h2, kind) : lin(h2));
  return 100 * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

// -- checks ---------------------------------------------------------------------
function validate(palette, { mode = "light", surface, pairs = "adjacent" } = {}) {
  surface ??= DEFAULT_SURFACE[mode];
  const [lo, hi] = BAND[mode];
  const report = [];
  let ok = true;

  // 2. lightness band
  const offband = palette.filter(c => { const L = oklch(c)[0]; return L < lo || L > hi; })
    .map(c => [c, +oklch(c)[0].toFixed(3)]);
  if (offband.length) ok = false;
  report.push(["Lightness band", !offband.length,
    offband.length ? `outside band: ${JSON.stringify(offband)}` : `all ${palette.length} inside L ${lo}\u2013${hi}`]);

  // 3. chroma floor
  const lowc = palette.filter(c => oklch(c)[1] < CHROMA_FLOOR).map(c => [c, +oklch(c)[1].toFixed(3)]);
  if (lowc.length) ok = false;
  report.push(["Chroma floor", !lowc.length,
    lowc.length ? `below floor (reads gray): ${JSON.stringify(lowc)}` : `all ${palette.length} >= ${CHROMA_FLOOR}`]);

  // 4. CVD separation - adjacent for stacks/bars/lines; ALL pairs for scatter/bubble/maps/small-multiples
  const n = palette.length;
  const pairlist = pairs === "all"
    ? Array.from({ length: n }, (_, i) => Array.from({ length: n - i - 1 }, (_, k) => [i, i + 1 + k])).flat()
    : Array.from({ length: n - 1 }, (_, i) => [i, i + 1]);
  const label = pairs === "all" ? "all-pairs" : "adjacent";
  let worst = null;
  for (const kind of ["protan", "deutan"]) {
    for (const [i, j] of pairlist) {
      const d = deltaE(palette[i], palette[j], kind);
      if (worst === null || d < worst[0]) worst = [d, kind, palette[i], palette[j]];
    }
  }
  const tri = pairlist.length ? Math.min(...pairlist.map(([i, j]) => deltaE(palette[i], palette[j], "tritan"))) : 99;
  const wd = worst ? worst[0] : 99;
  const cvdState = wd >= CVD_TARGET ? "pass" : wd >= CVD_FLOOR ? "floor" : "fail";
  if (cvdState === "fail") ok = false;
  report.push(["CVD separation", cvdState,
    worst ? `worst ${label} ${worst[3]}\u2194${worst[2]} \u0394E ${wd.toFixed(1)} (${worst[1]}) · tritan ${tri.toFixed(1)}` : "n/a"]);

  // 4b. Normal-vision floor. The CVD gate protects dichromat readers; this one
  //     protects everyone else - neighbors must stay easy to tell apart under
  //     unsimulated vision too. A hard gate: secondary encoding does not
  //     excuse it, and weak pairs are not masked to keep an existing palette
  //     validating (this floor forced the first of the July 2026 re-orders
  //     of the shipped set: same steps, re-ordered, clears 19.6/19.3).
  let nworst = null;
  for (const [i, j] of pairlist) {
    const d = deltaE(palette[i], palette[j]);
    if (nworst === null || d < nworst[0]) nworst = [d, palette[i], palette[j]];
  }
  const nd = nworst ? nworst[0] : 99;
  const norState = nd >= NORMAL_FLOOR ? "pass" : "fail";
  if (norState === "fail") ok = false;
  report.push(["Normal-vision floor", norState,
    nworst ? `worst ${label} ${nworst[2]}\u2194${nworst[1]} \u0394E ${nd.toFixed(1)} (normal)`
      + (nd >= NORMAL_FLOOR ? "" : ` \u2014 below ${NORMAL_FLOOR.toFixed(0)}, hard to tell apart even with full color vision`) : "n/a"]);

  // 5. contrast vs surface - sub-3:1 is a documented conditional relax (visible labels / table view), not a hard fail
  const low = palette.filter(c => contrast(c, surface) < CONTRAST_MIN).map(c => [c, +contrast(c, surface).toFixed(2)]);
  report.push(["Contrast vs surface", low.length ? "relief" : "pass",
    low.length ? `below ${CONTRAST_MIN}:1 \u2014 relief required (visible labels or table view): ${JSON.stringify(low)}`
               : `all ${palette.length} >= ${CONTRAST_MIN}:1`]);

  return { report, ok };
}
g.KS_PALCHECK = { validate, contrast };
})(window);
