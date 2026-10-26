const fs=require('node:fs'),path=require('node:path'),{validate}=require('./metrics.cjs');
const [input,out]=process.argv.slice(2);if(!input||!out)throw Error('Usage: node build.cjs <snapshot.json> <output-directory>');
const data=JSON.parse(fs.readFileSync(input,'utf8'));validate(data);
const age=Date.now()-Date.parse(data.generatedAt);if(age>24*3600000||age< -5*60000)throw Error('Snapshot is stale or future-dated');
fs.mkdirSync(out,{recursive:true});
for(const file of ['index.html','style.css','app.js'])fs.copyFileSync(path.join(__dirname,file),path.join(out,file));
fs.copyFileSync(path.join(__dirname,'metrics.cjs'),path.join(out,'metrics.js'));
const raw=JSON.stringify(data,null,2)+'\n';fs.writeFileSync(path.join(out,'data.json'),raw);fs.writeFileSync(path.join(out,'v.txt'),data.generatedAt+'\n');
console.log(`GG&DG published bundle: ${data.leads.length} leads, ${data.deals.length} deals (${Buffer.byteLength(raw)} bytes data)`);
