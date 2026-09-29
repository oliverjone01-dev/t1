#!/usr/bin/env python3
"""Склейка слоя Авито без CSV: прошлый слой A (D.av принятой сборки) плюс окно B (две сырые выгрузки getChats
«чаты с updated не раньше periodFrom», история до 100 последних сообщений на чат).
Запуск: merge_av.py A.json RAW1.json RAW2.json OUT_DIR
  A.json: D.av из шифроблока public/index.html (вместе с recon); RAW1, RAW2 в любом порядке.
Выход: OUT_DIR/av.json и OUT_DIR/recon.json для build.cjs. Любое нарушение правила = код выхода 2 и строка причины.
Правила С1-С11: knowledge/episodes/2026-09/feniks-decisions-opgm-restyle-20260929.md, §3.
Печатает только счётчики: имён, телефонов и текстов в выводе нет."""
import json, sys, os, datetime, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_av import Ads, chat_info, norm_msgs, make_rec, mark_both, phones_of, report, BEFORE_APR

CABS = ('OLD-G', 'NEW-B')
DAY = 86400
def stop(msg): print('СТОП:', msg); sys.exit(2)
def ts(s): return int(datetime.datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp())
def side(who): return 'u' if who in ('m', 'a') else who      # клиент / мы (менеджер и автоответ вместе) / система
def keys(M):
    """ключ сообщения: секунда, тип, сторона, порядковый номер среди сообщений с той же секундой, типом и стороной"""
    n = collections.Counter(); out = []
    for x in M:
        k = (x[0], x[2], side(x[1])); out.append(k + (n[k],)); n[k] += 1
    return out

def main(argv):
    if len(argv) < 5: sys.exit(__doc__)
    A = json.load(open(argv[1])); R0 = A.get('recon') or stop('в A нет recon')
    raws = [json.load(open(p)) for p in argv[2:4]]
    OUT = argv[4]
    exA = {t: ts(R0[t]['exported']) for t in CABS}
    idsA = {t: {c['id'] for c in A['chats'] if c['cab'] == t} for t in CABS}
    recA = {c['id']: c for c in A['chats']}

    # С1: кабинет по пересечению channelId (не по имени файла и не по аккаунту)
    tagof = {}
    for i, d in enumerate(raws):
        fit = []
        for t in CABS:
            other = CABS[1 - CABS.index(t)]
            old = [c['channelId'] for c in d['chats'] if c['created'] / 1e7 < exA[t] - DAY]
            k = sum(1 for x in old if x in idsA[t]); z = sum(1 for x in old if x in idsA[other])
            if old and k >= 0.9 * len(old) and z == 0: fit.append((t, k, len(old)))
        if len(fit) != 1: stop(f'файл {i + 1}: кабинет по пересечению channelId не определяется однозначно ({fit})')
        tagof[i] = fit[0]
    if {v[0] for v in tagof.values()} != set(CABS): stop('оба файла легли в один кабинет')

    ads = Ads(A['ads'])
    chats = [dict(c) for c in A['chats']]; pos = {c['id']: i for i, c in enumerate(chats)}
    msgs = dict(A['msgs'])
    recon = {}
    for i, d in enumerate(raws):
        tag, k, m = tagof[i]; O = d['ownerId']; H = d['history']
        pf = ts(d['periodFrom']); exB = d['exported']
        # С2: окно перекрывает прошлую выгрузку не меньше чем на сутки
        if pf > exA[tag] - DAY: stop(f'{tag}: periodFrom позже прошлой выгрузки минус 24 ч, дыра в данных')
        # С3: полнота окна вместо CSV: каждый чат A с сообщением не раньше periodFrom есть в окне
        missing = [c for c in idsA[tag] if recA[c]['last'] >= pf and c not in H]
        if missing: stop(f'{tag}: в окне нет {len(missing)} чатов прошлого слоя с сообщениями после periodFrom')
        if any(ch in idsA[CABS[1 - CABS.index(tag)]] for ch in H): stop(f'{tag}: чат окна лежит в A под другим кабинетом')
        meta = {c['channelId']: c for c in d['chats']}
        mg = collections.Counter(); nB = 0
        for ch, r in H.items():
            items = r.get('result', {}).get('items', [])
            if not items: continue
            MB = norm_msgs(items, O); nB += len(MB)
            title, cname, adid = chat_info(meta.get(ch, {}), O)
            if ch in recA:
                # С6: объединение по ключу, при совпадении строка B; ранние сообщения из A
                MA = A['msgs'].get(ch, []); kA = keys(MA); kB = set(keys(MB)); b0 = MB[0][0]
                lost = sum(1 for x, kk in zip(MA, kA) if x[0] >= b0 and kk not in kB)
                if lost: mg['overlap_missing'] += lost; continue
                early = [x for x, kk in zip(MA, kA) if kk not in kB]
                if len(items) >= 100: mg['truncated_100'] += 1
                if early: mg['restored_from_old'] += len(early); mg['restored_chats'] += 1
                M = early + MB
                old = recA[ch]
                if ads.list()[old['ad']] != (title or '(без названия)'): mg['ad_title_changed'] += 1
                rec, _ = make_rec(ch, tag, ads.id(title), cname, M)
                if rec['t'] != old['t']: mg['t_changed'] += 1
                mg['replaced'] += 1
                chats[pos[ch]] = rec
            else:
                # С5: чат только в окне: та же функция, что у полной выгрузки
                if len(items) >= 100: mg['truncated_100'] += 1
                M = MB
                rec, _ = make_rec(ch, tag, ads.id(title), cname, M)
                mg['added'] += 1
                pos[ch] = len(chats); chats.append(rec)
            if adid is not None:     # С7: id объявления рядом с индексом названия
                rec = {**{kk: v for kk, v in rec.items() if kk != 'p'}, 'adid': adid, 'p': rec['p']}
                chats[pos[ch]] = rec
            msgs[ch] = M
        if mg['overlap_missing']: stop(f"{tag}: {mg['overlap_missing']} сообщений A не нашлись в окне после его первого сообщения")
        mg['kept_old'] = len(idsA[tag]) - mg['replaced']
        mg['window_missing'] = 0
        mg['mapping_overlap'] = {'k': k, 'm': m}
        lay = R0[tag].get('layers') or [{'name': 'полная выгрузка', 'exported': R0[tag]['exported'], 'json_chats': R0[tag]['json_chats'],
                                        'json_msgs': R0[tag]['json_msgs'], 'csv_rows': R0[tag].get('csv_rows'), 'csv': True}]
        lay = lay + [{'name': 'окно', 'periodFrom': d['periodFrom'], 'exported': exB, 'json_chats': len(H), 'json_msgs': nB, 'csv': False}]
        recon[tag] = {**{kk: v for kk, v in R0[tag].items() if kk in ('csv_rows', 'csv_max', 'miss')},
                      'exported': exB, 'layers': lay, 'merge': dict(mg)}

    # С8: «писал в оба кабинета» по всему объединению тем же правилом
    before = {c['id']: bool(c.get('both')) for c in chats}
    PH = {c['id']: phones_of(msgs[c['id']]) for c in chats}
    both = mark_both(chats, {k: v for k, v in PH.items() if v})
    bc = sum(1 for c in chats if bool(c.get('both')) != before[c['id']])
    # С9: итог по объединению
    for t in CABS:
        L = [c for c in chats if c['cab'] == t]
        recon[t].update(json_chats=len(L), json_msgs=sum(len(msgs[c['id']]) for c in L), before_apr=sum(1 for c in L if c['t'] < BEFORE_APR))
        recon[t]['merge']['both_changed'] = sum(1 for c in L if bool(c.get('both')) != before[c['id']])
    if len(chats) != len({c['id'] for c in chats}): stop('повтор channelId в итоге')
    os.makedirs(OUT, exist_ok=True)
    json.dump({'ads': ads.list(), 'chats': chats, 'msgs': msgs, 'exported': max(d['exported'] for d in raws)[:10]},
              open(os.path.join(OUT, 'av.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    json.dump(recon, open(os.path.join(OUT, 'recon.json'), 'w'), ensure_ascii=False, indent=1)
    for t in CABS: print(t, json.dumps(recon[t]['merge'], ensure_ascii=False), '| чатов', recon[t]['json_chats'], '| до апреля', recon[t]['before_apr'])
    print('флаг «оба кабинета» изменился у', bc, 'чатов; телефонов в обоих', len(both), '| объявлений', len(A['ads']), '->', len(ads.ix))
    report(chats)

if __name__ == '__main__': main(sys.argv)
