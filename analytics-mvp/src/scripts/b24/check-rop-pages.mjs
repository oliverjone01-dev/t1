import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const html = readFileSync(process.argv[2], 'utf8');
if (!/^<!doctype html/i.test(html) || html.includes('Warning: truncated output')) throw Error('ROP HTML is incomplete or contains a transfer diagnostic');
const plan = html.match(/const PLAN_MGRS=(\[[^\]]*\])/);
if (!plan) throw Error('Missing ROP roster');
const names = JSON.parse(plan[1]);
if (names.length !== 7 || !names.includes('Алёна Кубанова') || names.some(n => /Зазноба|Платонова/.test(n))) throw Error('Unexpected active roster');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
if (!scripts.length) throw Error('No ROP script');
for (const script of scripts) {
  const checked = spawnSync(process.execPath, ['--check'], { input: script[1], encoding: 'utf8' });
  if (checked.status !== 0) throw Error(checked.stderr);
}
console.log('ROP page: complete HTML, seven active managers, JavaScript syntax valid');
