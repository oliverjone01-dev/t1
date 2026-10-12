# ФЕНИКС iter6: текст двух новых абзацев docx @ 16a192e - тире, Anti-Slop, D1, арифметика производных чисел.
# Запуск: python3 -I i6_text.py (из любого каталога)
import zipfile, re, subprocess, io, json, math, collections as C
blob = subprocess.run(['git', '-C', '/home/user/t1', 'show', '16a192e:sessions/OZON-testy-itogi-2026-10-12.docx'], capture_output=True).stdout
x = zipfile.ZipFile(io.BytesIO(blob)).read('word/document.xml').decode('utf8')
L = [''.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>', p, flags=re.S)) for p in re.findall(r'<w:p[ >].*?</w:p>', x, flags=re.S)]
new = [l for l in L if l.startswith('Перетягивание заказов.') or l.startswith('От чего зависят показы рекламы.')]
t = '\n'.join(new)
print('paragraphs found:', len(new))
bl = ['в мире современного дизайна', 'не секрет, что', 'на протяжении веков', 'неотъемлемой частью', 'позволяет создать', 'позволяет реализовать',
      'уникальн', 'инновацион', 'революцион', 'непревзойдённ', 'эксклюзивн', 'высокое качество', 'опытные специалисты', 'индивидуальный подход',
      'доступные цены', 'гармонично', 'идеальное решение', 'квинтэссенц', 'один из лучших', 'премиум-сегмент', 'топовое',
      'удвоит', 'выстрелит', 'взорвёт', 'никто в РФ', 'просто надо подключить', 'база уже есть', 'выглядит хорошо', 'отлично подойдёт']
print('anti-slop hits:', [w for w in bl if w.lower() in t.lower()])
print('em dash (new paragraphs)', t.count('—'), 'en dash', t.count('–'), '| whole document.xml em dash', x.count('—'), 'en dash', x.count('–'))
print('self-score (D1):', re.findall(r'[0-9][.,][0-9]+ ?/ ?10', t))
print('2^0.807 = %.3f, 2^-0.527 = %.3f' % (2 ** 0.807, 2 ** -0.527))
print('CTR 5.88/2.71 = %.2f; CPM 1000/515 = %.2f; CPC 37.0/8.8 = %.2f; CPM = CPC*CTR*1000: KUVINO %.0f, KONUX %.0f' % (5.88 / 2.71, 1000 / 515, 37.0 / 8.8, 37.0 * 0.0271 * 1000, 8.8 * 0.0588 * 1000))
print('card per day B 21/14 = %.2f, A 31/23 = %.2f (%+.0f%%); store ctrl 3.43 -> 3.17 (%+.1f%%)' % (21 / 14, 31 / 23, (31 / 23 / (21 / 14) - 1) * 100, (3.17 / 3.43 - 1) * 100))
print('rest per day 18/14 = %.2f -> 19/23 = %.2f; GGT-35-5-1 15/14 = %.2f -> 15/23 = %.2f' % (18 / 14, 19 / 23, 15 / 14, 15 / 23))
print('Главное/тест 3: KONUX search impressions x%.1f at budget x%.1f -> implied elasticity %.2f; paragraph model 14.8^0.807 = x%.1f' % (54718 / 3088, 30004 / 2024, math.log(54718 / 3088) / math.log(30004 / 2024), (30004 / 2024) ** 0.807))
# CPM rank of KONUX among the 38 campaigns of shows_model.py
R = [json.loads(l) for l in open('/home/user/t1/analytics-mvp/data/ads_daily.ndjson')]
agg = C.defaultdict(C.Counter)
for r in R:
    if '2026-09-22' <= r['d'] <= '2026-10-07' and r['sp'] > 0:
        a = agg[r['id']]; a['sp'] += r['sp']; a['vw'] += r['vw']; a['cl'] += r['cl']; a['days'] += 1
rows = [(i, a['sp'] / a['vw'] * 1000, a['vw'] * 7 / a['days']) for i, a in agg.items() if a['vw'] and a['cl'] and i != '28753239' and a['sp'] * 7 / a['days'] > 500]
kon = [r for r in rows if r[0] == '37675958'][0]
print('n=%d; KONUX CPM %.0f; campaigns with cheaper 1000 impressions: %d; KONUX weekly impressions rank: %d of %d' % (len(rows), kon[1], sum(1 for r in rows if r[1] < kon[1]), 1 + sum(1 for r in rows if r[2] > kon[2]), len(rows)))
