# Перенос фикстуры iter3 (p3_fixture.py) в папку этого аудита с путём scratch этой сессии.
# python3 -I c8_port.py  ->  c8_fixture_iter3.py
E = '/home/user/t1/knowledge/episodes/2026-10/'
src = open(E + 'feniks-probes-ozon-plan-tab/iter3/p3_fixture.py', encoding='utf-8').read()
old = '/tmp/claude-0/-home-user-t1/39ce78b8-29b6-551f-9a34-e54649462146/scratchpad/it3/'
new = '/tmp/claude-0/-home-user-t1/f57f6776-149c-58f9-8707-d73e74e89ad9/scratchpad/'
assert src.count(old) == 1
hdr = '# Копия p3_fixture.py (iter3) с путём scratch этого аудита. Каталог фикстуры: scratch/fx_<сценарий>.\n'
open(E + 'feniks-probes-ozon-chat-2x/c8_fixture_iter3.py', 'w', encoding='utf-8').write(hdr + src.replace(old, new))
print('ok')
