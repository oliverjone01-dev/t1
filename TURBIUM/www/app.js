/* TURBIUM · общий скрипт сайта */
(function(){
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* mobile nav */
  var burger = document.getElementById('burger');
  var links = document.getElementById('navlinks');
  if(burger && links){
    burger.addEventListener('click', function(){
      var open = links.classList.toggle('open');
      burger.textContent = open ? '×' : '≡';
      burger.setAttribute('aria-expanded', open);
    });
    links.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){ links.classList.remove('open'); burger.textContent='≡'; });
    });
  }

  /* reveal (по позиции в rAF-скролле: надёжно при любой скорости, без дыр) */
  var revEls = [].slice.call(document.querySelectorAll('.rv, .fc, .puls-panel'));
  if(reduce){ revEls.forEach(function(e){ e.classList.add('in'); }); revEls=[]; }
  function revealPass(){
    if(!revEls.length) return;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    revEls = revEls.filter(function(e){
      if(e.getBoundingClientRect().top < vh*0.92){ e.classList.add('in'); return false; }
      return true;
    });
  }

  /* scroll progress + sticky echo */
  var bar = document.getElementById('progress');
  var refract = document.getElementById('refractFill');
  var echo = document.getElementById('echo');
  var hero = document.querySelector('.hero, .phead');
  var t=false;
  function onScroll(){
    if(t) return; t=true;
    requestAnimationFrame(function(){
      var h=document.documentElement, max=h.scrollHeight-h.clientHeight;
      var p = max>0 ? (h.scrollTop||pageYOffset)/max : 0;
      if(bar) bar.style.width = (p*100)+'%';
      if(refract) refract.style.height = (p*100)+'%';
      revealPass();
      if(echo){
        var past = (pageYOffset > (hero?hero.offsetHeight:600));
        echo.classList.toggle('show', past && p < .93);
      }
      t=false;
    });
  }
  var revTimer;
  function onScrollSafe(){ onScroll(); clearTimeout(revTimer); revTimer=setTimeout(revealPass,140); }
  addEventListener('scroll', onScrollSafe, {passive:true});
  addEventListener('resize', onScrollSafe, {passive:true});
  addEventListener('load', function(){ onScroll(); setTimeout(revealPass,60); });
  onScroll();

  /* sticky-огранка процесса: подсветка активного шага (desktop) */
  var psteps = document.querySelectorAll('.pstep');
  if(psteps.length && 'IntersectionObserver' in window){
    var po = new IntersectionObserver(function(en){
      en.forEach(function(e){
        if(e.isIntersecting && matchMedia('(min-width:860px)').matches){
          psteps.forEach(function(s){ s.classList.remove('active'); });
          e.target.classList.add('active');
        }
      });
    }, {rootMargin:'-45% 0px -45% 0px', threshold:0});
    psteps.forEach(function(s){ po.observe(s); });
  }

  /* count-up */
  function fmt(v,d){ return d>0 ? v.toFixed(d) : Math.round(v).toString(); }
  function count(el){
    var to=parseFloat(el.dataset.count), d=parseInt(el.dataset.dec||'0',10), suf=el.dataset.suf||'';
    if(reduce){ el.textContent=fmt(to,d)+suf; return; }
    var s=null, dur=1400;
    function step(ts){ if(!s)s=ts; var p=Math.min((ts-s)/dur,1), e=1-Math.pow(1-p,4);
      el.textContent=fmt(to*e,d)+suf; if(p<1)requestAnimationFrame(step); else el.textContent=fmt(to,d)+suf; }
    requestAnimationFrame(step);
  }
  var cs=document.querySelectorAll('[data-count]');
  if('IntersectionObserver' in window){
    var co=new IntersectionObserver(function(en){en.forEach(function(e){if(e.isIntersecting){count(e.target);co.unobserve(e.target);}});},{threshold:.6});
    cs.forEach(function(c){co.observe(c);});
  } else cs.forEach(count);

  /* интерактивная плитка Tb: наклон + блик (только точный указатель) */
  var tile=document.getElementById('tbTile');
  if(tile && !reduce){
    var glare=tile.querySelector('.tb-glare');
    if(tile.animate){ tile.style.opacity='0'; tile.animate([{opacity:0},{opacity:1}],{duration:700,easing:'cubic-bezier(.16,1,.3,1)',fill:'forwards'}); }
    else { tile.style.opacity='1'; }
    if(matchMedia('(hover:hover) and (pointer:fine)').matches){
      var raf=false;
      tile.addEventListener('pointermove',function(ev){
        if(raf)return; raf=true;
        requestAnimationFrame(function(){
          var r=tile.getBoundingClientRect();
          var x=(ev.clientX-r.left)/r.width, y=(ev.clientY-r.top)/r.height;
          tile.style.setProperty('--ry',((x-.5)*6).toFixed(2)+'deg');
          tile.style.setProperty('--rx',((.5-y)*6).toFixed(2)+'deg');
          if(glare){glare.style.setProperty('--gx',(x*100).toFixed(1)+'%');glare.style.setProperty('--gy',(y*100).toFixed(1)+'%');}
          raf=false;
        });
      });
      tile.addEventListener('pointerleave',function(){tile.style.setProperty('--ry','0deg');tile.style.setProperty('--rx','0deg');});
    }
  }

  /* lead form: progressive disclosure + honest submit
     LEAD_ENDPOINT пуст по умолчанию. Впишите сюда URL вебхука (n8n / Formspree / свой бот),
     и заявки начнут уходить на бэкенд автоматически. Пока пусто - контакт уводится
     в почту и Telegram-бот, чтобы лид не терялся и мы не показывали ложную доставку. */
  var LEAD_ENDPOINT="";
  var LEAD_MAIL="hello@turbium.ru";
  var form=document.getElementById('leadForm');
  if(form){
    var tileEl=form.closest('.form-tile');
    var first=form.querySelector('.first-field');
    if(first) first.addEventListener('focus',function(){ tileEl.classList.add('expanded'); }, {once:true});
    form.addEventListener('submit',function(e){
      e.preventDefault();
      var ok=document.getElementById('formOk');
      var data={}; new FormData(form).forEach(function(v,k){ data[k]=v; });
      function reveal(){ form.style.display='none'; if(ok) ok.classList.add('show'); }
      if(LEAD_ENDPOINT){
        var btn=form.querySelector('button[type=submit]');
        if(btn){ btn.disabled=true; btn.textContent='Отправляем…'; }
        fetch(LEAD_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
          .then(function(r){ if(!r.ok) throw 0; reveal(); })
          .catch(function(){
            if(btn){ btn.disabled=false; btn.innerHTML='Попробовать ещё раз <span class="arr">→</span>'; }
            window.open('https://t.me/turbium_bot','_blank','noopener');
          });
      } else {
        var s=encodeURIComponent('Заявка на AI-аудит TURBIUM');
        var b=encodeURIComponent('Контакт: '+(data.contact||'')+'\nИмя: '+(data.name||'')+'\nБизнес и боль: '+(data.task||''));
        if(ok){ ok.innerHTML='<div class="big">Почти готово</div><p class="muted mt-s">Мы открыли письмо с вашими данными, отправьте его. Или напишите прямо в бот <a class="mint" href="https://t.me/turbium_bot" rel="noopener">@turbium_bot</a>, так быстрее всего.</p>'; }
        reveal();
        window.location.href='mailto:'+LEAD_MAIL+'?subject='+s+'&body='+b;
      }
    });
  }
})();
