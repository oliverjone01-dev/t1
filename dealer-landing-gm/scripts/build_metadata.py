"""Build native HTML metadata from explicit site facts; no network or packages."""
from pathlib import Path
from urllib.parse import urlsplit
from html import escape
from datetime import date
import json, re
from html_tree import P,N,fragment

ROOT=Path(__file__).resolve().parents[1]
config=json.loads((ROOT/'site.config.json').read_text())
production=config['mode']=='production'
url=config.get('production_url') if production else config['public_url']
def valid_url(value):
 p=urlsplit(value or '')
 return p.scheme=='https' and bool(p.netloc) and not p.username and not p.query and not p.fragment and value.endswith('/')
if not valid_url(url):raise ValueError('Set a complete HTTPS canonical URL ending in /, without query or fragment')
updated=date.fromisoformat(config['updated_at'])
dealer=config['dealer']
if production:
 if not all(dealer.get(k) for k in ['name','city','service_area']):raise ValueError('Production needs actual dealer name, city and service area')
 if not (dealer.get('phone') or dealer.get('email')):raise ValueError('Production needs an actual contact')
 if dealer.get('phone') and len(re.sub(r'\D','',dealer['phone']))<10:raise ValueError('Invalid dealer telephone')
 if dealer.get('email') and not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$',dealer['email']):raise ValueError('Invalid dealer email')
p=P();p.feed((ROOT/'index.html').read_text());tree=p.root
def byid(i):return next(n for n in tree.walk() if n.a.get('id')==i)
def bydata(i):return next(n for n in tree.walk() if n.a.get('data-node-id')==i)
def text(n,t):n.c=[t]
# Preserve readable text across visual line breaks, including textContent and no-CSS readers.
for heading in [n for n in tree.walk() if n.t in {'h1','h2','h3'}]:
 for i in range(len(heading.c)-1,-1,-1):
  child=heading.c[i]
  if isinstance(child,N) and i+1<len(heading.c) and isinstance(heading.c[i+1],N) and child.text() and heading.c[i+1].text():
   if not child.text()[-1].isspace() and not heading.c[i+1].text()[0].isspace():heading.c.insert(i+1,' ')
  if isinstance(child,N) and child.t=='br' and i+1<len(heading.c):
   following=heading.c[i+1]
   if isinstance(following,str) and not following.startswith(' '):heading.c[i+1]=' '+following
# Public copy is editorial content, not audit commentary. Keep source evidence in docs.
editorial=json.loads((ROOT/'content.ru.json').read_text())
for node_id,value in editorial.items():
 n=bydata(node_id)
 if '\n' in value:
  old_spans=[c for c in n.c if isinstance(c,N) and c.t=='span']
  lines=value.split('\n');children=[]
  for i,line in enumerate(lines):
   span=old_spans[i] if i<len(old_spans) else N('span')
   span.c=[line];span.p=n
   if i:children.append(' ')
   children.append(span)
  n.c=children
 else:text(n,value)
copy=bydata('94:338')
notes=[n for n in copy.walk() if n.a.get('class')=='material-note']
if notes:note=notes[0];note.c=[]
else:note=copy.append(N('div',[('class','material-note')]))
for n in fragment('<h3>Наборное стекло соединяем УФ-клеем</h3><p>Для наборных памятников используем незакалённое стекло. Соединяем отдельные элементы УФ-клеем, без полимерной плёнки. Конструкцию и крепление подбираем под изделие.</p>'):note.append(n)
form=byid('request-form')
form_notes=[n for n in form.walk() if n.a.get('class')=='form-note']
text(form_notes[0],'Контакт добавим в текст запроса.')
text(form_notes[1],'Подготовим запрос на этой странице. Данные никуда не отправляем.')
footer=next(n for n in tree.walk() if n.t=='footer')
footer.c=[n for n in footer.c if not (isinstance(n,N) and n.a.get('class') in {'source-note','updated-note'})]
for n in footer.walk():
 if n.a.get('class')=='demo-note':text(n,'Используем шаблонные контакты. Запрос можно подготовить и скачать; данные никуда не отправляем.')

# Use existing subject media, not stock substitutes. Exported derivatives preserve geometry.
manifest_path=ROOT/'assets/responsive-images.json'
manifest=json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
for img in [n for n in tree.walk() if n.t=='img']:
 name=Path(img.a.get('src','')).name
 if name in manifest:
  item=manifest[name];img.a['srcset']=', '.join(f"assets/{x['file']} {x['width']}w" for x in item)
  if name=='d0125.webp':img.a.update({'sizes':'(max-width: 1023px) 730px, 100vw','fetchpriority':'high'})
  else:
   node=img;sid=''
   while node.p:
    if node.t=='section':sid=node.a.get('id');break
    node=node.p
   img.a['sizes']='(max-width: 1023px) calc(100vw - 88px), 460px' if sid=='memorials' else '(min-width: 1440px) 628px, (min-width: 1024px) calc(44.45vw - 12px), calc(100vw - 40px)'

head=next(n for n in tree.walk() if n.t=='head')
keep=[]
for n in head.c:
 if not isinstance(n,N):continue
 if n.t=='meta' and (n.a.get('charset') or n.a.get('name') in {'viewport','theme-color'}):keep.append(n)
 if n.t=='link' and (n.a.get('rel')=='stylesheet' or n.a.get('as')=='font'):keep.append(n)
 if n.t=='script' and n.a.get('src'):keep.append(n)
head.c=keep
title='Памятники и портреты на стекле — GLASS-MEMORY'
description='Подберём памятник из стекла, портрет с керамической печатью, стеклянный цветник или ограждение GLASS-MEMORY. Согласуем форму, крепление и оформление.'
head.append(N('title')).c=[title]
for name,content in [('description',description),('robots','index, follow, max-image-preview:large' if production else 'noindex, follow'),('twitter:card','summary_large_image'),('twitter:title',title),('twitter:description',description),('twitter:image',url+'assets/7c708.webp')]:head.append(N('meta',[('name',name),('content',content)]))
head.append(N('link',[('rel','canonical'),('href',url)]))
head.append(N('link',[('rel','icon'),('type','image/svg+xml'),('href','assets/favicon.svg')]))
for name,content in [('og:type','website'),('og:locale','ru_RU'),('og:site_name','GLASS-MEMORY'),('og:title',title),('og:description',description),('og:url',url),('og:image',url+'assets/7c708.webp'),('og:image:alt','Стеклянное ограждение с растительным декором GLASS-MEMORY')]:head.append(N('meta',[('property',name),('content',content)]))
categories=[('Памятники и стелы','memorials'),('Портреты на стекле','technology'),('Стеклянные цветники','flowerbeds'),('Ограждения','fences'),('Рамы и подставки','frames'),('Крепление к памятнику','mounting')]
graph=[{'@type':'WebSite','@id':url+'#website','url':url,'name':'GLASS-MEMORY — изделия из стекла','inLanguage':'ru-RU'},
 {'@type':'Brand','@id':url+'#brand','name':'GLASS-MEMORY','url':config['brand_url']},
 {'@type':'WebPage','@id':url+'#webpage','url':url,'name':title,'description':description,'inLanguage':'ru-RU','dateModified':config['updated_at'],'isPartOf':{'@id':url+'#website'},'about':{'@id':url+'#brand'},'mainEntity':{'@id':url+'#products-list'}},
 {'@type':'ItemList','@id':url+'#products-list','name':'Направления изделий и оформления','itemListElement':[{'@type':'ListItem','position':i+1,'name':name,'url':url+'#'+anchor} for i,(name,anchor) in enumerate(categories)]}]
if production:
 org={'@type':'Organization','@id':url+'#dealer','name':dealer['name'],'url':url,'areaServed':dealer['service_area']}
 if dealer.get('phone'):org['telephone']=dealer['phone']
 if dealer.get('email'):org['email']=dealer['email']
 graph.append(org);graph[2]['publisher']={'@id':url+'#dealer'}
 phone=next((n for n in tree.walk() if n.t=='a' and 'phone' in n.a.get('class','').split()),None)
 if phone:
  phone.a['href']='tel:'+re.sub(r'[^+\d]','',dealer['phone']) if dealer.get('phone') else 'mailto:'+dealer['email']
  for n in phone.walk():
   if n.t=='span':text(n,dealer.get('phone') or dealer['email'])
   if n.t=='small':text(n,dealer['name'])
 for n in footer.walk():
  if n.a.get('class')=='demo-note':text(n,'Запрос в форме подготавливается в браузере и не отправляется автоматически. Для обращения используйте контакты дилера.')
 notes=[n for n in footer.walk() if n.a.get('class')=='dealer-note']
 note=notes[0] if notes else footer.append(N('p',[('class','dealer-note')]))
 text(note,dealer['name']+' · '+dealer['city']+' · Территория обслуживания: '+dealer['service_area'])
schema=head.append(N('script',[('type','application/ld+json')]));schema.c=[json.dumps({'@context':'https://schema.org','@graph':graph},ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')]
(ROOT/'index.html').write_text('<!doctype html>'+tree.html())
if production:
 (ROOT/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'+escape(url)+'</loc><lastmod>'+config['updated_at']+'</lastmod></url></urlset>')
elif (ROOT/'sitemap.xml').exists():(ROOT/'sitemap.xml').unlink()
print(json.dumps({'mode':config['mode'],'canonical':url,'robots':'index' if production else 'noindex','schema_nodes':len(graph),'title_length':len(title),'description_length':len(description)},ensure_ascii=False))
