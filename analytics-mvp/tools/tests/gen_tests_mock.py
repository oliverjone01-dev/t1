import json,csv,datetime,html
U='/root/.claude/uploads/6a6bf916-6777-52d3-938b-d993c73fac46/'
T=json.load(open(U+'db510097-tests.json'))
log={}
for r in csv.DictReader(open(U+'18587218-_____________.psv'),delimiter='|'):
    log[r['товар']]=r
rea=json.load(open('data/reakciya.json'))
measured=[t for t in rea.get('tests',[]) if t.get('status')=='измерен']
TODAY=datetime.date(2026,9,22)
def esc(s): return html.escape(str(s))
def days_to(d):
    try: return (datetime.date.fromisoformat(d)-TODAY).days
    except: return None
def statuschip(t):
    st=t.get('статус')
    if st and 'не запущен' in st: return '<span class="chip chip-off">не запущен</span>'
    dm=days_to(t.get('замер') or '')
    if dm is not None and dm>0: return f'<span class="chip chip-run">идёт · замер через {dm} дн</span>'
    if dm is not None and dm<=0: return '<span class="chip chip-done">пора мерить</span>'
    return '<span class="chip chip-run">идёт</span>'
def logrow(sku,ctrl=False):
    cls='ctrl' if ctrl else ''
    r=log.get(sku)
    if not r: return f'<tr class="{cls}"><td>{esc(sku)}</td><td colspan="5" class="muted">нет в логе кампаний</td></tr>'
    rec=esc(r.get('ставка_рекоменд','') or '—'); fin=esc(r.get('ставка_финальная','') or '—')
    start=esc(r.get('старт','')[:16].replace('T',' '))
    return (f'<tr class="{cls}"><td>{esc(sku)}</td><td class="r">{esc(r.get("показы_за_неделю_до",""))}</td>'
            f'<td class="r">{esc(r.get("соинвест_%",""))}</td><td class="r">{rec} → <b>{fin}</b></td>'
            f'<td>{start}</td><td class="muted">{esc(r.get("контроль",""))}</td></tr>')
cards=''
for t in T['тесты']:
    tst=t.get('тест',[]);ctl=t.get('контроль',[])
    if tst or ctl:
        rows=''.join(logrow(s) for s in tst)+''.join(logrow(s,True) for s in ctl)
        grp=('<div class="tbl-wrap"><table class="gtbl"><thead><tr><th>SKU</th><th class="r">Показы/нед</th>'
             '<th class="r">Соинвест %</th><th class="r">Ставка рек.→фин.</th><th>Старт</th><th>Контроль</th></tr></thead>'
             f'<tbody>{rows}</tbody></table></div>')
    else:
        grp='<div class="muted" style="padding:8px 2px">Группы не заданы — тест не запущен.</div>'
    cards+=(f'<section class="card"><div class="chead"><div class="ctitle">{esc(t["название"])} {statuschip(t)}</div></div>'
            f'<div class="hyp">{esc(t["гипотеза"])}</div>'
            f'<div class="meta"><span>Старт: <b>{esc(t.get("старт") or "—")}</b></span><span>Замер: <b>{esc(t.get("замер") or "—")}</b></span>'
            f'<span>Горизонт: <b>{esc(t.get("горизонт_дней",""))} дн</b></span><span>Тест <b>{len(tst)}</b> · Контроль <b>{len(ctl)}</b></span></div>'
            f'<div class="rule"><b>Правило:</b> {esc(t.get("правило",""))}</div>{grp}</section>')
mblock=''
if measured:
    mrows=''
    for t in measured:
        res=' · '.join(f'{esc(a)}: {esc(b)}' for a,b in t.get('res',[]))
        mrows+=(f'<div class="mrow"><div class="ctitle">{esc(t["name"])} <span class="chip chip-done">измерен</span></div>'
                f'<div class="meta"><span>Старт <b>{esc(t.get("started",""))}</b></span><span>Замер <b>{esc(t.get("read",""))}</b></span>'
                f'<span>Тест <b>{esc(t.get("t",""))}</b> · Контроль <b>{esc(t.get("c",""))}</b></span></div>'
                f'<div class="res">{res}</div><div class="muted">{esc(t.get("note",""))}</div></div>')
    mblock='<h2 class="sec">Измеренные тесты</h2>'+mrows
notes=''.join(f'<li>{esc(n)}</li>' for n in T.get('заметки',[]))
metrics=' · '.join(esc(m) for m in T.get('метрики',[]))
CSS=""":root{--bg:#0b0f17;--card:#12161f;--soft:#232B36;--ink:#e8eef2;--ink2:#9fb2c0;--ink3:#5d7484;--cy:#22D3EE;--up:#34D399;--dn:#FF5A5F;--warn:#E5B567}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 system-ui,Segoe UI,Roboto,sans-serif}
.nav{background:#1a2330;border-bottom:1px solid var(--cy);padding:9px 18px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:center;font-size:13px}
.nav a{color:#cfe8ef;text-decoration:none;padding:4px 10px;border-radius:7px}.nav a.on{background:var(--cy);color:#04222a;font-weight:700}
.wrap{max-width:1080px;margin:0 auto;padding:18px 16px 60px}
h1{font-size:20px;margin:8px 2px 4px}.sub{color:var(--ink3);margin:0 2px 16px}
.sec{font-size:15px;color:var(--cy);margin:22px 2px 10px;border-bottom:1px solid var(--soft);padding-bottom:6px}
.card{background:var(--card);border:1px solid var(--soft);border-radius:12px;padding:14px 16px;margin-bottom:14px}
.chead{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.ctitle{font-weight:700;font-size:15px}
.chip{font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:20px;white-space:nowrap}
.chip-run{background:rgba(34,211,238,.15);color:var(--cy)}.chip-off{background:rgba(93,116,132,.2);color:var(--ink3)}.chip-done{background:rgba(52,211,153,.16);color:var(--up)}
.hyp{color:var(--ink2);margin:8px 0}.meta{display:flex;gap:16px;flex-wrap:wrap;font-size:12.5px;color:var(--ink3);margin:6px 0}.meta b{color:var(--ink)}
.rule{font-size:12.5px;color:var(--ink2);background:rgba(229,181,103,.08);border-left:3px solid var(--warn);padding:7px 10px;border-radius:6px;margin:8px 0}
.tbl-wrap{overflow-x:auto;margin-top:8px;max-height:340px;overflow-y:auto}
.gtbl{width:100%;border-collapse:collapse;font-size:12px}
.gtbl th{color:var(--ink3);text-align:left;font-weight:600;padding:5px 7px;border-bottom:1px solid var(--soft);position:sticky;top:0;background:var(--card)}
.gtbl td{padding:5px 7px;border-bottom:1px solid rgba(255,255,255,.04)}.gtbl .r{text-align:right}
.gtbl tr.ctrl td:first-child{color:var(--ink3)}.gtbl tr.ctrl{background:rgba(93,116,132,.06)}
.muted{color:var(--ink3)}.mrow{background:var(--card);border:1px solid var(--soft);border-radius:12px;padding:12px 16px;margin-bottom:10px}
.res{font-weight:700;color:var(--up);margin:6px 0}.notes{background:var(--card);border:1px solid var(--soft);border-radius:12px;padding:10px 16px}
.notes li{color:var(--ink2);margin:4px 0}.legend{font-size:12px;color:var(--ink3);margin:2px 2px 14px}.legend b{color:var(--ink2)}"""
HTML=(f'<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
      f'<title>GENGLASS · Тесты (макет)</title><style>{CSS}</style></head><body>'
      '<div class="nav"><a>Обзор</a><a>Товары и заказы</a><a>Воронка</a><a>Деньги</a><a>Маркетинг</a><a>Реакция</a><a class="on">Тесты</a><a>Конкуренты</a></div>'
      '<div class="wrap"><h1>Тесты · A/B по рекламе</h1>'
      f'<p class="sub">Проверяем гипотезы по соинвесту и ставке. Метрики замера: {metrics}. Обновлено {esc(T.get("обновлено",""))}. <b style="color:var(--warn)">МАКЕТ</b> — согласовать до постройки.</p>'
      '<p class="legend">Строки <b>тест</b> — обычные, <b>контроль</b> — серые. Ставки/показы — из лога кампаний кабинета.</p>'
      f'{cards}{mblock}<h2 class="sec">Заметки и предупреждения</h2><div class="notes"><ul>{notes}</ul></div></div></body></html>')
open('/tmp/claude-0/katya-tests-mock.html','w',encoding='utf-8').write(HTML)
print('mock written:',len(HTML),'bytes | tests:',len(T['тесты']),'| measured:',len(measured),'| log rows:',len(log))
