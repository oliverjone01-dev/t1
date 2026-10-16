# ФЕНИКС: правка собственных файлов аудита. (1) render5.mts: литерал длинного тире в регэкспе -> escape-последовательность
# (поведение то же, символа U+2014 в файле нет). (2) моя строка трейса partial: note длиннее 500 символов (схема) -> короче.
import json, pathlib
EM = chr(0x2014); BS = chr(92)
P = pathlib.Path('/home/user/t1/knowledge/episodes/2026-10/feniks-probes-ozon-plan-price-status/render5.mts')
s = P.read_text(encoding='utf-8'); s2 = s.replace('page.match(/' + EM + '/g)', 'page.match(/' + BS + 'u2014/g)')
P.write_text(s2, encoding='utf-8'); print('render5.mts U+2014:', s.count(EM), '->', s2.count(EM))
T = pathlib.Path('/home/user/t1/traces/2026-10-15/agents.jsonl')
lines = T.read_text(encoding='utf-8').split('\n')
i = max(k for k, l in enumerate(lines) if l.strip())
rec = json.loads(lines[i])
assert rec['agent'] == 'feniks' and rec['outcome'] == 'partial' and rec['ts'] == '2026-10-15T13:45:27+00:00', rec
rec['note'] = ("Прерван координатором до вердикта: решения Ивана по спидометрам меняют plan-tab.ts и client.js. Вердикта и audited_hash нет. "
               "Готово: vitest 74/74, jsdom 0 ошибок, 0 из 20 пустых, B1 25 из 25 = страница, price_now = prices_daily 14.10. "
               "Предварительно: статус по дате сборки, а не среза (16.10 до 09:00 МСК 4 ложных «не снижена»; пропуск среза - 9 против «ждём» на main); T4 просрочен. "
               "Пробы: feniks-probes-ozon-plan-price-status/")
assert len(rec['note']) <= 500, len(rec['note'])
lines[i] = json.dumps(rec, ensure_ascii=False)
T.write_text('\n'.join(lines), encoding='utf-8'); print('trace line', i + 1, 'note', len(rec['note']))
