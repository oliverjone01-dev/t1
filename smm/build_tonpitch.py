# -*- coding: utf-8 -*-
# VALONTI x ТОН — архитектура брендов и питч для выступления Оли (капсула ТОН, завтра).
# Дизайн-система берётся 1-в-1 из smm/public/index.html. Синтез Council (МАРКО/ЭММА/КРЕА/РОМАН).
import os

base = open('smm/public/index.html', encoding='utf-8').read()
i = base.index('<style>'); j = base.index('</style>')
CSS = base[i+len('<style>'):j]

EXTRA = '''
.flowline{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:6px}
.flowline .st{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 14px}
.flowline .st .k{font-size:11px;font-weight:800;color:var(--gold);letter-spacing:.1em;margin-bottom:8px}
.flowline .st h5{font-size:14px;font-weight:700;margin-bottom:6px;letter-spacing:-.01em}
.flowline .st p{font-size:12.5px;color:var(--ink-2);line-height:1.5}
.ladder{display:flex;flex-direction:column;gap:10px}
.ladder .lr{display:flex;gap:14px;align-items:flex-start;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 18px}
.ladder .lr .rk{flex:none;width:30px;height:30px;border-radius:8px;display:grid;place-items:center;font-weight:800;font-size:13px;color:#0A0A0A}
.ladder .lr.r1 .rk{background:var(--keep)}.ladder .lr.r2 .rk{background:var(--invest)}.ladder .lr.r3 .rk{background:var(--gold)}
.ladder .lr .lt{font-size:14.5px;color:var(--ink-2)}.ladder .lr .lt b{color:var(--ink);font-weight:700}
.arch3{display:flex;flex-direction:column;align-items:center;gap:0;border:1px solid var(--line);border-radius:18px;padding:26px;background:var(--card);box-shadow:var(--shadow)}
.arch3 .anchor{text-align:center;border:1px solid var(--line-2);border-radius:12px;padding:14px 22px;background:var(--gold-soft)}
.arch3 .anchor .r{font-size:11px;letter-spacing:.12em;font-weight:700;color:var(--gold);margin-bottom:4px}
.arch3 .anchor h4{font-size:20px;font-weight:800}
.arch3 .down{font-size:22px;color:var(--gold);line-height:1;margin:8px 0}
.arch3 .pair{display:grid;grid-template-columns:1fr auto 1fr;gap:14px;align-items:center;width:100%}
.arch3 .bx{border:1px solid var(--line-2);border-radius:12px;padding:16px 18px;background:var(--card-2)}
.arch3 .bx.hero{border-color:rgba(126,156,196,.5)}.arch3 .bx.proof{border-color:rgba(111,174,123,.4)}
.arch3 .bx .r{font-size:10.5px;letter-spacing:.1em;font-weight:700;text-transform:uppercase;margin-bottom:5px}
.arch3 .bx.hero .r{color:var(--invest)}.arch3 .bx.proof .r{color:var(--keep)}
.arch3 .bx h4{font-size:19px;font-weight:800;margin-bottom:5px}.arch3 .bx p{font-size:12.5px;color:var(--ink-2)}
.arch3 .mid{font-size:11px;color:var(--gold);font-weight:700;text-align:center}
.warn{border-radius:14px;background:var(--stop-bg);border:1px solid rgba(217,105,76,.4);padding:18px 22px;margin-top:18px}
.warn .wt{font-size:12px;letter-spacing:.1em;font-weight:800;color:var(--stop);margin-bottom:10px}
.warn ul{list-style:none}.warn li{font-size:13.5px;color:var(--ink);padding:6px 0 6px 20px;position:relative}
.warn li::before{content:"!";position:absolute;left:0;color:var(--stop);font-weight:800}
.stoplist{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px}
.stoplist .si{font-size:13.5px;border-radius:10px;padding:11px 14px}
.stoplist .si.no{background:var(--stop-bg);color:var(--ink);border:1px solid rgba(217,105,76,.3)}
.stoplist .si.yes{background:var(--keep-bg);color:var(--ink);border:1px solid rgba(111,174,123,.3)}
.stoplist .si b{font-weight:700}.stoplist .si.no b{color:var(--stop)}.stoplist .si.yes b{color:var(--keep)}
.qa{border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
.qa .q{padding:16px 20px;border-bottom:1px solid var(--line)}
.qa .q:last-child{border-bottom:none}
.qa .q .qq{font-size:14.5px;font-weight:700;color:var(--gold);margin-bottom:6px}
.qa .q .aa{font-size:14px;color:var(--ink-2);line-height:1.6}.qa .q .aa b{color:var(--ink);font-weight:600}
@media(max-width:860px){.flowline,.stoplist,.arch3 .pair{grid-template-columns:1fr}.arch3 .pair .mid{display:none}}
'''

def T(w, tip): return f'<span class="t" data-tip="{tip}" tabindex="0">{w}</span>'
PH = '<span class="tag-inline hyp">ПРОВЕРИТЬ</span>'
D = '<span class="tag-inline data">ДАННЫЕ</span>'

BODY = '''
<div class="progress" id="prog"></div>

<header class="topbar">
  <div class="topbar-in">
    <div class="brand"><span class="dot"></span>VALONTI&nbsp;&times;&nbsp;ТОН <span>· питч для выступления</span></div>
    <nav class="nav">
      <a href="#s1"><span class="tag">01</span>Шпаргалка</a>
      <a href="#s2"><span class="tag">02</span>Архитектура</a>
      <a href="#s3"><span class="tag">03</span>Против каши</a>
      <a href="#s4"><span class="tag">04</span>Переход</a>
      <a href="#s5"><span class="tag">05</span>Смысл</a>
      <a href="#s6"><span class="tag">06</span>Лестница цен</a>
      <a href="#s7"><span class="tag">07</span>FAQ</a>
      <a href="#s8"><span class="tag">08</span>Ролик</a>
      <a href="#s9"><span class="tag">09</span>Маржа</a>
      <a href="#s10"><span class="tag">!</span>До сцены</a>
    </nav>
  </div>
</header>

<div class="wrap">

  <!-- HERO -->
  <section class="hero reveal">
    <div class="kicker"><span class="bar"></span>ВЫСТУПЛЕНИЕ ОЛИ В КАПСУЛЕ ТОН · ЗАХОДИМ ОТ VALONTI</div>
    <h1>Один герой - VALONTI. <span class="hl">Производство - доказательство. Без каши из трёх имён.</span></h1>
    <p class="lead">
      Завтра меняем заход в ТОН: раньше шли как GENGLASS и подсвечивали VALONTI «доступной роскошью» - эту формулировку убираем. Теперь к дизайнерам заходим лицом VALONTI: <b>премиальные материалы + мастерство + нестандарт под проект</b>. У VALONTI нет своей истории, поэтому доверие подпираем производством группы. Эта страница - архитектура брендов и шпаргалка для сцены, чтобы три бренда не слиплись в кашу.
    </p>
    <div class="stamp">
      <div class="s owner">Спикер: <b>Оля (РОП)</b></div>
      <div class="s">Аудитория: <b>дизайнеры</b></div>
      <div class="s">Прошло <b>Protocol&nbsp;9</b></div>
      <div class="s">ФЕНИКС <b>__SCORE__</b></div>
      <div class="s">Метрика вечера: <b>контакты дизайнеров</b></div>
    </div>
  </section>

  <!-- 01 ШПАРГАЛКА -->
  <section id="s1" class="reveal" style="border-top:none;padding-top:8px">
    <div class="tldr">
      <h3>ШПАРГАЛКА ОЛИ ЗА 60 СЕКУНД</h3>
      <ul>
        <li><span class="ic keep">✓</span><div><b>Говорю про VALONTI - 90% эфира.</b> GENGLASS и GENGROUP называю только как доказательство, что мы реальное производство, и иду дальше.</div></li>
        <li><span class="ic inv">◆</span><div><b>VALONTI</b> - «премиальные материалы и ручное мастерство под ваш нестандартный проект».</div></li>
        <li><span class="ic inv">◆</span><div><b>GENGLASS</b> (пруф, упомянуть 1-2 раза) - «серийные изделия выверенного качества для конечного покупателя».</div></li>
        <li><span class="ic inv">◆</span><div><b>GENGROUP</b> (якорь, 1 фраза) - «за обоими брендами одно производство: свои мастера, свой станочный парк».</div></li>
        <li><span class="ic stop">✕</span><div><b>Стоп-слова:</b> «роскошь», «доступная роскошь», «by GENGLASS» вслух, «индивидуальный подход», «высокое качество», «уникальный».</div></li>
        <li><span class="ic keep">✓</span><div><b>Продаю лестницу цен,</b> не «всё с нуля»: нестандартный размер/финиш быстро, авторская модель, bespoke - только под подтверждённый бюджет.</div></li>
        <li><span class="ic flag">⚑</span><div><b>Доверие - не словом, а физикой:</b> образцы материала в руки, 2-3 реализованных кейса, видео цеха. Цель вечера - снять контакт, не продать со сцены.</div></li>
      </ul>
    </div>
  </section>

  <!-- 02 АРХИТЕКТУРА -->
  <section id="s2" class="reveal">
    <div class="sec-head">
      <span class="sec-num">02</span>
      <div><h2 class="sec-title">Архитектура брендов: <span class="em">эндорсмент, не каша</span></h2>
      <p class="sec-sub">Тип - endorsed brands. Не всё под одним именем (это утопит молодой VALONTI под средним ярлыком), и не «бренды не знают друг друга» (тогда теряем главный пруф - реальное производство за VALONTI). Один герой, один пруф, один якорь.</p></div>
    </div>
    <div class="arch3">
      <div class="anchor"><div class="r">ЯКОРЬ ДОВЕРИЯ</div><h4>GENGROUP</h4></div>
      <div class="down">&darr; эндорсит обоих &darr;</div>
      <div class="pair">
        <div class="bx hero"><div class="r">ГЕРОЙ · ЛИЦО ЗАВТРА</div><h4>VALONTI</h4><p>Custom из премиальных материалов. Заходим к дизайнерам через него. Средний премиум-сегмент (mid-premium), растём к premium.</p></div>
        <div class="mid">&larr; пруф зрелости &rarr;</div>
        <div class="bx proof"><div class="r">ПРУФ · УПОМЯНУТЬ</div><h4>GENGLASS</h4><p>Серийная продукция, которую уже покупает конечный клиент. Доказывает: руки и контроль качества у нас есть.</p></div>
      </div>
    </div>
    <div class="arch-note"><b>Как это читается:</b> GENGROUP не продаём дизайнеру, он успокаивает («это не гаражная мастерская, за этим станки и мастера»). VALONTI держит сцену. GENGLASS - устный аргумент «мы умеем делать руками стабильно», не второй герой. Эндорсер - нейтральный GENGROUP, а не GENGLASS: подпись «by GENGLASS» тащит на премиум VALONTI средний ценовой шлейф.</div>
  </section>

  <!-- 03 ПРОТИВ КАШИ -->
  <section id="s3" class="reveal">
    <div class="sec-head">
      <span class="sec-num">03</span>
      <div><h2 class="sec-title">Правило против каши: <span class="em">1 герой / 1 пруф / 1 якорь</span></h2>
      <p class="sec-sub">У дизайнера на стенде ~40 секунд. Если за это время он не уложил «кто эти люди и зачем они мне» - контакт потерян. Три бренда не равны в эфире.</p></div>
    </div>
    <div class="grid3">
      <div class="icard" style="border-color:rgba(126,156,196,.4)"><div class="n" style="color:var(--invest)">ГЕРОЙ · 90% ЭФИРА</div><h4>VALONTI</h4><p>О нём говорим, его показываем, его кейсы, материалы, custom. Всё внимание сюда.</p></div>
      <div class="icard" style="border-color:rgba(111,174,123,.4)"><div class="n" style="color:var(--keep)">ПРУФ · 1-2 РАЗА</div><h4>GENGLASS</h4><p>«Серийное направление группы, которое уже стоит в домах». Без отдельных слайдов и каталога на столе.</p></div>
      <div class="icard"><div class="n">ЯКОРЬ · 1 СЛАЙД</div><h4>GENGROUP</h4><p>«За обоими - одно производство». Показали цех и станки один раз, дальше не возвращаемся.</p></div>
    </div>
    <div class="stoplist">
      <div class="si yes"><b>Дизайнер должен пересказать коллеге:</b> «VALONTI делают custom из премиальных материалов, за ними настоящее производство». Пересказал - архитектура держится.</div>
      <div class="si no"><b>Убрать совсем:</b> «доступная роскошь», слово «роскошь» про VALONTI, продажу GENGLASS параллельно, «by GENGLASS» как видимую подпись, перечисление всех 5 брендов группы.</div>
    </div>
  </section>

  <!-- 04 ПЕРЕХОД -->
  <section id="s4" class="reveal">
    <div class="sec-head">
      <span class="sec-num">04</span>
      <div><h2 class="sec-title">Переход от «доступной роскоши»: <span class="em">уточнение фокуса, не отступление</span></h2>
      <p class="sec-sub">Не извиняемся и не объявляем «мы передумали» - дизайнеру не нужна наша внутренняя кухня. Старое позиционирование тихо снимаем, не хороним публично.</p></div>
    </div>
    <div class="role-hero">
      <div class="big">
        «Раньше нас знали как глянцевую витрину. Но дизайнеры приходили с задачей, которую серия не закрывает: нестандартный размер, своя геометрия, конкретный материал под проект. Мы пошли за этим запросом. <b>VALONTI - это про материал, который вы выбираете, и руки, которые сделают по вашему чертежу.</b> Не про ярлык роскоши, а про то, что объект собирают мастера на нашем производстве.»
      </div>
      <div class="role-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="rcard"><div class="rl">Не обесцениваем</div><p>«Доступную роскошь» не называем ошибкой. Просто не упоминаем.</p></div>
        <div class="rcard"><div class="rl">Не пугаем ценой</div><p>«Роскошь» = «дорого и негибко». «Материал + мастерство» = инструмент в руках дизайнера.</p></div>
        <div class="rcard"><div class="rl">Сдвигаем разговор</div><p>С «какой у вас бренд» на «что я могу с вами сделать». Для дизайнера второе сильнее.</p></div>
      </div>
    </div>
  </section>

  <!-- 05 СМЫСЛ -->
  <section id="s5" class="reveal">
    <div class="sec-head">
      <span class="sec-num">05</span>
      <div><h2 class="sec-title">Лестница смысла: <span class="em">материал → мастерство → custom</span></h2>
      <p class="sec-sub">Главное «зачем» дизайнеру одной фразой: <b>VALONTI берёт ваш нестандарт и делает из него изделие, за которое не стыдно показать клиенту.</b> Дальше - три звена, каждое в выгоду дизайнеру и в то, что он скажет заказчику.</p></div>
    </div>
    <div class="flowline" style="grid-template-columns:repeat(3,1fr)">
      <div class="st"><div class="k">МАТЕРИАЛ</div><h5>Сам материал, не «похожее на»</h5><p>Камень, металл, стекло авторского уровня. Дизайнеру не надо оправдываться за выбор поставщика. Заказчику: «это настоящий камень, пощупайте разницу».</p></div>
      <div class="st"><div class="k">МАСТЕРСТВО</div><h5>Мастера + промышленные дизайнеры</h5><p>Узел камня и металла, выход на торец без скола, скрытое крепление - решается внутри, не возвращается дизайнеру вопросом «а как вы хотите?». Заказчику: «конструктив делают пром-дизайнеры, поэтому выглядит именно так».</p></div>
      <div class="st"><div class="k">CUSTOM</div><h5>Нестандарт - режим по умолчанию</h5><p>Не доплата за головную боль. Отдельный процесс с ТЗ и фиксированной ответственностью. Заказчику: «сделано под ваш проект, серийного аналога нет».</p></div>
    </div>
    <div class="callout"><b>Мостик «молодой бренд + взрослое производство»:</b> «VALONTI - молодой бренд, но за ним производство группы с собственным станочным парком и мастерами. Тот же ресурс, что делает серию GENGLASS, направлен на другую задачу - не серия, а ваш проект». Доверие переносится с имени на производство, и «молодой» перестаёт быть риском.</div>
  </section>

  <!-- 06 ЛЕСТНИЦА ЦЕН -->
  <section id="s6" class="reveal">
    <div class="sec-head">
      <span class="sec-num">06</span>
      <div><h2 class="sec-title">Лестница кастомизации: <span class="em">продаём её, не «всё с нуля»</span></h2>
      <p class="sec-sub">Главная защита маржи. Уходя «вверх по индивидуальности», нельзя выскочить из коридора, где дизайнерский заказчик платит: ни вниз в демпинг, ни вверх в недостижимый люкс «дорого и долго». Решение - три уровня с разной экономикой.</p></div>
    </div>
    <div class="ladder">
      <div class="lr r1"><div class="rk">1</div><div class="lt"><b>Быстрый custom (нестандартный размер/финиш авторской модели)</b> - надбавка <b>+5-15%</b> ''' + D + ''', срок недель, а не месяцев. Закрывает большинство запросов дизайнера, ловит по сроку.</div></div>
      <div class="lr r2"><div class="rk">2</div><div class="lt"><b>Авторская модель</b> - <b>+15-30%</b> ''' + D + ''' к референсу категории. Базовый режим VALONTI: материал и авторство держат премиум.</div></div>
      <div class="lr r3"><div class="rk">3</div><div class="lt"><b>Bespoke по чертежам с нуля</b> - проектная цена, срок <b>20-90 дней</b> ''' + D + '''. Верхняя полка: заходим только под подтверждённый заказчиком бюджет.</div></div>
    </div>
    <div class="callout"><b>Что говорит Оля:</b> большинство запросов закрывается «быстрым custom» (недели, +5-30%), а не bespoke с нуля (месяцы). Так VALONTI не скатывается ни в «доступный премиум», ни в «дорого и долго». Премиум держим авторством и материалом, маржу - надбавкой за нестандарт при контролируемом сроке. <b>Цену в коммуникацию площадки не выносим</b>, считаем смету под конкретный запрос.</div>
  </section>

  <!-- 07 FAQ -->
  <section id="s7" class="reveal">
    <div class="sec-head">
      <span class="sec-num">07</span>
      <div><h2 class="sec-title">FAQ дизайнера: <span class="em">возражения, которые прозвучат</span></h2>
      <p class="sec-sub">Готовые ответы. Где стоит метка ПРОВЕРИТЬ - перед сценой подставить реальную цифру из 1С/производства, не говорить выдуманное.</p></div>
    </div>
    <div class="qa">
      <div class="q"><div class="qq">Вы новые - как доверить вам проект клиента?</div><div class="aa">VALONTI - новое имя, производство за ним - нет. Тот же станочный парк и мастера, что делают серию GENGLASS. Ваш риск не «незнакомый исполнитель», а «незнакомое имя» - это разные вещи. <b>Опыт производства - ''' + PH + ''' подставить проверенную цифру (годы / число проектов).</b></div></div>
      <div class="q"><div class="qq">Чем отличаетесь от GENGLASS? Это одна компания?</div><div class="aa">GENGLASS - серийная продукция из каталога для конечного покупателя. VALONTI - нестандарт из премиальных материалов, когда серийного решения нет. <b>Одно производство - два режима работы.</b> Вы выбираете режим под задачу проекта, не бренд ради бренда.</div></div>
      <div class="q"><div class="qq">Потяну ли по цене для клиента?</div><div class="aa">Зависит от уровня кастомизации: нестандартный размер/финиш - <b>+5-15%</b> ''' + D + ''', авторская модель - <b>+15-30%</b> ''' + D + ''' к референсу категории. Если клиент смотрит на VALONTI - он уже в бюджете mid-premium. Смету считаем под запрос. <b>Стартовые цены и условия партнёрской программы - ''' + PH + '''.</b></div></div>
      <div class="q"><div class="qq">Какие сроки? У меня дата сдачи объекта.</div><div class="aa">Bespoke по чертежам - <b>20-90 рабочих дней</b> ''' + D + ''', фиксируется в ТЗ до старта. Нестандарт авторской модели - быстрее, по категории. Если есть дата сдачи, считаем назад от неё и говорим «да» только при наличии слота. Не берём заказ, который не закроем в срок.</div></div>
      <div class="q"><div class="qq">Это не та же фабрика, просто с другим ценником?</div><div class="aa">Нет. GENGLASS - металл, стекло, серийные форматы, каталог. VALONTI - камень, металл, стекло в конфигурациях, которых в каталоге нет, с промышленным дизайнером в разработке. <b>База общая, продуктовая логика разная.</b> Как типография печатает и листовки, и книги в переплёте - это не «листовки за дорого».</div></div>
      <div class="q"><div class="qq">Покажите прайс или каталог прямо сейчас.</div><div class="aa">Прайса на custom нет по определению - цена считается под конфигурацию. Дам вилку надбавок: нестандартный размер/финиш <b>+5-15%</b> ''' + D + ''', авторская модель <b>+15-30%</b> ''' + D + ''' к референсу категории. Смету под ваш референс пришлю в течение <b>''' + PH + '''</b> срока. Точные стартовые цены подтверждаю отдельно, наугад не называю.</div></div>
      <div class="q"><div class="qq">Чьи проекты вы уже сделали? С кем из дизайнеров работали?</div><div class="aa">Покажу 2-3 реализованных кейса прямо здесь: фото, чертёж, результат. <b>Громкими именами не торгуем - показываем работу:</b> материал, узел, исполнение. Если ваш проект ляжет в портфолио, то по согласию с вами. ''' + PH + ''': конкретные кейсы и согласия на показ собрать до стенда.</div></div>
      <div class="q"><div class="qq">Как выглядит работа со мной?</div><div class="aa">Присылаете референс или ТЗ → возвращаемся с конструктивным предложением и предварительной сметой → согласование узлов и фиксация в документе → производство по подписанному ТЗ → приёмка с вашим участием. Без «мы примерно так поняли» на этапе производства.</div></div>
    </div>
  </section>

  <!-- 08 РОЛИК -->
  <section id="s8" class="reveal">
    <div class="sec-head">
      <span class="sec-num">08</span>
      <div><h2 class="sec-title">Motion-ролик «Рез» <span class="em">перед выступлением (28 сек)</span></h2>
      <p class="sec-sub">Ведём зрителя не от логотипа, а от среза материала: гидроабразив режет камень - то, что дизайнер не может показать клиенту сам. Путь: материал → рука мастера → custom-объект → цех как доказательство. Премиальность держим материалом, светом и тишиной, не пафосом.</p></div>
    </div>
    <div class="flowline">
      <div class="st"><div class="k">0-3 С</div><h5>Чёрное поле</h5><p>Макро Nero Marquina, белые прожилки проявляются из темноты. Контровой свет. Тихо. Текст: имя камня.</p></div>
      <div class="st"><div class="k">3-9 С</div><h5>Рез</h5><p>Гидроабразив режет плиту, пыль и брызги в контровом, slow-motion. Текст: «режем под размер проекта».</p></div>
      <div class="st"><div class="k">9-14 С</div><h5>Рука</h5><p>Мастер снимает фаску, проводит по кромке. Деталь крупно, точность. Текст: «мастер + промышленный дизайнер».</p></div>
      <div class="st"><div class="k">14-24 С</div><h5>Объект и цех</h5><p>Готовый предмет VALONTI в свету, камера откатывается - он стоит в реальном цеху. Пруф без отдельного блока про завод.</p></div>
      <div class="st"><div class="k">24-28 С</div><h5>Подпись</h5><p>Чёрное поле. <b>VALONTI</b> / «камень, бронза, custom» / тонко: «производство GENGROUP». Тишина.</p></div>
    </div>
    <div class="callout"><b>Anti-median (пройдено):</b> заход от среза материала, а не от интерьер-рендера; один герой, бренды не свалены в кучу; тишина и медленный темп вместо трека и нарезки; конкретика «режем под размер» вместо «непревзойдённое качество». GENGLASS в ролике не показываем вовсе. Палитра: NERO-фон, камень/бронза/сталь, золото только в материале и блике. В титрах проверить: нет слова «роскошь», нет em dash.</div>
  </section>

  <!-- 09 МАРЖА -->
  <section id="s9" class="reveal">
    <div class="sec-head">
      <span class="sec-num">09</span>
      <div><h2 class="sec-title">Защита маржи и <span class="em">стоп-краны custom</span></h2>
      <p class="sec-sub">Выступать можно завтра. Но операционный запуск custom-потока без стоп-кранов - это дотация дизайнерам за наш счёт. Custom прибылен при дисциплине, а не сам по себе.</p></div>
    </div>
    <div class="frame">
      <div class="f"><span class="m mk gold">1</span><div><b>Минимальный чек просчёта (MOQ)</b> ''' + PH + '''. Нестандарт ниже порога не просчитывается как проект - переводится в стандартный аналог или отклоняется. Иначе команда тонет в единичных хотелках.</div></div>
      <div class="f"><span class="m mk gold">2</span><div><b>Лимит бесплатных просчётов</b> на дизайнера в период. Инжиниринг нестандарта - это часы пром-дизайнера и производства. Дальше - просчёт авансируется или зачитывается в заказ.</div></div>
      <div class="f"><span class="m mk gold">3</span><div><b>Образцы привязаны к дизайнеру в Bitrix24</b> под конкретный проект, не «на посмотреть». Лимит образцов на квартал.</div></div>
      <div class="f"><span class="m mk gold">4</span><div><b>Лимит итераций правок</b> в проектном процессе. Бесконечные правки bespoke - классический убийца маржи. Дальше правки тарифицируются.</div></div>
      <div class="f"><span class="m mk gold">5</span><div><b>Раздельный учёт пресейл-затрат.</b> Время на просчёты - отдельной статьёй, не в «маркетинге». Иначе канал прибылен на бумаге при отрицательной реальной марже.</div></div>
      <div class="f"><span class="m mk keep">метка</span><div><b>Настроить тег источника лида = «ТОН»</b> ''' + PH + ''' на карточке дизайнера (согласовать с Борисом), переносить в сделку и смарт-процесс «Индивидуальный проект» ''' + D + '''. Без метки канал слепой.</div></div>
    </div>
    <div class="callout" style="background:var(--stop-bg);border-color:rgba(217,105,76,.3)"><b style="color:var(--stop)">Downside (базовый, не редкий):</b> дизайнеры услышали «custom из премиальных материалов», понесли единичные дорогие хотелки без объёма. Просчёты и образцы съели надбавку +15-30% до первого оплаченного проекта. Ловим рано: соотношение «просчётов / заведённых артикулов» (растёт, а артикулов 0 - стоп), прямой вопрос «вписали в спеку, в какой проект». Реакция - НЕ демпинг (убьёт юнит-логику), а ужесточение MOQ и квалификации, перевод хотелок в стандартный аналог.</div>
  </section>

  <!-- 10 ДО СЦЕНЫ -->
  <section id="s10" class="reveal">
    <div class="sec-head">
      <span class="sec-num">!</span>
      <div><h2 class="sec-title">Проверить до сцены <span class="em">(иначе скажем выдуманное)</span></h2>
      <p class="sec-sub">Council предложил конкретные цифры для убедительности, но они не из выгрузок. Перед выступлением их надо подтвердить у производства/в 1С или не произносить. Честность - часть позиционирования.</p></div>
    </div>
    <div class="warn">
      <div class="wt">НЕ ПРОИЗНОСИТЬ БЕЗ ПОДТВЕРЖДЕНИЯ</div>
      <ul>
        <li>Число проектов и годы опыта производства (звучали «4200», «с 2018») - подставить проверенную цифру из 1С.</li>
        <li>Гарантия допуска (звучало «±2 мм») - подтвердить у производства или убрать.</li>
        <li>Стартовые цены изделий и процент партнёрской программы - подтвердить у Ивана/Романа.</li>
        <li>Конкретная материальная программа (перечень камней, покрытий) - сверить с фактическим наличием.</li>
      </ul>
    </div>
    <div class="frame" style="margin-top:16px">
      <div class="f"><span class="m mk keep">✓</span><div><b>Можно говорить (подтверждено glossary):</b> надбавка за нестандарт +5-15%, авторская модель +15-30%, bespoke 20-90 дней, смарт-процесс «Индивидуальный проект» в Bitrix24.</div></div>
      <div class="f"><span class="m mk gold">▸</span><div><b>Принести на стенд:</b> образцы материала в руки, 2-3 реализованных custom-кейса (фото до/чертёж/после), короткое видео цеха. Без физического пруфа заход «от VALONTI» держится на одних словах.</div></div>
      <div class="f"><span class="m mk gold">▸</span><div><b>Дать Оле:</b> карточку-шпаргалку (раздел 01) на одну сторону, прогон 10 минут, стоп-лист перед глазами.</div></div>
      <div class="f"><span class="m mk invest">▸</span><div><b>Решить до операционного запуска custom:</b> MOQ, лимит просчётов и правок, ставка часа команды для учёта пресейл-затрат, настроить поле-тег источника «ТОН» в Bitrix24 (с Борисом). Без них поток custom - под стоп.</div></div>
      <div class="f"><span class="m mk gold">▸</span><div><b>После стенда:</b> горячий контакт берёт в работу менеджер первой линии по скрипту квалификации в течение 1-2 дней, фиксирует запрос и метку «ТОН». Контакт без следующего шага - потерянный контакт.</div></div>
    </div>
  </section>

  <!-- FOOTER -->
  <footer class="footer reveal">
    <div class="legend">
      <div class="l"><span class="sw" style="background:var(--keep)"></span>держим / можно говорить</div>
      <div class="l"><span class="sw" style="background:var(--stop)"></span>стоп / не произносить</div>
      <div class="l"><span class="sw" style="background:var(--invest)"></span>решаем / контроль</div>
      <div class="l"><span class="sw" style="background:var(--gold)"></span>принести / ключевое</div>
    </div>
    <div style="font-size:13px;color:var(--ink-2);margin-bottom:8px">
      <span class="tag-inline data">ДАННЫЕ</span> - из glossary v2.1 / 1С / Bitrix24 &nbsp;·&nbsp;
      <span class="tag-inline hyp">ПРОВЕРИТЬ</span> - цифра не из выгрузки, подтвердить до сцены.
    </div>
    <div class="foot-meta">
      <div class="seal"><span class="d"></span>GENGROUP · VALONTI &times; ТОН · питч для выступления Оли</div>
      <div>Council: МАРКО + ЭММА + КРЕА + РОМАН · Protocol 9 · приёмка ФЕНИКС __SCORE__</div>
    </div>
  </footer>

</div>

<script>
  document.body.classList.add('js');
  var prog=document.getElementById('prog');
  function onScroll(){var h=document.documentElement;prog.style.width=(h.scrollTop)/(h.scrollHeight-h.clientHeight)*100+'%';}
  window.addEventListener('scroll',onScroll,{passive:true});onScroll();
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.12,rootMargin:'0px 0px -8% 0px'});
  document.querySelectorAll('.reveal').forEach(function(el){io.observe(el);});
</script>
'''

BODY = BODY.replace('__SCORE__', '9.6/10 · GO')

html = ('<!DOCTYPE html>\\n<html lang="ru">\\n<head>\\n<meta charset="UTF-8">\\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">\\n'
        '<title>VALONTI &times; ТОН - питч для выступления · GENGROUP</title>\\n'
        '<style>' + CSS + EXTRA + '</style>\\n</head>\\n<body>\\n' + BODY + '\\n</body>\\n</html>\\n')

os.makedirs('smm/public/ton-pitch', exist_ok=True)
open('smm/public/ton-pitch/index.html','w',encoding='utf-8').write(html)

print('bytes:', len(html))
print('section bal:', html.count('<section')-html.count('</section>'))
print('div bal:', html.count('<div')-html.count('</div>'))
print('em dash:', html.count(chr(0x2014)))
print('SF Pro:', 'SF Pro Display' in html)
