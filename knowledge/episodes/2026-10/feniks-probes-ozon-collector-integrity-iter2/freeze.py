from pathlib import Path
import subprocess,re,os,sys
rev=sys.argv[1];target=Path('/private/tmp/ozon-integrity-audit')/('source-'+rev[:8]);target.mkdir(exist_ok=True)
todo=['analytics-mvp/package.json','analytics-mvp/tsconfig.json']+['analytics-mvp/src/scripts/ozon/'+x+'.ts' for x in ['collector-integrity','attribution-report','ad-sku-daily','ad-attribution-daily','source-health','ads-daily','acq-sku-daily','pnl-accrual-daily']]+['analytics-mvp/src/connector/'+x+'.ts' for x in ['ozon-seller','ozon-performance']];seen=set()
while todo:
 name=todo.pop()
 if name in seen:continue
 seen.add(name);data=subprocess.check_output(['git','show',f'{rev}:{name}'],text=True);p=target/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(data)
 if name.endswith('.ts'):
  for ref in re.findall(r'''(?:from\s*|import\s*)["'](\.[^"']+)["']''',data):
   rel=Path(os.path.normpath(Path(name).parent/ref));todo.append(str(rel.with_suffix('.ts') if rel.suffix=='.js' else rel))
modules=target/'analytics-mvp/node_modules'
if not modules.exists():modules.symlink_to('/Users/gengroup/Documents/Codex/t1/analytics-mvp/node_modules',target_is_directory=True)
print(target)
