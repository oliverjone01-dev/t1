# -*- coding: utf-8 -*-
HEAD = r'''<title>Контур: SEO, GEO, Директ</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/apexcharts/3.54.1/apexcharts.min.js"></script>
<script>
tailwind.config = { darkMode:'class', theme:{ extend:{
  fontFamily:{ sans:['"DM Sans"','system-ui','sans-serif'], mono:['"IBM Plex Mono"','monospace'] }
}}}
/* Цвета намеренно НЕ живут в конфиге Tailwind: если play-CDN не догрузится,
   страница всё равно должна выглядеть правильно. Все поверхности заданы в <style> ниже. */
</script>
<style>
  html{background:#F4F6FA} html.dark{background:#0A0C0E}
  body{margin:0;font-family:"DM Sans",system-ui,sans-serif;font-size:14px;background:#F4F6FA;color:#5A6A85}
  html.dark body{background:#0A0C0E;color:#949BA6}
  .num{font-family:"IBM Plex Mono",monospace;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
  .hero{font-family:"DM Sans",system-ui,sans-serif;font-variant-numeric:proportional-nums;letter-spacing:-.03em}
  .cd{background:#fff;border:1px solid #E7EAF0;border-radius:10px;transition:box-shadow .25s,transform .25s,border-color .25s}
  .cd:hover{box-shadow:0 6px 24px rgba(42,53,71,.09);transform:translateY(-2px)}
  html.dark .cd{background:#101317;border-color:#232830}
  html.dark .cd:hover{box-shadow:0 10px 30px rgba(0,0,0,.55);border-color:#2E343D}
  .nv{transition:background .16s,color .16s}
  #sb{transition:width .28s cubic-bezier(.4,0,.2,1),transform .28s cubic-bezier(.4,0,.2,1)}
  #view{min-width:0}
  .cd{min-width:0}
  .fade{animation:fd .42s ease both}
  @keyframes fd{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
  .sub{max-height:0;overflow:hidden;transition:max-height .3s cubic-bezier(.4,0,.2,1)}
  .sub.on{max-height:640px}
  .chev{transition:transform .25s}
  .chev.on{transform:rotate(90deg)}
  ::-webkit-scrollbar{width:7px;height:7px}
  ::-webkit-scrollbar-thumb{background:#c9d1de;border-radius:4px}
  html.dark ::-webkit-scrollbar-thumb{background:#2b3038}
  .apexcharts-tooltip{border-radius:8px!important;border:none!important;box-shadow:0 8px 26px rgba(0,0,0,.22)!important}
  .apexcharts-legend-text{color:inherit!important}
  table.dv{width:100%;border-collapse:collapse;font-size:12.5px}
  table.dv th{text-align:left;font-weight:600;padding:7px 10px;border-bottom:1px solid #E7EAF0;color:#2A3547;white-space:nowrap}
  table.dv td{padding:7px 10px;border-bottom:1px solid #F1F3F7}
  html.dark table.dv th{border-color:#232830;color:#E7EAEF}
  html.dark table.dv td{border-color:#1A1E24}
  .kmark{font-size:9.5px;font-weight:700;letter-spacing:.04em;padding:1px 5px;border-radius:4px;vertical-align:middle}
  .scroll-x{overflow-x:auto}
  input.fld{width:100%;background:#F4F6FA;border:1px solid #E7EAF0;border-radius:7px;padding:6px 9px;font-size:13px;color:#2A3547;font-family:"IBM Plex Mono",monospace}
  html.dark input.fld{background:#0D1013;border-color:#232830;color:#E7EAEF}
  input.fld:focus{outline:2px solid #5D87FF;outline-offset:-1px}
  /* Поверхности заданы обычным CSS: если конфиг Tailwind не подхватится, страница
     всё равно выглядит правильно, а не белым пятном в тёмной теме. */
  .pane{background:#fff;border-color:#E7EAF0}
  html.dark .pane{background:#101317;border-color:#232830}
  .topbar{background:rgba(255,255,255,.86);border-color:#E7EAF0}
  html.dark .topbar{background:rgba(13,16,19,.88);border-color:#232830}
  .soft{background:#F4F6FA} html.dark .soft{background:#161A1F}
  .hd{color:#2A3547} html.dark .hd{color:#E7EAEF}
  .bdr{border-color:#E7EAF0} html.dark .bdr{border-color:#232830}
  .hovr:hover{background:rgba(0,0,0,.045)} html.dark .hovr:hover{background:rgba(255,255,255,.055)}
  .k-ok{color:#0F7A52;background:rgba(15,122,82,.10)}
  .k-warn{color:#9A6A00;background:rgba(154,106,0,.12)}
  .k-crit{color:#B3261E;background:rgba(179,38,30,.10)}
  .k-neu{color:#5A6A85;background:rgba(90,106,133,.10)}
  html.dark .k-ok{color:#37D39B;background:rgba(55,211,155,.14)}
  html.dark .k-warn{color:#E0A82E;background:rgba(224,168,46,.14)}
  html.dark .k-crit{color:#FF6B6B;background:rgba(255,107,107,.14)}
  html.dark .k-neu{color:#949BA6;background:rgba(148,155,166,.12)}
  .nt{border:1px solid;border-radius:10px;padding:14px;display:flex;gap:10px}
  .nt-ok{border-color:rgba(15,122,82,.28);background:rgba(15,122,82,.05);--ni:#0F7A52}
  .nt-warn{border-color:rgba(154,106,0,.30);background:rgba(154,106,0,.06);--ni:#9A6A00}
  .nt-crit{border-color:rgba(179,38,30,.28);background:rgba(179,38,30,.05);--ni:#B3261E}
  .nt-info{border-color:rgba(181,84,26,.26);background:rgba(181,84,26,.05);--ni:#B5541A}
  html.dark .nt-ok{border-color:rgba(55,211,155,.26);background:rgba(55,211,155,.07);--ni:#37D39B}
  html.dark .nt-warn{border-color:rgba(224,168,46,.26);background:rgba(224,168,46,.07);--ni:#E0A82E}
  html.dark .nt-crit{border-color:rgba(255,107,107,.26);background:rgba(255,107,107,.07);--ni:#FF6B6B}
  html.dark .nt-info{border-color:rgba(240,135,63,.24);background:rgba(240,135,63,.06);--ni:#F0873F}
  .nt-i{color:var(--ni);flex-shrink:0;margin-top:1px}
  .navon{background:rgba(93,135,255,.13);color:#3561C9;font-weight:600}
  html.dark .navon{background:rgba(93,138,255,.15);color:#93B2FF}
  .ok-i{color:#0F7A52} html.dark .ok-i{color:#37D39B}
  .crit-i{color:#B3261E} html.dark .crit-i{color:#FF6B6B}
  .trk{background:rgba(0,0,0,.055)} html.dark .trk{background:rgba(255,255,255,.07)}
  @media print{
    #sb,#topbar,.noprint{display:none!important}
    body,html{background:#fff!important;color:#000!important}
    .cd{break-inside:avoid;box-shadow:none!important;border-color:#ccc!important}
    #main{padding:0!important}
  }
</style>
'''
