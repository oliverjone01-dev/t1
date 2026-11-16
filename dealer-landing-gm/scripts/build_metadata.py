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
text(bydata('94:119'),'GLASS-MEMORY · ПАМЯТНИКИ И ПОРТРЕТЫ')
text(bydata('94:143'),'Стекло под задачу')
text(bydata('94:144'),'Триплекс, закалённое или наборное.')
text(bydata('94:137'),'Стойкий цвет керамической печати')
text(bydata('94:264'),'По данным каталога GLASS-MEMORY, керамическая печать сохраняет цвет 20+ лет. Срок и условия гарантии уточняют для конкретного изделия.')
for n in tree.walk():
 if n.t=='p' and n.text()=='Керамическая печать сохраняет цвет 20+ лет. Срок и условия гарантии уточняются при согласовании заказа.':
  text(n,'В каталоге GLASS-MEMORY заявлено сохранение цвета 20+ лет. Это характеристика печати, а срок и условия гарантии согласуют для конкретного изделия.')
 if n.t=='p' and n.text().startswith('Изготовление — 30 календарных дней'):
  text(n,'В каталоге GLASS-MEMORY указан цикл 30 календарных дней после утверждения макета; для мемориальных комплексов — 45–90 дней. Срок конкретного заказа зависит от изделия и сложности и согласуется до изготовления.')
copy=bydata('94:338')
if not any(n.a.get('class')=='material-note' for n in copy.walk()):
 for n in fragment('<div class="material-note"><h3>Триплекс и наборное стекло — разные конструкции</h3><p>В триплексе слои соединены полимерной плёнкой. Наборный памятник собирают из отдельных стеклянных элементов на УФ-клее; для него используется незакалённое стекло. Конструкцию и крепление подбирают под изделие.</p></div>'):copy.append(n)
footer=next(n for n in tree.walk() if n.t=='footer')
if not any(n.a.get('class')=='source-note' for n in footer.walk()):
 for n in fragment('<p class="source-note">Технические сведения — по каталогу GLASS-MEMORY. <a href="https://glass-memory.ru/ceramic-printing-on-glass" target="_blank" rel="noopener">Описание керамической печати у производителя ↗</a></p>'):footer.append(n)
times=[n for n in footer.walk() if n.t=='time']
if times:t=times[0]
else:
 n=footer.append(N('p',[('class','updated-note')]));n.c=['Обновлено '];t=n.append(N('time'))
t.a['datetime']=config['updated_at'];t.c=[str(updated.day)+' '+['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'][updated.month-1]+' '+str(updated.year)]

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
description='Памятники из триплекса, портреты с керамической печатью, стеклянные цветники и ограждения GLASS-MEMORY. Варианты оформления, крепления и порядок заказа.'
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
