# ФЕНИКС iter7 (быстрая): PR #482 голова 639f6429, audit_hash 4b4e873721788cdc. Дельта к go 8.4 (28a5fec9f1e28feb = db5ede19)
# в хешируемых путях - одна строка knowledge/decisions.md (c21400a9). Код тот же, пробы iter6 действуют. JSON строится из iter6
# с правкой охвата, проб журнала и W3; оценка не меняется. Плюс строка трейса. python3 -I make_iter7.py
import json, datetime, pathlib
S = pathlib.Path('/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/out')
d = json.loads((S / 'feniks-audit-ozon-plan-iter6-20261016.json').read_text(encoding='utf-8'))
d['task_id'] = 'feniks-ozon-plan-iter7-20261016'
d['timestamp'] = '2026-10-16T09:35:00+03:00'
d['deliverable_ref'] = ('oliverjone01-dev/t1 PR #482, голова 639f6429, audit_hash 4b4e873721788cdc; дельта к go 8.4 на 28a5fec9f1e28feb (db5ede19): '
                        'в хешируемых путях только knowledge/decisions.md, одна строка (c21400a9); ad6a06b2 и 639f6429 - трейсы и отчёты iter6')
d['anchor'] = ('8.5 timur-activation итерация 3 - наш ниже на 0.1, как в iter6: код не менялся, картинка верна на всех проверенных состояниях, '
               'тест берёт положение дуг и стрелки из атрибутов (G1b, G1n), остаются T1, B4n; W3 и Z1 теперь отложены Иваном до 29.10 записью в журнале')
keep = [p for p in d['probes'] if p['id'] not in ('H1',)]
for p in keep:
    if p['id'] not in ('C3', 'C4', 'D1'):
        p['evidence'] = 'без изменений с iter6 (код db5ede19 = голова по хешируемому коду): ' + p['evidence']
d['probes'] = [
    {'id': 'H1', 'result': 'PASS', 'evidence': 'audit_hash.py --rev 639f6429 = 4b4e873721788cdc (= хешу запроса); git diff --name-only db5ede19 639f6429 без traces/, knowledge/episodes/, knowledge/errors/, sessions/handoff/ = только knowledge/decisions.md; в нём 1 добавленная строка (decisions.md:6), удалённых 0; голова PR = refs/pull/482/head'},
    {'id': 'J1', 'result': 'PASS', 'evidence': 'запись 16.10 передаёт слова Ивана дословно в кавычках («1 оставляй как есть», «2 отложи этот вопрос до принятия решения по откладыванию карточек») и совпадает с брифом координатора; пункт (1) описывает код db5ede19 верно (зазор min(.7, ширина/4), жёлтая в день 1 - 1,0-1,5 ед. по g1_grid.mjs iter6), решение 15.10 не отменяет; пункт (2) - W3 и Z1 из handoff Ивану iter5. Соответствие номеров 1/2 вопросам и чтение «откладывания карточек» как решения 29.10 «оставляем / откат» - из брифа, другого источника слов Ивана в репозитории нет (git grep)'},
    {'id': 'J2', 'result': 'PARTIAL', 'evidence': 'формат журнала «дата - решение - почему»: явного «Почему» в записи нет (у соседних записей есть); причина читается из текста (решение 15.10 в силе; W3/Z1 зависят от 29.10)'},
] + keep
for p in d['probes']:
    if p['id'] == 'W3':
        p['result'] = 'PARTIAL'
        p['evidence'] = 'Иван 16.10 отложил W3 и Z1 до решения 29.10 (decisions.md:6): метка в действующей записи есть; до решения страница после 29.10 мерит все 10 карточек по порогу, как в iter4'
    if p['id'] in ('C3', 'C4'):
        p['evidence'] += '; строка decisions.md:6: em dash 0, anti-slop 0'
d['gaps'] = [g if not g.startswith('W3') else 'W3/Z1 (29.10): отложены Иваном до решения по карточкам (decisions.md:6); до него страница после 29.10 мерит все 10 карточек по порогу, Z1 - 8 артикулов с датой 22.10' for g in d['gaps']]
for e in d['evidence_ledger']:
    if e['gap'].startswith('W3'):
        e['gap'] = 'W3/Z1 отложены Иваном до 29.10'
        e['evidence'] = 'decisions.md:6 (Иван 16.10, «2 отложи этот вопрос ...»); поведение страницы после 29.10 - iter4 render8 fx_nov'
d['sources_of_truth'] = ['knowledge/decisions.md:6 (Иван 16.10)'] + d['sources_of_truth']
(S / 'feniks-audit-ozon-plan-iter7-20261016.json').write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
now = datetime.datetime.now(datetime.timezone.utc)
rec = {'ts': now.isoformat(timespec='seconds'), 'event': 'audit', 'agent': 'feniks', 'outcome': 'success', 'confidence': 0.8,
       'feniks_score': d['weighted_total'], 'verdict': 'go', 'audited_hash': '4b4e873721788cdc',
       'deliverable_ref': 'knowledge/episodes/2026-10/feniks-audit-ozon-plan-iter7-20261016.md', 'task_id': d['task_id'],
       'note': ('PR #482 голова 639f6429, дельта к go 8.4 (db5ede19): в хешируемых путях одна строка decisions.md:6 (Иван 16.10: узкие зоны '
                'как есть, W3/Z1 отложены до 29.10). Слова переданы дословно, совпадают с брифом, код тот же; оценка 8.4 без изменений. '
                'Gaps iter6 в силе: G1t остаток, T4/M5, T1 до 22.10, B4n до 01.11.')}
assert len(rec['note']) <= 500
(S / f'traces-{now:%Y-%m-%d}-agents.iter7.line.jsonl').write_text(json.dumps(rec, ensure_ascii=False) + '\n', encoding='utf-8')
print('ok', d['weighted_total'], len(d['probes']), 'проб', len(d['gaps']), 'gaps', '| em dash', (S / 'feniks-audit-ozon-plan-iter7-20261016.json').read_text(encoding='utf-8').count(chr(0x2014)))
