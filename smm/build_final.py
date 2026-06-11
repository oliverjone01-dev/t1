# -*- coding: utf-8 -*-
# Финальная сводная SMM-стратегия GENGROUP. Дизайн-система берётся 1-в-1 из
# smm/public/index.html. Контент - синтез всех источников: стратсессия (стенограмма),
# обратная связь Богдана, капсула ТОН, независимый разбор ФЕНИКСА.
import os

base = open('smm/public/index.html', encoding='utf-8').read()
i = base.index('<style>'); j = base.index('</style>')
CSS = base[i+len('<style>'):j]

EXTRA = '''
.chip{display:inline-block;font-size:12px;font-weight:600;color:var(--ink-2);border:1px solid var(--line-2);border-radius:30px;padding:6px 12px;background:rgba(255,255,255,.015);margin:3px}
.chip b{color:var(--gold);font-weight:700}
.flowline{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:6px}
.flowline .st{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 14px}
.flowline .st .k{font-size:11px;font-weight:800;color:var(--gold);letter-spacing:.1em;margin-bottom:8px}
.flowline .st h5{font-size:14px;font-weight:700;margin-bottom:6px;letter-spacing:-.01em}
.flowline .st p{font-size:12.5px;color:var(--ink-2);line-height:1.5}
.ladder{display:flex;flex-direction:column;gap:10px}
.ladder .lr{display:flex;gap:14px;align-items:flex-start;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 18px}
.ladder .lr .rk{flex:none;width:30px;height:30px;border-radius:8px;display:grid;place-items:center;font-weight:800;font-size:13px;color:#0A0A0A}
.ladder .lr.r0 .rk{background:var(--stop);color:#fff}.ladder .lr.r1 .rk{background:var(--keep)}.ladder .lr.r2 .rk{background:var(--invest)}.ladder .lr.r3 .rk{background:var(--gold)}
.ladder .lr .lt{font-size:14.5px;color:var(--ink-2)}.ladder .lr .lt b{color:var(--ink);font-weight:700}
@media(max-width:860px){.flowline{grid-template-columns:1fr}}
'''

def T(w, tip): return f'<span class="t" data-tip="{tip}" tabindex="0">{w}</span>'

BODY = '''
<div class="progress" id="prog"></div>

<header class="topbar">
  <div class="topbar-in">
    <div class="brand"><span class="dot"></span>GEN&nbsp;/&nbsp;SMM <span>· финальная стратегия</span></div>
    <nav class="nav">
      <a href="#s1"><span class="tag">01</span>Решение</a>
      <a href="#s2"><span class="tag">02</span>Роли брендов</a>
      <a href="#s3"><span class="tag">03</span>Спор 80/90</a>
      <a href="#s4"><span class="tag">04</span>Позиционирование</a>
      <a href="#s5"><span class="tag">05</span>Движки</a>
      <a href="#s6"><span class="tag">06</span>Капсула ТОН</a>
      <a href="#s7"><span class="tag">07</span>Площадки</a>
      <a href="#s8"><span class="tag">08</span>Контент</a>
      <a href="#s9"><span class="tag">09</span>Измеримость</a>
      <a href="#s10"><span class="tag">10</span>Дисциплина</a>
      <a href="#s11"><span class="tag">!</span>Риски</a>
      <a href="#s12"><span class="tag">12</span>Дальше</a>
    </nav>
  </div>
</header>

<div class="wrap">

  <!-- HERO -->
  <section class="hero reveal">
    <div class="kicker"><span class="bar"></span>ФИНАЛЬНАЯ SMM-СТРАТЕГИЯ · СВЕДЕНО И ПРИНЯТО ФЕНИКСОМ</div>
    <h1>SMM как драйвер, не прогрев. <span class="hl">Volonti растим на плечах GENGLASS, результат меряем контактами дизайнеров.</span></h1>
    <p class="lead">
      Один документ, в который сведено всё: стратсессия, обратная связь Богдана, капсула ТОН и независимый разбор ФЕНИКСА. Главный итог: приоритет Volonti исполняем <b>через ТОН</b>, где живые дизайнеры и оплаченный трафик, а GENGLASS держим как движок, который этих людей приводит. Дорожная карта и роли - отдельным документом.
    </p>
    <div class="stamp">
      <div class="s owner">Владелец канала: <b>Аня Емельяненко</b></div>
      <div class="s">Собственник: <b>Богдан Валайко</b></div>
      <div class="s">Прошло <b>Protocol&nbsp;9</b></div>
      <div class="s">ФЕНИКС <b>__SCORE__</b></div>
      <div class="s">Метрика: <b>контакты дизайнеров, не рубли 2026</b></div>
    </div>
  </section>

  <!-- TL;DR -->
  <section class="reveal" style="border-top:none;padding-top:8px">
    <div class="tldr">
      <h3>СУТЬ ЗА 60 СЕКУНД</h3>
      <ul>
        <li><span class="ic keep">✓</span><div><b>Архитектура: Valonti by GENGLASS.</b> Растим Volonti на узнаваемости и трафике GENGLASS (как Toyota растила Lexus). Связку «by GENGLASS» держим внутри, наружу не выносим.</div></li>
        <li><span class="ic inv">◆</span><div><b>Приоритет бренда - Volonti, но через ТОН.</b> Не заливаем нулёвые ленты в пустоту, а вкладываемся в капсулу, где дизайнеры есть, а трафик уже оплачен.</div></li>
        <li><span class="ic flag">⚑</span><div><b>GENGLASS не глушим.</b> Это движок, который приводит аудиторию. Держим ≥3 публикации в неделю, иначе охваты падают и кормить Volonti нечем.</div></li>
        <li><span class="ic keep">✓</span><div><b>Позиционирование Volonti - верх среднего сегмента (middle+/premium).</b> Слово «роскошь» не пишем, но выглядим премиально. Цель - рост маржи.</div></li>
        <li><span class="ic keep">✓</span><div><b>Метрика Volonti 2026 - контакты дизайнеров, не выручка.</b> Деньги придут позже, через заведение наших артикулов в проекты.</div></li>
        <li><span class="ic inv">◆</span><div><b>Контент с конвейера.</b> Один съёмочный день - серия нарезок. Лицо - Богдан 1-2 раза в месяц плюс другие люди производства, возможно цифровой двойник.</div></li>
        <li><span class="ic stop">✕</span><div><b>Без точки отсчёта по GENGLASS целей не ставим и движок не режем.</b> Иначе кассовый провал заметим поздно.</div></li>
        <li><span class="ic stop">✕</span><div><b>Дорожная карта и роли - отдельно.</b> Этот документ задаёт вектор и рамку, а сроки, ответственные и часы идут следующим шагом.</div></li>
      </ul>
    </div>
  </section>

  <!-- 01 РЕШЕНИЕ -->
  <section id="s1" class="reveal">
    <div class="sec-head">
      <span class="sec-num">01</span>
      <div><h2 class="sec-title">Принятое решение: <span class="em">Valonti by GENGLASS</span></h2>
      <p class="sec-sub">Стратсессия закрепила архитектуру. GENGLASS - главный источник трафика и узнаваемости, Volonti развивается как премиальное направление внутри экосистемы GENGROUP, на заёмной инфраструктуре GENGLASS. SMM перестаёт быть просто прогревом перед продажей и становится двигателем узнаваемости и привлечения дизайнеров.</p></div>
    </div>
    <div class="arch">
      <div class="node gg">
        <div class="role">ДВИГАТЕЛЬ · МАССОВАЯ АУДИТОРИЯ</div>
        <h4>GENGLASS</h4>
        <p>Конечный покупатель, готовится к ремонту. Готовая аудитория, трафик, накопленный контент. Кормит охваты и приводит людей.</p>
      </div>
      <div class="flow">
        <div class="arrow">&rarr;</div>
        <div class="lbl">репостит<br>ведёт аудиторию</div>
      </div>
      <div class="node v">
        <div class="role">ПРЕМИУМ-НАПРАВЛЕНИЕ · ДИЗАЙНЕРЫ</div>
        <h4>VALONTI</h4>
        <p>Своя лента и свой контент для профи. Растёт на авторитете GENGLASS. Выходит в самостоятельный бренд позже, когда наберёт вес и базу.</p>
      </div>
    </div>
    <div class="arch-note">
      <b>Toyota &rarr; Lexus:</b> материнский бренд поддерживает премиальный, а не наоборот. Контент Volonti репостим в GENGLASS, но в обратную сторону не размещаем, чтобы не размывать премиум. Полное разделение - когда Volonti наберёт собственную узнаваемость и клиентскую базу, ориентировочно через полтора года.
    </div>
  </section>

  <!-- 02 РОЛИ БРЕНДОВ -->
  <section id="s2" class="reveal">
    <div class="sec-head">
      <span class="sec-num">02</span>
      <div><h2 class="sec-title">Роль каждого бренда <span class="em">в SMM</span></h2>
      <p class="sec-sub">Час команды отбивается там, где видно, какой канал привёл заявку. Из пяти брендов в SMM активны два. Остальные лентой не продаются. Выручка по брендам здесь намеренно не приводится - идёт отдельно, из 1С.</p></div>
    </div>
    <div class="tbl">
      <div class="row h"><div>Бренд</div><div>Аудитория</div><div>Роль в SMM</div><div>Почему</div></div>
      <div class="row"><div><span class="brand-n">GENGLASS</span></div><div><span class="desc">Конечный покупатель</span></div><div><span class="badge keep"><span class="d"></span>ДВИГАЕТ</span></div><div><span class="why">Приводит аудиторию и заявки. Движок, который кормит Volonti.</span></div></div>
      <div class="row"><div><span class="brand-n">VALONTI</span></div><div><span class="desc">Дизайнеры, архитекторы</span></div><div><span class="badge invest"><span class="d"></span>СТРОИТ БРЕНД</span></div><div><span class="why">Отложенный эффект. Главный приоритет смысла и креатива.</span></div></div>
      <div class="row"><div><span class="brand-n">Metal-GM</span></div><div><span class="desc">B2B контракт</span></div><div><span class="badge stop"><span class="d"></span>РАЗ В МЕСЯЦ</span></div><div><span class="why">Лентой не продаётся. Минимум, чтобы знали, что бренд жив.</span></div></div>
      <div class="row"><div><span class="brand-n">GENTERO</span></div><div><span class="desc">B2B HoReCa/офис</span></div><div><span class="badge stop"><span class="d"></span>НЕ КАНАЛ</span></div><div><span class="why">Прямые продажи и тендеры, вне SMM.</span></div></div>
      <div class="row"><div><span class="brand-n">GLASS-MEMORY</span></div><div><span class="desc">Дилерская сеть</span></div><div><span class="badge stop"><span class="d"></span>ПОКА НЕТ</span></div><div><span class="why">Распылять команду из двух рук на третий бренд - эффекта не будет.</span></div></div>
    </div>
    <div class="callout">Интеграция всех аккаунтов с CRM обязательна, чтобы ни одна заявка из комментариев или сообщений не терялась.</div>
  </section>

  <!-- 03 СПОР 80/90 -->
  <section id="s3" class="reveal">
    <div class="sec-head">
      <span class="sec-num">03</span>
      <div><h2 class="sec-title">Обратная связь Богдана: <span class="em">80-90% на Volonti - разрешение</span></h2>
      <p class="sec-sub">Собственник настаивает: основной фокус на Volonti, GENGLASS не пытаться вытягивать. Разбор ФЕНИКСА: вектор верный, но буквальные «80-90% часов на нулёвые ленты» - ставка против чистой прибыли. Решение - развести два понятия, которые слиплись.</p></div>
    </div>
    <div class="engines" style="margin-bottom:18px">
      <div class="eng b">
        <div class="tag">ПРИОРИТЕТ БРЕНДА · ДА, ~80% VOLONTI</div>
        <h4>Сюда весь фокус смысла</h4>
        <dl>
          <dt>Что это</dt><dd>Позиционирование, голос, креатив, события, лид-магниты для дизайнеров.</dd>
          <dt>Куда</dt><dd>В первую очередь в капсулу ТОН, где дизайнеры физически есть.</dd>
        </dl>
      </div>
      <div class="eng a">
        <div class="tag">ЧАСЫ ПРОДАКШНА · НЕ 80% В ПУСТОТУ</div>
        <h4>Часы идут в конвейер</h4>
        <dl>
          <dt>Что это</dt><dd>Снимаем общее, репостим. GENGLASS держим регулярным как движок.</dd>
          <dt>Почему</dt><dd>Нельзя растить Lexus, заглушив сеть, которая приводит людей, которым ты показываешь Lexus.</dd>
        </dl>
      </div>
    </div>
    <h3 style="font-size:18px;font-weight:700;margin:26px 0 14px;color:var(--gold)">Лестница приоритетов (куда идёт час команды)</h3>
    <div class="ladder">
      <div class="lr r0"><div class="rk">0</div><div class="lt"><b>GENGLASS ≥3 публикации в неделю</b> - защита движка. Аня подтвердила: пропуски роняют охваты. Это не режется.</div></div>
      <div class="lr r1"><div class="rk">1</div><div class="lt"><b>Коллаборации ТОН</b> - ядро приоритета Volonti. Реальные дизайнеры, оплаченный трафик, метрика = контакты, низкая доп. стоимость.</div></div>
      <div class="lr r2"><div class="rk">2</div><div class="lt"><b>Pinterest Volonti</b> - витрина для дизайнеров, копится со временем, дёшево. Атрибуция слабая (8 переходов за квартал <span class="tag-inline data">ДАННЫЕ</span>), держим как узнаваемость.</div></div>
      <div class="lr r3"><div class="rk">3</div><div class="lt"><b>Лента Volonti (IG + ВКонтакте)</b> на конвейере общих съёмок. Не отдельный продакшн на 80%.</div></div>
    </div>
    <div class="callout" style="margin-top:16px"><b>Решение для Богдана:</b> «80-90%» исполняем как приоритет бренда, направленный через ТОН, а не как 80-90% часов в нулёвые ленты. Буквальные 80-90% часов возможны только с наймом рук - команда из двух человек оба бренда так не вытянет. Это и есть путь к результату, который требует собственник, без удара по кассе.</div>
  </section>

  <!-- 04 ПОЗИЦИОНИРОВАНИЕ -->
  <section id="s4" class="reveal">
    <div class="sec-head">
      <span class="sec-num">04</span>
      <div><h2 class="sec-title">Позиционирование VALONTI: <span class="em">верх среднего, без слова «роскошь»</span></h2>
      <p class="sec-sub">Уходим от формулировки «роскошь в каждой детали» к привязке к аудитории и сегменту. Объективно: ни качеством, ни сервисом, ни сроками мы пока не люкс, и клиентской базы под люкс нет. Поэтому несём в рынок middle+/premium и не отпугиваем доступных нам дизайнеров завышенной планкой.</p></div>
    </div>
    <div class="grid3">
      <div class="icard"><div class="n">КТО ПОКУПАТЕЛЬ</div><h4>Дизайнер и архитектор</h4><p>Профи, который закладывает бренд в проект своего клиента. Не массовый покупатель.</p></div>
      <div class="icard"><div class="n">СЕГМЕНТ</div><h4>''' + T('middle+ / premium','Верх среднего ценового сегмента. Ниже люкса, выше массового.') + '''</h4><p>Дороже материалы, сложнее нестандарт, выше уровень исполнения. Цель - рост маржи, в будущем переход выше.</p></div>
      <div class="icard"><div class="n">ЯЗЫК</div><h4>«Выглядим как роскошь»</h4><p>Слово «роскошь» не пишем (отпугивает доступных дизайнеров), но подача премиальная. Контент не должен бить по глазам реального люкс-сегмента.</p></div>
    </div>
    <div class="spotlight" style="margin-top:18px">
      <div class="st">САЙТ valonti.ru · СЛОГАН ПОД ЗАМЕНУ</div>
      <h4>«Роскошь в каждой детали» - под замену</h4>
      <p>Шаблонная luxury-формула, какую лепит каждый второй, и она противоречит сегменту middle+/premium. Замена - ось на материал и авторство, не на статус. Рекомендованный вариант: <b>«Камень, металл, стекло. Работа с материалом для тех, кто проектирует.»</b> Финальную формулировку и «напыление премиальности» дорабатываем отдельно.</p>
    </div>
  </section>

  <!-- 05 ДВИЖКИ -->
  <section id="s5" class="reveal">
    <div class="sec-head">
      <span class="sec-num">05</span>
      <div><h2 class="sec-title">Два движка и <span class="em">контент-матрица</span></h2>
      <p class="sec-sub">У GENGLASS и Volonti разные покупатели и разная логика. Один контент их не обслуживает. Это база для распределения съёмок и форматов.</p></div>
    </div>
    <div class="matrix">
      <div class="mcol gg">
        <h4>GENGLASS - конечный покупатель</h4>
        <div class="sub">движок денег · прогрев розницы</div>
        <ul>
          <li><b>Производство и процессы</b> - стекло, металл, цех</li>
          <li><b>Кейсы до/после</b>, продукт крупно, лайфстайл в интерьере</li>
          <li><b>Ценовые якоря</b> и отработка страхов клиента</li>
          <li><b>Развлекательное и трендовое</b> - можно мемы, шутки, для охвата</li>
          <li>Прямой переход в заявку в каждой продающей единице</li>
        </ul>
      </div>
      <div class="mcol v">
        <h4>VALONTI - дизайнер</h4>
        <div class="sub">движок бренда · единый премиальный стиль</div>
        <ul>
          <li><b>Работа с дорогими материалами</b> крупно, фактуры, авторские предметы</li>
          <li><b>Проектные кейсы</b> и нестандартные изделия (бывший нестандарт GENGLASS)</li>
          <li><b>Экспертный контент</b> - польза дизайнеру, лайфхаки, кругозор</li>
          <li><b>Единый стиль без шуток</b> - голос бренда выдержан, эксперименты уходят в GENGLASS</li>
          <li>Живые объекты в интерьерах, интервью у лояльных дизайнеров</li>
        </ul>
      </div>
    </div>
    <div class="rule"><b>Жёсткое правило:</b> потребительский ролик соберёт конечников, которые Volonti не купят. Частота и хуки - для GENGLASS, премиальная выдержанная подача - для Volonti. Эксперименты и «залётное» - только в GENGLASS.</div>
  </section>

  <!-- 06 КАПСУЛА ТОН -->
  <section id="s6" class="reveal">
    <div class="sec-head">
      <span class="sec-num">06</span>
      <div><h2 class="sec-title">Капсула ТОН - <span class="em">ядро направления Volonti</span></h2>
      <p class="sec-sub">ТОН - живой шоурум на ЗИЛАРТ, где премиум-поставщики показаны в связке. Мы там резидент через GEN-GROUP. Это единственный канал, где дизайнеры физически есть, а трафик уже оплачен. Сюда направляем приоритет Volonti.</p></div>
    </div>
    <div class="flowline">
      <div class="st"><div class="k">01</div><h5>Повод зайти</h5><p>Дизайнер идёт на практикум по свету CSC или за тканью. Volonti встречает попутно. Чужой трафик оплачивает наш показ.</p></div>
      <div class="st"><div class="k">02</div><h5>Контакт рукой</h5><p>Камень, металл, стекло. В премиуме решение принимают рукой и светом, не рендером.</p></div>
      <div class="st"><div class="k">03</div><h5>Перехват</h5><p>Стадия комплектации зоны под заказчика и замены ушедшего импорта. Тут мы выигрываем по сроку и нестандарту.</p></div>
      <div class="st"><div class="k">04</div><h5>В проект</h5><p>Дизайнер уходит с тех-карточкой артикула. Контакт зафиксирован здесь, не на оплате.</p></div>
      <div class="st"><div class="k">05</div><h5>Повтор</h5><p>Дизайнер делает 5-15 проектов в год. Отработавший артикул возвращается без нового касания.</p></div>
    </div>
    <h3 style="font-size:18px;font-weight:700;margin:26px 0 14px;color:var(--gold)">Резиденты-партнёры (с кем коллаборируемся)</h3>
    <div>
      <span class="chip"><b>Mebelit</b> · Андрей Колегов · мебель</span>
      <span class="chip"><b>CSC Group</b> · Михаил Смагин · свет</span>
      <span class="chip"><b>AcousticPet</b> · Алексей Старилов · акустика</span>
      <span class="chip"><b>MULÉMU</b> · Екатерина · мягкая мебель</span>
      <span class="chip"><b>Текстиль А. Квятковской</b> · текстиль</span>
      <span class="chip"><b>SKETCHINGGO</b> · Ирина Федотова · бани</span>
      <span class="chip"><b>Джессо</b> · декор-штукатурка</span>
      <span class="chip"><b>Кураторы</b> · Николай и Наталия Ксенофонтовы</span>
    </div>
    <div class="matrix" style="margin-top:18px">
      <div class="mcol v">
        <h4>«Сцена на четверых»</h4>
        <div class="sub">снимается один раз · кормит ленты всех</div>
        <ul>
          <li>Свет CSC + камень и металл Volonti + текстиль Квятковской + мягкая мебель MULÉMU</li>
          <li>Готовая зона, дизайнер фотографирует и несёт заказчику</li>
          <li>Камень и металл - категория, которой нет у других резидентов: коллаборация это сложение, не дележ</li>
        </ul>
      </div>
      <div class="mcol gg">
        <h4>Что забираем</h4>
        <div class="sub">приоритет первой коллаборации</div>
        <ul>
          <li>Поток дизайнеров на нашу экспозицию без оплаты контакта</li>
          <li>Вход в проекты, которые ведут другие резиденты</li>
          <li>Обмен базами дизайнеров (под согласие на данные)</li>
          <li><b>Первая коллаба:</b> CSC «Камень под светом», практикум 25.06</li>
        </ul>
      </div>
    </div>
    <div class="callout"><b>Подача для ТОН:</b> наружу позиционируем роль GEN-GROUP как генератора трафика и охватов для капсулы (через Ксенофонтовых). Внутренняя версия - корыстная, для ТОН оборачиваем как вклад в общую движуху резидентов. <b>Гриф: внутренний документ, наружу не передаём.</b> Полная стратегия взаимодействия - в отдельном документе VALONTI &times; ТОН.</div>
  </section>

  <!-- 07 ПЛОЩАДКИ -->
  <section id="s7" class="reveal">
    <div class="sec-head">
      <span class="sec-num">07</span>
      <div><h2 class="sec-title">Разбивка по площадкам <span class="em">и решения</span></h2>
      <p class="sec-sub">Что ведём, как и зачем. Решения приняты по фокусу: не распыляться, концентрировать усилия там, где есть отдача.</p></div>
    </div>
    <div class="tbl">
      <div class="row h"><div>Площадка</div><div>GENGLASS</div><div>VALONTI</div><div>Решение</div></div>
      <div class="row"><div><span class="brand-n">Instagram</span></div><div><span class="desc">главная витрина, ≥3/нед</span></div><div><span class="desc">проектный контент для дизайнеров</span></div><div><span class="why">Оба ведём. GENGLASS как движок, Volonti как приоритет бренда.</span></div></div>
      <div class="row"><div><span class="brand-n">ВКонтакте</span></div><div><span class="desc">дубль контента, РФ без VPN</span></div><div><span class="desc">кросспост проектных кейсов</span></div><div><span class="why">Держим на готовом контенте, без отдельного продакшна.</span></div></div>
      <div class="row"><div><span class="brand-n">Pinterest</span></div><div><span class="desc">поисковый трафик на сайт</span></div><div><span class="desc">создать, витрина для дизайнеров</span></div><div><span class="why">''' + T('pull','Канал, куда дизайнер приходит сам и ищет. Не требует набранной аудитории.') + '''-витрина. Атрибуция слабая (8 переходов/квартал <span class="tag-inline data">ДАННЫЕ</span>), но дёшево.</span></div></div>
      <div class="row"><div><span class="brand-n">Telegram</span></div><div><span class="desc">прогрев тёплой базы</span></div><div><span class="badge stop"><span class="d"></span>НЕ ЗАВОДИМ</span></div><div><span class="why">Volonti публичный TG - нет. Позже закрытый клуб дизайнеров.</span></div></div>
      <div class="row"><div><span class="brand-n">Facebook</span></div><div><span class="desc" colspan="2">мёртвый, обновить айдентику</span></div><div><span class="badge stop"><span class="d"></span>ИГНОР</span></div><div><span class="why">Аудитории нет, активность вести смысла нет.</span></div></div>
    </div>
    <div class="callout">Внешние сервисы (3DD, Керамик 3D, агрегаторы-маркетплейсы дизайнеров) - загружать модели можно, но отдачу почти не измерить (как наружная реклама). Влияют на брендовые запросы. Брать в работу точечно, после анализа, какие сервисы живы.</div>
  </section>

  <!-- 08 КОНТЕНТ -->
  <section id="s8" class="reveal">
    <div class="sec-head">
      <span class="sec-num">08</span>
      <div><h2 class="sec-title">Контент-система: <span class="em">чтобы охваты были не ради охватов</span></h2>
      <p class="sec-sub">Каждый формат имеет задачу, у каждого ролика - хук, решения опираются на данные. Две руки тянут оба бренда только за счёт конвейера и единого стиля.</p></div>
    </div>
    <div class="grid3">
      <div class="icard"><div class="n">ХУК + ПЕРСОНАЖ</div><h4>Зацеп на 1-й секунде</h4><p>Без хука просмотров нет. Человек в кадре пробивает баннерную слепоту. В Instagram сейчас главное - органика и охваты, алгоритмы любят то, что цепляет внимание.</p></div>
      <div class="icard"><div class="n">МУЛЬТИПЕРСОНАЖ</div><h4>Не только Богдан</h4><p>Богдан 1-2 съёмки/мес, перевес его появлений заметный (лицо бренда). Плюс люди с производства, эксперты, резиденты ТОН. Возможен цифровой двойник (''' + T('HeyGen','Сервис, который делает реалистичное видео с цифровой копией человека без его съёмки.') + ''') позже.</p></div>
      <div class="icard"><div class="n">КОНВЕЙЕР</div><h4>Снял раз - нарезал на всё</h4><p>Планируем съёмочный день сразу с количеством нарезок. Пример: один ролик на YouTube - серия Shorts, reels, клипов. Множитель для команды из двух рук.</p></div>
      <div class="icard"><div class="n">ЕДИНЫЙ СТИЛЬ</div><h4>Tone of Voice и локации</h4><p>Описать голос и вид для GENGLASS и Volonti отдельно. Регламент локаций: убрать провода, мусор, непремиальный фон (крупный план или киноэффект размывают сами). Чтобы по нескольким роликам было видно: это один аккаунт.</p></div>
      <div class="icard"><div class="n">КАРУСЕЛИ + АНАЛИТИКА</div><h4>Досматриваемость и учёт</h4><p>Карусели дожимают досмотр и набирают охват. Ведём ежемесячный учёт «что залетело и почему», часть каруселей готовит арт-направление (Кирилл) вне ленты ситуатива.</p></div>
      <div class="icard"><div class="n">ЛИД-МАГНИТЫ</div><h4>Приземлять, а не просто охватывать</h4><p>Для Volonti сразу продумать лид-магниты (гайд, топ-чарт, польза для дизайнера). Тогда из немногочисленных охватов измеряем рост: скачивания, обращения. Контент клиент-first, не каждый пост - продажа.</p></div>
    </div>
  </section>

  <!-- 09 ИЗМЕРИМОСТЬ -->
  <section id="s9" class="reveal">
    <div class="sec-head">
      <span class="sec-num">09</span>
      <div><h2 class="sec-title">Измеримость: <span class="em">что и как считаем</span></h2>
      <p class="sec-sub">SMM становится драйвером только если оцифрован. Сейчас данных мало, поэтому первый шаг - собрать точку отсчёта и наладить метки. Ни одна цифра ниже не выдаётся за факт без выгрузки.</p></div>
    </div>
    <div class="frame">
      <div class="f"><span class="m mk gold">1</span><div><b>Метрика Volonti 2026 - контакты дизайнеров, не выручка.</b> Финансовую задачу не ставим: её нельзя честно оценить на этом этапе. Контакты измеримы и проверяемы.</div></div>
      <div class="f"><span class="m mk gold">2</span><div><b>Точка отсчёта по GENGLASS</b> - сколько заявок и охватов SMM даёт сейчас. Без неё цели не ставим и движок не режем под Volonti. <b>Ответственный - Дима, срок до конца июня</b> (предусловие красной линии −15%).</div></div>
      <div class="f"><span class="m mk gold">3</span><div><b>Метка источника в Bitrix.</b> Собрать всё, что приходит из SMM (метки на сайте, чаты, сообщения), сегментировать: сколько контактов и какого рода. Стартовый стол, с которым дальше сверяемся.</div></div>
      <div class="f"><span class="m mk gold">4</span><div><b>Pinterest честно:</b> охваты тысячные, переходов 8 за квартал <span class="tag-inline data">ДАННЫЕ</span>. Это витрина узнаваемости, не источник заявок. Не переоцениваем.</div></div>
      <div class="f"><span class="m mk gold">5</span><div><b>Обогащение карточек дизайнеров</b> через требования в CRM: система сама подсвечивает незаполненные поля и подталкивает менеджеров довносить данные (мягкая разведка вместо классических каздевов). Срок - до конца июня.</div></div>
      <div class="f"><span class="m mk gold">6</span><div><b>Единый источник правды по цифрам.</b> Свести данные из презентаций, сайта, каталога к одному значению, чтобы не рандомить цифры. До этого публичные плашки с числами - стоп.</div></div>
      <div class="f"><span class="m mk keep">отчётность</span><div>SMM-специалист ведёт еженедельные срезы, рабочая группа разбирает раз в месяц. Динамика наверх или вниз должна быть видна.</div></div>
    </div>
  </section>

  <!-- 10 ДИСЦИПЛИНА -->
  <section id="s10" class="reveal">
    <div class="sec-head">
      <span class="sec-num">10</span>
      <div><h2 class="sec-title">Финансовая дисциплина <span class="em">и защита кассы</span></h2>
      <p class="sec-sub">Бюджет рамочный и недоминирующая доля общих расходов, его ещё уточняем. Главное - тратить так, чтобы не сжечь движок GENGLASS и поймать провал рано.</p></div>
    </div>
    <div class="gate">
      <div class="step"><span class="k">1</span><div><b>Бюджет даём частями.</b> Сначала малый шаг (метка источника + первая коллаба ТОН), остаток открываем после первой проверки. Доп. траты на капсулу - потолок ориентир <b>200 000 ₽</b> <span class="tag-inline hyp">ГИПОТЕЗА - нужны сметы</span>, считаем отдельно от уже оплаченного резидентства.</div></div>
      <div class="step"><span class="k">2</span><div><b>Точка отсчёта до резки движка.</b> Пока нет цифр по заявкам GENGLASS, нельзя жертвовать его частотой ради Volonti. Это страховка от незамеченного кассового провала.</div></div>
      <div class="step"><span class="k">3</span><div><b>Время команды - главная скрытая статья.</b> Две руки + уход Ани Сосновской в начале июля. Уперлись в потолок по времени - режем число событий, а не нанимаем под буквальные 80-90%.</div></div>
    </div>
    <h3 style="font-size:18px;font-weight:700;margin:26px 0 14px;color:var(--stop)">Красные линии (когда жмём на тормоз)</h3>
    <div class="grid3">
      <div class="icard" style="border-color:rgba(217,105,76,.4)"><div class="n" style="color:var(--stop)">КАССА</div><h4>Заявки GENGLASS −15%</h4><p>Просадка заявок движка больше 15% от точки отсчёта - немедленно вернуть частоту GENGLASS. Это триггер Protocol 8.</p></div>
      <div class="icard" style="border-color:rgba(217,105,76,.4)"><div class="n" style="color:var(--stop)">КАНАЛ ПУСТ</div><h4>0 контактов за 90 дней</h4><p>Дизайнеры из капсулы и лент не приходят при выполненном плане - менять подход, а не лить дальше.</p></div>
      <div class="icard" style="border-color:rgba(217,105,76,.4)"><div class="n" style="color:var(--stop)">СЛЕПО</div><h4>Нет меток и точки отсчёта</h4><p>Если измеримость так и не настроена - вклад SMM недоказуем, и любой бюджет на масштаб не выдаём.</p></div>
    </div>
  </section>

  <!-- 11 РИСКИ -->
  <section id="s11" class="reveal">
    <div class="sec-head">
      <span class="sec-num">!</span>
      <div><h2 class="sec-title">Риски <span class="em">и как закрыть</span></h2>
      <p class="sec-sub">Без розовых очков. Где стратегия ломается и что необратимо.</p></div>
    </div>
    <div class="traps">
      <div class="trap"><div class="tnum">ОДНО ЛИЦО</div><h4>Завязка на Богдане</h4><p>Богдан - лицо бренда, но 1-2 съёмки в месяц и высокая загрузка.</p><div class="fix"><b>Закрытие:</b> мультиперсонаж (производство, эксперты, резиденты ТОН), банк контента заранее, возможен цифровой двойник.</div></div>
      <div class="trap"><div class="tnum">УХОД КУРАТОРА</div><h4>Аня Сосновская уходит в начале июля</h4><p>Стратегическая поддержка и помощь Ане Емельяненко заканчиваются.</p><div class="fix"><b>Закрытие:</b> до июля передать дела, зафиксировать регламенты и Tone of Voice письменно, не в голове.</div></div>
      <div class="trap"><div class="tnum">РАЗМЫТИЕ</div><h4>«Доступный премиум» и слово «роскошь»</h4><p>Формулировки тянут Volonti вниз и отпугивают дизайнеров.</p><div class="fix"><b>Закрытие:</b> снять с кураторов ТОН формулировку, в своём голосе «роскошь» не писать, держать материал и авторство.</div></div>
      <div class="trap"><div class="tnum">НЕОБРАТИМО</div><h4>Связка «by GENGLASS» наружу</h4><p>Если прилипнет к Volonti публично - откатить нельзя, ломает будущую самостоятельность бренда.</p><div class="fix"><b>Закрытие:</b> чек-лист перед публикацией, «by GENGLASS» только внутри.</div></div>
      <div class="trap"><div class="tnum">ДВЕ РУКИ</div><h4>Команда не вытягивает два бренда</h4><p>Аня одна и пока неопытная, GENGLASS и Volonti одновременно качать тяжело.</p><div class="fix"><b>Закрытие:</b> конвейер, единый стиль, часть каруселей на арт-направление, GENGLASS на минимально-достаточной частоте. Иначе нанимать.</div></div>
      <div class="trap"><div class="tnum">ЗАВИСИМОСТЬ</div><h4>Доступ к дизайнерам через кураторов ТОН</h4><p>База и доверие идут через Ксенофонтовых.</p><div class="fix"><b>Закрытие:</b> копим свою базу с меткой «ТОН» прямо с экспозиции, под согласие на данные. Партнёрство, не зависимость.</div></div>
    </div>
  </section>

  <!-- 12 ДАЛЬШЕ -->
  <section id="s12" class="reveal">
    <div class="sec-head">
      <span class="sec-num">12</span>
      <div><h2 class="sec-title">Что закрыто <span class="em">и что идёт отдельно</span></h2>
      <p class="sec-sub">Эта стратегия задаёт вектор и рамку. Конкретика следующего шага - отдельными документами.</p></div>
    </div>
    <div class="frame">
      <div class="f"><span class="m mk keep">✓</span><div><b>Закрыто:</b> архитектура Valonti by GENGLASS; приоритет Volonti через ТОН; GENGLASS как движок ≥3/нед; позиционирование middle+/premium без «роскоши»; метрика 2026 = контакты дизайнеров; владелец канала - Аня Емельяненко, аналитика - Дима.</div></div>
      <div class="f"><span class="m mk gold">▸</span><div><b>Отдельный документ:</b> полная дорожная карта (блоки, сроки, ответственные, часы) и распределение ролей в рабочей группе.</div></div>
      <div class="f"><span class="m mk gold">▸</span><div><b>Отдельный документ:</b> два контент-плана (GENGLASS и Volonti) и две контент-стратегии с чёткой ЦА, болями, слоганом, философией, миссией, Tone of Voice, ассортиментом.</div></div>
      <div class="f"><span class="m mk gold">▸</span><div><b>Отдельный документ:</b> стратегия взаимодействия VALONTI &times; ТОН (резиденты, коллаборации, экономика) - уже собрана.</div></div>
      <div class="f"><span class="m mk invest">▸</span><div><b>Решается:</b> перевод дизайнеров GENGLASS &rarr; Volonti (с Олей, указания менеджерам); каздевы через систему контроля в CRM, не через одного человека; финальная формулировка слогана.</div></div>
      <div class="f"><span class="m mk stop">▸</span><div><b>Пока делаем:</b> Аня ежедневно снимает живой премиальный контент в Volonti с конвейера, не дожидаясь идеального плана, GENGLASS держим регулярным.</div></div>
    </div>
  </section>

  <!-- FOOTER -->
  <footer class="footer reveal">
    <div class="legend">
      <div class="l"><span class="sw" style="background:var(--keep)"></span>держим / закрыто</div>
      <div class="l"><span class="sw" style="background:var(--stop)"></span>стоп / красная линия</div>
      <div class="l"><span class="sw" style="background:var(--invest)"></span>решаем / контроль</div>
      <div class="l"><span class="sw" style="background:var(--gold)"></span>отдельный документ / ключевое</div>
    </div>
    <div style="font-size:13px;color:var(--ink-2);margin-bottom:8px">
      <span class="tag-inline data">ДАННЫЕ</span> - из 1С / Bitrix24 / аналитики / рабочих чатов &nbsp;·&nbsp;
      <span class="tag-inline hyp">ГИПОТЕЗА</span> - оценка, требует проверки перед попаданием в план.
    </div>
    <div class="foot-meta">
      <div class="seal"><span class="d"></span>GENGROUP · GEN / SMM · финальная стратегия · владелец: Аня Емельяненко</div>
      <div>Сведено из стратсессии, обратной связи Богдана и капсулы ТОН · приёмка ФЕНИКС __SCORE__</div>
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

BODY = BODY.replace('Volonti', 'VALONTI').replace('Valonti', 'VALONTI')
BODY = BODY.replace('GEN-GROUP', 'GENGROUP')
BODY = BODY.replace('luxury-формула', 'люксовая формула')
BODY = BODY.replace('__SCORE__', '8.4/10 · GO')

html = ('<!DOCTYPE html>\\n<html lang="ru">\\n<head>\\n<meta charset="UTF-8">\\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">\\n'
        '<title>GEN / SMM - Финальная стратегия · GENGROUP</title>\\n'
        '<style>' + CSS + EXTRA + '</style>\\n</head>\\n<body>\\n' + BODY + '\\n</body>\\n</html>\\n')

os.makedirs('smm/public/final', exist_ok=True)
open('smm/public/final/index.html','w',encoding='utf-8').write(html)

print('bytes:', len(html))
print('section bal:', html.count('<section')-html.count('</section>'))
print('div bal:', html.count('<div')-html.count('</div>'))
print('em dash:', html.count(chr(0x2014)))
print('tooltips:', html.count('class="t"'))
print('SF Pro:', 'SF Pro Display' in html)
