# ФЕНИКС iter5. Симуляция предложенного фикса Codex P2 (после вердикта, код автора не трогаю): копия plan-tab.client.js 381f11d5
# в scratch с отступом дуги min(.7, ширина/4) вместо .7. Дальше g1_grid.mjs на копии - сколько стрелок останется без дуги цвета статуса.
# python3 -I codex_fix_sim.py
SC = '/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/'
src = open(SC + 'p8/tree_381f11d5/analytics-mvp/src/scripts/plan-tab/plan-tab.client.js', encoding='utf-8').read()
a = 'zones.forEach(function(z){s+=arc(z[0]+.7,Math.max(z[0]+.7,z[1]-.7),z[2])});'
b = 'zones.forEach(function(z){var ii=Math.min(.7,(z[1]-z[0])/4);s+=arc(z[0]+ii,z[1]-ii,z[2])});'
assert src.count(a) == 1
open(SC + 'p8/client_codexfix.js', 'w', encoding='utf-8').write(src.replace(a, b))
print('ok', SC + 'p8/client_codexfix.js')
