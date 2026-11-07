import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
await build({entryPoints:['ui/board.tsx'],outfile:'public/board-ui.mjs',bundle:true,jsx:'automatic',minify:true,format:'esm',target:['es2022'],legalComments:'eof',alias:{'@/lib/utils':'./ui/primitives.tsx','@/components/ui/button':'./ui/primitives.tsx','@/components/ui/card':'./ui/primitives.tsx'},define:{'process.env.NODE_ENV':'"production"'}});
execFileSync('node',['node_modules/tailwindcss/lib/cli.js','-c','tailwind.config.cjs','-i','ui/board.css','-o','public/board-ui.css','--minify'],{stdio:'inherit'});
copyFileSync('node_modules/fractional-indexing/src/index.js','public/vendor/fractional-indexing.mjs');
