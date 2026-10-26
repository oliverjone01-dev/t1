'use strict';
// Legacy entry point: remove both public DG routes without leaving a redirect.
// Production is served exclusively by the authenticated VPS route.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(process.argv[2]||'_site');
for(const name of ['gg&dg','gg-dg'])fs.rmSync(path.join(root,name),{recursive:true,force:true});
