#!/usr/bin/env python3
"""Приёмка склейки по §15 CLAUDE.md (Д-пакет ОП ГМ).
Запуск: accept_dpack.py A.json RAW1.json RAW2.json av.json recon.json
Блоки 1-4 и 5: независимый пересчёт, код сборки не импортируется. Блок 4б помечен как согласованность: он берёт
norm_msgs и make_rec из src/build_av.py и проверяет, что опубликованные записи получены по правилам сборки.
  A.json - D.av прошлой сборки (с recon), RAW1/RAW2 - сырые окна, av.json/recon.json - результат склейки.
Печатает только счётчики и хэши channelId, без имён, телефонов и текстов. Любой провал = код выхода 1."""
import json, sys, datetime, hashlib, collections, re

A, R1, R2, AV, RC = (json.load(open(p)) for p in sys.argv[1:6])
CABS = ('OLD-G', 'NEW-B'); FAIL = []
def check(name, ok, detail=''):
    print(('OK  ' if ok else 'FAIL'), name, detail)
    if not ok: FAIL.append(name)
def h(ch): return hashlib.sha256(ch.encode()).hexdigest()[:8]
def ym(t): return datetime.datetime.fromtimestamp(t, datetime.timezone(datetime.timedelta(hours=3))).strftime('%Y-%m')
AUTO = re.compile(r'(?i)(первый освободившийся|в данный момент мы не можем вам ответить|спасибо за обращение в компанию|^\s*оператор\s*$)')

# кабинет окна: где лежат его channelId в A (не по имени файла)
idsA = {t: {c['id'] for c in A['chats'] if c['cab'] == t} for t in CABS}
def tag_of(raw):
    ids = set(raw['history']); return max(CABS, key=lambda t: len(ids & idsA[t]))
W = {tag_of(r): r for r in (R1, R2)}
check('кабинеты окон различны', set(W) == set(CABS))
out = {t: {c['id']: c for c in AV['chats'] if c['cab'] == t} for t in CABS}

# 1. число channelId без повторов по кабинету и счётчики склейки
for t in CABS:
    b = {ch for ch, r in W[t]['history'].items() if r.get('result', {}).get('items')}
    u = idsA[t] | b
    check(f'{t}: channelId A∪B = json_chats', len(u) == RC[t]['json_chats'] == len(out[t]), f'{len(u)} / {RC[t]["json_chats"]} / {len(out[t])}')
    g = RC[t]['merge']
    check(f'{t}: kept_old, replaced, added', (len(idsA[t] - b), len(idsA[t] & b), len(b - idsA[t])) == (g['kept_old'], g.get('replaced', 0), g.get('added', 0)))
    check(f'{t}: overlap_missing = 0, window_missing = 0', g.get('overlap_missing', 0) == 0 and g.get('window_missing', 0) == 0)
check('повторов channelId нет', len(AV['chats']) == len({c['id'] for c in AV['chats']}))

# 2. С4: чаты только в A байт в байт (кроме флага «оба кабинета», его пересчитывает С8)
recA = {c['id']: c for c in A['chats']}
nb = lambda c: json.dumps({k: v for k, v in c.items() if k != 'both'}, ensure_ascii=False, sort_keys=True)
diff = [ch for t in CABS for ch in idsA[t] if ch not in W[t]['history'] and (nb(recA[ch]) != nb(out[t][ch]) or A['msgs'][ch] != AV['msgs'][ch])]
check('С4: чаты только в A без изменений', not diff, f'расхождений {len(diff)}')

# 3. первое сообщение клиента по сырому JSON (для пересчитанных и новых) и по A (для прочих), месяц с годом
def first_client_raw(items, O):
    cli = [m for m in items if m['type'] not in ('system', 'appCall') and m['fromUid'] != O and (m.get('body') or {}).get('text') != 'Сообщение удалено']
    return int(min(m['created'] for m in cli) / 1e7) if cli else None
def first_client_A(M):
    cli = [x[0] for x in M if x[1] == 'c' and x[2] != 'c' and x[3] != 'Сообщение удалено']
    return min(cli) if cli else None
mism = []; months = collections.Counter(); months_out = collections.Counter()
for t in CABS:
    O = W[t]['ownerId']
    for ch, c in out[t].items():
        items = (W[t]['history'].get(ch) or {}).get('result', {}).get('items') or []
        fc = [x for x in (first_client_raw(items, O) if items else None, first_client_A(A['msgs'][ch]) if ch in recA else None) if x is not None]
        exp = min(fc) if fc else AV['msgs'][ch][0][0]
        if exp != c['t']: mism.append(h(ch))
        months[(t, ym(exp))] += 1; months_out[(t, ym(c['t']))] += 1
check('время первого сообщения клиента = независимый пересчёт', not mism, f'расхождений {len(mism)} {mism[:5]}')
check('распределение по месяцам с годом совпадает', months == months_out)
for t in CABS:
    pre = sum(v for (tt, m), v in months.items() if tt == t and m < '2026-04')
    check(f'{t}: before_apr = чаты раньше 2026-04', pre == RC[t]['before_apr'], f'{pre} / {RC[t]["before_apr"]}')
print('месяцы:', {f'{t} {m}': v for (t, m), v in sorted(months.items())})

# 4. ВСЕ чаты окна, независимо: первое сообщение клиента, первый ответ, «не ответили вообще».
#    Обрезанные лимитом и восстановленные считаются на объединении: ранние строки A (раньше первого сообщения окна) плюс сырое окно.
def ev_raw(items, O):
    out = []
    for m in sorted(items, key=lambda m: m['created']):
        b = m.get('body') or {}; t = m['type']; sec_ = int(m['created'] / 1e7)
        if t == 'system': out.append((sec_, 's', 'sys', None, '')); continue
        if t == 'appCall': out.append((sec_, 'c' if b.get('direction') == 'in' else 'm', 'call', b.get('status'), '')); continue
        txt = re.sub(r'\s+', ' ', b.get('text') or '').strip() if t == 'text' else ''
        who = 'c' if m['fromUid'] != O else ('a' if t == 'text' and AUTO.search(txt) else 'm')
        out.append((sec_, who, t, None, txt))
    return out
CODE = {'t': 'text', 'i': 'image', 'l': 'link', 'f': 'file', 'v': 'video', 'a': 'voice', 'c': 'call', 's': 'sys'}
def ev_A(M): return [(x[0], x[1], CODE.get(x[2], 'text'), x[4] if x[2] == 'c' else None, x[3]) for x in M]
def indep(E):
    cli = [e[0] for e in E if e[1] == 'c' and e[2] not in ('call', 'sys') and e[4] != 'Сообщение удалено']
    if not cli: return E[0][0], None, False
    fc = min(cli)
    mgr = [e[0] for e in E if e[1] == 'm' and e[2] in ('text', 'image', 'link', 'file', 'video', 'voice')]
    call_after = any(e[2] == 'call' and e[3] == 'success' and e[0] > fc for e in E)
    r1 = next((x for x in sorted(mgr) if x > fc), None)
    return fc, (r1 - fc if r1 else None), (not mgr and not call_after)
bad = collections.Counter(); nwin = 0
for t in CABS:
    O = W[t]['ownerId']
    for ch, r in W[t]['history'].items():
        items = r.get('result', {}).get('items') or []
        if not items: continue
        nwin += 1; E = ev_raw(items, O); b0 = E[0][0]
        if ch in recA: E = [e for e in ev_A(A['msgs'][ch]) if e[0] < b0] + E
        fc, lag, nor = indep(E); c = out[t][ch]
        if fc != c['t']: bad['t'] += 1
        if c['nc'] and lag != c['lag']: bad['lag'] += 1
        if c['kind'] != 'vendor' and nor != ('noresp' in c['p']): bad['noresp'] += 1   # у поставщиков сборка очищает проблемы
check(f'все {nwin} чатов окна: первое сообщение клиента, первый ответ, «не ответили вообще» (независимо)', not bad, dict(bad))

# 4б. СОГЛАСОВАННОСТЬ, не независимый пересчёт: опубликованные сообщения = ранние строки A + нормализованное окно,
#     запись каждого чата окна = make_rec на опубликованных сообщениях (ловит подмену флагов проблем и полей записи)
import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src'))
from build_av import norm_msgs, make_rec, chat_info
cm = collections.Counter()
for t in CABS:
    O = W[t]['ownerId']; meta = {c['channelId']: c for c in W[t]['chats']}
    for ch, r in W[t]['history'].items():
        items = r.get('result', {}).get('items') or []
        if not items: continue
        MB = norm_msgs(items, O)
        M = ([x for x in A['msgs'][ch] if x[0] < MB[0][0]] if ch in recA else []) + MB
        if AV['msgs'][ch] != M: cm['msgs'] += 1; continue
        c = out[t][ch]; _, cname, _ = chat_info(meta.get(ch, {}), O)
        rec, _ = make_rec(ch, t, c['ad'], cname, M)
        strip = lambda x: {k: v for k, v in x.items() if k not in ('both', 'adid')}
        if strip(rec) != strip(c): cm['rec'] += 1
check('согласованность: сообщения и записи чатов окна = правила сборки', not cm, dict(cm))

# 5. «весь ряд»: итог минус сумма месячных столбцов = before_apr (столбцы с 2026-04 до месяца выгрузки)
for t in CABS:
    last = ym(max(int(datetime.datetime.fromisoformat(RC[x]['exported'].replace('Z', '+00:00')).timestamp()) for x in CABS))
    cols = sum(v for (tt, m), v in months_out.items() if tt == t and '2026-04' <= m <= last)
    check(f'{t}: всего - столбцы = before_apr', len(out[t]) - cols == RC[t]['before_apr'], f'{len(out[t])} - {cols}')

print('ИТОГ:', 'FAIL ' + ', '.join(FAIL) if FAIL else 'все проверки прошли')
sys.exit(1 if FAIL else 0)
