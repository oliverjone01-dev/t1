#!/usr/bin/env python3
"""One active-manager policy for dashboards and scheduled report rendering."""
import argparse,json,re
from pathlib import Path

def norm(name):
 return ' '.join(str(name).split()).casefold().replace('ё','е')

def policy(path):
 add=[];exclude=set()
 for line in Path(path).read_text().splitlines():
  if not line.strip() or line.lstrip().startswith('#'):continue
  parts=[p.strip() for p in line.split('|')]
  if len(parts)<2:continue
  if parts[0]=='exclude':exclude.add(norm(parts[1]))
  elif parts[0]=='include':add.append(parts[1])
 return add,exclude

def resolve(names,conf):
 add,excluded=policy(conf);canonical={norm(n):n for n in add};out=[];seen=set()
 for name in [*names,*add]:
  key=norm(name)
  if key in excluded or key in seen:continue
  seen.add(key);out.append(canonical.get(key,name))
 return out

ARRAY=re.compile(r'(const\s+(?:PLAN_MGRS|PLAN)\s*=\s*)(\[[^\]]*\])')
def rewrite_script(text,conf):
 def change(m):return m[1]+json.dumps(resolve(json.loads(m[2]),conf),ensure_ascii=False,separators=(',',':'))
 return ARRAY.sub(change,text)

def template_names(path):
 text=Path(path).read_text();m=ARRAY.search(text)
 if not m:raise ValueError('Manager roster array not found: '+str(path))
 return json.loads(m[2])

def normalize_snapshot(path,names):
 path=Path(path);data=json.loads(path.read_text());canonical={norm(n):n for n in names}
 if isinstance(data.get('firedManagers'),list):data['firedManagers']=[n for n in data['firedManagers'] if norm(n) not in canonical]
 for section in ['deals','leads','prodItems']:
  for row in data.get(section,[]):
   if row.get('mgr') and norm(row['mgr']) in canonical:row['mgr']=canonical[norm(row['mgr'])]
 # Same identity in auxiliary keyed aggregates.
 for section in ['channelMix','managerPhotos']:
  fields=data.get(section)
  if not isinstance(fields,dict):continue
  for name in list(fields):
   target=canonical.get(norm(name),name)
   if target==name:continue
   source=fields.pop(name)
   if target in fields and isinstance(source,dict) and isinstance(fields[target],dict):
    for key,value in source.items():
     if isinstance(value,(int,float)):fields[target][key]=fields[target].get(key,0)+value
   else:fields[target]=source
 path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--conf',required=True);p.add_argument('--template');p.add_argument('--rewrite-script');p.add_argument('--normalize-snapshot');p.add_argument('--csv',action='store_true');a=p.parse_args()
 if a.rewrite_script:
  f=Path(a.rewrite_script);f.write_text(rewrite_script(f.read_text(),a.conf))
 names=resolve(template_names(a.template),a.conf) if a.template else policy(a.conf)[0]
 if a.normalize_snapshot:normalize_snapshot(a.normalize_snapshot,names)
 if a.csv:print(','.join(names))
