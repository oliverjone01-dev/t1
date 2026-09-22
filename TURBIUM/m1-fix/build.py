# -*- coding: utf-8 -*-
# TURBIUM m1 v5 build: применяет правки Совета к страницам.
import io, os, re, sys

BASE = os.path.dirname(os.path.abspath(__file__))
def rd(p): return io.open(os.path.join(BASE,p),encoding='utf-8').read()
def wr(p,s): io.open(os.path.join(BASE,p),'w',encoding='utf-8').write(s)

MISS=[]
def rep(s,old,new,f,cnt=1):
    if old not in s:
        MISS.append(f'{f}: NOT FOUND: {old[:80]}')
        return s
    return s.replace(old,new,cnt)

SPRITE = rd('assets/sprite.html').strip()

DESKTOP_NAV = ('<nav class="desktop-nav" aria-label="Основная навигация">'
 '<a href="solutions.html" data-page-link="solutions">Решения</a>'
 '<a href="products.html" data-page-link="products">Продукты</a>'
 '<a href="method.html" data-page-link="method">Как работаем</a>'
 '<a href="pricing.html" data-page-link="pricing">Цены</a>'
 '<a href="insights.html" data-page-link="insights">Разборы</a>'
 '<a href="about.html" data-page-link="about">О нас</a></nav>')

MOBILE_NAV = ('<nav class="mobile-nav" id="mobile-nav" aria-label="Мобильная навигация">'
 '<a href="index.html" data-page-link="home"><span class="num">00</span><span class="label">Главная</span><span class="arrow">↘</span></a>'
 '<a href="solutions.html" data-page-link="solutions"><span class="num">01</span><span class="label">Решения</span><span class="arrow">↘</span></a>'
 '<a href="products.html" data-page-link="products"><span class="num">02</span><span class="label">Продукты</span><span class="arrow">↘</span></a>'
 '<a href="method.html" data-page-link="method"><span class="num">03</span><span class="label">Как работаем</span><span class="arrow">↘</span></a>'
 '<a href="pricing.html" data-page-link="pricing"><span class="num">04</span><span class="label">Цены</span><span class="arrow">↘</span></a>'
 '<a href="insights.html" data-page-link="insights"><span class="num">05</span><span class="label">Разборы</span><span class="arrow">↘</span></a>'
 '<a href="about.html" data-page-link="about"><span class="num">06</span><span class="label">О нас</span><span class="arrow">↘</span></a>'
 '<a href="audit.html" data-page-link="audit"><span class="num">07</span><span class="label">Бесплатный аудит</span><span class="arrow">↗</span></a></nav>')

ICON = lambda i: f'<svg class="ico" aria-hidden="true"><use href="#{i}"/></svg>'

PIPE = '''<figure class="hero-pipe" role="img" aria-label="Путь заявки: на шаге два деньги выпадают из трубы">
<svg viewBox="0 0 560 170" fill="none">
  <path d="M20 84h520" stroke="#203029" stroke-width="22" stroke-linecap="round"/>
  <path d="M20 84h210" stroke="#4EEAC0" stroke-width="4" stroke-linecap="round" opacity=".85"/>
  <g class="pipe-coin"><circle cx="46" cy="84" r="6" fill="#4EEAC0"/></g>
  <g class="pipe-coin c2"><circle cx="46" cy="84" r="6" fill="#4EEAC0" opacity=".7"/></g>
  <g class="pipe-coin c3"><circle cx="46" cy="84" r="6" fill="#4EEAC0" opacity=".45"/></g>
  <g class="pipe-drop"><circle cx="248" cy="96" r="6" fill="#FF8C42"/></g>
  <path d="M242 148h12" stroke="#FF8C42" stroke-width="2" stroke-linecap="round" opacity=".5"/>
  <g font-family="ui-monospace,monospace" font-size="10" text-anchor="middle">
    <rect x="73" y="67" width="34" height="34" rx="8" stroke="#365247" fill="#0b1411"/><text x="90" y="88" fill="#8A9A94">01</text>
    <rect x="213" y="67" width="34" height="34" rx="8" stroke="#FF8C42" fill="#161007"/><text x="230" y="88" fill="#FF8C42">02</text>
    <rect x="353" y="67" width="34" height="34" rx="8" stroke="#365247" fill="#0b1411"/><text x="370" y="88" fill="#8A9A94">03</text>
    <rect x="493" y="67" width="34" height="34" rx="8" stroke="#365247" fill="#0b1411"/><text x="510" y="88" fill="#8A9A94">04</text>
    <text x="90" y="46" fill="#8A9A94">ЗАЯВКА</text><text x="230" y="46" fill="#FFB88C">ОТВЕТ</text><text x="370" y="46" fill="#8A9A94">ПОВТОР</text><text x="510" y="46" fill="#8A9A94">ПРОДАЖА</text>
  </g>
</svg>
<figcaption>Заявки едут по трубе. На шаге «Ответ» часть денег выпадает - это и есть утечка.</figcaption>
</figure>'''

ART = {
'ha': '''<svg class="situation-art" viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path class="a" d="M8 46c10-26 20 12 30-6S24 14 36 12s12 20 24 12 8-16 18-10" opacity=".8"/><path class="m" d="M8 76h72m0 0-8-6m8 6-8 6"/></svg>''',
'ra': '''<svg class="situation-art" viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="10" y="8" width="46" height="34" rx="5"/><path d="M18 34v-9M28 34V18M38 34v-6M48 34V22" class="m"/><path class="a" d="M56 62h30v22H56zM56 62l6-8h18l6 8M64 70h14" stroke-dasharray="0"/><path class="a" d="M66 74h10" opacity=".4" stroke-dasharray="2 4"/></svg>''',
'no': '''<svg class="situation-art" viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="10" y="58" width="44" height="13" rx="3"/><rect x="14" y="45" width="44" height="13" rx="3"/><rect x="18" y="32" width="44" height="13" rx="3"/><path class="m" d="M76 18l2.4 6 6 2.4-6 2.4-2.4 6-2.4-6-6-2.4 6-2.4 2.4-6Z"/><path class="m" d="M76 35v14"/></svg>''',
'ma': '''<svg class="situation-art" viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="16" cy="76" r="5"/><circle cx="34" cy="62" r="5"/><circle cx="52" cy="48" r="5"/><circle cx="70" cy="34" r="5" class="m"/><circle cx="80" cy="16" r="10" class="a"/><text x="80" y="21" fill="currentColor" stroke="none" font-size="13" text-anchor="middle" font-family="ui-monospace,monospace">?</text></svg>''',
'be': '''<svg class="situation-art" viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="18" width="34" height="34" rx="4" class="a"/><path d="M44 35h10" stroke-dasharray="3 5"/><path d="M58 31l6 8M64 31l-6 8" class="a"/><path class="m" d="M68 58l12-9 12 9v20H68V58Z"/><path class="m" d="M76 78v-9h8v9"/></svg>'''}

TRAFFIC = '''<div class="traffic-scene"><svg viewBox="0 0 64 96" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><rect x="14" y="6" width="36" height="58" rx="9" stroke="#365247"/><circle cx="32" cy="24" r="9" stroke="#4EEAC0" fill="rgba(78,234,192,.14)"/><circle cx="32" cy="47" r="9" stroke="#FF8C42" fill="rgba(255,140,66,.1)"/><path d="M32 64v22M18 90h28" stroke="#365247"/></svg><p>Зелёный - усиливаем. Красный - останавливаемся по заранее оговорённому условию. Провал не переименовываем в успех.</p></div>'''

def common(s, f):
    s = rep(s,'assets/css/site.css?v=6','assets/css/site.css?v=7',f) if 'site.css?v=6' in s else rep(s,'assets/css/site.css"','assets/css/site.css?v=7"',f)
    s = rep(s,'assets/js/site.js?v=6','assets/js/site.js?v=7',f) if 'site.js?v=6' in s else rep(s,'assets/js/site.js"','assets/js/site.js?v=7"',f)
    # спрайт сразу после body
    s = re.sub(r'(<body[^>]*>)', r'\\1'+SPRITE, s, count=1)
    # единая мобильная навигация
    s = re.sub(r'<nav class="mobile-nav".*?</nav>', MOBILE_NAV, s, count=1, flags=re.S)
    # CTA в шапке
    s = s.replace('>Пройти AI-аудит</a>','>Пройти бесплатный аудит</a>')
    return s

# ---------------- INDEX ----------------
f='index.html'; s=rd(f)
s = common(s,f)
s = re.sub(r'<nav class="desktop-nav" aria-label="Основная навигация">.*?</nav>', DESKTOP_NAV, s, count=1, flags=re.S)
s = rep(s,'<meta property="og:image" content="https://rayivan001-cell.github.io/m1/assets/images/hero-reaction.jpg">','<meta property="og:image" content="https://rayivan001-cell.github.io/m1/assets/images/hero-reaction.jpg">\n  <meta name="twitter:card" content="summary_large_image">\n  <meta name="twitter:image" content="https://rayivan001-cell.github.io/m1/assets/images/hero-reaction.jpg">',f)
s = rep(s,'"description":"Диагностика маркетинга, лидогенерация и аналитика для малого бизнеса"','"description":"Диагностика маркетинга, привлечение заявок и понятная аналитика для малого бизнеса"',f)
s = rep(s,'Берём новые проекты на август','Берём ограниченное число проектов в работу',f)
s = rep(s,'За 5 минут находим слабое место в пути клиента. За короткий пилот собираем маршрут','За 5 минут находим слабое место на пути заявки. За короткий пробный запуск (мы зовём его «пилот») собираем маршрут',f)
s = rep(s,'<small>2 минуты · без заявки</small>','<small>2 минуты · без регистрации</small>',f)
s = rep(s,'<span class="tag">МОДЕЛЬНЫЙ ПРИМЕР</span>','<span class="tag hyp">ПРИМЕРНЫЙ РАСЧЁТ</span>',f)
s = rep(s,'<div><small>УПРАВЛЯЕМОСТЬ</small><strong>42<span>/100</span></strong></div>','<div><small>ПОРЯДОК В ЗАЯВКАХ</small><strong>42<span>/100</span></strong><span class="score-cap">Видно меньше половины пути ваших заявок</span></div>',f)
s = rep(s,'<b>42%</b><span>видимости</span>','<b>42</b><span>из 100</span>',f)
s = rep(s,'<small>Не связана с источником</small>','<small>Непонятно, какая реклама привела к продаже</small>',f)
s = rep(s,'</div>\n            <div class="console-action">','<button class="journey-more" type="button">Показать весь путь</button></div>\n            <div class="console-action">',f)
s = rep(s,'<div class="container hero-footnote">',PIPE+'\n        </div>\n        <div class="container hero-footnote">',f)
s = rep(s,'</div>\n        '+PIPE, PIPE, f) if False else s
# закрыть грид перед pipe: PIPE вставлен ПЕРЕД footnote, но внутри hero-v4-grid уже закрыт; поправка: вставка выше добавила лишний </div>. Автокоррекция:
s = s.replace(PIPE+'\n        </div>\n        <div class="container hero-footnote">', PIPE+'\n        <div class="container hero-footnote">')
# pipe должен быть ВНУТРИ hero-v4-grid: переносим - вставляем перед закрытием грида
s = rep(s,'</div>\n        </div>\n        '+PIPE,'</div>\n        '+PIPE+'\n        </div>',f) if ('</div>\n        </div>\n        '+PIPE) in s else s
s = rep(s,'НЕЗАВИСИМОЕ AI-АГЕНТСТВО · МОСКВА / РОССИЯ','ПРОДУКТОВАЯ КОМАНДА · МОСКВА / РОССИЯ',f)
for num,ic in [('01','i-chat-clock'),('02','i-unplug'),('03','i-mute-db'),('04','i-chart-q')]:
    s = rep(s,f'<p><span>{num}</span><b>',f'<p><svg class="ico pain-ico" aria-hidden="true"><use href="#{ic}"/></svg><b>',f)
s = rep(s,'Внутри - минимальный первый шаг без преждевременного внедрения.','Внутри - понятный первый шаг без лишних расходов.',f)
for code,art in [('Ха','ha'),('Ра','ra'),('Но','no'),('Ма','ma')]:
    s = rep(s,f'<span class="situation-code">{code}</span>',f'<span class="situation-code">{code}</span>{ART[art]}',f)
s = rep(s,'<em>Найти точку роста <i>↗</i></em></a>','<em>Найти, что усилить <i>↗</i></em></a>',f)
s = rep(s,'''<em>Найти, что усилить <i>↗</i></em></a>
          </div>''','''<em>Найти, что усилить <i>↗</i></em></a>
            <a class="situation-row" href="solutions.html#platform"><span class="situation-code">Бе</span>'''+ART['be']+'''<span><small>СИТУАЦИЯ 05</small><b>Площадка забирает клиентов и комиссию</b></span><p>Возвращаем спрос и контакты в ваши каналы: своя база, сайт, карты и прямая связь с клиентами.</p><em>Вернуть клиентов себе <i>↗</i></em></a>
          </div>''',f)
s = rep(s,'Каждый следующий слой подключается только после сигнала от предыдущего.','Следующий шаг подключаем только после того, как предыдущий доказал результат.',f)
s = rep(s,'Один сегмент, одна боль, один маршрут от касания до следующего действия.','Одна группа клиентов, одна их главная проблема и один маршрут: от первого обращения до следующего шага.',f)
s = rep(s,'<span class="tag hyp">ПОСЛЕ ПИЛОТА</span><h3>Рост подтверждённого</h3><p>Усиливаем только тот канал, который прошёл критерий и сохранил экономику.</p>','<span class="tag hyp">ПОСЛЕ ПРОБНОГО ЗАПУСКА</span><h3>Рост того, что работает</h3><p>Усиливаем только тот канал, который принёс заявки и не съел прибыль.</p>',f)
s = s.replace('<aside><small>НА ВЫХОДЕ</small>','<aside><small>ЧТО ВЫ ПОЛУЧИТЕ</small>')
s = rep(s,'<b>Индекс и рекомендация</b>','<b>Оценка и первый шаг</b>',f)
s = rep(s,'<b>Контролируемый масштаб</b>','<b>Рост под контролем</b>',f)
s = rep(s,'<div class="honesty-head"><span>ПРОТОКОЛ ПРОЗРАЧНОСТИ</span>','<div class="honesty-head"><span><svg class="ico gb-ico" aria-hidden="true"><use href="#i-glassbox"/></svg>НАШИ ПРАВИЛА ЧЕСТНОСТИ</span>',f)
s = rep(s,'<p>рядом источник или пометка «модель»</p>','<p>рядом источник или пометка «примерный расчёт»</p>',f)
s = rep(s,'<p>показана до созвона</p>','<p>показана до разговора</p>',f)
s = rep(s,'<p>остаются в контуре клиента</p>','<p>остаются у вас, не у нас</p>',f)
s = rep(s,'<span>КОРОТКИЙ ПИЛОТ</span>','<span>ПРОБНЫЙ ЗАПУСК</span>',f)
s = rep(s,'<span>ТОЛЬКО ПОСЛЕ СИГНАЛА</span><b>04</b><h3>Усилим рабочее</h3><p>Не перестраиваем всё. Масштабируем подтверждённый механизм и оставляем контроль вам.</p>','<span>ТОЛЬКО ЕСЛИ ЕСТЬ РЕЗУЛЬТАТ</span><b>04</b><h3>Усилим то, что работает</h3><p>Не перестраиваем всё. Развиваем то, что доказало результат, и оставляем контроль вам.</p>',f)
s = rep(s,'Диагностика, лидогенерация и понятная аналитика для малого бизнеса России.','Диагностика, привлечение заявок и понятная аналитика для малого бизнеса России.',f)
s = rep(s,'<span>Публичная версия 4.0</span>','<span>Страница обновлена в июле 2026</span>',f)
wr(f,s)

# ---------------- AUDIT ----------------
f='audit.html'; s=rd(f)
s = common(s,f)
s = re.sub(r'<nav class="desktop-nav">.*?</nav>', DESKTOP_NAV, s, count=1, flags=re.S)
s = rep(s,'content="Бесплатный модельный AI-аудит маркетинга TURBIUM."','content="Бесплатный AI-аудит маркетинга TURBIUM: пять вопросов, результат сразу на экране, ответы никуда не отправляются."',f)
s = rep(s,'Модельный индекс управляемости от 0 до 100, найденное слабое звено и один рекомендуемый следующий шаг.','Оценка порядка в заявках от 0 до 100, найденное слабое звено и один понятный следующий шаг.',f)
s = rep(s,'<span class="tag hyp">[МОДЕЛЬ TURBIUM]</span>','<span class="tag hyp">[ПРИМЕРНЫЙ РАСЧЁТ TURBIUM]</span>',f)
s = rep(s,'<p>Выбирайте ближайший к реальности ответ. Здесь нет правильных вариантов.</p>','<p>Выбирайте ближайший к реальности ответ. Здесь нет правильных вариантов.</p><p class="meta" style="margin-top:12px">Ответы остаются в вашем браузере и никуда не отправляются.</p>',f)
s = rep(s,'Откуда обычно приходят новые обращения?','Откуда обычно приходят новые заявки?',f)
s = rep(s,'МОДЕЛЬНЫЙ ИНДЕКС УПРАВЛЯЕМОСТИ','ОЦЕНКА ПОРЯДКА В ЗАЯВКАХ · ПРИМЕРНЫЙ РАСЧЁТ',f)
s = rep(s,'Результат рассчитан по внутренней модели TURBIUM и не является аудитом финансовой отчётности, гарантией результата или коммерческим предложением.','Это расчёт по нашей формуле. Он не проверка вашей бухгалтерии, не гарантия результата и не готовое коммерческое предложение.',f)
s = rep(s,'Этот прототип не отправляет и не сохраняет ответы.','Этот аудит не отправляет и не сохраняет ответы.',f)
s = rep(s,'<span>AI-аудит использует модельный расчёт</span>','<span>Аудит использует примерный расчёт TURBIUM</span>',f)
wr(f,s)

# ---------------- PRICING ----------------
f='pricing.html'; s=rd(f)
s = common(s,f)
# перестановка: калькулятор потерь до цен
m_prices = re.search(r'(<section class="section reveal"><div class="container"><div class="pricing-grid.*?</section>)', s, re.S)
m_calc   = re.search(r'(<section class="section reveal"><div class="container"><header class="section-head"><div class="section-index">02 / Модель потерь.*?</section>)', s, re.S)
if m_prices and m_calc:
    s = s.replace(m_prices.group(1),'@@PRICES@@').replace(m_calc.group(1),'@@CALC@@')
    s = s.replace('@@PRICES@@','@@TMP@@').replace('@@CALC@@','@@PRICES@@').replace('@@TMP@@','@@CALC@@')
    s = s.replace('@@CALC@@',m_calc.group(1)).replace('@@PRICES@@',m_prices.group(1))
else:
    MISS.append('pricing: sections for swap not found')
s = rep(s,'<div class="section-index">02 / Модель потерь</div>','<div class="section-index">01 / Сколько теряется</div>',f)
s = rep(s,'<section class="section reveal"><div class="container"><div class="pricing-grid','<section class="section reveal"><div class="container"><header class="section-head"><div class="section-index">02 / Цены</div><div><h2 class="section-title wipe">Три продукта. Цены открыты.</h2></div></header><div class="pricing-grid',f)
s = rep(s,'Пока продукты не прошли достаточное число реальных внедрений, цены являются рабочими гипотезами. Мы показываем их открыто, чтобы вы понимали порядок до разговора.','Мы пока не сделали столько проектов, чтобы цены стали окончательными, поэтому честно называем их гипотезами. И показываем открыто, чтобы вы понимали порядок сумм до разговора.',f)
s = rep(s,'<span class="tag hyp">[ГИПОТЕЗА] ЦЕНЫ V1</span>','<span class="tag hyp">ЦЕНЫ-ГИПОТЕЗА</span>',f)
s = s.replace('<p>[ГИПОТЕЗА] продуктовая модель TURBIUM</p>','<p>Предварительная цена: уточнится по опыту первых проектов</p>')
s = rep(s,'<p>+ 9 990 ₽/мес [ГИПОТЕЗА] за поддержку контура</p>','<p>+ 9 990 ₽ в месяц (тоже гипотеза) за поддержку системы и порядок в данных</p>',f)
s = rep(s,'<li>одна аудитория и одна боль</li>','<li>одна группа клиентов и их главная проблема</li>',f)
s = rep(s,'<li>квиз, бот или посадочная механика</li>','<li>тест-опрос, чат-бот или отдельная страница для заявок</li>',f)
s = rep(s,'<li>маршрутизация заявки</li>','<li>заявка сразу попадает нужному человеку</li>',f)
s = rep(s,'<li>базовые события аналитики</li>','<li>видно, сколько людей оставили заявку</li>',f)
s = rep(s,'>Проверить применимость</a>','>Узнать, подходит ли мне</a>',f)
s = rep(s,'<li>одна активная гипотеза на цикл</li>','<li>одна проверяемая идея за раз</li>',f)
s = rep(s,'<li>прозрачный stop-сигнал</li>','<li>заранее понятно, когда остановимся</li>',f)
s = rep(s,'Возможный месячный объём прибыли, связанный с 10–25% заявок без следующего действия. Диапазон является внутренней гипотезой TURBIUM и не заменяет анализ CRM.','Возможная месячная прибыль, которая уходит вместе с 10–25% заявок, оставшихся без ответа. Диапазон - наша гипотеза, он не заменяет разбор вашей CRM (программы учёта клиентов).',f)
s = rep(s,'В расчёте не учитываются конверсия в продажу, повторные покупки и отраслевые различия.','В расчёте не учтено, сколько заявок реально становятся продажами, повторные покупки и отраслевые различия.',f)
s = rep(s,'TURBIUM не выдаёт раннюю продуктовую модель за статистически подтверждённую экономику. Диапазоны будут уточняться по фактической трудоёмкости и результатам проектов.','У нас пока мало завершённых проектов, чтобы точно посчитать все затраты. Мы не выдаём предварительную цену за окончательную: диапазоны будут уточняться по реальному опыту.',f)
s = rep(s,'<p class="meta" style="margin-top:14px">Цены не являются публичной офертой. Налоги, рекламный бюджет и сторонние сервисы уточняются отдельно.</p>','<p class="meta" style="margin-top:14px">Цены не являются публичной офертой. Налоги, рекламный бюджет и сторонние сервисы уточняются отдельно. Видимость в поиске и AI-ответах (GEO) считаем после диагностики, отдельным предложением.</p>',f)
wr(f,s)

# ---------------- PRODUCTS ----------------
f='products.html'; s=rd(f)
s = common(s,f)
s = rep(s,'content="Продукты TURBIUM: AI-аудит, связки лидогенерации, Пульс BI, GEO-система и сопровождение."','content="Продукты TURBIUM: бесплатный аудит, связки для приёма заявок, экран Пульс, видимость в поиске (GEO) и сопровождение."',f)
s = rep(s,'От первого сигнала до <span class="solution-color">управляемого роста</span>','От первой заявки до <span class="solution-color">роста под контролем</span>',f)
s = rep(s,'Сложность должна появляться только после подтверждённой необходимости. Если проблему решает одна связка, мы не продаём вам платформу.','Мы не усложняем раньше времени. Если проблему решает одна связка, большую систему вам не продаём.',f)
s = rep(s,'<h2 class="wipe">Связка лидогенерации</h2><p>Один законченный путь: человек','<h2 class="wipe">Связка для приёма заявок</h2><p>Связка - это один готовый маршрут: человек',f)
s = rep(s,'<li><span>01</span>Одна аудитория и одна дорогая боль</li>','<li><span>01</span>Одна группа клиентов и одна дорогая для них проблема</li>',f)
s = rep(s,'<li><span>02</span>Посадочная механика, квиз или бот</li>','<li><span>02</span>Отдельная страница, тест-опрос или чат-бот</li>',f)
s = rep(s,'<li><span>03</span>Маршрутизация заявки и уведомление</li>','<li><span>03</span>Заявка сразу у нужного человека, с уведомлением</li>',f)
s = rep(s,'<li><span>04</span>Базовая аналитика без лишних кабинетов</li>','<li><span>04</span>Понятная статистика без лишних кабинетов</li>',f)
s = rep(s,'<i style="--h:55%"></i></div>','<i style="--h:55%"></i></div><div class="chart-labels"><span>Увидел</span><span>Перешёл</span><span>Оставил заявку</span><span>Получил ответ</span><span>Дошёл до встречи</span><span>Купил</span></div>',f)
s = rep(s,'<article class="panel service-card"><span class="icon-box">01</span><h3>Что произошло</h3>','<article class="panel service-card"><span class="icon-box">'+ICON('i-inflow')+'</span><h3>Что произошло</h3>',f)
s = rep(s,'<article class="panel service-card"><span class="icon-box">02</span><h3>Где остановилось</h3>','<article class="panel service-card"><span class="icon-box">'+ICON('i-pause')+'</span><h3>Где остановилось</h3>',f)
s = rep(s,'<article class="panel service-card"><span class="icon-box">03</span><h3>Что делать дальше</h3>','<article class="panel service-card"><span class="icon-box">'+ICON('i-compass')+'</span><h3>Что делать дальше</h3>',f)
s = rep(s,'Какой канал усилить, какую механику проверить и что не масштабировать.','Какую рекламу усилить, что попробовать и что не развивать дальше.',f)
s = rep(s,'<div class="eyebrow">ПРОДУКТ 03 / GEO</div>','<div class="eyebrow">ПРОДУКТ 03 / ВИДИМОСТЬ В ПОИСКЕ И AI-ОТВЕТАХ (GEO)</div>',f)
s = rep(s,'Ответы на вопросы клиентов становятся <span class="solution-color">вашим активом.</span>','Ответы на вопросы клиентов начинают <span class="solution-color">работать на вас.</span>',f)
s = rep(s,'связываем сайт, карты, статьи и AI-поиск в единый контур.','связываем сайт, карты, статьи и AI-поиск (ChatGPT, Алиса и другие) в одну систему, которая работает на вас.',f)
s = rep(s,'<strong>Карты</strong><span>единый образ и управляемые отзывы</span>','<strong>Карты</strong><span>точные данные о вас на Яндекс Картах и 2ГИС, порядок в отзывах</span>',f)
s = rep(s,'<h3>Смотрим сигнал</h3><p>Что изменилось в пути клиента и экономике.</p>','<h3>Смотрим, что изменилось</h3><p>В поведении клиентов и в деньгах.</p>',f)
s = rep(s,'<h3>Проводим тест</h3><p>Малая ставка и заранее согласованный срок.</p>','<h3>Проводим проверку</h3><p>Небольшой бюджет и заранее согласованный срок.</p>',f)
s = rep(s,'<h3>Фиксируем вывод</h3><p>Масштабировать, изменить или отключить.</p>','<h3>Фиксируем вывод</h3><p>Развивать, изменить или остановить.</p>',f)
wr(f,s)

# ---------------- SOLUTIONS ----------------
f='solutions.html'; s=rd(f)
s = common(s,f)
s = rep(s,'Начинаем не с услуги. <span class="solution-color">С вашей точки.</span>','Начинаем не с услуги, а <span class="solution-color">с вашей проблемы.</span>',f)
s = rep(s,'Мы покажем минимальный маршрут без лишних внедрений.','Мы покажем понятный первый шаг без лишних расходов.',f)
s = rep(s,'Результат является модельной рекомендацией, а не обещанием результата.','Результат - это расчёт по нашей формуле, а не гарантия.',f)
s = rep(s,'<span class="tag hyp">первый запуск</span>','<span class="tag hyp">старт</span>',f)
s = rep(s,'<span class="tag data">масштабирование</span>','<span class="tag">масштабирование</span>',f)
s = rep(s,'До работы фиксируем вопрос, метрику и условие остановки.','До работы фиксируем вопрос, число, по которому оценим результат, и условие остановки.',f)
s = rep(s,'Выбираем одну боль и одну аудиторию. Собираем минимальную связку, не строя отдел и сложную инфраструктуру заранее.','Выбираем одну проблему и одну группу клиентов. Собираем минимальную связку, не строя отдел и сложную систему заранее.',f)
s = rep(s,'Соединяем рекламу, заявки и продажи в Пульсе. Масштабируем только участки, где данные подтверждают экономику.','Соединяем рекламу, заявки и продажи в Пульсе. Усиливаем только то, что доказанно приносит прибыль.',f)
s = rep(s,'Возвращаем знания, контакты и контент в собственный контур: база, сайт, карты, GEO и прямые каналы.','Возвращаем контакты и материалы под ваш контроль: своя база, сайт, карты, видимость в поиске (GEO) и прямая связь с клиентами.',f)
s = rep(s,'<span class="tag pain">хаос</span><h3>Заявки приходят отовсюду</h3>','<span class="tag pain">хаос</span><span class="tag hyp sol-price">Пульс · от 49 990 ₽ · гипотеза</span><h3>Заявки приходят отовсюду</h3>',f)
s = rep(s,'<span class="tag pain">разочарование</span><h3>Отчёты есть, ответа нет</h3>','<span class="tag pain">разочарование</span><span class="tag sol-price">аудит · 0 ₽</span><h3>Отчёты есть, ответа нет</h3>',f)
s = rep(s,'<span class="tag hyp">старт</span><h3>Нужно начать без дорогой ошибки</h3>','<span class="tag hyp">старт</span><span class="tag hyp sol-price">связка · от 19 990 ₽ · гипотеза</span><h3>Нужно начать без дорогой ошибки</h3>',f)
s = rep(s,'<span class="tag">масштабирование</span><h3>Поток растёт, прибыль неясна</h3>','<span class="tag">масштабирование</span><span class="tag hyp sol-price">Пульс · от 49 990 ₽ · гипотеза</span><h3>Поток растёт, прибыль неясна</h3>',f)
s = rep(s,'<span class="tag hyp">зависимость</span><h3>Площадка контролирует спрос</h3>','<span class="tag hyp">зависимость</span><span class="tag sol-price">цена после диагностики</span><h3>Площадка контролирует спрос</h3>',f)
s = rep(s,'>Прозрачный пилот</a>','>Прозрачный пробный запуск</a>',f)
s = rep(s,'>Пульс BI</a>','>Экран Пульс</a>',f)
s = rep(s,'>GEO-система</a>','>Видимость в поиске</a>',f)
s = rep(s,'Не просто «лид получен», а конкретный ответственный, срок и статус движения.','Не просто «заявка есть», а понятно, кто отвечает, в какой срок и на каком она шаге.',f)
wr(f,s)

# ---------------- METHOD ----------------
f='method.html'; s=rd(f)
s = common(s,f)
s = rep(s,'<strong>У каждого теста есть стоп-сигнал</strong><p>Мы заранее договариваемся, при каком результате механику меняют или отключают. Провал теста не переименовывается в прогрев рынка.</p>','<strong>У каждой проверки есть условие остановки</strong><p>Мы заранее договариваемся, при каком результате работу меняем или останавливаем. Если пробный запуск не сработал, мы говорим об этом прямо.</p>'+TRAFFIC,f)
s = rep(s,'<span class="step-num">03 / ПИЛОТ</span>','<span class="step-num">03 / ПРОБНЫЙ ЗАПУСК</span>',f)
s = rep(s,'Ограничиваем срок, бюджет и объём. Настраиваем события до запуска трафика.','Ограничиваем срок, бюджет и объём. До запуска рекламы настраиваем, как будем считать результат.',f)
s = rep(s,'Масштабируем, переделываем или останавливаем. Вы получаете вывод, а не набор активностей.','Развиваем, переделываем или останавливаем. Вы получаете вывод, а не список задач.',f)
s = rep(s,'Одна активная гипотеза, понятный ответственный и следующий контрольный момент.','Одна проверяемая идея, понятный ответственный и дата, когда посмотрим результат.',f)
s = rep(s,'Связь между наблюдаемой проблемой, действием и ожидаемым сигналом.','Понятно, как связаны проблема, наше действие и ожидаемый результат.',f)
s = rep(s,'Kill-критерий известен заранее и не меняется после неудобного результата.','Условие остановки известно заранее и не меняется после неудобного результата.',f)
s = rep(s,'Рабочие данные, доступы и материалы остаются в вашем контуре.','Рабочие данные, доступы и материалы остаются у вас.',f)
s = rep(s,'<h3>Когда остановимся?</h3>','<h3>Когда остановимся?</h3>',f)
for num,ic in [('01','i-target'),('02','i-logic'),('03','i-ruble'),('04','i-flag'),('05','i-shield'),('06','i-handover')]:
    s = rep(s,f'<article class="panel value-card"><span class="icon-box">{num}</span>',f'<article class="panel value-card"><span class="icon-box">{ICON(ic)}</span>',f)
s = rep(s,'<td>Срабатывает заранее согласованный стоп-сигнал</td>','<td>Работа останавливается по заранее оговорённому условию</td>',f)
wr(f,s)

# ---------------- ABOUT ----------------
f='about.html'; s=rd(f)
s = common(s,f)
s = rep(s,'content="О TURBIUM: независимом AI-агентстве для малого бизнеса России."','content="О TURBIUM: продуктовой команде, которая делает AI-инструменты роста для малого бизнеса России."',f)
s = rep(s,'<div class="eyebrow">Независимое AI-агентство</div>','<div class="eyebrow">Продуктовая команда · AI-инструменты роста</div>',f)
s = rep(s,'Малая доза. <span class="solution-color">Измеримое изменение.</span>','Малое действие. <span class="solution-color">Заметный результат.</span>',f)
s = rep(s,'Решаем наблюдаемую потерю до того, как предлагаем полезные, но необязательные улучшения.','Сначала чиним то, что теряет деньги прямо сейчас. Полезные, но необязательные улучшения - потом.',f)
s = rep(s,'<h3>Сначала пилот</h3><p>Проверяем малой ставкой и не масштабируем неподтверждённую механику.</p>','<h3>Сначала пробный запуск</h3><p>Проверяем малым бюджетом и не увеличиваем то, что не доказало результат.</p>',f)
s = rep(s,'Число без происхождения не становится убедительнее от крупного кегля.','Число без источника не становится убедительнее, даже написанное крупными буквами.',f)
s = rep(s,'<h3>AI как copilot</h3><p>Модель помогает анализировать и производить. Ответственность остаётся у человека.</p>','<h3>AI как помощник</h3><p>AI помогает анализировать данные и готовить материалы. Ответственность остаётся у человека.</p>',f)
s = rep(s,'<h3>Нет кейса, нет легенды</h3><p>Пока нет подтверждённых клиентских результатов, используются только модельные расчёты с явной пометкой.</p>','<h3>Нет примера - не выдумываем</h3><p>Пока нет подтверждённых результатов клиентов, показываем только примерные расчёты с явной пометкой.</p>',f)
for num,ic in [('01','i-plaster'),('02','i-spark'),('03','i-tag'),('04','i-chip'),('05','i-shield'),('06','i-frame')]:
    s = rep(s,f'<article class="panel value-card"><span class="icon-box">{num}</span>',f'<article class="panel value-card"><span class="icon-box">{ICON(ic)}</span>',f)
s = rep(s,'Перед внешней публикацией каждый конкретный показатель требует сверки с первичной методологией и датой исследования.','Каждую цифру из этих источников мы перед публикацией сверяем: откуда она, как посчитана и на какой год актуальна.',f)
s = rep(s,'Не агентство, которое выглядит умнее клиента. <em>Реагент, после которого система работает лучше.</em>','Не агентство, которое красуется перед клиентом. <em>Команда, после которой ваша система работает лучше.</em>',f)
s = rep(s,'<h2>Покажите системе, где болит</h2>','<h2>Покажите нам, где болит</h2>',f)
s = rep(s,'Короткий аудит даст больше контекста, чем формальный бриф.','Короткий аудит расскажет о вашей задаче больше, чем длинная анкета.',f)
s = rep(s,'<p>Диагностика, лидогенерация и аналитика для малого бизнеса России.</p>','<p>Диагностика, привлечение заявок и понятная аналитика для малого бизнеса России.</p>',f)
wr(f,s)

# ---------------- INSIGHTS ----------------
f='insights.html'; s=rd(f)
s = common(s,f)
s = rep(s,'Разборы без терминологического налога','Разборы без сложных терминов',f)
s = rep(s,'Почему больше лидов не всегда означает больше продаж','Почему больше заявок не всегда означает больше продаж',f)
s = rep(s,'два признака, что сложное внедрение рано.','два признака, что сложную систему ставить пока рано.',f)
s = rep(s,'<span class="meta">КОНТЕНТ · ПРАКТИКА</span>','<span class="meta">МАТЕРИАЛЫ · ПРАКТИКА</span>',f)
s = rep(s,'<span class="meta">GEO · ПРАКТИКА</span>','<span class="meta">ВИДИМОСТЬ В ПОИСКЕ · ПРАКТИКА</span>',f)
s = rep(s,'Изучить GEO <span>→</span>','Узнать про видимость в поиске <span>→</span>',f)
s = rep(s,'Числа публикуются только с источником или статусом модельного расчёта.','Каждую цифру подписываем источником или помечаем, что это наш примерный расчёт.',f)
wr(f,s)

# ---------------- JS ----------------
f='assets/js/site.js'; s=rd(f)
s = rep(s,"resultCopy.textContent = 'Система пока не требует сложного внедрения. Сначала соберите единый путь заявки и проверьте его на коротком пилоте.'","resultCopy.textContent = 'Сложная система вам пока не нужна. Сначала соберите один понятный путь заявки и проверьте его коротким пробным запуском.'",f)
s = rep(s,"resultCopy.textContent = 'Каналы уже работают, но между заявкой и продажей теряется управляемость. Нужны диагностика и единый экран Пульс.'","resultCopy.textContent = 'Реклама уже работает, но между заявкой и продажей теряется порядок. Начните с диагностики и одного экрана Пульс.'",f)
s = rep(s,"resultCopy.textContent = 'Базовый контроль уже есть. Не перестраивайте всё: выберите один подтверждённый канал, усилите его и добавьте накопительный GEO-контур.'","resultCopy.textContent = 'Базовый порядок уже есть. Не перестраивайте всё: усильте один канал, который доказал результат, и добавьте видимость в поиске (GEO).'",f)
s = rep(s,"const page = document.body.dataset.page;","const jm=document.querySelector('.journey-more');\n  jm?.addEventListener('click',()=>{jm.closest('.journey-map')?.classList.add('expanded');});\n\n  const page = document.body.dataset.page;",f)
wr(f,s)

# ---------------- CSS: приклеить патч ----------------
css = rd('assets/css/site.css'); patch = rd('assets/css/patch-v5.css')
if 'TURBIUM v5 patch' not in css:
    wr('assets/css/site.css', css.rstrip()+'\n\n'+patch)

print('MISSED:', len(MISS))
for m in MISS: print(' -', m)
print('OK')
