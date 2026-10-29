import {readFileSync} from 'node:fs';
import {validateCaptureFile,latestCapture} from './cabinet-capture.js';
const file=process.argv[2];if(!file)throw Error('Usage: validate-cabinet-capture.ts staged/cabinet_capture.json');
const data=validateCaptureFile(JSON.parse(readFileSync(file,'utf8'))),capture=latestCapture(data);
if(!capture)throw Error('Empty cabinet package');
console.log(JSON.stringify({day:capture.day,scope:capture.scope,day_in_progress:capture.day_in_progress,totals:capture.totals}));
