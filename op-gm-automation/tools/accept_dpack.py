#!/usr/bin/env python3
"""Приёмка склейки по §15 CLAUDE.md (Д-пакет ОП ГМ). Независимый пересчёт: код сборки (build_av.py, merge_av.py) не импортируется.
Запуск: accept_dpack.py A.json RAW1.json RAW2.json av.json recon.json
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

# 4. выборка 20 чатов, по 10 на кабинет: первый ответ и «не ответили вообще» по сырому JSON
def lag_raw(items, O):
    it = sorted(items, key=lambda m: m['created']); fc = first_client_raw(it, O)
    if fc is None: return None, False
    mgr = [m for m in it if m['fromUid'] == O and m['type'] in ('text', 'image', 'link', 'file', 'video', 'voice')
           and not (m['type'] == 'text' and AUTO.search(re.sub(r'\s+', ' ', (m.get('body') or {}).get('text') or '').strip()))]
    call_after = any(m['type'] == 'appCall' and (m.get('body') or {}).get('status') == 'success' and m['created'] / 1e7 > fc for m in it)
    r1 = next((int(m['created'] / 1e7) for m in mgr if int(m['created'] / 1e7) > fc), None)
    return (r1 - fc if r1 else None), (not mgr and not call_after)
bad = []; picked = 0
for t in CABS:
    O = W[t]['ownerId']; H = W[t]['history']
    # только чаты, где окно не упёрлось в лимит и A не добавил ранних сообщений: там сырое окно = вся история
    pool = [ch for ch in sorted(out[t], key=h) if ch in H and len(H[ch]['result']['items']) < 100 and not (ch in recA and first_client_A(A['msgs'][ch]) and first_client_A(A['msgs'][ch]) < (first_client_raw(H[ch]['result']['items'], O) or 1e12))]
    kinds = [lambda c: 'noresp' in c['p'], lambda c: c['lag'] is not None, lambda c: c['cin'] or c['cout'] or c['cmiss'], lambda c: c['id'] in recA, lambda c: True]
    take = []
    for f in kinds:
        take += [ch for ch in pool if f(out[t][ch]) and ch not in take][:2]
    take = (take + [ch for ch in pool if ch not in take])[:10]
    for ch in take:
        c = out[t][ch]; lag, nor = lag_raw(H[ch]['result']['items'], O)
        if c['nc'] and (lag != c['lag'] or nor != ('noresp' in c['p'])): bad.append(h(ch))
        picked += 1
check(f'выборка {picked} чатов: первый ответ и «не ответили вообще» по сырому JSON', not bad and picked == 20, f'расхождений {len(bad)} {bad}')

# 5. «весь ряд»: итог минус сумма месячных столбцов = before_apr (столбцы с 2026-04 до месяца выгрузки)
for t in CABS:
    last = ym(max(int(datetime.datetime.fromisoformat(RC[x]['exported'].replace('Z', '+00:00')).timestamp()) for x in CABS))
    cols = sum(v for (tt, m), v in months_out.items() if tt == t and '2026-04' <= m <= last)
    check(f'{t}: всего - столбцы = before_apr', len(out[t]) - cols == RC[t]['before_apr'], f'{len(out[t])} - {cols}')

print('ИТОГ:', 'FAIL ' + ', '.join(FAIL) if FAIL else 'все проверки прошли')
sys.exit(1 if FAIL else 0)
