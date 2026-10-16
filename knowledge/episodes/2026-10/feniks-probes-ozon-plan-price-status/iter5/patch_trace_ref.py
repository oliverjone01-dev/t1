# ФЕНИКС iter5: строка трейса - в traces/2026-10-16 (дата события сдачи), правка ссылки в отчёте и run_all.sh. python3 -I patch_trace_ref.py
import pathlib
S = pathlib.Path('/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/out')
for f, a, b in ((S / 'feniks-audit-ozon-plan-iter5-20261015.md', 'строку трейса - в traces/2026-10-15/agents.jsonl', 'строку трейса - в traces/2026-10-16/agents.jsonl'),
                (S / 'iter5' / 'run_all.sh', 'traces-2026-10-15-agents.line.jsonl', 'traces-2026-10-16-agents.line.jsonl')):
    s = f.read_text(encoding='utf-8')
    assert s.count(a) == 1, (f.name, a)
    f.write_text(s.replace(a, b), encoding='utf-8')
    print('ok', f.name)
