"""Build an existing publisher package from archived catalogs / competitor exports.

Raw XLSX files stay local. Historical observations keep their original timestamps.
The existing bot publisher requires an explicit --backfill-since for old sources.
"""
import argparse
import csv
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
from catalog_capture import catalog_capture, merge_catalogs
from capture import atomic_json
from import_report import read_xlsx


def competitors(run):
    context = json.loads((run/'result.json').read_text())
    watch = [{k: r[k] for k in ['sku','role','model','seller','pair_own']}
             for r in csv.DictReader((run/'watchlist.psv').open(), delimiter='|')]
    exports = []
    for kind in ['genglass-all','tables','mirrors']:
        for days in [7,28]:
            path = run/'raw'/f'{kind}-{days}d.xlsx'
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            if digest != context['raw_files'][path.name]['sha256']:
                raise ValueError('Competitor file changed since collection')
            sheets = read_xlsx(path)
            if len(sheets) != 1:
                raise ValueError('Unexpected competitor sheet count')
            cells = {r['row']: {k:v['value'] for k,v in r['cells'].items()} for r in sheets[0]['rows']}
            cols = list(cells[5]); headers = ['SKU']+[' '.join(cells[5][c].split()) for c in cols]
            rows=[]
            for i,r in cells.items():
                if i<7: continue
                match=re.search(r'/product/(\d+)', r.get('B') or '')
                if not match: continue
                row=[match[1]]
                for c in cols:
                    v=r.get(c)
                    # Percentages remain source percentage points, exactly as labelled.
                    row.append(float(v) if v is not None and c not in ['A','B','C','D','E','F','G','S','AF'] and re.fullmatch(r'-?\d+(?:\.\d+)?',v) else (v or None))
                rows.append(row)
            exports.append({'kind':kind,'days':days,'headers':headers,'rows':rows,'sha256':digest})
    return {'captured_at':context['finished_at'],'source_updated_at':context['source_updated_at'], 'exports':exports,'watch':watch}


def package(previous, runs, since, competitor_run, out):
    payload=json.loads(previous.read_text())
    catalogs=[]
    for run in sorted(runs.iterdir()):
        path=run/'raw/catalog.xlsx'; cp=run/'context.json'
        if not path.exists() or not cp.exists() or 'resume' in run.name: continue
        c=json.loads(cp.read_text())
        catalog=c.get('catalog', {})
        stamp=catalog.get('downloaded_at') or c.get('catalog_downloaded_at') or c.get('downloaded_at') or c.get('observed_at')
        if not stamp:
            observed=c.get('captured_at') or c.get('generated_at') or c.get('report_generation_times')
            if isinstance(observed,dict): stamp=max(observed.values())
            elif isinstance(observed,str): stamp=observed
            elif c.get('reports'):stamp=max(r['captured_at'] for r in c['reports'])
        stamp=stamp or c.get('started_at') or c.get('trigger_at') or c.get('triggered_at')
        if not stamp or stamp[:10]<since: continue
        digest=hashlib.sha256(path.read_bytes()).hexdigest()
        hashes=c.get('files') or c.get('raw_sha256') or c.get('source_sha256') or {}
        if hashes.get('catalog.xlsx') != digest:
            raise ValueError('Catalog hash not confirmed: '+run.name)
        phase={'morning':'утро','evening':'вечер'}.get(c['phase'],c['phase'])
        count=c.get('catalog_count_visible') or c.get('catalog_count') or catalog.get('count') or c.get('catalog_visible_count')
        if not isinstance(count,int): raise ValueError('Unconfirmed catalog count: '+run.name)
        catalogs.append(catalog_capture(path,stamp,phase,count))
    payload['catalogs']=merge_catalogs(payload.get('catalogs',[]),catalogs,backfill_since=since)
    if competitor_run:payload['competitors']=competitors(competitor_run)
    out.mkdir(parents=True,exist_ok=True)
    atomic_json(out/'cabinet_capture.json',payload)
    digest=hashlib.sha256((out/'cabinet_capture.json').read_bytes()).hexdigest()
    atomic_json(out/'manifest.json',{'public_sha256':digest,'ready_for_summary_publication':True,'backfill_since':since})
    atomic_json(out/'READY.json',{'sha256':digest})
    print(json.dumps({'catalog_observations':len(payload['catalogs']),'catalog_rows':sum(len(r['items']) for r in payload['catalogs']),'through':max(r['day'] for r in payload['catalogs']),'competitor_exports':len(payload.get('competitors',{}).get('exports',[]))}))

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--previous',type=Path,required=True);p.add_argument('--runs',type=Path,required=True)
    p.add_argument('--since',required=True);p.add_argument('--competitor-run',type=Path);p.add_argument('--out',type=Path,required=True)
    a=p.parse_args();dt.date.fromisoformat(a.since)
    package(a.previous,a.runs,a.since,a.competitor_run,a.out)
