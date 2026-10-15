# ФЕНИКС: правка своей пробы render6.mts - escape вместо литерала U+2014 в регэкспе и вывод таблицы 1 (статус карточек к порогу).
EM = chr(0x2014); BS = chr(92); GT = chr(62)
p = '/home/user/t1/knowledge/episodes/2026-10/feniks-probes-ozon-plan-price-status/render6.mts'
s = open(p, encoding='utf-8').read()
s = s.replace('page.match(/' + EM + '/g)', 'page.match(/' + BS + 'u2014/g)')
anchor = 'gauges.forEach((g) =' + GT + ' console.log(`  спидометр: ${g.title} | ${g.v} | ${g.l1} | ${g.l2}`));'
add = (anchor + '\nconst t1 = [...doc.querySelectorAll("#pt-plan table")][0]!;\n'
       + 'const st1 = [...t1.querySelectorAll("tr.crow")].map((r) =' + GT + ' { const td = [...r.querySelectorAll("td")]; '
       + 'return `${t(td[0]).replace("▸ ", "")}: ${t(td[2])}/${t(td[1])} ${t(td[6])}`; });\n'
       + 'console.log("  таблица 1 (с 15.10 / порог, статус):", st1.join(" | "));')
assert anchor in s, 'anchor'
s = s.replace(anchor, add)
open(p, 'w', encoding='utf-8').write(s)
print('U+2014 в render6.mts:', s.count(EM))
