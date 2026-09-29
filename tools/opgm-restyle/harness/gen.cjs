/* Стенд старых экранов ОП ГМ: страница из src/shell.html без входа по паролю.
   Основа: стенд ФЕНИКСА 29.09 (feniks-harness/gen.cjs). Отличия: папка кода и папка src задаются аргументами,
   чтобы собирать «до» и «после» из разных копий; фикстура параметрическая (window.__FX_OPTS).
   Исходники только читаются. Шифроблок не используется, пароль не нужен.
   Запуск: node gen.cjs <op-gm-automation> <src-dir> <out.html>
   Модуль: require('./gen.cjs').build(opDir, srcDir, outFile) */
const fs = require('fs'), path = require('path');
function build(OP, SRC, OUT){
  const U = p => 'file://' + path.resolve(OP, p), S = p => 'file://' + path.resolve(SRC, p);
  let h = fs.readFileSync(path.join(SRC, 'shell.html'), 'utf8');
  h = h.split('{{V}}').join('fx')
    .replace('href="kontur-ds/tokens/tokens.css', 'href="' + U('kontur-ds/tokens/tokens.css'))
    .replace('href="kontur-ds/kit/kit.css', 'href="' + U('kontur-ds/kit/kit.css'))
    .replace('href="app/opgm.css', 'href="' + S('opgm.css'))
    .replace('href="app/kx.css', 'href="' + S('kx/kx.css'))
    .replace('src="vendor/apexcharts.min.js', 'src="' + U('public/vendor/apexcharts.min.js'))
    .replace(/src="kontur-ds\/kit\//g, 'src="' + U('kontur-ds/kit') + '/')
    .replace('src="app/kx.js', 'src="' + S('kx/kx.js'))
    .replace('src="app/legacy.js', 'src="' + S('legacy.js'))
    .replace('src="app/opgm.js', 'src="' + S('opgm.js'))
    .replace('window.OPGM_ENC={{ENC}};', 'window.OPGM_ENC=null;');
  const i0 = h.lastIndexOf('<script>\n/* Вход'), i1 = h.lastIndexOf('</script>') + '</script>'.length;
  if(i0 < 0) throw new Error('блок входа в shell.html не найден');
  const fx = 'file://' + path.join(__dirname, 'fixture.js');
  h = h.slice(0, i0) + '<script src="' + fx + '"></script>\n<script>KS.theme.init(); D = window.__FX; document.getElementById("gate").hidden = true; document.getElementById("app").hidden = false; OPGM.start(); window.__READY = true;</script>' + h.slice(i1);
  const left = (h.match(/\{\{[A-Z]+\}\}/g) || []);
  if(left.length) throw new Error('в стенде остались подстановки: ' + left.join(', '));
  fs.writeFileSync(OUT, h);
  return OUT;
}
module.exports = { build };
if(require.main === module){
  const [op, src, out] = process.argv.slice(2);
  if(!op || !src || !out){ console.error('usage: node gen.cjs <op-gm-automation> <src-dir> <out.html>'); process.exit(2); }
  build(op, src, out); console.log('стенд:', out);
}
