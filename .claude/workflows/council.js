// GENGROUP Council как детерминированный workflow (Protocol 3 + Step 12.5).
// Запуск ТОЛЬКО по явному opt-in Ивана («use a workflow», «ultracode», /council --workflow).
// Обычный /council без opt-in идёт через Agent tool из main-контекста (см. skill council).
//
// args (объект, не строка):
//   task            - формулировка задачи (обязательно)
//   ts              - ISO-время старта (обязательно: текущее время внутри workflow недоступно)
//   roster          - массив id бойцов (опционально; иначе выбирает СПАРТАК, max 4)
//   cc              - код Council Configuration (CC-09..CC-19), опционально
//   mode            - solo | council | debate | red_team (опционально; иначе решает СПАРТАК)
//   max_iterations  - итерации Step 12.5 (по умолчанию 3)
//   deliverable_ref - путь артефакта, если Council про существующий файл
//   cost_budget_usd - лимит стоимости, по умолчанию 1.0 (оценка по токенам, тариф [ГИПОТЕЗА]); hard_stop_over_budget: true - остановка при превышении
//
// Возвращает объект: brief, roster, positions (анонимизированы), votes, ranking,
// synthesis, audits[], verdict, final_status. Эпизод в knowledge/episodes/ пишет
// main-сессия после возврата (там есть дата и Write).

export const meta = {
  name: 'council',
  description: 'GENGROUP Council: СПАРТАК собирает ростер, бойцы работают параллельно, анонимная взаимная оценка, синтез, Step 12.5 ФЕНИКС-гейт до 3 итераций',
  whenToUse: 'Задача на 3+ департамента, финансы >5M, стратегический pivot, KPI drop <70%, «собери бойцов». Только по явному opt-in Ивана на workflow.',
  phases: [
    { title: 'Assess', detail: 'СПАРТАК: brief, режим, ростер, P9-флаг' },
    { title: 'Execute', detail: 'Бойцы параллельно, A2A-бриф, evidence' },
    { title: 'Peer review', detail: 'Анонимная взаимная оценка по 5 критериям' },
    { title: 'Synthesis', detail: 'СПАРТАК: агрегация, STEAL THIS, черновик' },
    { title: 'Gate', detail: 'Step 12.5 ФЕНИКС, rework до 3 итераций' },
  ],
}

const ALLOWED = ['marco', 'data', 'viktor', 'boris', 'emma', 'maks', 'semyon', 'timur', 'krea', 'roman', 'trener']
const LETTERS = 'ABCDEFGH'
const WEIGHTS = { accuracy: 0.25, actionability: 0.25, insight: 0.20, brand_fit: 0.15, risk_awareness: 0.15 }

if (!args || typeof args.task !== 'string' || !args.task.trim()) {
  throw new Error('council: args.task обязателен (строка с формулировкой задачи)')
}
if (!args.ts) {
  throw new Error('council: args.ts обязателен (ISO-время старта; часы внутри workflow недоступны)')
}
const MAX_ITER = Math.min(Math.max(Number(args.max_iterations) || 3, 1), 3)
// Правило СПАРТАКА «Council > $1 - предупредить Ивана». Внутри workflow есть только токены (budget.spent()),
// поэтому доллары оцениваются по тарифу [ГИПОТЕЗА: opus ~$75/M output => ~13K output-токенов на $1; берём 15K].
const COST_BUDGET_USD = Number(args.cost_budget_usd) > 0 ? Number(args.cost_budget_usd) : 1.0
const TOKENS_PER_USD = 15000
const spentUsd = () => (typeof budget !== 'undefined' && budget && typeof budget.spent === 'function') ? budget.spent() / TOKENS_PER_USD : null
let costWarned = false
function costCheck(stage) {
  const usd = spentUsd()
  if (usd === null) return
  if (usd > COST_BUDGET_USD && !costWarned) {
    costWarned = true
    log(`БЮДЖЕТ: после стадии ${stage} оценка ~$${usd.toFixed(2)} превысила лимит $${COST_BUDGET_USD} [ГИПОТЕЗА: тариф ${TOKENS_PER_USD} output-токенов/$]. Предупреждение Ивану - в эпизод. ${args.hard_stop_over_budget ? 'hard_stop_over_budget=true: остановка.' : 'Продолжаем (hard_stop_over_budget не задан).'}`)
    if (args.hard_stop_over_budget) throw new Error(`council: превышен cost_budget_usd=${COST_BUDGET_USD} после стадии ${stage}`)
  }
}

const SCORES_SCHEMA = {
  type: 'object',
  required: ['accuracy', 'actionability', 'insight', 'brand_fit', 'risk_awareness'],
  properties: {
    accuracy: { type: 'number', minimum: 0, maximum: 10 },
    actionability: { type: 'number', minimum: 0, maximum: 10 },
    insight: { type: 'number', minimum: 0, maximum: 10 },
    brand_fit: { type: 'number', minimum: 0, maximum: 10 },
    risk_awareness: { type: 'number', minimum: 0, maximum: 10 },
  },
}

const BRIEF_SCHEMA = {
  type: 'object',
  required: ['clarified_task', 'mode', 'cc', 'roster', 'p9_required', 'rag_paths', 'success_criteria', 'stop_conditions', 'artifact_class'],
  properties: {
    clarified_task: { type: 'string', description: 'Задача одной фразой, как её понял СПАРТАК' },
    mode: { type: 'string', enum: ['solo', 'council', 'debate', 'red_team'] },
    artifact_class: { type: 'string', enum: ['strategy', 'content', 'gate', 'dashboard', 'agent', 'mixed'], description: 'Класс ожидаемого deliverable (Phase 0 ФЕНИКСА): от него зависят обязательные пробы' },
    cc: { type: 'string', description: 'CC-09..CC-19 или custom' },
    roster: { type: 'array', items: { type: 'string' }, maxItems: 4, description: 'id бойцов без feniks и spartak' },
    p9_required: { type: 'boolean' },
    p9_triggers: { type: 'array', items: { type: 'string' } },
    rag_paths: { type: 'array', items: { type: 'string' }, description: 'Файлы semantic/episodic памяти для инжекта в брифы' },
    success_criteria: { type: 'array', items: { type: 'string' } },
    stop_conditions: { type: 'array', items: { type: 'string' }, description: 'Когда Council останавливается без результата' },
    clarifying_question: { type: 'string', description: 'Один вопрос Ивану, если задача не переформулируется; иначе пустая строка' },
  },
}

const POSITION_SCHEMA = {
  type: 'object',
  required: ['position', 'evidence', 'blocking_issues', 'confidence'],
  properties: {
    position: { type: 'string', description: 'Позиция в markdown, 200-600 слов, без em dash, каждое число с меткой' },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        required: ['claim', 'tag', 'source'],
        properties: {
          claim: { type: 'string' },
          tag: { type: 'string', enum: ['ДАННЫЕ', 'ГИПОТЕЗА', 'РЕТРО-ОЦЕНКА'] },
          source: { type: 'string', description: 'путь к файлу:строке, команда grep или «нет источника»' },
        },
      },
    },
    blocking_issues: { type: 'array', items: { type: 'string' } },
    steal_candidate: { type: 'string', description: 'Один элемент своей позиции, который стоит взять в синтез' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
}

const VOTES_SCHEMA = {
  type: 'object',
  required: ['votes'],
  properties: {
    votes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['target_id', 'scores', 'vote', 'top_strength', 'top_weakness'],
        properties: {
          target_id: { type: 'string', description: 'Аноним A / B / C ...' },
          scores: SCORES_SCHEMA,
          vote: { type: 'string', enum: ['best', 'second', 'discard', 'rework'] },
          top_strength: { type: 'string' },
          top_weakness: { type: 'string' },
        },
      },
    },
  },
}

const SYNTHESIS_SCHEMA = {
  type: 'object',
  required: ['deliverable_markdown', 'steal_this', 'conflicts', 'self_check'],
  properties: {
    deliverable_markdown: { type: 'string', description: 'Финальный артефакт для Ивана, markdown, без em dash' },
    steal_this: { type: 'array', items: { type: 'object', required: ['from', 'element'], properties: { from: { type: 'string' }, element: { type: 'string' } } } },
    conflicts: { type: 'array', items: { type: 'string' }, description: 'Где позиции бойцов расходятся и как разрешено' },
    open_questions: { type: 'array', items: { type: 'string' } },
    self_check: { type: 'array', items: { type: 'string' }, description: '25 чекпоинтов phoenix-eval: «N: да|нет|частично» без оценки' },
  },
}

const AUDIT_SCHEMA = {
  type: 'object',
  required: ['scores', 'weighted_total', 'verdict', 'gaps', 'rework_tz', 'anchor', 'probes', 'confidence'],
  properties: {
    scores: SCORES_SCHEMA,
    weighted_total: { type: 'number', minimum: 0, maximum: 10 },
    verdict: { type: 'string', enum: ['go', 'return', 'veto'] },
    gaps: { type: 'array', items: { type: 'string' }, maxItems: 10 },
    rework_tz: { type: 'string' },
    anchor: { type: 'string', description: 'Ближайший калибровочный якорь и почему выше/ниже' },
    probes: { type: 'array', items: { type: 'object', required: ['id', 'result', 'evidence'], properties: { id: { type: 'string' }, result: { type: 'string', enum: ['PASS', 'FAIL', 'PARTIAL', 'N/A'] }, evidence: { type: 'string' } } }, description: 'Red-team пробы класса артефакта; пустой массив допустим только для класса strategy/content' },
    comprehension_gate: { type: 'object', properties: { applies: { type: 'boolean' }, passed: { type: 'boolean' }, defects: { type: 'array', items: { type: 'string' } } } },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
}

function weighted(scores) {
  return Object.keys(WEIGHTS).reduce((acc, k) => acc + (Number(scores[k]) || 0) * WEIGHTS[k], 0)
}

function fmtEvidence(ev) {
  return (ev || []).map(e => `- [${e.tag}] ${e.claim} (источник: ${e.source})`).join('\n')
}

// ---------------------------------------------------------------- Phase A
phase('Assess')
log(`Council старт ${args.ts}: «${args.task.slice(0, 120)}»`)

const brief = await agent(
  [
    'Ты СПАРТАК. Фаза A (Assessment) Council. Верни ТОЛЬКО структурированный объект.',
    `Задача Ивана: ${args.task}`,
    args.deliverable_ref ? `Артефакт под обсуждение: ${args.deliverable_ref} (прочитай его).` : '',
    args.cc ? `Иван указал CC: ${args.cc}.` : 'Выбери CC из таблицы триггеров своей роли.',
    args.mode ? `Иван указал режим: ${args.mode}.` : 'Выбери режим: solo / council / debate / red_team.',
    args.roster && args.roster.length ? `Иван указал ростер: ${args.roster.join(', ')}. Не меняй его, только проверь на пересечение зон.` : `Собери ростер max 4 из: ${ALLOWED.join(', ')}. ФЕНИКС и ты в ростер не входят.`,
    'Прогони детектор Protocol 9 (CLAUDE.md §5): если триггер сработал - p9_required=true и в ростере обязательны data и marco.',
    'В rag_paths укажи реальные файлы из knowledge/semantic/, knowledge/episodes/ и glossary.md, которые бойцы обязаны прочитать (проверь, что файлы существуют).',
    'stop_conditions: минимум 2 (например «два бойца вернули blocking_issues по одному факту», «нужен доступ к 1С, которого нет»).',
    'Если задачу нельзя переформулировать одной фразой - заполни clarifying_question (ровно один вопрос) и всё равно верни лучший brief.',
  ].filter(Boolean).join('\n'),
  { agentType: 'spartak', schema: BRIEF_SCHEMA, label: 'spartak:assess', phase: 'Assess' },
)
if (!brief) throw new Error('council: СПАРТАК не вернул brief (агент прерван)')

const rosterFromIvan = Array.isArray(args.roster) && args.roster.length > 0
const requested = (rosterFromIvan ? args.roster : brief.roster).map(a => String(a).toLowerCase().trim())
let roster = requested.filter((a, i, arr) => ALLOWED.includes(a) && arr.indexOf(a) === i)
const rejected = requested.filter(a => !ALLOWED.includes(a))
if (rejected.length) log(`Ростер: отклонены не из ростера v3: ${rejected.join(', ')}`)
if (brief.mode === 'debate') {
  // DEBATE = ровно 2 голоса. Ростер Ивана не переопределяется P9-правилом (аудит 2026-09-06: [viktor,boris] молча превращались в [marco,data]).
  if (roster.length > 2) { log(`DEBATE: оставлены первые два (${roster.slice(0, 2).join(', ')}), убраны ${roster.slice(2).join(', ')}`); roster = roster.slice(0, 2) }
  if (brief.p9_required) log('P9 в режиме DEBATE: data и marco в ростер не добавляются; цифры проверяет ФЕНИКС в Gate, рекомендуется отдельный /reality-audit')
} else if (brief.p9_required) {
  for (const must of ['data', 'marco']) if (!roster.includes(must)) { roster.unshift(must); log(`P9: в ростер добавлен ${must}`) }
}
if (roster.length > 4) { log(`Ростер обрезан до 4 (coordination tax): убраны ${roster.slice(4).join(', ')}`); roster = roster.slice(0, 4) }
if (roster.length === 0) throw new Error('council: пустой ростер после фильтра ALLOWED')
if (brief.clarifying_question) log(`Вопрос СПАРТАКА Ивану (не блокирует прогон): ${brief.clarifying_question}`)
log(`Режим ${brief.mode}, ${brief.cc}, ростер: ${roster.join(', ')}${brief.p9_required ? ', P9 обязателен' : ''}`)

// ---------------------------------------------------------------- Phase B
// Барьер оправдан: peer review в фазе C нуждается во ВСЕХ позициях сразу.
phase('Execute')
const stanceOf = i => (brief.mode === 'debate' ? (i === 0 ? 'ЗА (pro)' : 'ПРОТИВ (contra)') : (brief.mode === 'red_team' ? 'атакующий: ищи, где план ломается' : 'эксперт своей зоны'))

const rawPositions = await parallel(roster.map((a, i) => () => agent(
  [
    `Ты ${a.toUpperCase()}. Council ${brief.cc}, режим ${brief.mode}. Твоя позиция: ${stanceOf(i)}.`,
    'A2A-бриф (Protocol 13):',
    JSON.stringify({ from: 'spartak', to: a, intent: 'council_position_request', thread_id: `council-${args.ts}`, context: { cc: brief.cc, p9_required: brief.p9_required, deadline: null }, deliverable_ref: args.deliverable_ref || null, expected_output: 'council_position' }),
    `Задача: ${brief.clarified_task}`,
    `Критерии успеха: ${brief.success_criteria.join('; ')}`,
    `Обязательные источники (прочитай перед ответом): ${brief.rag_paths.join(', ') || 'нет'}`,
    'Правила: каждое число с меткой [ДАННЫЕ: путь] или [ГИПОТЕЗА: допущения]; без em dash; Anti-Slop §7; позиция 200-600 слов через призму твоей экспертизы, не общий обзор.',
    'evidence: минимум 3 записи; blocking_issues: то, что делает задачу невыполнимой в текущем виде (пусто, если нет).',
    'Верни ТОЛЬКО структурированный объект.',
  ].join('\n'),
  { agentType: a, schema: POSITION_SCHEMA, label: `${a}:position`, phase: 'Execute' },
)))

const positions = rawPositions
  .map((p, i) => (p ? { id: `Аноним ${LETTERS[i]}`, agent: roster[i], ...p } : null))
  .filter(Boolean)
if (positions.length === 0) throw new Error('council: ни один боец не вернул позицию')
costCheck('Execute')
if (positions.length < roster.length) log(`Внимание: ${roster.length - positions.length} бойц(а) не вернули позицию, идём с ${positions.length}`)
const blockers = positions.flatMap(p => p.blocking_issues.map(b => `${p.id}: ${b}`))
if (blockers.length) log(`Blocking issues (${blockers.length}): ${blockers.slice(0, 3).join(' | ')}`)

// ---------------------------------------------------------------- Phase C.1
phase('Peer review')
const anonPack = (excludeIdx) => positions
  .filter((_, j) => j !== excludeIdx)
  .map(p => `### ${p.id}\n${p.position}\n\nEvidence:\n${fmtEvidence(p.evidence)}`)
  .join('\n\n')

const rawVotes = positions.length > 1
  ? await parallel(positions.map((p, i) => () => agent(
    [
      `Ты ${p.agent.toUpperCase()}. Peer review в Council ${brief.cc}. Оцени позиции коллег (анонимизированы, своей среди них нет) по 5-Criteria Matrix через призму СВОЕЙ экспертизы.`,
      'Шкала 0-10 на критерий. vote: best одному, second одному (если есть), остальным discard или rework.',
      'top_strength - что взять в синтез (STEAL THIS), top_weakness - главный разрыв. Никакой вежливости: консенсус без проверки допущений - антипаттерн.',
      `Задача: ${brief.clarified_task}`,
      anonPack(i),
      'Верни ТОЛЬКО структурированный объект с массивом votes (по одному на каждую позицию выше).',
    ].join('\n'),
    { agentType: p.agent, schema: VOTES_SCHEMA, label: `${p.agent}:review`, phase: 'Peer review' },
  )))
  : []

const votes = rawVotes.map((v, i) => (v ? { voter: positions[i].agent, votes: v.votes } : null)).filter(Boolean)
const tally = {}
for (const p of positions) tally[p.id] = { id: p.id, agent: p.agent, n: 0, sum: 0, best: 0, strengths: [], weaknesses: [] }
for (const v of votes) for (const b of v.votes) {
  const t = tally[b.target_id]
  if (!t) continue
  t.n += 1
  t.sum += weighted(b.scores)
  if (b.vote === 'best') t.best += 1
  t.strengths.push(`${v.voter}: ${b.top_strength}`)
  t.weaknesses.push(`${v.voter}: ${b.top_weakness}`)
}
const ranking = Object.values(tally)
  .map(t => ({ ...t, avg: t.n ? Math.round((t.sum / t.n) * 100) / 100 : null }))
  .sort((a, b) => (b.avg || 0) - (a.avg || 0) || b.best - a.best)
log(`Ранжирование: ${ranking.map(r => `${r.id}=${r.avg === null ? 'n/a' : r.avg}`).join(', ')}`)
costCheck('Peer review')

// ---------------------------------------------------------------- Phase C.2
phase('Synthesis')
const synthPrompt = (extra) => [
  'Ты СПАРТАК. Фаза C (Elite Synthesis). Собери финальный артефакт для Ивана.',
  `Задача: ${brief.clarified_task}. Критерии успеха: ${brief.success_criteria.join('; ')}.`,
  `Ранжирование peer review (weighted avg, голоса best): ${ranking.map(r => `${r.id} (${r.agent}) avg=${r.avg} best=${r.best}`).join('; ')}`,
  'Позиции (топ-2 по ранжированию - основа, остальные - донор STEAL THIS):',
  positions.map(p => `### ${p.id} (${p.agent})\n${p.position}\n\nEvidence:\n${fmtEvidence(p.evidence)}\nBlocking: ${p.blocking_issues.join('; ') || 'нет'}`).join('\n\n'),
  'Сильные и слабые стороны по оценкам коллег:',
  ranking.map(r => `${r.id}: + ${r.strengths.join(' / ')}\n${r.id}: - ${r.weaknesses.join(' / ')}`).join('\n'),
  'Требования к deliverable_markdown: verdict и confidence вверху; каждое число с меткой; downside-сценарий; ответственный + дата первого чекпоинта; без em dash; Anti-Slop §7.',
  'conflicts: где позиции расходятся и как ты разрешил (согласие без проверки допущений запрещено). Проверь ложный консенсус: если все согласны, найди механизм, почему.',
  'self_check: пройди 25 чекпоинтов phoenix-eval без оценок, только да/нет/частично. Это обязательно перед ФЕНИКСОМ.',
  extra || '',
  'Верни ТОЛЬКО структурированный объект.',
].filter(Boolean).join('\n')

let synthesis = await agent(synthPrompt(''), { agentType: 'spartak', schema: SYNTHESIS_SCHEMA, label: 'spartak:synthesis', phase: 'Synthesis' })
if (!synthesis) throw new Error('council: синтез не вернулся')
costCheck('Synthesis')

// ---------------------------------------------------------------- Phase D
phase('Gate')
const audits = []
let verdict = null
for (let iter = 1; iter <= MAX_ITER; iter += 1) {
  const audit = await agent(
    [
      `Ты ФЕНИКС. Step 12.5, итерация ${iter} из ${MAX_ITER}. Не подчиняешься СПАРТАКУ. Skill phoenix-eval: Comprehension Gate (если контент наружу), 25 чекпоинтов, калибровочные якоря (references/calibration-anchors.md), red-team пробы для класса артефакта (references/red-team-probes.md).`,
      'A2A (Protocol 13):',
      JSON.stringify({ from: 'spartak', to: 'feniks', intent: 'review_request', thread_id: `council-${args.ts}`, context: { cc: brief.cc, p9_required: brief.p9_required, iteration: iter }, expected_output: 'audit-report' }),
      `Задача: ${brief.clarified_task}. Класс артефакта: ${brief.artifact_class}. Для класса gate/dashboard/agent/mixed пробы обязательны, иначе оценка не выше 7.9 и verdict не выше return.`,
      `Self-check автора (25 чекпоинтов): ${(synthesis.self_check || []).join('; ') || 'ОТСУТСТВУЕТ - это само по себе gap'}`,
      'Артефакт под аудит:',
      synthesis.deliverable_markdown,
      audits.length ? `Предыдущая итерация: ${audits[audits.length - 1].weighted_total} ${audits[audits.length - 1].verdict}; gaps: ${audits[audits.length - 1].gaps.join('; ')}. Проверь, закрыты ли они реально, а не переформулированы.` : '',
      'weighted_total = 0.25*accuracy + 0.25*actionability + 0.20*insight + 0.15*brand_fit + 0.15*risk_awareness. Пороги: go >= 7.5, return 6.0-7.49, veto < 6.0. anchor обязателен. Каждый gap - с доказательством (файл:строка, команда, расчёт).',
      'Верни ТОЛЬКО структурированный объект.',
    ].filter(Boolean).join('\n'),
    { agentType: 'feniks', schema: AUDIT_SCHEMA, label: `feniks:audit-${iter}`, phase: 'Gate' },
  )
  if (!audit) { log('ФЕНИКС не вернул отчёт, gate не пройден'); break }
  // Пороги enforced кодом, не доверием к полю verdict.
  const wt = Math.round(weighted(audit.scores) * 100) / 100
  const enforced = wt >= 7.5 ? 'go' : wt >= 6.0 ? 'return' : 'veto'
  if (Math.abs(wt - audit.weighted_total) > 0.05 || enforced !== audit.verdict) {
    log(`Коррекция ФЕНИКСА: заявлено ${audit.weighted_total}/${audit.verdict}, пересчёт по весам ${wt}/${enforced}`)
  }
  const probes = Array.isArray(audit.probes) ? audit.probes : []
  const realProbes = probes.filter(p => p && p.result && p.result !== 'N/A')
  const needsProbes = ['gate', 'dashboard', 'agent', 'mixed'].includes(brief.artifact_class)
  let scores = { ...audit.scores }
  let wtAdj = wt
  if (needsProbes && realProbes.length === 0) {
    // Правило red-team-probes / Hard Rule 8: класс гейт/дашборд/агент без проб -> risk_awareness <= 5.0, оценка <= 7.9, verdict не выше return
    scores.risk_awareness = Math.min(Number(scores.risk_awareness) || 0, 5.0)
    wtAdj = Math.min(Math.round(weighted(scores) * 100) / 100, 7.9)
    log(`Класс ${brief.artifact_class} без red-team проб: risk_awareness <= 5.0, потолок 7.9, verdict не выше return (заявлено ${wt})`)
  }
  const enforcedAdj = wtAdj >= 7.5 ? 'go' : wtAdj >= 6.0 ? 'return' : 'veto'
  const probeFail = realProbes.some(p => p.result === 'FAIL' && /^(A|B7)/.test(p.id))
  let finalVerdict = enforcedAdj
  if (needsProbes && realProbes.length === 0 && finalVerdict === 'go') finalVerdict = 'return'
  if (probeFail && finalVerdict === 'go') { finalVerdict = 'return'; log('Проба класса A или B7 = FAIL: go понижен до return (правило red-team-probes)') }
  audits.push({ ...audit, iteration: iter, scores, weighted_total: wtAdj, verdict: finalVerdict, probes_run: realProbes.length })
  verdict = finalVerdict
  log(`Step 12.5 итерация ${iter}: ${wtAdj}/10 → ${finalVerdict}${audit.anchor ? ` (якорь: ${audit.anchor.slice(0, 80)})` : ''}`)
  costCheck(`Gate-${iter}`)
  if (finalVerdict !== 'return') break
  if (iter === MAX_ITER) break
  synthesis = await agent(
    synthPrompt([
      `ДОРАБОТКА по итерации ${iter} ФЕНИКСА (${wt}/10, return). Rework TZ: ${audit.rework_tz}`,
      `Gaps: ${audit.gaps.join('; ')}`,
      'Диспут разрешён: если считаешь gap неверным - напиши в conflicts «ДИСПУТ: <gap> - <контраргумент с данными>», но артефакт всё равно доработай по остальным.',
      'Предыдущая версия артефакта:',
      synthesis.deliverable_markdown,
    ].join('\n')),
    { agentType: 'spartak', schema: SYNTHESIS_SCHEMA, label: `spartak:rework-${iter}`, phase: 'Gate' },
  )
  if (!synthesis) throw new Error('council: доработка не вернулась')
}

const final_status = verdict === 'go' ? 'deliver'
  : verdict === 'veto' ? 'escalate_to_ivan'
    : verdict === 'return' ? 'return_exhausted_escalate_to_ivan'
      : 'gate_not_run'
log(`Итог: ${final_status}`)

return {
  ts: args.ts,
  task: args.task,
  brief,
  roster,
  cost_estimate_usd: spentUsd(),
  positions,
  votes,
  ranking,
  synthesis,
  audits,
  verdict,
  final_status,
  episode_hint: `knowledge/episodes/YYYY-MM/council-<slug>-YYYYMMDD.md (написать из main-сессии; trace: traces/YYYY-MM-DD/agents.jsonl event=council)`,
}
