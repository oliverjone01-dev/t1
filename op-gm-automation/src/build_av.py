#!/usr/bin/env python3
"""Нормализованный слой Авито-API для сайта ОП ГМ. Кабинеты: OLD-G / NEW-B.
Выход: av.json (чаты + сообщения + справочники), recon.json (сверка с CSV)."""
import json, re, csv, collections, datetime
# Пути к выгрузкам передаются аргументами: OLD_RAW OLD_CSV NEW_RAW NEW_CSV [OUT_DIR]
import sys, os
if len(sys.argv)<5: sys.exit('usage: build_av.py OLD_RAW.json OLD_INDEX.csv NEW_RAW.json NEW_INDEX.csv [OUT_DIR]')
CAB=[('OLD-G',sys.argv[1],sys.argv[2]),('NEW-B',sys.argv[3],sys.argv[4])]
OUT=sys.argv[5] if len(sys.argv)>5 else '.'
TZ=datetime.timezone(datetime.timedelta(hours=3))
REPLY={'text','image','link','file','video','voice'}
TCODE={'text':'t','image':'i','appCall':'c','system':'s','link':'l','video':'v','file':'f','voice':'a'}
TMPL='Вы просматривали наше объявление'
PRICE_Q=re.compile(r'(?i)(сколько\s+(стоит|стоить|будет стоить|по цене|денег|это стоит|обойд|выйдет|за\s)|стоимост|(?<![а-яё])цен[аыуеой]?(?![а-яё])|ценник|почём|почем|прайс|во сколько|бюджет)')
QUAL=re.compile(r'(?i)(размер|пришлите фото|фото с|для расч[её]та|рассчита|посчита)')
NOT_PQ=re.compile(r'(?i)((что\s+)?входит в стоимост\S*|сколько\s+гарант|на\s?сколько)')
CLI_NOT_OURS=re.compile(r'(?i)(из гранита|из мрамора|нам надо из|нужен гранит|не из стекла)')
PRICE_A=re.compile(r'(?i)((?<!\d)\d{1,3}\s\d{3}(?!\d)(?!\s*(мм|см|х|x|\*))|(?<!\d)\d{4,6}\s*(руб|₽|р(?![а-яё])|тыс|т\.?\s?р)|(?<!\d)\d{5,6}(?!\d)|(?<!\d)\d{1,3}\s*(тыс|т\.\s?р))')
PRICE_OTHER=re.compile(r'(?i)(на почт|почту|e-?mail|@|ватсап|whatsapp|вотсап|\bмакс\b|\bmax\b|телеграм|прайс|калькулятор|рассчитать[^.]{0,40}сайт|коммерческое предложение|\bкп\b|отправил[аи]?\s+(вам\s+)?(расч|стоим|цен|прайс|кп))')
NOT_OURS=re.compile(r'(?i)(с камнем\s*(мы\s*)?не работаем|не работаем с|не изготавливаем|не делаем|работаем только со стекл|только стеклянн)')
COURT=re.compile(r'(?i)(спасибо|спс|хорошо|ок|окей|ok|понятно|ясно|благодарю|договорились|до свидания|всего доброго|да|нет|ладно|принято)[\s.!,)]*(большое|вам|огромное|за информацию|за ответ)?[\s.!,)]*')
PH=re.compile(r'(?:\+7|8|7)[\s\-\(]*(9\d{2})[\s\-\)]*(\d{3})[\s\-]*(\d{2})[\s\-]*(\d{2})')
AUTO=re.compile(r'(?i)(первый освободившийся|в данный момент мы не можем вам ответить|спасибо за обращение в компанию|^\s*оператор\s*$)')
VENDOR=re.compile(r'(?i)(предлага(ю|ем)\b|устроиться на работу|противогаз|кто у вас занимается подготовкой|закупаетесь ли|предложить помощь|занимаюсь подготовкой портретов|предлагает вам|ищу работу|на работу не требу|требуются\b|требуется\s*\?|ретуш[её]р|наши работы|занимаемся производством|студия ретуши|услуги по ретуши|выполним любой объем|заинтересует услуга|специализируется на ретуши|дизайнер с опытом|бригада монтажников|оптом интерес|проектированием мемориал|подробности 👇|^\s*тест\s*\d*\s*$|покупаете ли)')
ORDER=re.compile(r'(?i)(хочу заказать|хотим заказать|хотел[аи]? бы заказать|от меня требуется)')
COMPL=re.compile(r'(?i)(опечатк|написано\s.{0,40}вместо|ошибк[аиу]\s+(в|на)\s|брак(?!ован)|трещин|претензи|жалоб|верните деньги|напечатали не)')
B2B=re.compile(r'(?i)(сотрудничеств|представительств|партн[её]р|дилер|оптом|ритуальн\S* услуг|франшиз)')
QUESTION=re.compile(r'(?i)(\?|сколько|какой|какая|какие|как |можно|когда|где|есть ли|подскажите|а если|почему|зачем|стоимост|цена)')
CLOSING=re.compile(r'(?i)(спасибо|благодар|подума|отпишусь|напишу|определ|ознаком|обратимся|будем знать|буду иметь|так и будет|хорошо|понятно|ясно|\bок\b|ладно|договорились|учту|позже|🤝|👍|до свидания|досвидан|всего доброго|не нужно|не надо|не интересно|неинтересно|заказывать у нас)')
ASK=re.compile(r'(напишите|пришлите|отправьте|уточните|подскажите|сообщите|скиньте|укажите)',re.I)
WARR=re.compile(r'гарант[^.!?]{0,40}?(\d+)\s*(?:-х|-ми)?\s*лет',re.I)
def sec(v): return int(v/1e7)
def systext(b):
    ch=b.get('chunks') or []
    t=' '.join((c.get('value') or {}).get('text','') for c in ch if c.get('type')=='text')
    t=re.sub(r'\{\{attr\d+\}\}','',t).strip()
    if 'напомнили собеседнику' in t: return 'Авито само напомнило клиенту о диалоге'
    return t[:140] or (b.get('text') or '')[:140]
ads={}; chats=[]; msgs={}; recon={}; PHONES={}
def ad_id(title):
    title=title or '(без названия)'
    if title not in ads: ads[title]=len(ads)
    return ads[title]
for tag,raw,csvp in CAB:
    d=json.load(open(raw)); H=d['history']; O=d['ownerId']
    meta={c['channelId']:c for c in d['chats']}
    nmsg=0
    for ch,r in H.items():
        it=sorted(r.get('result',{}).get('items',[]), key=lambda m:m['created'])
        if not it: continue
        c=meta.get(ch,{})
        title=((c.get('context') or {}).get('value') or {}).get('title')
        cname=''
        for u in (c.get('users') or []):
            if u.get('id')!=O: cname=(u.get('name') or '').strip()
        M=[]
        for m in it:
            b=m.get('body') or {}; t=m['type']
            who='s' if t=='system' else ('m' if m['fromUid']==O else 'c')
            if t=='system': txt=systext(b)
            elif t=='appCall':
                st=b.get('status'); dr=b.get('direction'); du=b.get('duration') or 0
                txt=('Пропущенный звонок' if st=='missed' else ('Отменённый звонок' if st=='cancelled' else f"Звонок {'входящий' if dr=='in' else 'исходящий'}, {du} с"))
                who='c' if dr=='in' else 'm'
            elif t=='image': txt='[фото]'
            elif t=='video': txt='[видео]'
            elif t=='voice': txt='[голосовое]'
            elif t=='file': txt='[файл] '+(b.get('name') or '')
            elif t=='link': txt=(b.get('text') or b.get('url') or '[ссылка]')
            else: txt=b.get('text') or ''
            txt=re.sub(r'\s+',' ',txt).strip()[:600]
            M.append([sec(m['created']),who,TCODE.get(t,'t'),txt]+([b.get('status'),b.get('direction'),b.get('duration') or 0] if t=='appCall' else []))
        for x in M:
            if x[1]=='m' and AUTO.search(x[3]): x[1]='a'   # автоответ, не человек
        nmsg+=len(M)
        cli=[x for x in M if x[1]=='c' and x[2]!='c' and x[3]!='Сообщение удалено']
        mgr=[x for x in M if x[1]=='m' and x[2] in ('t','i','l','f','v','a')]
        calls=[x for x in M if x[2]=='c']
        ct=' '.join(x[3] for x in cli); mt=' '.join(x[3] for x in mgr)
        rec={'id':ch,'cab':tag,'ad':ad_id(title),'cn':cname,
             'c0':M[0][0],'last':M[-1][0],'nc':len(cli),'nm':len(mgr),
             'ns':sum(1 for x in M if x[1]=='s'),
             'cin':sum(1 for x in calls if x[5]=='in' and x[4]=='success'),
             'cout':sum(1 for x in calls if x[5]=='out'),
             'cmiss':sum(1 for x in calls if x[4]=='missed'),
             'cdur':sum(x[6] for x in calls)}
        outbound = any(x[1]=='m' and TMPL in x[3] for x in M)
        first_c = cli[0][0] if cli else None
        if cli and B2B.search(' '.join(x[3] for x in cli)): rec['b2b']=1
        if cli and COMPL.search(' '.join(x[3] for x in cli)): rec['compl']=1
        live=[x for x in M if x[1] not in ('s','a') and not (x[2]=='c' and x[4]!='success') and x[3]!='Сообщение удалено']
        if live: rec['lw']=live[-1][1]
        if cname.strip().lower() in ('авито','avito') or any('коллтрекинг' in x[3].lower() or 'услугу продвижения' in x[3].lower() for x in cli):
            rec['kind']='vendor'
        elif cli and VENDOR.search(cli[0][3]) and not ORDER.search(cli[0][3]):
            rec['kind']='vendor'          # поставщик, соискатель, спам: не клиент
        elif not cli and not calls:
            rec['kind']='cold'            # холодная рассылка без отклика
        elif outbound and (not cli or any(x[1]=='m' and TMPL in x[3] and x[0]<cli[0][0] for x in M)):
            rec['kind']='cold_reply'      # холодная рассылка, клиент ответил
        else:
            rec['kind']='in'              # клиент пришёл сам
        rec['t']=first_c if first_c else M[0][0]
        if first_c:
            r1=next((x for x in mgr if x[0]>first_c), None)
            rec['lag']= (r1[0]-first_c) if r1 else None
        else: rec['lag']=None
        P=[]
        if cli:
            call_after=any(x[2]=='c' and x[4]=='success' and x[0]>cli[0][0] for x in M)
            if not mgr and not call_after: P.append('noresp')
            elif not mgr: pass
            else:
                if rec['lag'] is not None and rec['lag']>3600: P.append('slow')
                lastcli=cli[-1][3].strip()
                if PRICE_Q.search(NOT_PQ.sub(' ',ct)):
                    rec['pq']=1
                    mt_np=PH.sub(' ',mt)
                    if PRICE_A.search(mt_np): rec['ps']='num'
                    elif PRICE_OTHER.search(mt): rec['ps']='other'
                    elif NOT_OURS.search(mt): rec['ps']='notours'
                    elif CLI_NOT_OURS.search(ct) or any(VENDOR.search(x[3]) for x in cli): rec['ps']='notours'
                    elif rec.get('lw')=='c' and (COURT.fullmatch(lastcli) or (CLOSING.search(lastcli) and '?' not in lastcli)): rec['ps']='closed'
                    elif QUAL.search(mt) and rec.get('lw')!='c': rec['ps']='qual'
                    else: P.append('noprice')
                if '?' not in mt and not ASK.search(mt): P.append('noquestion')
                first=(cname.split() or [''])[0]
                if re.fullmatch(r'[А-ЯЁ][а-яё]{2,}',first):
                    if not re.search(r'\b'+re.escape(first[:-1])+r'[а-яё]{0,2}\b',mt,re.I): P.append('noname')
                lastc=cli[-1][0]; lastm=mgr[-1][0]
                rec['lc']=lastc
                lt=cli[-1][3].strip()
                called=any(x[2]=='c' and x[4]=='success' and x[0]>lastc for x in M)
                if lastc>lastm and not called and not COURT.fullmatch(lt) and not VENDOR.search(lt):
                    if PH.search(lt): P.append('phoneleft'); rec['phone']=1
                    elif re.fullmatch(r'\S*https?://\S+',lt): pass
                    elif (not CLOSING.search(lt) or '?' in lt) and (QUESTION.search(lt) or len(lt)>=40): P.append('abandoned')
                pushed=any(x[0]-max([c[0] for c in cli if c[0]<x[0]] or [x[0]])>86400 for x in mgr)
                if pushed: rec['push']=1
                if lastm>lastc and not pushed: P.append('nofollow')
                if WARR.search(mt): P.append('warranty')
        if rec['cmiss'] and not rec['cout']: P.append('misscall')
        if any(x[1]=='s' and x[3]=='Авито само напомнило клиенту о диалоге' for x in M) and not rec.get('push') and cli: P.append('robotonly')
        ph=set('7'+''.join(mo.groups()) for x in M if x[1]=='c' for mo in PH.finditer(x[3]))
        if ph: PHONES[ch]=ph
        if rec['kind']=='vendor': P=[]
        rec['p']=P
        chats.append(rec); msgs[ch]=M
    # сверка с CSV
    rows=list(csv.reader(open(csvp,encoding='utf-8-sig')))[1:]
    recon[tag]={'json_chats':len(H),'json_msgs':nmsg,'csv_rows':len(rows),'exported':d['exported']}
    if tag=='NEW-B':
        mx=max(r[1] for r in rows)
        keys=collections.Counter((r[1],r[4].strip()) for r in rows)
        miss=collections.Counter()
        for c in d['chats']:
            t=datetime.datetime.fromtimestamp(c['created']/1e7,TZ).strftime('%Y-%m-%d %H:%M')
            nm=next(((u.get('name') or '').strip() for u in (c.get('users') or []) if u.get('id')!=O),'')
            if keys[(t,nm)]>0: keys[(t,nm)]-=1
            else: miss['sep' if t>='2026-09' else ('late_aug' if t>='2026-08-22' else ('old' if t<'2026-04' else 'mid'))]+=1
        recon[tag].update(csv_max=mx,miss=dict(miss))
    early=sum(1 for c in chats if c['cab']==tag and c['t']<int(datetime.datetime(2026,3,31,21,tzinfo=datetime.timezone.utc).timestamp()))
    recon[tag]['before_apr']=early
cabof={c['id']:c['cab'] for c in chats}
byph={}
for ch,ps in PHONES.items():
    for p in ps: byph.setdefault(p,set()).add(cabof[ch])
both={p for p,cs in byph.items() if len(cs)>1}
for c in chats:
    if PHONES.get(c['id'],set())&both: c['both']=1
print('клиентов в обоих кабинетах (по телефону):',len(both),'чатов с флагом:',sum(1 for c in chats if c.get('both')))
json.dump({'ads':sorted(ads,key=ads.get),'chats':chats,'msgs':msgs,'exported':'2026-09-22'},
          open(os.path.join(OUT,'av.json'),'w'),ensure_ascii=False,separators=(',',':'))
json.dump(recon,open(os.path.join(OUT,'recon.json'),'w'),ensure_ascii=False,indent=1)
print('чатов',len(chats),'| объявлений',len(ads),'| сверка',recon)
k=collections.Counter((c['cab'],c['kind']) for c in chats); print(k)
pc=collections.Counter((c['cab'],p) for c in chats for p in c['p'])
for p in sorted(set(x[1] for x in pc)): print(f"  {p:12} OLD-G {pc[('OLD-G',p)]:4}  NEW-B {pc[('NEW-B',p)]:4}")
