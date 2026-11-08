// Project-specific guard. This is not the external Kontur validator from the reference.
export function contrast(a, b) {
  const luminance = (hex) =>
    hex
      .match(/[a-f\d]{2}/gi)
      .map((x) => parseInt(x, 16) / 255)
      .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
      .reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0);
  const [x, y] = [a, b].map(luminance);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function designCheck(css, copy = "") {
  const issues = [];
  const blocks = [
    css.match(/:root\s*\{([^}]+)\}/)?.[1],
    css.match(/:root\[data-theme=["']dark["']\]\s*\{([^}]+)\}/)?.[1],
  ];
  for (const [index, block] of blocks.entries()) {
    if (!block) {
      issues.push("theme");
      continue;
    }
    const tokens = Object.fromEntries(
      [...block.matchAll(/--([\w-]+):\s*(#[a-f\d]{6})(?![a-f\d])/gi)].map(
        (m) => [m[1], m[2]],
      ),
    );
    for (const [a, b, min] of [
      ["text", "panel", 7],
      ["text", "bg", 7],
      ["body", "panel", 4.5],
      ["muted", "panel", 4.5],
      ["muted", "subtle", 4.5],
      ["on-action", "action", 4.5],
      ["primary", "primary-soft", 4.5],
      ["success", "success-soft", 4.5],
      ["warning", "warning-soft", 4.5],
      ["danger", "danger-soft", 4.5],
      ["focus", "panel", 3],
    ]) {
      if (!tokens[a] || !tokens[b] || contrast(tokens[a], tokens[b]) < min)
        issues.push(`contrast-${index}-${a}-${b}`);
    }
  }
  // Reference palette roles must remain readable on their actual tinted zones.
  const blend=(a,b,p)=>'#'+[0,1,2].map(i=>Math.round(parseInt(a.slice(1+i*2,3+i*2),16)*p+parseInt(b.slice(1+i*2,3+i*2),16)*(1-p)).toString(16).padStart(2,'0')).join('');
  for(const [index,block] of blocks.entries()){
    if(!block)continue;
    const tokens=Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[a-f\d]{6})(?![a-f\d])/gi)].map(m=>[m[1],m[2]]));
    for(const name of ['importance-ink','urgency-ink']){
      if(!tokens[name]||!tokens.subtle){issues.push('priority-token-'+index+'-'+name);continue;}
      const bg=blend(tokens[name],tokens.subtle,.07);
      if(contrast(tokens[name],bg)<4.5||contrast(tokens[name],blend(tokens[name],tokens.panel,.07))<4.5||contrast(tokens.muted,bg)<4.5)issues.push('priority-contrast-'+index+'-'+name);
    }
  }
  if ([...css.matchAll(/font-size:\s*([\d.]+)px/g)].some((m) => +m[1] < 11))
    issues.push("font-floor");
  if (/[\u2013\u2014]/u.test(css + copy)) issues.push("long-dash");
  if (
    !css.includes("prefers-reduced-motion") ||
    !css.includes("animation: none !important")
  )
    issues.push("reduced-motion");
  if (
    !css.includes("forced-colors") ||
    !css.includes("prefers-reduced-transparency")
  )
    issues.push("system-accessibility");
  if (/transition:\s*(all|width|height|max-height|padding|margin)\b/.test(css))
    issues.push("layout-motion");
  if (!css.includes("100dvh") || !css.includes("safe-area-inset-bottom"))
    issues.push("viewport");
  return issues;
}
