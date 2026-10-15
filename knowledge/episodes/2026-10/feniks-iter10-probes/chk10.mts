// FENIKS iter10: cpoOrdersByDay + cpoExportCampaign of the AUDITED code (sandbox p10) over arbitrary data dirs.
// usage: node <p10>/node_modules/tsx/dist/cli.mjs chk10.mts <dataDir>...   prints one JSON line per dir
import { cpoOrdersByDay, cpoExportCampaign } from "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/f10/p10/analytics-mvp/src/scripts/cpo-orders-rev.ts";
for (const d of process.argv.slice(2)) {
  const dp = (f: string) => d + "/" + f;
  const co = cpoOrdersByDay(dp);
  const r = cpoExportCampaign(dp, co);
  console.log(JSON.stringify({ dir: d.split("/").pop(), spAll: Math.round(co.spAll * 100) / 100, skuSp: Math.round(co.skuSp * 100) / 100, miss: co.miss, missBy: co.missBy, err: r.err, missMonths: r.missMonths, missNote: r.missNote, id: r.id }));
}
