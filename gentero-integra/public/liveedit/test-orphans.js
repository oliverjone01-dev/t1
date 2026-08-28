// изолированная проверка логики orphans() на трёх сценариях
function orphans(patches, liveIds, docName) {
  var live = {};
  liveIds.forEach(function (id) { live[id] = 1; });
  var doc = docName + '/';
  return Object.keys(patches).filter(function (id) {
    if (live[id]) return false;
    if (/^[^\/]+\//.test(id) && id.indexOf(doc) !== 0) return false;
    return true;
  });
}
var T = [
  ['1. патч осиротел после правки шаблона',
   { 'gt/s1/p/aaaa': 'x', 'gt/s1/p/bbbb': 'y' }, ['gt/s1/p/bbbb'], 'gt', ['gt/s1/p/aaaa']],
  ['2. ручной data-edit удалён из шаблона',
   { 'price-total': 'x', 'gt/s1/p/bbbb': 'y' }, ['gt/s1/p/bbbb'], 'gt', ['price-total']],
  ['3. переключение вкладки gt -> gm (чужие патчи не сироты)',
   { 'gt/s1/p/aaaa': 'x', 'gm/s2/p/cccc': 'z' }, ['gm/s2/p/cccc'], 'gm', []],
  ['4. всё на месте', { 'gt/s1/p/bbbb': 'y' }, ['gt/s1/p/bbbb'], 'gt', []],
];
var ok = true;
T.forEach(function (t) {
  var got = orphans(t[1], t[2], t[3]);
  var pass = JSON.stringify(got) === JSON.stringify(t[4]);
  if (!pass) ok = false;
  console.log((pass ? 'ok   ' : 'ПРОВАЛ ') + t[0] + ' -> ' + JSON.stringify(got) + ' (ждали ' + JSON.stringify(t[4]) + ')');
});
process.exit(ok ? 0 : 1);
