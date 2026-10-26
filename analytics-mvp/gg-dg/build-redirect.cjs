'use strict';
// GitHub Pages retains only a data-free handoff. CRM collection runs on the VPS.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(process.argv[2]||'_site');
const html='<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=https://dash.genglas.ru/gg-dg/"><title>Домгласс</title><style>body{background:#0b1016;color:#e5e9ef;font:16px system-ui;padding:8vh 8vw}a{color:#20c8e2}</style><h1>Дашборд Домгласс</h1><p><a href="https://dash.genglas.ru/gg-dg/">Открыть дашборд</a> · требуется отдельный логин ДГ.</p></html>';
for(const name of ['gg&dg','gg-dg']){const out=path.join(root,name);fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'index.html'),html);}
