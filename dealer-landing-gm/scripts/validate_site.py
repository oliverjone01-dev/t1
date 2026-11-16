"""Focused static release checks; does not simulate delivery or SEO visibility."""
from pathlib import Path
from urllib.parse import urlsplit,unquote
from collections import Counter
import json,re
from html_tree import P
ROOT=Path(__file__).resolve().parents[1]
p=P();p.feed((ROOT/'index.html').read_text());nodes=list(p.root.walk());config=json.loads((ROOT/'site.config.json').read_text())
errors=[]
def check(ok,msg):
 if not ok:errors.append(msg)
ids=[n.a['id'] for n in nodes if 'id' in n.a]
check(not [x for x,c in Counter(ids).items() if c>1],'Duplicate DOM IDs')
check(sum(n.t=='h1' for n in nodes)==1,'Expected one h1')
check(sum(n.t=='main' for n in nodes)==1,'Expected one main')
main=next(n for n in nodes if n.t=='main')
check(not any(n.t in {'header','footer'} for n in main.walk()),'Main contains header/footer landmarks')
for n in nodes:
 if n.t=='a' and n.a.get('href','').startswith('#'):check(n.a['href'][1:] in ids,'Dead anchor '+n.a['href'])
 if n.a.get('aria-labelledby'):check(all(x in ids for x in n.a['aria-labelledby'].split()),'Missing accessible label target')
 if n.a.get('aria-describedby'):check(all(x in ids for x in n.a['aria-describedby'].split()),'Missing field description target')
 if n.t=='img':
  check('alt' in n.a,'Image without alt')
  if n.a.get('src','').endswith('.webp'):check('width' in n.a and 'height' in n.a,'Raster image without dimensions')
  if n.a.get('srcset'):check(bool(n.a.get('sizes')),'srcset without sizes')
 for attr in ['src','href']:
  value=n.a.get(attr,'');u=urlsplit(value)
  if not value or value.startswith('#') or u.scheme or u.netloc:continue
  check((ROOT/unquote(u.path)).is_file(),'Missing local resource '+value)
 for part in n.a.get('srcset','').split(','):
  if part.strip():check((ROOT/part.strip().split()[0]).is_file(),'Missing srcset candidate '+part)
 for attr in n.a:check(not attr.lower().startswith('on'),'Inline event handler '+attr)
 check(not n.a.get('href','').lower().startswith('javascript:'),'Unsafe link protocol')
for path in re.findall(r'url\([\"\']?([^\)\"\']+)',(ROOT/'styles.css').read_text()):
 if not urlsplit(path).scheme:check((ROOT/path).is_file(),'Missing CSS asset '+path)
canon=[n.a['href'] for n in nodes if n.t=='link' and n.a.get('rel')=='canonical']
expected=config.get('production_url') if config['mode']=='production' else config['public_url']
check(canon==[expected],'Canonical differs from explicit configuration')
robots=next(n.a['content'] for n in nodes if n.t=='meta' and n.a.get('name')=='robots')
check(('noindex' in robots)==(config['mode']=='demo'),'Indexing differs from site mode')
schema=[n for n in nodes if n.t=='script' and n.a.get('type')=='application/ld+json']
check(len(schema)==1,'Expected one structured-data graph')
if schema:
 data=json.loads(''.join(schema[0].c));types=[n['@type'] for n in data['@graph']]
 check(all(t in types for t in ['WebPage','WebSite','Brand','ItemList']),'Missing core semantic entities')
 check(not any(t in types for t in ['Review','AggregateRating','Offer','FAQPage']),'Unsupported invented rich-result entity')
 if config['mode']=='demo':check('Organization' not in types and 'LocalBusiness' not in types,'Demo invents an operator')
 for entity in data['@graph']:
  for item in entity.get('itemListElement',[]):check(urlsplit(item['url']).fragment in ids,'Schema category points to missing section')
check((ROOT/'assets/OFL-Manrope.txt').is_file(),'Missing font license')
check((ROOT/'assets/Manrope.woff2').stat().st_size>10000,'Missing WOFF2 font')
if config['mode']=='demo':check(not (ROOT/'sitemap.xml').exists(),'noindex demo should not be in sitemap')
if errors:raise SystemExit('\n'.join(errors))
print(json.dumps({'status':'pass','html_checks':'landmarks, headings, anchors, descriptions, local assets, responsive candidates, canonical, robots, schema','mode':config['mode'],'images':sum(n.t=='img' for n in nodes),'enlargements':sum('data-photo-src' in n.a for n in nodes),'forms':sum(n.t=='form' for n in nodes)},ensure_ascii=False))
