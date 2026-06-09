# -*- coding: utf-8 -*-
# Сборка страницы VALONTI x ТОН на дизайн-системе проекта.
# CSS-движок берём 1-в-1 из smm/public/index.html (сохранение дизайн-системы),
# добавляем минимум новых компонентов. Контент - синтез Council (ДАТА/МАРКО/РОМАН).
import os

base = open('smm/public/index.html', encoding='utf-8').read()
i = base.index('<style>'); j = base.index('</style>')
CSS = base[i+len('<style>'):j]

EXTRA = '''
/* --- VALONTI x ТОН: доп. компоненты на той же системе --- */
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.chip{font-size:12px;font-weight:600;color:var(--ink-2);border:1px solid var(--line-2);border-radius:30px;padding:6px 12px;background:rgba(255,255,255,.015)}
.chip b{color:var(--gold);font-weight:700}
.res-tag{font-size:10.5px;font-weight:700;letter-spacing:.04em;color:var(--ink-3);text-transform:uppercase}
.flowline{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:6px}
.flowline .st{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 14px;position:relative}
.flowline .st .k{font-size:11px;font-weight:800;color:var(--gold);letter-spacing:.1em;margin-bottom:8px}
.flowline .st h5{font-size:14px;font-weight:700;margin-bottom:6px;letter-spacing:-.01em}
.flowline .st p{font-size:12.5px;color:var(--ink-2);line-height:1.5}
@media(max-width:860px){.flowline{grid-template-columns:1fr}}
'''

# Хелпер тултипа
def T(w, tip): return f'<span class="t" data-tip="{tip}" tabindex="0">{w}</span>'

BODY = '''
<div class="progress" id="prog"></div>

<header class="topbar">
  <div class="topbar-in">
    <div class="brand"><span class="dot"></span>VALONTI&nbsp;&times;&nbsp;ТОН <span>· капсула ЗИЛАРТ</span></div>
    <nav class="nav">
      <a href="#s1"><span class="tag">01</span>Капсула</a>
      <a href="#s2"><span class="tag">02</span>Резиденты</a>
      <a href="#s3"><span class="tag">03</span>Перехват</a>
      <a href="#s4"><span class="tag">04</span>Позиционирование</a>
      <a href="#s5"><span class="tag">05</span>Коллаборации</a>
      <a href="#s6"><span class="tag">06</span>Контент</a>
      <a href="#s7"><span class="tag">07</span>Экономика</a>
      <a href="#s8"><span class="tag">08</span>Пилот</a>
      <a href="#s9"><span class="tag">!</span>Риски</a>
      <a href="#s10"><span class="tag">10</span>Решаем</a>
    </nav>
  </div>
</header>

<div class="wrap">

  <!-- HERO -->
  <section class="hero reveal">
    <div class="kicker"><span class="bar"></span>VALONTI &times; ТОН · ПАРТНЁРСКАЯ КАПСУЛА НА ЗИЛАРТ</div>
    <h1>VALONTI в капсуле ТОН. <span class="hl">Чужой трафик дизайнеров оплачивает наш показ.</span></h1>
    <p class="lead">
      ТОН - живой шоурум на ЗИЛАРТ, который собрал премиум-поставщиков интерьера под одной крышей. Мы там резидент через GEN-GROUP. Для VALONTI это почти бесплатный
      ''' + T('B2D','Продажи через дизайнеров и архитекторов, которые закладывают бренд в проект клиента.') + '''-канал: дизайнеры приходят сами, трогают камень и металл, закладывают артикул в проект заказчика. Условие одно - считать <b>спецификации, а не восхищения</b>, и не дать VALONTI размыться в «доступный премиум».
    </p>
    <div class="stamp">
      <div class="s owner">Владелец канала: <b>''' + T('Аня Емельяненко','Владелец SMM-канала GENGROUP по принятой SMM-стратегии. Точка операционной ответственности, не резидент ТОН.') + '''</b></div>
      <div class="s">Партнёры-кураторы: <b>Н. и Н. Ксенофонтовы</b></div>
      <div class="s">Прошло <b>Protocol&nbsp;9</b></div>
      <div class="s">ФЕНИКС <b>__SCORE__</b></div>
      <div class="s">Метрика: <b>дизайн-лиды, не рубли 2026</b></div>
    </div>
  </section>

  <!-- TL;DR -->
  <section class="reveal" style="border-top:none;padding-top:8px">
    <div class="tldr">
      <h3>СУТЬ ЗА 30 СЕКУНД</h3>
      <ul>
        <li><span class="ic keep">✓</span><div><b>ТОН = физический шоурум VALONTI</b> и доступ к практикующим дизайнерам. Метрика - спеки в работе, не визиты.</div></li>
        <li><span class="ic inv">◆</span><div><b>Точка перехвата - не на входе.</b> Дизайнер заходит на чужой повод (свет, текстиль), а VALONTI берёт его на стадии комплектации зоны и «замещения ушедшего импорта».</div></li>
        <li><span class="ic stop">✕</span><div><b>Риск №1: ТОН назвал нас «доступный премиум».</b> Это прямое размытие VALONTI. Снять на уровне кураторов до старта co-marketing.</div></li>
        <li><span class="ic keep">✓</span><div><b>VALONTI - единственное публичное лицо в ТОН.</b> GENGLASS = невидимая производственная база (Lexus, не «Lexus by Toyota»).</div></li>
        <li><span class="ic inv">◆</span><div><b>Коллаборации - сложение, не дележ.</b> Камень, стекло, металл, акцент - категория, которой нет ни у одного резидента. Мы дополняем, не конкурируем.</div></li>
        <li><span class="ic flag">⚑</span><div><b>Деньги живут в одной точке - повторная спека дизайнером.</b> Всё до неё - затраты и гипотеза.</div></li>
        <li><span class="ic stop">✕</span><div><b>Пилот ≤200K, тег «ТОН» в CRM до старта.</b> Без атрибуции канал слепой и недоказуемый = BLOCK.</div></li>
      </ul>
    </div>
  </section>

  <!-- 01 КАПСУЛА -->
  <section id="s1" class="reveal">
    <div class="sec-head">
      <span class="sec-num">01</span>
      <div><h2 class="sec-title">Что такое капсула ТОН и <span class="em">где в ней мы</span></h2>
      <p class="sec-sub">ТОН - не «точка аренды», а кураторский шоурум, где материалы, мебель и свет показывают в связке, а не по каталогам. Аудитория - дизайнеры, их заказчики и производители. Адрес: Москва, ЗИЛАРТ, ул. Архитектора Щусева, 4к2 <span class="tag-inline data">ДАННЫЕ</span>.</p></div>
    </div>
    <div class="arch">
      <div class="node gg">
        <div class="role">ПРОИЗВОДСТВЕННАЯ БАЗА · НЕВИДИМА</div>
        <h4>GENGLASS / GEN-GROUP</h4>
        <p>Производство в Домодедово, стекло, зеркало, металл. Сроки, контроль качества, логистика. В капсуле молчит как бренд - это инфраструктура, не вывеска.</p>
      </div>
      <div class="flow">
        <div class="arrow">&rarr;</div>
        <div class="lbl">даёт мощность<br>остаётся за кадром</div>
      </div>
      <div class="node v">
        <div class="role">ПУБЛИЧНОЕ ЛИЦО · B2D</div>
        <h4>VALONTI</h4>
        <p>Единственный бренд, который дизайнер видит на нашей экспозиции. Авторский камень и металл, галерейная подача. Уже стоит объект AUGASO <span class="tag-inline data">ДАННЫЕ</span>.</p>
      </div>
    </div>
    <div class="arch-note">
      <b>Кто держит площадку:</b> основатели-кураторы Николай Ксенофонтов и Наталия Ксенофонтова (архитектурное бюро). Отбор резидентов вела лично Наталия <span class="tag-inline data">ДАННЫЕ</span>. Наша команда уже внутри закрытого чата резидентов: Богдан Валайко, Оля Лысенко (РОП), Анна Сосновская, Анастасия Валайко, Марина (промдизайнер), Роман Гужик, Наташа Скриптун, Иван.
    </div>
  </section>

  <!-- 02 РЕЗИДЕНТЫ -->
  <section id="s2" class="reveal">
    <div class="sec-head">
      <span class="sec-num">02</span>
      <div><h2 class="sec-title">Резиденты-партнёры и <span class="em">их собственники</span></h2>
      <p class="sec-sub">Это карта, кому жать руку. Каждый резидент - отдельный бизнес со своим собственником. Источник - рабочие чаты капсулы, confidence помечен честно. Это не наши конкуренты, а соседи по проекту дизайнера.</p></div>
    </div>
    <div class="tbl">
      <div class="row h"><div>Резидент</div><div>Собственник / первое лицо</div><div>Категория</div><div>Связка с VALONTI</div></div>
      <div class="row"><div><span class="brand-n">Mebelit</span></div><div><span class="desc">Андрей Колегов, основатель <span class="tag-inline data">ДАННЫЕ</span></span></div><div><span class="desc">Индивидуальная мебель</div><div><span class="why">Каменная вставка/столешница VALONTI в их корпус.</span></div></div>
      <div class="row"><div><span class="brand-n">CSC Group</span></div><div><span class="desc">Михаил Смагин, управл. партнёр <span class="tag-inline hyp">c=0.9</span></span></div><div><span class="desc">Свет и потолки, «лаборатория света»</div><div><span class="why">Главный повод визита. Свет читает фактуру камня и металла.</span></div></div>
      <div class="row"><div><span class="brand-n">AcousticPet</span></div><div><span class="desc">Алексей Старилов, первое лицо <span class="tag-inline data">ДАННЫЕ</span></span></div><div><span class="desc">Акустические PET-панели</div><div><span class="why">Тихий фон под наш объект-акцент.</span></div></div>
      <div class="row"><div><span class="brand-n">MULÉMU</span></div><div><span class="desc">Екатерина (@KatherineRojo) <span class="tag-inline data">ДАННЫЕ</span></span></div><div><span class="desc">Мягкая мебель на заказ</div><div><span class="why">Комплектность зоны: диван + наш акцент рядом.</span></div></div>
      <div class="row"><div><span class="brand-n">Текстильный дом А. Квятковской</span></div><div><span class="desc">Анна Квятковская <span class="tag-inline data">ДАННЫЕ</span></span></div><div><span class="desc">Текстиль, ковры, шторы</div><div><span class="why">Цветовая сцепка ткань + каменная палитра.</span></div></div>
      <div class="row"><div><span class="brand-n">SKETCHINGGO</span></div><div><span class="desc">Ирина Федотова <span class="tag-inline hyp">c=0.8</span></span></div><div><span class="desc">Бани, сауны, хамамы (СПб)</div><div><span class="why">Слабая прямая связка. Точечно.</span></div></div>
      <div class="row"><div><span class="brand-n">Джессо · Giorgio Graesan</span></div><div><span class="desc">Собственник в чатах не назван <span class="tag-inline hyp">ПРОБЕЛ</span></span></div><div><span class="desc">Итал. декоративная штукатурка</div><div><span class="why">Фактурная стена как оправа нашего предмета.</span></div></div>
      <div class="row"><div><span class="brand-n">Бюро Н. Ксенофонтовой</span></div><div><span class="desc">Наталия Ксенофонтова - куратор <span class="tag-inline data">ДАННЫЕ</span></span></div><div><span class="desc">Архитектурный дизайн</div><div><span class="why">Куратор отбора. Ключ к доверию и базе дизайнеров.</span></div></div>
    </div>
    <div class="callout"><b>Кому жать руку первым:</b> кураторы Ксенофонтовы (доступ и доверие) и CSC Group (свет - самый частый повод визита дизайнера, значит самый сильный кросс-трафик на нашу экспозицию).</div>
  </section>

  <!-- 03 ПЕРЕХВАТ -->
  <section id="s3" class="reveal">
    <div class="sec-head">
      <span class="sec-num">03</span>
      <div><h2 class="sec-title">Как дизайнер реально <span class="em">заводит VALONTI в проект</span></h2>
      <p class="sec-sub">В капсуле дизайнер не покупает товар. Он закладывает наш артикул в ''' + T('спецификацию','Список материалов и предметов, который дизайнер согласует с заказчиком и по которому идёт закупка.') + ''' проекта, который продаст своему заказчику. Цикл - 2-4 месяца до подписания. Поэтому точку перехвата надо ловить правильно.</p></div>
    </div>
    <div class="flowline">
      <div class="st"><div class="k">01</div><h5>Повод зайти</h5><p>Дизайнер идёт на практикум по свету CSC или за тканью. VALONTI встречает попутно. Чужой трафик оплачивает наш показ.</p></div>
      <div class="st"><div class="k">02</div><h5>Контакт рукой</h5><p>Камень, бронза, латунь, стекло. В премиуме решение принимают рукой и светом, не рендером. Это то, чего не даёт Pinterest.</p></div>
      <div class="st"><div class="k">03</div><h5>Перехват</h5><p>Момент комплектации зоны под заказчика. Нужен акцент уровня замещения ''' + T('Cattelan','Итальянский премиум-бренд мебели. VALONTI замещает по сроку: ориентир 4-6 недель против 12-16 у импорта (ГИПОТЕЗА).') + '''. Тут мы выигрываем по сроку и нестандарту.</p></div>
      <div class="st"><div class="k">04</div><h5>Спецификация</h5><p>Дизайнер уходит с тех-карточкой артикула и партнёрским бонусом. <b>Лид зафиксирован здесь</b>, не на оплате.</p></div>
      <div class="st"><div class="k">05</div><h5>Реордер</h5><p>Дизайнер делает 5-15 проектов в год. Один отработавший артикул возвращается в следующие проекты без нового касания. Это ''' + T('LTV','Сколько денег партнёр приносит за всё время сотрудничества, а не за одну сделку.') + ''' дизайнера.</p></div>
    </div>
    <div class="callout" style="margin-top:18px"><b>Главное:</b> перехватываем на стадии комплектации зоны и «чем заменю ушедший импорт», а не на входной стойке и не на масс-позиции. Считаем заведённые артикулы, а не людей у витрины.</div>
  </section>

  <!-- 04 ПОЗИЦИОНИРОВАНИЕ -->
  <section id="s4" class="reveal">
    <div class="sec-head">
      <span class="sec-num">04</span>
      <div><h2 class="sec-title">Защита позиционирования: <span class="em">«доступный премиум» под снос</span></h2>
      <p class="sec-sub">ТОН публично описал GEN-GROUP как «философию доступного премиума» <span class="tag-inline data">ДАННЫЕ</span>. Для VALONTI (middle+/premium, замещение Cattelan) это сигнал «дёшево, но красиво» - ровно то, что отпугивает целевого дизайнера. Чинится без скандала, рабочей правкой.</p></div>
    </div>
    <div class="grid3">
      <div class="icard"><div class="n">ПРАВКА У КУРАТОРОВ</div><h4>Снять формулировку</h4><p>Разговор с Николаем и Наталией: VALONTI в их коммуникации звучит как авторский материал и галерейная подача, не «доступно». Если после правки повторяют - режем co-marketing, эскалация Ивану.</p></div>
      <div class="icard"><div class="n">ГОЛОС VALONTI</div><h4>Материал и автор, без цены</h4><p>Имя автора + материал + одна идея. Никаких «доступно», «выгодно», «оптимально». Цена не выносится в коммуникацию площадки.</p></div>
      <div class="icard"><div class="n">РАЗДЕЛЕНИЕ ГОЛОСОВ</div><h4>VALONTI видно, GENGLASS - нет</h4><p>Один резидент GEN-GROUP, два голоса. VALONTI - публичное лицо. GENGLASS - база за кадром. «by GENGLASS» в публичный контент капсулы не выносим.</p></div>
    </div>
    <div class="callout"><b>Premium-by-restriction:</b> в капсулу не весь каталог, а узкая авторская выборка. Дефицит экспозиции работает на премиум сильнее, чем полнота. Аналогия Lexus: в шоуруме не висит «Lexus by Toyota», база невидима, бренд премиален.</div>
  </section>

  <!-- 05 КОЛЛАБОРАЦИИ -->
  <section id="s5" class="reveal">
    <div class="sec-head">
      <span class="sec-num">05</span>
      <div><h2 class="sec-title">Коллаборации с резидентами: <span class="em">«Сцена на четверых»</span></h2>
      <p class="sec-sub">VALONTI ни с кем не бьётся за один бюджет. Мы закрываем категорию «камень / стекло / металл / акцент», которой нет ни у одного резидента. Это делает коллаборацию сложением, а не дележом.</p></div>
    </div>
    <div class="matrix">
      <div class="mcol v">
        <h4>Один проект, одна зона</h4>
        <div class="sub">премиум-интерьер · готовое решение</div>
        <ul>
          <li><b>CSC Group</b> - сценарный свет на наш камень и металл</li>
          <li><b>MULÉMU</b> - мягкая мебель, рядом акцент VALONTI</li>
          <li><b>Mebelit</b> - наша каменная столешница в их корпусе</li>
          <li><b>Квятковская</b> - текстиль в цвет каменной палитры</li>
          <li><b>AcousticPet</b> - PET-панель как тихий фон</li>
          <li><b>Джессо</b> - фактурная стена под наш предмет</li>
        </ul>
      </div>
      <div class="mcol gg">
        <h4>Форматы кейсов</h4>
        <div class="sub">снимается один раз · кормит ленты всех</div>
        <ul>
          <li><b>Сцена на четверых</b> - готовая зона в шоуруме, дизайнер фотографирует и несёт заказчику</li>
          <li><b>Камень под светом</b> - парный практикум VALONTI + CSC</li>
          <li><b>Тон в тон</b> - подбор текстиля к каменной палитре с Квятковской</li>
          <li><b>Спец-объект</b> - каменная вставка в мебель Mebelit, две спеки в одном предмете</li>
        </ul>
      </div>
    </div>
    <div class="callout"><b>Приоритет по силе кросс-трафика:</b> CSC (свет - частый повод) &gt; Квятковская (близость эстетики) &gt; MULÉMU / Mebelit (комплектность зоны) &gt; остальные. <b>Правило авторства:</b> если в кадре VALONTI читается как фон чужой мебели, а не как центр сцены - кейс под нашим брендом не публикуем.</div>
  </section>

  <!-- 06 КОНТЕНТ -->
  <section id="s6" class="reveal">
    <div class="sec-head">
      <span class="sec-num">06</span>
      <div><h2 class="sec-title">Контент вокруг капсулы: <span class="em">два контура</span></h2>
      <p class="sec-sub">Контур ТОН - их аудитория, наш повод. Контур VALONTI - наши ленты IG и Pinterest для дизайнеров. Публичный TG VALONTI не создаём (решение принятой стратегии). Топливо - съёмки Богдана 1-2/мес и общие съёмки капсулы.</p></div>
    </div>
    <div class="tbl">
      <div class="row h"><div>Формат</div><div>Повод</div><div>Канал</div><div>Зачем</div></div>
      <div class="row"><div><span class="brand-n">Карточка материала</span></div><div><span class="desc">новый камень/металл в экспозиции</span></div><div><span class="desc">Pinterest + IG</span></div><div><span class="why">''' + T('pull','Канал, куда дизайнер приходит сам и ищет визуал. Не требует набранной аудитории.') + '''-поиск дизайнеров, актив копится</span></div></div>
      <div class="row"><div><span class="brand-n">Reels «свет читает фактуру»</span></div><div><span class="desc">практикум с CSC</span></div><div><span class="desc">IG</span></div><div><span class="why">показываем материал в действии</span></div></div>
      <div class="row"><div><span class="brand-n">Кейс «Сцена на четверых»</span></div><div><span class="desc">кросс-резидентская съёмка</span></div><div><span class="desc">IG + Pinterest, репост всеми</span></div><div><span class="why">готовое решение в руки дизайнеру</span></div></div>
      <div class="row"><div><span class="brand-n">Анонс практикума</span></div><div><span class="desc">событие на площадке (Timepad)</span></div><div><span class="desc">канал ТОН + IG stories</span></div><div><span class="why">мы даём повод, ТОН даёт охват</span></div></div>
    </div>
    <div class="callout"><b>Дисциплина:</b> каденс привязан к событиям капсулы и съёмкам, не к календарю ради календаря. Весь текст - через humanizer-ru и Anti-Slop. Перед любым launch-постом коллаборации - Step 12.5 (ФЕНИКС).</div>
  </section>

  <!-- 07 ЭКОНОМИКА -->
  <section id="s7" class="reveal">
    <div class="sec-head">
      <span class="sec-num">07</span>
      <div><h2 class="sec-title">Экономика канала: <span class="em">где чистая прибыль, где иллюзия</span></h2>
      <p class="sec-sub">Канал структурно высокомаржинален - но прибыль живёт в одной точке: повторная спека дизайнером в оплаченный проект. Всё, что до этой точки, - затраты и гипотеза. Реальных выгрузок по VALONTI пока нет, поэтому ни одна цифра здесь не выдаётся за факт.</p></div>
    </div>
    <div class="engines" style="margin-bottom:18px">
      <div class="eng a">
        <div class="tag">ГДЕ ПРИБЫЛЬ</div>
        <h4>Повторная спека</h4>
        <dl>
          <dt>CAC</dt><dd>''' + T('CAC','Стоимость привлечения одного платящего партнёра.') + ''' размазан на поток проектов дизайнера, а не на одну сделку.</dd>
          <dt>Чек</dt><dd>Дизайнер не торгуется как конечник. Премиум - его инструмент маржи.</dd>
          <dt>Замок</dt><dd>Артикул в проектной документации трудно заменить на аналог.</dd>
        </dl>
      </div>
      <div class="eng b">
        <div class="tag">ГДЕ ИЛЛЮЗИЯ</div>
        <h4>Восхищение у витрины</h4>
        <dl>
          <dt>Трафик</dt><dd>«Потрогал и восхитился» не равно «вписал в спеку». Между ними 4-5 этапов отвала.</dd>
          <dt>Бесплатно</dt><dd>Резидентство оплачено как факт, но события, образцы и время команды - новые деньги поверх.</dd>
          <dt>Рефералы</dt><dd>Обмен визитками между резидентами часто остаётся в тусовке, а не в проекте заказчика.</dd>
        </dl>
      </div>
    </div>
    <h3 style="font-size:18px;font-weight:700;margin:30px 0 14px;color:var(--gold)">Метрики, которые надо завести (иначе канал слепой)</h3>
    <div class="frame">
      <div class="f"><span class="m mk gold">1</span><div><b>''' + T('Атрибуция','Понимание, какой канал реально привёл сделку.') + ''' тегом «ТОН» в Bitrix24.</b> Каждый дизайнер тегируется источником, сделка наследует тег. Без него вклад = 0 по умолчанию.</div></div>
      <div class="f"><span class="m mk gold">2</span><div><b>CAC дизайнера-партнёра</b> = затраты капсулы / число активированных дизайнеров (≥1 спека, не «взял визитку»).</div></div>
      <div class="f"><span class="m mk gold">3</span><div><b>LTV дизайнера</b> = средний чек × число спек × маржа × удержание. Источник - ''' + T('когорта','Группа партнёров, пришедших в один период, которую отслеживают во времени.') + ''' 1С по тегу «ТОН».</div></div>
      <div class="f"><span class="m mk gold">4</span><div><b>Удержание дизайнеров</b> - доля давших 2-ю и 3-ю спеку. <b>Самая важная метрика канала</b>: она отличает высокую маржу от дорогой розницы.</div></div>
      <div class="f"><span class="m mk gold">5</span><div><b>Доля проектов с кросс-резидентским чеком</b> - где в сделке VALONTI есть второй резидент. Доказывает, что экосистема работает, а не только наш стенд.</div></div>
      <div class="f"><span class="m mk keep">KPI 2026</span><div><b>Спеки в работе</b> (заведено, ещё не закрыто). Честный KPI, который не врёт про выручку, но показывает движение денег к нам. <b>Цель-ориентир: 8-12 спек в работе к Q4 2026</b> <span class="tag-inline hyp">ГИПОТЕЗА - уточнить после baseline</span>.</div></div>
    </div>
  </section>

  <!-- 08 ПИЛОТ -->
  <section id="s8" class="reveal">
    <div class="sec-head">
      <span class="sec-num">08</span>
      <div><h2 class="sec-title">Пилот: <span class="em">потолок, чекпоинты, стоп-краны</span></h2>
      <p class="sec-sub">Капсула - это demand-gen эксперимент с длинным B2D-циклом, не открытый бюджет. Судим по leading-метрикам (спеки в работе), не по закрытой выручке: спека до закрытия идёт 3-9 месяцев, иначе зарежем канал раньше, чем он физически мог дать деньги.</p></div>
    </div>
    <div class="gate">
      <div class="step"><span class="k">1</span><div><b>До старта - атрибуция.</b> Тег «ТОН» живёт в Bitrix24 и наследуется в сделку. Не внедрили - <b>BLOCK</b>: слепой канал недоказуем и не получит ни рубля масштаба.</div></div>
      <div class="step"><span class="k">2</span><div><b>Бюджет фазируем (Protocol 9, H3).</b> Транш 1 - <b>≤50K ₽</b>: только атрибуция + первая коллаба CSC. Остаток до потолка <b>≤200K ₽</b> <span class="tag-inline hyp">ГИПОТЕЗА - требует котировок</span> разблокируется лишь после чекпоинта дня 30 (атрибуция внедрена). Выше потолка - BLOCK. Считаем отдельно: sunk (резидентство) и incremental.</div></div>
      <div class="step"><span class="k">3</span><div><b>Горизонт 90 дней, чекпоинты 30 / 60 / 90.</b> День 30 - атрибуция внедрена. День 60 - ≥1 спека в работе с тегом «ТОН». День 90 - виден хотя бы 1 проект с кросс-резидентским чеком.</div></div>
    </div>
    <h3 style="font-size:18px;font-weight:700;margin:30px 0 14px;color:var(--gold)">Кто ведёт и сколько часов (RACI)</h3>
    <div class="tbl">
      <div class="row h"><div>Процесс</div><div>Ответственный</div><div>Нагрузка/мес <span class="tag-inline hyp">ГИПОТЕЗА</span></div><div>Поддержка</div></div>
      <div class="row"><div><span class="brand-n">CRM-тег «ТОН»</span></div><div><span class="desc">Аня Емельяненко</span></div><div><span class="desc">~4 ч (настройка разово + ведение)</span></div><div><span class="why">boris (Bitrix24)</span></div></div>
      <div class="row"><div><span class="brand-n">Контент капсулы</span></div><div><span class="desc">Богдан Валайко</span></div><div><span class="desc">1-2 съёмки/мес</span></div><div><span class="why">продакшн, общие съёмки</span></div></div>
      <div class="row"><div><span class="brand-n">Практикумы / события</span></div><div><span class="desc">Оля Лысенко (РОП)</span></div><div><span class="desc">~8 ч на событие</span></div><div><span class="why">кураторы Ксенофонтовы</span></div></div>
      <div class="row"><div><span class="brand-n">Follow-up дизайнеров</span></div><div><span class="desc">Аня Емельяненко / РОП</span></div><div><span class="desc">~6 ч/мес</span></div><div><span class="why">скрипт квалификации</span></div></div>
      <div class="row"><div><span class="brand-n">Учёт асимметрии (квартал)</span></div><div><span class="desc">Аня Емельяненко</span></div><div><span class="desc">~3 ч/квартал</span></div><div><span class="why">data (выгрузки)</span></div></div>
    </div>
    <div class="callout" style="margin-top:14px"><b>Время команды = главная скрытая статья.</b> Суммарно пилот - ориентир <b>0.2-0.4 FTE</b> на 90 дней <span class="tag-inline hyp">ГИПОТЕЗА - подтвердить трекингом часов</span>. Уперлись в потолок - режем события, а не добавляем людей.</div>

    <h3 style="font-size:18px;font-weight:700;margin:30px 0 14px;color:var(--gold)">Из чего потолок 200K ₽ <span class="tag-inline hyp">ГИПОТЕЗА - требует котировок</span></h3>
    <div class="frame">
      <div class="f"><span class="m mk gold">▸</span><div>Время команды (0.2-0.4 FTE × 90 дней, по ставке) - <b>~70 000 ₽</b> · самая недооценённая статья</div></div>
      <div class="f"><span class="m mk gold">▸</span><div>Контент-продакшн под капсулу (съёмки, носители) - <b>~45 000 ₽</b></div></div>
      <div class="f"><span class="m mk gold">▸</span><div>События и кросс-практикумы (доля наших затрат) - <b>~30 000 ₽</b></div></div>
      <div class="f"><span class="m mk gold">▸</span><div>Образцы и обновление экспозиции - <b>~25 000 ₽</b></div></div>
      <div class="f"><span class="m mk gold">▸</span><div>Резерв 15% - <b>~30 000 ₽</b></div></div>
      <div class="f"><span class="m mk keep">=</span><div><b>Итого ~200 000 ₽ incremental.</b> Резидентство (sunk) считаем отдельно. HITL Ивана обязателен.</div></div>
    </div>

    <h3 style="font-size:18px;font-weight:700;margin:30px 0 14px;color:var(--stop)">Kill-criteria и стоп-краны</h3>
    <div class="grid3">
      <div class="icard" style="border-color:rgba(217,105,76,.4)"><div class="n" style="color:var(--stop)">СЛЕПОЙ КАНАЛ</div><h4>90 дней без атрибуции</h4><p>Тег «ТОН» так и не внедрён - kill по операционке. Вклад недоказуем навсегда.</p></div>
      <div class="icard" style="border-color:rgba(217,105,76,.4)"><div class="n" style="color:var(--stop)">НЕ КОНВЕРТИТ</div><h4>Трафик есть, спек 0</h4><p>Дизайнеры ходят, но заведения VALONTI в проекты нет за 90 дней - kill или жёсткий разворот механики.</p></div>
      <div class="icard" style="border-color:rgba(217,105,76,.4)"><div class="n" style="color:var(--stop)">ЖЖЁТ ДЕНЬГИ</div><h4>Потолок пробит до спеки</h4><p>Incremental ушёл за 200K раньше первой спеки - стоп, пересбор. Главная скрытая статья - время команды.</p></div>
    </div>
    <div class="callout" style="margin-top:16px;background:var(--stop-bg);border-color:rgba(217,105,76,.3)"><b style="color:var(--stop)">Downside ×0.3 (базовый сценарий, не редкий):</b> дизайнер использует наш шоурум как бесплатную витрину для вдохновения, а в спеку вписывает дешёвый аналог. Ловим рано: метрика «запрос сметы под конкретный проект» против «просто восхитился» + прямой вопрос в follow-up «вписали в спеку, в какой проект». Ответ - НЕ демпинг (это убьёт юнит-логику), а ужесточение квалификации дизайнеров и усиление замка спеки.</div>
  </section>

  <!-- 09 РИСКИ -->
  <section id="s9" class="reveal">
    <div class="sec-head">
      <span class="sec-num">!</span>
      <div><h2 class="sec-title">Риски механики <span class="em">и как закрыть</span></h2>
      <p class="sec-sub">Где стратегия ломается. Без розовых очков.</p></div>
    </div>
    <div class="traps">
      <div class="trap"><div class="tnum">РАЗМЫТИЕ</div><h4>«Доступный премиум» прилипает</h4><p>ТОН и резиденты тиражируют формулировку, VALONTI теряет премиум-восприятие.</p><div class="fix"><b>Закрытие:</b> снять на уровне кураторов. Сигнал - упоминание «доступно/выгодно» рядом с VALONTI. Повтор после правки - режем co-marketing, эскалация Ивану.</div></div>
      <div class="trap"><div class="tnum">АСИММЕТРИЯ</div><h4>ТОН качает наш контент сильнее, чем даёт контакты</h4><p>Мы отдаём готовый контент и репосты, а лиды и база назад не идут.</p><div class="fix"><b>Закрытие:</b> поквартальный учёт «репосты от нас против контактов от них». Перекос - режем каденс, переводим в платный формат событий.</div></div>
      <div class="trap"><div class="tnum">КАНИБАЛИЗАЦИЯ</div><h4>GENGLASS просачивается в публичный голос</h4><p>Ломает модель Lexus, премиум превращается в «стенд с линейкой».</p><div class="fix"><b>Закрытие:</b> публичное лицо в ТОН - только VALONTI. «by GENGLASS» вне публичного контента. Контроль - владелец канала.</div></div>
      <div class="trap"><div class="tnum">УТЕЧКА</div><h4>Бесконечные ивенты и образцы жгут бюджет</h4><p>«Движуха» маскирует отсутствие спек, образцы расходятся без обязательств.</p><div class="fix"><b>Закрытие:</b> лимит событий на квартал, следующее - только если прошлое дало ≥X контактов. Образцы учитываются в CRM и привязаны к дизайнеру.</div></div>
      <div class="trap"><div class="tnum">ЮР-РИСК ПД</div><h4>Обмен базами дизайнеров - голый по закону</h4><p>Передача контактов между нами и ТОН - это персональные данные. Без основания это нарушение 152-ФЗ.</p><div class="fix"><b>Закрытие:</b> до любого обмена - согласие дизайнера на обработку ПД, определить оператора и форму передачи. Нет согласия - нет обмена. Ответственный - юрист, дедлайн до старта co-marketing.</div></div>
      <div class="trap"><div class="tnum">SINGLE POINT OF FAILURE</div><h4>Весь доступ к дизайнерам - через кураторов</h4><p>База и доверие идут через Ксенофонтовых. Испортятся отношения - канал схлопывается.</p><div class="fix"><b>Закрытие:</b> копим собственный актив - своя база дизайнеров с тегом «ТОН», прямые контакты с экспозиции, не только через кураторов. Резидентство - партнёрство, не зависимость.</div></div>
    </div>
  </section>

  <!-- 10 РЕШАЕМ -->
  <section id="s10" class="reveal">
    <div class="sec-head">
      <span class="sec-num">10</span>
      <div><h2 class="sec-title">Что запросить и <span class="em">что решаем</span></h2>
      <p class="sec-sub">Стратегия - это каркас механики. Чтобы он стал расчётом, нужны выгрузки. Перечень - ниже.</p></div>
    </div>
    <div class="frame">
      <div class="f"><span class="m mk gold">▸</span><div><b>Запросить (Аня Е. + boris, 1С/Bitrix24, до 20.06):</b> условия резидентства и аллокацию платежа VALONTI/GENGLASS; есть ли сейчас тег источника на дизайнерах; средний чек и маржа спеки VALONTI; длина цикла спека&rarr;закрытие по прошлым проектам.</div></div>
      <div class="f"><span class="m mk gold">▸</span><div><b>Запросить (Оля Лысенко РОП, у кураторов ТОН, до 20.06):</b> трафик в шоурум за май-июнь; состав и явка на практикумах (Timepad); есть ли у ТОН IG/VK/сайт (Ирина Федотова спрашивала про Instagram - ответа нет).</div></div>
      <div class="f"><span class="m mk gold">▸</span><div><b>Запросить (юрист, до старта co-marketing):</b> форму согласия на обработку ПД (152-ФЗ) для обмена базами дизайнеров, кто оператор, форма передачи. До этого обмен базами - блок.</div></div>
      <div class="f"><span class="m mk invest">▸</span><div><b>Решить (Иван + кураторы, до 16.06):</b> согласие ТОН снять «доступный премиум» применительно к VALONTI - да/нет. Условия обмена базами (объём, согласие, контроль).</div></div>
      <div class="f"><span class="m mk invest">▸</span><div><b>Решить (Богдан + Аня Е.):</b> первая коллаборация - CSC «Камень под светом», привязать к практикуму <b>25.06</b>. Перечень артикулов VALONTI в экспозиции (подтверждён только AUGASO).</div></div>
      <div class="f"><span class="m mk keep">✓</span><div><b>Закрыто:</b> метрика 2026 = спеки и пайплайн, не рубли. VALONTI - публичное лицо, GENGLASS - база. Точка перехвата - комплектация зоны и замещение импорта.</div></div>
      <div class="f"><span class="m mk stop">▸</span><div><b>Эскалация-флаг (data):</b> цифра «10 000 м² производства» <span class="tag-inline hyp">ГИПОТЕЗА - источник наш пресс-текст</span> в посте ТОН. Кто передал куратору - проверить до повторных публикаций.</div></div>
    </div>
  </section>

  <!-- FOOTER -->
  <footer class="footer reveal">
    <div class="legend">
      <div class="l"><span class="sw" style="background:var(--keep)"></span>держим / закрыто</div>
      <div class="l"><span class="sw" style="background:var(--stop)"></span>стоп / риск</div>
      <div class="l"><span class="sw" style="background:var(--invest)"></span>решаем / контроль</div>
      <div class="l"><span class="sw" style="background:var(--gold)"></span>запросить / ключевое</div>
    </div>
    <div style="font-size:13px;color:var(--ink-2);margin-bottom:8px">
      <span class="tag-inline data">ДАННЫЕ</span> - из рабочих чатов ТОН / 1С / Bitrix24 &nbsp;·&nbsp;
      <span class="tag-inline hyp">ГИПОТЕЗА</span> - оценка или непроверенный источник, требует верификации.
    </div>
    <div class="foot-meta">
      <div class="seal"><span class="d"></span>GENGROUP · VALONTI &times; ТОН · стратегия взаимодействия в капсуле ЗИЛАРТ</div>
      <div>Council: ДАТА + МАРКО + РОМАН · Protocol 9 · приёмка ФЕНИКС __SCORE__</div>
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

# Стартовый плейсхолдер скоринга (до приёмки ФЕНИКСА)
BODY = BODY.replace('__SCORE__', 'на приёмке')

html = ('<!DOCTYPE html>\\n<html lang="ru">\\n<head>\\n<meta charset="UTF-8">\\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">\\n'
        '<title>VALONTI &times; ТОН - Стратегия взаимодействия в капсуле ЗИЛАРТ · GENGROUP</title>\\n'
        '<style>' + CSS + EXTRA + '</style>\\n</head>\\n<body>\\n' + BODY + '\\n</body>\\n</html>\\n')

os.makedirs('smm/public/valonti-ton', exist_ok=True)
open('smm/public/valonti-ton/index.html','w',encoding='utf-8').write(html)

# контроль
print('bytes:', len(html))
print('section bal:', html.count('<section')-html.count('</section>'))
print('div bal:', html.count('<div')-html.count('</div>'))
print('em dash:', html.count(chr(0x2014)))
print('tooltips:', html.count('class="t"'))
print('has SF Pro:', 'SF Pro Display' in html)
