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
        <li><span class="ic keep">✓</span><div><b>ТОН = физический шоурум VALONTI</b> и доступ к практикующим дизайнерам. Считаем ''' + T('заведённые артикулы','Когда дизайнер вписывает наш артикул в список материалов проекта.') + ''' в работе, а не визиты.</div></li>
        <li><span class="ic inv">◆</span><div><b>Точка перехвата - не на входе.</b> Дизайнер заходит на чужой повод (свет, текстиль), а VALONTI берёт его на стадии комплектации зоны и «замещения ушедшего импорта».</div></li>
        <li><span class="ic stop">✕</span><div><b>Риск №1: ТОН назвал нас «доступный премиум».</b> Это прямое размытие VALONTI. Снять на уровне кураторов до старта совместного продвижения.</div></li>
        <li><span class="ic keep">✓</span><div><b>VALONTI - единственное публичное лицо в ТОН.</b> GENGLASS = невидимая производственная база (Lexus, не «Lexus by Toyota»).</div></li>
        <li><span class="ic inv">◆</span><div><b>Коллаборации - сложение, не дележ.</b> Камень, стекло, металл, акцент - категория, которой нет ни у одного резидента. Мы дополняем, не конкурируем.</div></li>
        <li><span class="ic flag">⚑</span><div><b>Деньги живут в одной точке - дизайнер повторно заводит наш артикул.</b> Всё до неё - затраты и гипотеза.</div></li>
        <li><span class="ic stop">✕</span><div><b>Пилот ≤200K, метка «ТОН» в базе клиентов до старта.</b> Без метки канал слепой и недоказуемый = стоп.</div></li>
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
    <div class="callout"><b>Кому жать руку первым:</b> кураторы Ксенофонтовы (доступ и доверие) и CSC Group (свет - самый частый повод визита дизайнера, значит самый сильный поток дизайнеров на нашу экспозицию).</div>
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
      <div class="st"><div class="k">05</div><h5>Повторный заказ</h5><p>Дизайнер делает 5-15 проектов в год. Один отработавший артикул возвращается в следующие проекты без нового касания. Это ''' + T('пожизненная ценность','Сколько денег партнёр приносит за всё время сотрудничества, а не за одну сделку.') + ''' дизайнера.</p></div>
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
      <div class="icard"><div class="n">ПРАВКА У КУРАТОРОВ</div><h4>Снять формулировку</h4><p>Разговор с Николаем и Наталией: VALONTI в их коммуникации звучит как авторский материал и галерейная подача, не «доступно». Если после правки повторяют - режем совместное продвижение, эскалация Ивану.</p></div>
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
    <div class="callout"><b>Приоритет по силе потока дизайнеров:</b> CSC (свет - частый повод) &gt; Квятковская (близость эстетики) &gt; MULÉMU / Mebelit (комплектность зоны) &gt; остальные. <b>Правило авторства:</b> если в кадре VALONTI читается как фон чужой мебели, а не как центр сцены - кейс под нашим брендом не публикуем.</div>
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
      <div class="row"><div><span class="brand-n">Кейс «Сцена на четверых»</span></div><div><span class="desc">совместная съёмка резидентов</span></div><div><span class="desc">IG + Pinterest, репост всеми</span></div><div><span class="why">готовое решение в руки дизайнеру</span></div></div>
      <div class="row"><div><span class="brand-n">Анонс практикума</span></div><div><span class="desc">событие на площадке (Timepad)</span></div><div><span class="desc">канал ТОН + IG stories</span></div><div><span class="why">мы даём повод, ТОН даёт охват</span></div></div>
    </div>
    <div class="callout"><b>Дисциплина:</b> каденс привязан к событиям капсулы и съёмкам, не к календарю ради календаря. Весь текст - через humanizer-ru и Anti-Slop. Перед любым launch-постом коллаборации - Step 12.5 (ФЕНИКС).</div>
  </section>

  <!-- 07 ЭКОНОМИКА -->
  <section id="s7" class="reveal">
    <div class="sec-head">
      <span class="sec-num">07</span>
      <div><h2 class="sec-title">Экономика канала: <span class="em">где чистая прибыль, где иллюзия</span></h2>
      <p class="sec-sub">Канал даёт высокую прибыль с заказа - но эта прибыль живёт в одной точке: дизайнер повторно заводит наш артикул в оплаченный проект. Всё, что до этой точки, - затраты и гипотеза. Реальных выгрузок по VALONTI пока нет, поэтому ни одна цифра здесь не выдаётся за факт.</p></div>
    </div>
    <div class="engines" style="margin-bottom:18px">
      <div class="eng a">
        <div class="tag">ГДЕ ПРИБЫЛЬ</div>
        <h4>Повторное заведение артикула</h4>
        <dl>
          <dt>Цена клиента</dt><dd>Размазана на поток проектов дизайнера, а не на одну сделку.</dd>
          <dt>Чек</dt><dd>Дизайнер не торгуется как конечник. Премиум - его инструмент маржи.</dd>
          <dt>Замок</dt><dd>Артикул в проектной документации трудно заменить на аналог.</dd>
        </dl>
      </div>
      <div class="eng b">
        <div class="tag">ГДЕ ИЛЛЮЗИЯ</div>
        <h4>Восхищение у витрины</h4>
        <dl>
          <dt>Гости</dt><dd>«Потрогал и восхитился» не равно «вписал в проект». Между ними 4-5 шагов, где дизайнер отваливается.</dd>
          <dt>Бесплатно</dt><dd>Резидентство оплачено как факт, но события, образцы и время команды - новые деньги поверх.</dd>
          <dt>Советы коллег</dt><dd>Обмен визитками между резидентами часто остаётся в тусовке, а не доходит до проекта заказчика.</dd>
        </dl>
      </div>
    </div>
    <h3 style="font-size:18px;font-weight:700;margin:30px 0 14px;color:var(--gold)">Метрики, которые надо завести (иначе канал слепой)</h3>
    <div class="frame">
      <div class="f"><span class="m mk gold">1</span><div><b>''' + T('Метка источника','Понимание, какой канал реально привёл сделку.') + ''' «ТОН» в базе клиентов (Bitrix24).</b> Каждого дизайнера помечаем источником, сделка получает ту же метку. Без неё вклад считается нулём.</div></div>
      <div class="f"><span class="m mk gold">2</span><div><b>Цена привлечения дизайнера</b> = траты на капсулу / число дизайнеров, реально заведших хотя бы один наш артикул (не просто «взял визитку»).</div></div>
      <div class="f"><span class="m mk gold">3</span><div><b>''' + T('Ценность дизайнера','Сколько денег партнёр приносит за всё время работы с нами, а не за одну сделку.') + '''</b> = средний чек × число заведённых артикулов × наценка × возвраты. Источник - выгрузка 1С по метке «ТОН».</div></div>
      <div class="f"><span class="m mk gold">4</span><div><b>Возвраты дизайнеров</b> - доля тех, кто завёл наш артикул во 2-й и 3-й проект. <b>Самая важная цифра канала</b>: она отличает высокую прибыль от дорогой разовой продажи. <b>Ориентир: если ≥40% дизайнеров возвращаются со 2-м проектом, капсула выгоднее платной рекламы по цене привлечения</b> <span class="tag-inline hyp">ГИПОТЕЗА - проверить на точке отсчёта</span>.</div></div>
      <div class="f"><span class="m mk gold">5</span><div><b>Доля проектов с общим чеком с другим резидентом</b> - где в сделке VALONTI стоит рядом со вторым резидентом. Доказывает, что экосистема работает, а не только наш стенд.</div></div>
      <div class="f"><span class="m mk keep">ЦЕЛЬ 2026</span><div><b>Артикулы в работе</b> (заведены в проект, ещё не оплачены). Честный ориентир, который не врёт про выручку, но показывает движение денег к нам. <b>Цель: 8-12 артикулов в работе к концу 2026</b> <span class="tag-inline hyp">ГИПОТЕЗА - уточнить после точки отсчёта</span>.</div></div>
    </div>
  </section>

  <!-- 08 ПИЛОТ -->
  <section id="s8" class="reveal">
    <div class="sec-head">
      <span class="sec-num">08</span>
      <div><h2 class="sec-title">Пилот: <span class="em">потолок, чекпоинты, стоп-краны</span></h2>
      <p class="sec-sub">Капсула - это пробный канал привлечения дизайнеров с долгим циклом сделки, не открытый бюджет. Судим по ранним сигналам (наши артикулы, заведённые в проекты), не по закрытой выручке: от заведения артикула до оплаты проекта проходит 3-9 месяцев, иначе зарежем канал раньше, чем он физически мог дать деньги.</p></div>
    </div>
    <div class="gate">
      <div class="step"><span class="k">1</span><div><b>До старта - метка источника.</b> Метка «ТОН» живёт в базе клиентов (Bitrix24) и переносится в сделку. Не внедрили - <b>СТОП</b>: непонятно, что привёл именно ТОН, и канал не получит ни рубля на масштаб.</div></div>
      <div class="step"><span class="k">2</span><div><b>Бюджет даём частями (по Protocol 9).</b> Первый шаг - <b>до 50 000 ₽</b>: только метка источника и первая коллаборация с CSC. Остаток до потолка <b>200 000 ₽</b> <span class="tag-inline hyp">ГИПОТЕЗА - нужны сметы</span> открываем лишь после проверки на 30-й день. Выше потолка - <b>СТОП</b>. Считаем раздельно: уже оплаченное резидентство и дополнительные траты пилота.</div></div>
      <div class="step"><span class="k">3</span><div><b>Горизонт 90 дней, проверки на 30 / 60 / 90.</b> День 30 - метка источника настроена. День 60 - хотя бы 1 наш артикул заведён в проект дизайнера с меткой «ТОН». День 90 - виден хотя бы 1 проект с общим чеком с другим резидентом.</div></div>
    </div>
    <h3 style="font-size:18px;font-weight:700;margin:30px 0 14px;color:var(--gold)">Кто ведёт и сколько часов</h3>
    <div class="tbl">
      <div class="row h"><div>Процесс</div><div>Ответственный</div><div>Нагрузка/мес <span class="tag-inline hyp">ГИПОТЕЗА</span></div><div>Поддержка</div></div>
      <div class="row"><div><span class="brand-n">Метка «ТОН» в базе клиентов</span></div><div><span class="desc">Дима Янчоглов</span></div><div><span class="desc">~4 ч (настройка разово + ведение)</span></div><div><span class="why">ИТ-настройка Bitrix24</span></div></div>
      <div class="row"><div><span class="brand-n">Контент капсулы</span></div><div><span class="desc">Аня Емельяненко</span></div><div><span class="desc">1-2 съёмки/мес</span></div><div><span class="why">продакшн, общие съёмки</span></div></div>
      <div class="row"><div><span class="brand-n">Практикумы и события</span></div><div><span class="desc">Оля Лысенко (РОП)</span></div><div><span class="desc">~8 ч на событие</span></div><div><span class="why">кураторы Ксенофонтовы</span></div></div>
      <div class="row"><div><span class="brand-n">Связь с дизайнером после визита</span></div><div><span class="desc">Юля Шура-Бура</span></div><div><span class="desc">~6 ч/мес</span></div><div><span class="why">скрипт первичного отбора</span></div></div>
    </div>
    <div class="callout" style="margin-top:14px"><b>Время команды - главная скрытая статья.</b> По грубой прикидке пилот забирает у команды примерно <b>один рабочий день в неделю на всех</b> <span class="tag-inline hyp">ГИПОТЕЗА - уточнить замером по часам</span>. Уперлись в потолок по времени - режем число событий, а не нанимаем людей.</div>

    <h3 style="font-size:18px;font-weight:700;margin:30px 0 14px;color:var(--gold)">Из чего потолок 200K ₽ <span class="tag-inline hyp">ГИПОТЕЗА - требует котировок</span></h3>
    <div class="frame">
      <div class="f"><span class="m mk gold">▸</span><div>Время команды (примерно день в неделю на всех × 3 месяца × ставка ~1500 ₽/ч <span class="tag-inline hyp">ГИПОТЕЗА</span>) - <b>~55-90 000 ₽</b>, в смете берём середину ~70 000 ₽ · самая недооценённая статья</div></div>
      <div class="f"><span class="m mk gold">▸</span><div>Контент-продакшн под капсулу (съёмки, носители) - <b>~45 000 ₽</b></div></div>
      <div class="f"><span class="m mk gold">▸</span><div>События и совместные практикумы (доля наших затрат) - <b>~30 000 ₽</b></div></div>
      <div class="f"><span class="m mk gold">▸</span><div>Образцы и обновление экспозиции - <b>~25 000 ₽</b></div></div>
      <div class="f"><span class="m mk gold">▸</span><div>Резерв 15% - <b>~30 000 ₽</b></div></div>
      <div class="f"><span class="m mk keep">=</span><div><b>Итого ~200 000 ₽ дополнительных трат.</b> Уже оплаченное резидентство считаем отдельно. Обязательно ручное утверждение Ивана.</div></div>
    </div>

    <h3 style="font-size:18px;font-weight:700;margin:30px 0 14px;color:var(--stop)">Kill-criteria и стоп-краны</h3>
    <div class="grid3">
      <div class="icard" style="border-color:rgba(217,105,76,.4)"><div class="n" style="color:var(--stop)">СЛЕПОЙ КАНАЛ</div><h4>90 дней без метки источника</h4><p>Метка «ТОН» так и не настроена - закрываем. Вклад уже не доказать никогда.</p></div>
      <div class="icard" style="border-color:rgba(217,105,76,.4)"><div class="n" style="color:var(--stop)">НЕ ИДЁТ В ДЕЛО</div><h4>Гости есть, артикулов 0</h4><p>Дизайнеры ходят, но VALONTI в проекты не заводят за 90 дней - закрываем или резко меняем подход.</p></div>
      <div class="icard" style="border-color:rgba(217,105,76,.4)"><div class="n" style="color:var(--stop)">ЖЖЁТ ДЕНЬГИ</div><h4>Потолок пробит до первого артикула</h4><p>Дополнительные траты ушли за 200K раньше первого заведённого артикула - стоп, пересбор. Главная скрытая статья - время команды.</p></div>
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
      <div class="trap"><div class="tnum">РАЗМЫТИЕ</div><h4>«Доступный премиум» прилипает</h4><p>ТОН и резиденты повторяют формулировку, VALONTI теряет премиальное восприятие.</p><div class="fix"><b>Закрытие:</b> снять на уровне кураторов. Сигнал - слова «доступно/выгодно» рядом с VALONTI. Повтор после правки - режем совместное продвижение, эскалация Ивану.</div></div>
      <div class="trap"><div class="tnum">НЕРАВНЫЙ ОБМЕН</div><h4>ТОН берёт наш контент сильнее, чем даёт контакты</h4><p>Мы отдаём готовый контент и репосты, а заявки и контакты назад не идут.</p><div class="fix"><b>Закрытие:</b> раз в квартал сверяем «репосты от нас против контактов от них». Перекос - режем частоту, переводим в платный формат событий.</div></div>
      <div class="trap"><div class="tnum">ПОДМЕНА ГОЛОСА</div><h4>GENGLASS просачивается в публичный голос</h4><p>Ломает модель Lexus, премиум превращается в «стенд с линейкой».</p><div class="fix"><b>Закрытие:</b> публичное лицо в ТОН - только VALONTI. «by GENGLASS» вне публичного контента. Контроль - владелец канала.</div></div>
      <div class="trap"><div class="tnum">УТЕЧКА</div><h4>Бесконечные ивенты и образцы жгут бюджет</h4><p>«Движуха» маскирует отсутствие спек, образцы расходятся без обязательств.</p><div class="fix"><b>Закрытие:</b> лимит событий на квартал, следующее - только если прошлое дало ≥X контактов. Образцы учитываются в CRM и привязаны к дизайнеру.</div></div>
      <div class="trap"><div class="tnum">РИСК ПО ЗАКОНУ О ДАННЫХ</div><h4>Обмен базами дизайнеров - голый по закону</h4><p>Передача контактов между нами и ТОН - это персональные данные. Без согласия это нарушение <span class="t" data-tip="Закон о персональных данных. Передавать чужие контакты можно только с согласия человека." tabindex="0">152-ФЗ</span>.</p><div class="fix"><b>Закрытие:</b> до любого обмена - согласие дизайнера на обработку данных, определить, кто отвечает за данные и как передаём. Нет согласия - нет обмена. Ответственный - юрист, срок до старта совместного продвижения.</div></div>
      <div class="trap"><div class="tnum">ОДНА ТОЧКА ОТКАЗА</div><h4>Весь доступ к дизайнерам - через кураторов</h4><p>База и доверие идут через Ксенофонтовых. Испортятся отношения - канал схлопывается.</p><div class="fix"><b>Закрытие:</b> копим собственный актив - своя база дизайнеров с меткой «ТОН», прямые контакты прямо с экспозиции, не только через кураторов. <b>Связь с риском данных:</b> своя база растёт только на согласиях, собранных у нас на стенде - это и есть путь к независимости от кураторов. Резидентство - партнёрство, не зависимость.</div></div>
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
      <div class="f"><span class="m mk gold">▸</span><div><b>Запросить (юрист, до старта совместного продвижения):</b> форму согласия на обработку персональных данных (<span class="t" data-tip="Закон о персональных данных. Передавать чужие контакты можно только с согласия человека." tabindex="0">152-ФЗ</span>) для обмена базами дизайнеров, кто отвечает за данные, как передаём. До этого обмен базами - стоп.</div></div>
      <div class="f"><span class="m mk invest">▸</span><div><b>Решить (Иван + Юля Шура-Бура):</b> первая коллаборация - CSC «Камень под светом», привязать к практикуму <b>25.06</b>. Перечень артикулов VALONTI в экспозиции (подтверждён только AUGASO).</div></div>
      <div class="f"><span class="m mk keep">✓</span><div><b>Закрыто:</b> цель 2026 = заведённые артикулы и проекты в работе, не рубли. VALONTI - публичное лицо, GENGLASS - база. Точка перехвата - комплектация зоны и замещение импорта.</div></div>
      <div class="f"><span class="m mk stop">▸</span><div><b>Эскалация-флаг (аналитика):</b> цифра «10 000 м² производства» <span class="tag-inline hyp">ГИПОТЕЗА - источник наш пресс-текст</span> в посте ТОН. Кто передал куратору - проверить до повторных публикаций.</div></div>
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
BODY = BODY.replace('__SCORE__', '9.58/10 · GO')

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
