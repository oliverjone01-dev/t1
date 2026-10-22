#!/usr/bin/env python3
"""Import an approved offline mapping, projecting only fields needed by the public page."""
import argparse,copy,hashlib,json,pathlib,re

def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def reference(ref,field):
    return {'file':pathlib.Path(ref['path']).name,'sha256':ref['sha256'],'collectedAt':ref['at'],'field':field}

def project(d):
    products={}
    for sku,p in d['products'].items():
        price_field='by_period.final_price' if p['dailyVerified'] else 'price_graph[27]'
        provenance={'mpstats':reference(p['dailySource'] or p['catalogSource'],price_field)}
        provenance['catalog']=reference(p['catalogSource'],'sales / revenue')
        own=p.get('ownPrices')
        if own:
            for key,filename,sha,field in [('cabinet',own['siteSource'],own['siteSha256'],'site'),('api',own['apiSource'],own['apiSha256'],'price')]:
                provenance[key]={'file':pathlib.Path(filename).name,'sha256':sha,'date':own['date'],'field':field}
        products[sku]={k:copy.deepcopy(p[k]) for k in ['sku','own','modelId','article','seller','name','attributes','metrics','metricDate','history','dailyVerified','observedDays']}
        products[sku]['provenance']=provenance
        products[sku]['keywords']=[{'period':r['period'],'rows':[{k:copy.deepcopy(row[k]) for k in ['query','avg_position','positions']} for row in r['data']], 'source':reference(r['source'],'avg_position / positions')} for r in p['keywords']]
    result={'schemaVersion':1,'period':d['period'],'models':[{k:m[k] for k in ['id','name','rank']} for m in d['models']],
        'products':products,'pairs':copy.deepcopy(d['pairs']),
        'pendingOriginal':copy.deepcopy(d['pendingOriginal']),'excluded':copy.deepcopy(d['excluded']),
        'source':{'workbook':d['source']['workbook'],'workbookSha256':d['source']['workbookSha256'],'mappingSheet':d['source']['mappingSheet'],'mappingColumns':d['source']['mappingColumns'],'mpstatsBundleSha256':d['source']['mpstatsBundleSha256']}}
    text=json.dumps(result,ensure_ascii=False,separators=(',',':'),allow_nan=False)
    assert not any(s in text for s in ['/Users/','config.toml','mcp.mpstats.io','siteRow','apiRow','dailyRaw','catalogRaw'])
    assert len(result['pairs'])==len({(p['ownSku'],p['competitorSku']) for p in result['pairs']})
    assert len(result['products'])==len({s for p in result['pairs'] for s in [p['ownSku'],p['competitorSku']]})
    return text+'\n'

if __name__=='__main__':
    a=argparse.ArgumentParser();a.add_argument('input',type=pathlib.Path);a.add_argument('--output',type=pathlib.Path,default=pathlib.Path('data/competitors/mpstats-matched-2026-10-22.json'));o=a.parse_args()
    data=json.loads(o.input.read_text());text=project(data)
    o.output.parent.mkdir(parents=True,exist_ok=True);o.output.write_text(text)
    print(json.dumps({'output':str(o.output),'sha256':digest(o.output),'pairs':len(data['pairs']),'products':len(data['products'])}))
