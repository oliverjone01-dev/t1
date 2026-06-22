import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync, writeFileSync } from "node:fs";
const dom=new JSDOM(readFileSync("public/katya-marketing.html","utf-8"),{runScripts:"dangerously",pretendToBeVisual:true,url:"https://x/"});
const d=dom.window.document;const src=d.getElementById('src1');
writeFileSync("/tmp/pr5.txt","src1 badge: "+(src?src.textContent.replace(/\s+/g,' ').trim():'(none)')+"\n");
