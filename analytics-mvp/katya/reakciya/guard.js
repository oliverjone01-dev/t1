<script>
(function(){
 var BOOT=document.getElementById('boot');
 window.__end=false; window.__failed=false;
 function show(title,msg,col){
  if(!BOOT||!document.body.contains(BOOT)) return;
  BOOT.style.borderColor=col||'#F43F5E';
  BOOT.innerHTML='<div class="card-title" style="color:'+(col||'#F43F5E')+'">'+title+'</div>'+
   '<div class="card-sub" style="margin-top:8px;line-height:1.65;max-width:none;font-size:12.5px">'+msg+'</div>';
 }
 window.onerror=function(m,src,line,col){
  window.__failed=true;
  show('Страница не отрисовалась','Браузер сообщил об ошибке:<br><b style="color:#F59E0B">'+String(m).replace(/</g,'')+
   '</b><br>строка '+line+', позиция '+col+'<br><br>Пришлите этот текст, по нему видно причину точно.');
  // Глушим ошибку только пока висит загрузочная карточка: там понятное сообщение полезнее
  // красной консоли. После старта приложения ошибку отдаём наружу, иначе её не видят
  // ни автотесты (smoke, jsdom), ни headless-проверки: молчаливо падающая страница
  // проходила бы прогон как исправная.
  return !!(BOOT && document.body.contains(BOOT));
 };
 setTimeout(function(){
  if(!BOOT||!document.body.contains(BOOT)) return;
  if(window.__failed) return;
  if(!window.__end){
   show('Файл скачался не полностью',
    'Конец файла не дошёл до браузера, поэтому данные и код не выполнились.<br><br>'+
    'Проверьте размер файла на диске: правой кнопкой по нему, Свойства. Должно быть примерно <b style="color:#22D3EE">__SIZE__ КБ</b>. '+
    'Если меньше, скачайте заново или возьмите облегчённую версию, она в несколько раз меньше.');
   return;
  }
  if(typeof D==='undefined'){ show('Данные не выполнились','Конец файла на месте, но блок данных не выполнился. Пришлите этот текст.'); return; }
  show('Код не отработал','Данные на месте ('+(D.feed?D.feed.length:0)+' действий), но блоки не нарисовались. Пришлите этот текст.');
 },2500);
})();
</script>
