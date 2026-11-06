import { chromium } from 'playwright';
import sharp from 'sharp';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';

const root = await fs.realpath('/srv/gg/www/current');
const out = '/srv/gg/cache/site-previews';
await fs.mkdir(out + '/mgr', { recursive: true });
const html = await fs.readFile(root + '/index.html', 'utf8');
const sections = [...new Set([...html.matchAll(/href="\/([a-z0-9-]+)\/"/g)].map(m => m[1]))].filter(s => !s.startsWith('rop-') || s === 'rop-gm');
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!target.startsWith(root + '/') && target !== root) throw Error('path');
    const stat = await fs.stat(target);
    if (stat.isDirectory()) target = path.join(target, 'index.html');
    const ext = path.extname(target);
    res.setHeader('Content-Type', ({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg'})[ext] || 'application/octet-stream');
    createReadStream(target).on('error', () => res.destroy()).pipe(res);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({headless: true});
const results = [];
try {
  for (const slug of sections) {
    try { await fs.access(root + '/' + slug + '/index.html'); } catch { continue; }
    const context = await browser.newContext({viewport: {width: 1280, height: 800}, deviceScaleFactor: 1, serviceWorkers: 'block'});
    await context.route('**/*', route => {
      const request = route.request();
      const u = new URL(request.url());
      const local = u.origin === origin;
      const staticHost = ['cdn.jsdelivr.net','cdnjs.cloudflare.com','unpkg.com','fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname);
      if (request.method() === 'GET' && (local || staticHost) && !u.pathname.includes('_audit-bridge')) return route.continue();
      return route.abort();
    });
    const page = await context.newPage();
    try {
      await page.goto(origin + '/' + slug + '/', {waitUntil: 'load', timeout: 45000});
      await page.waitForTimeout(1800);
      await page.addStyleTag({content: '* { animation: none !important; transition: none !important; }'});
      const raw = await page.screenshot({type: 'png', timeout: 20000});
      const image = await sharp(raw).resize(640, 400).webp({quality: 60}).toBuffer();
      await fs.writeFile(out + '/' + slug + '.webp.tmp', image);
      await fs.rename(out + '/' + slug + '.webp.tmp', out + '/' + slug + '.webp');
      results.push({slug, bytes: image.length, capturedAt: new Date().toISOString()});
      console.log(slug, image.length, 'bytes');
    } catch (e) { console.error(slug, 'preview failed:', e.name); }
    finally { await context.close(); }
  }
  const main = await fs.realpath('/srv/gg/src/main/current');
  const photoDir = main + '/analytics-mvp/public/dashboards/mgr';
  for (const filename of await fs.readdir(photoDir)) {
    if (!/^[a-z0-9-]+\.jpg$/.test(filename)) continue;
    const name = filename.replace(/\.jpg$/, '.webp');
    await sharp(photoDir + '/' + filename).resize(104, 104, {fit: 'cover'}).webp({quality: 75}).toFile(out + '/mgr/' + name + '.tmp');
    await fs.rename(out + '/mgr/' + name + '.tmp', out + '/mgr/' + name);
  }
  if (!results.length) throw Error('No previews generated');
  await fs.writeFile(out + '/manifest.json.tmp', JSON.stringify({generatedAt: new Date().toISOString(), results}, null, 2));
  await fs.rename(out + '/manifest.json.tmp', out + '/manifest.json');
  console.log('Completed', results.length, 'previews; no AI API requests permitted.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }

