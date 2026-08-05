# Конкуренты РФ: столы для сотрудников и бенч-системы

**Дата сборки:** 05.08.2026
**Ниша:** мебель для персонала open-space (операторские столы, рабочие станции, бенч-системы 2/4/6+ мест)
**Гео:** Москва + федеральная доставка
**Статус:** рабочая карта рынка, не финансовая модель. Цифр эффекта на выручку здесь нет намеренно.

---

## 0. Как отбирал «высокую реализацию»

Выручка по нише «бенч-системы» не публикуется никем. Прямой метрики продаж нет, поэтому реализация оценивается тремя прокси, каждый со своим ограничением.

| Прокси | Что показывает | Чего НЕ показывает | Тип |
|---|---|---|---|
| Keys.so: `top50` (число фраз в топ-50 Яндекса) и `vis` (видимость) | масштаб органического спроса, который сайт реально забирает | конверсию, средний чек, офлайн- и тендерные продажи | [ДАННЫЕ] внутренний замер |
| Рейтинги отзывов (Яндекс.Карты, 2ГИС, Yell, Отзовик, Я.Маркет) | удовлетворённость и хотя бы порядок объёма сделок | репрезентативность: у B2B-фабрик отзывов единицы при больших отгрузках | [ДАННЫЕ] с разными выборками |
| Публичные факты о производстве и клиентах | контрактную мощность | достоверность: часть фактов из поисковых сниппетов, не с сайтов | [ГИПОТЕЗА] где не подтверждено |

**Источник цифр видимости:** `gg-seo-geo-monster/data/keyso-gentero/*/dashboard.json`, Keys.so, база `msk`, замер **16.07.2026**. Это внутренние данные репозитория, не свежий замер на дату сборки.

**Честное ограничение:** органическая видимость коррелирует с онлайн-реализацией, но не равна ей. Для контрактных фабрик (Феликс, Юнитекс, ДЭФО) основной объём идёт через тендеры и дилеров, где Keys.so слеп. Поэтому таблицы разделены на две группы, сравнивать их между собой по `vis` некорректно.

---

## 1. Группа A. Онлайн-реализация (интернет-магазины и гипермаркеты офисной мебели)

Отсортировано по `top50` (фразы в топ-50 Яндекса, Москва, 16.07.2026).

| Сайт | Раздел «бенч / столы для сотрудников» | top50 | vis | Отзывы | Комментарий |
|---|---|---|---|---|---|
| [komus.ru](https://www.komus.ru/) | офисное снабжение + мебель для персонала | 882 025 | 109 322 | сеть с многолетней репутацией B2B-снабжения | Крупнейший B2B-канал офисного снабжения. Мебель тут сопутствующая категория, но по трафику это доминанта рынка |
| [bestmebelshop.ru](https://www.bestmebelshop.ru/catalog/mebel-dlya-ofisa/category-bench-sistemy/) | [бенч-системы от 6 390 ₽](https://www.bestmebelshop.ru/catalog/mebel-dlya-ofisa/category-bench-sistemy/) | 138 837 | 21 648 | общемебельный ретейлер | Самая низкая заявленная точка входа в бенч из найденных [ДАННЫЕ: цена из сниппета, прайсом не сверена] |
| [express-office.ru](https://www.express-office.ru/) | гипермаркет, десятки фабрик в одном каталоге | 42 103 | 3 906 | [сводка отзывов](https://www.express-office.ru/company/feedback/), [Отзовик](https://otzovik.com/reviews/express-office_ru-internet-magazin_ofisnoy_mebeli/) | Референсный конкурент №1 в органике по офисной мебели. В Keys.so вылезает как топ-конкурент почти у каждой фабрики ниши |
| [zamm.ru](https://zamm.ru/) / [pro.zamm.ru](https://pro.zamm.ru/catalog/stoly/stoly_na_neskolko_rabochikh_mest/) | [столы на несколько рабочих мест](https://pro.zamm.ru/catalog/stoly/stoly_na_neskolko_rabochikh_mest/) | 14 676 | 3 016 | [Я.Маркет 4.6/5, 260 отзывов](https://market.yandex.ru/shop--zamm-mebel/461943/reviews); [Я.Карты СПб 4.7/5, 55](https://yandex.com/maps/org/zamm/127509761405/reviews/) | Своё производство на металлокаркасе, ЛДСП Egger. Отдельный B2B-канал ZAMM-PRO. 559 объявлений в Директе на замере: единственный в выборке, кто системно жжёт платный трафик |
| [ergotronica.ru](https://ergotronica.ru/) | столы с регулировкой высоты | 12 825 | 182 | ниша эргономики | Sit-stand сегмент |
| [dobriy-office.ru](https://dobriy-office.ru/tag/ofisnye-stoly-bench-sistemy/) | [бенч-системы](https://dobriy-office.ru/tag/ofisnye-stoly-bench-sistemy/) | 9 091 | 527 | [2ГИС 5.0, 54 отзыва](https://2gis.ru/moscow/firm/70000001051992598); [Yell 5.0, 65](https://www.yell.ru/moscow/com/kompaniya-dobryj-ofis-na-tamozhennoj-ulice_11983793/) | Лучшее сочетание «живой трафик + чистая репутация» в среднем эшелоне. Обещают сборку за 5 часов, бенч на 2/3/4/6+ мест |
| [prime-wood.ru](https://prime-wood.ru/news/top5-bench/) | [обзор «Топ-5 бенч-систем»](https://prime-wood.ru/news/top5-bench/) | 9 820 | 525 | нет собранного рейтинга | Контент-лидер по теме бенча: их обзор ранжируется по коммерческим запросам конкурентов |
| [orgmebel.ru](https://www.orgmebel.ru/catalog/bench-sistema-dlya-ofisa/) | [бенч-системы](https://www.orgmebel.ru/catalog/stoly-ofisnye-bench-sistemy/), команды от 2 до 50+ | 6 894 | 20 | нет собранного рейтинга | Много страниц, мало видимости: страницы есть, позиций почти нет |
| [mavikom.ru](https://www.mavikom.ru/catalog/ofisnye-stoly/bench-sistema/) | [бенч-системы](https://www.mavikom.ru/catalog/ofisnye-stoly/bench-sistema/) | 6 598 | 392 | нет собранного рейтинга | Второй эшелон |
| [office-mebel.ru](https://www.office-mebel.ru/catalog/office_mebel/ofisnaya_mebel_solution/bench_sistema_stol_na_metallokarkase_/) | [бенч Solution от 26 673 ₽](https://www.office-mebel.ru/catalog/office_mebel/ofisnaya_mebel_solution/bench_sistema_stol_na_metallokarkase_/), [бенч Инновация I-51 на 4 места от 42 286 ₽](https://www.office-mebel.ru/catalog/office_mebel/innovatsiya/bench_sistema_na_4_rabochikh_mesta_i_51/) | 4 667 | 28 | нет собранного рейтинга | Полезен как прайс-референс: конкретные артикулы с ценами |
| [ergostol.ru](https://ergostol.ru/catalog/bench-sistemy/) | [бенч от 12 900 ₽](https://ergostol.ru/catalog/bench-sistemy/), разрезы [на 2](https://ergostol.ru/catalog/bench-sistemy/text/workplaces-is-two/) и [на 4 места](https://ergostol.ru/catalog/bench-sistemy/text/workplaces-is-four/) | нет в замере | нет в замере | [Я.Отзывы](https://reviews.yandex.ru/shop/ergostol.ru), [2ГИС](https://2gis.ru/moscow/firm/70000001019944391/tab/reviews), [irecommend](https://irecommend.ru/content/sait-ergostolru-mebel-dlya-raboty-stoya-sidya), [B2B-отзывы](https://ergostol.ru/reviews/company/) | Собственный бренд в нише sit-stand. Модельный ряд Optima Plus / Air / Delta / One / Start. Хвалят механизм подъёма, сварку и покраску каркаса |
| [ergomebel.ru](https://ergomebel.ru/catalog/mebel-dlya-personala/stoly/bench-sistemy-dlya-ofisa/) | [бенч для офиса](https://ergomebel.ru/catalog/mebel-dlya-personala/stoly/bench-sistemy-dlya-ofisa/), [бенч на 4 места](https://ergomebel.ru/catalog/mebel-dlya-personala/stoly/bench-sistemy-na-4-rabochikh-mesta/) | нет в замере | нет в замере | нет собранного рейтинга | Торгует брендами FLEX, Anyways |

---

## 2. Группа B. Производители контракта (столы для персонала под объём, БЦ, тендеры)

Здесь `vis` мал по сравнению с группой A, и это нормально: канал другой.

| Фабрика | Сайт и раздел бенча | top50 | vis | Ключей / страниц в индексе | Отзывы | Что известно о масштабе |
|---|---|---|---|---|---|---|
| **Феликс** | [felix.ru](https://www.felix.ru/), [рабочие станции open-space](https://www.felix.ru/catalog/mebel-dlya-personala/rabochie-stantsii-open-space/): [Тандем от 8 424 ₽](https://www.felix.ru/catalog/mebel-dlya-personala/rabochie-stantsii-open-space/tandem_1/), [Система-М от 12 156 ₽](https://www.felix.ru/catalog/mebel-dlya-personala/rabochie-stantsii-open-space/sistema-m_1/), Тандем Премиум от 22 340 ₽ | 4 688 | **617** | 74 687 / 792 | [Я.Карты](https://yandex.com/maps/org/feliks/1041366112/reviews/), [Я.Маркет категория](https://market.yandex.ru/category/ofisnaya-mebel-feliks) | Самый сильный производитель в органике ниши (vis 617 против 168 у Юнитекса). Выручка ТПК «Феликс» 1,1 млрд ₽ за 2023 [ДАННЫЕ: рейтинг testfirm.ru, требует перепроверки по СПАРК]. Клиенты 2025: ГК Домодедово, Спецстрой, Росатом, ОЭЗ Алабуга [ГИПОТЕЗА: из поисковых сниппетов]. Присутствует на OZON, WB, Я.Маркете |
| **Юнитекс** | [unitex.ru](https://www.unitex.ru/), [мебель для персонала](https://www.unitex.ru/mebel-personala/), [рабочие станции (бенч)](https://spb.unitex.ru/mebel-personala/ofisnye-stoly/rabochie-stancii/) | 5 454 | 168 | 66 159 / 965 | [2ГИС Москва](https://2gis.ru/moscow/firm/4504127908510658), [spr.ru 26 отзывов](https://www.spr.ru/moskva/mebel-dlya-ofisa-ofisnie-peregorodki/reviews/yuniteks-71694.html) | 30+ лет на рынке, программа для БЦ и управляющих компаний, региональная сеть поддоменов (spb, ekb, volgograd). Бенч-серии UP! и Space+. Рейтинги 2ГИС 4.6 (9 отзывов) и 4.0 (20, Тюмень): **выборки малые, статистически слабо** |
| **ДЭФО** | [defo.ru](https://www.defo.ru/), [мебель для персонала](https://www.defo.ru/catalog/mebel-dlya-personala/pd-ofisnaya-mebel_svetlaya/) | 8 421 | 270 | нет в замере | [Отзовик](https://otzovik.com/reviews/mebel_defo/), [собственный раздел отзывов](https://spb.defo.ru/about/reviews/) | Бенч-системы в линейке, столы от 4 326 ₽, гарантия 10 лет [ДАННЫЕ: сниппет, прайсом не сверено]. Широкая сеть региональных сайтов (spb, abakan и далее) |
| **МебельСтиль** | [mebelstyle.ru](https://mebelstyle.ru/) | 5 148 | 185 | 69 284 / 753 | нет собранного рейтинга | Московский производитель, серийка + индивидуальное. 225 объявлений в Директе на замере |
| **Estel** | [estel.pro](https://estel.pro/) | нет в замере | нет в замере | нет в замере | нет собранного рейтинга | Дистрибуция по РФ и ближнему зарубежью, бенч с электрорегулировкой высоты. Продаётся через дилеров ([Стиль Объект](https://www.st-ob.ru/furniture/staff/made-on-estel/) и др.) |
| **RIVA** | [riva.ru](https://riva.ru/) | 326 | 77 | 487 298 / 65 | нет собранного рейтинга | МДФ, экошпон, лак. Персонал + кабинеты. Дилерская сеть. Гигантское семядро при 65 страницах в индексе: сайт не отрабатывает свой же спрос |
| **Directoria & Moder** | [directoria-moder.ru](https://directoria-moder.ru/) | 793 | 42 | 274 926 / 189 | нет собранного рейтинга | Премиум-контракт с 1998, фабрика мягкой мебели Одинцово ~4 000 м². 264 объявления в Директе |
| **Пионер** | [pioner.ru](https://pioner.ru/) | 596 | 3 | 331 685 / 146 | нет собранного рейтинга | Деловая мебель на заказ, ресепшн и кабинеты. Бенч не ядро |
| **ALSAV** | [alsav.ru](https://alsav.ru/) | 257 | 8 | 563 413 / 40 | нет собранного рейтинга | Московская фабрика ~7 000 м², кабинеты руководителя, опт и дилеры. Бенч не ядро |
| **KANO** | [kanorussia.ru](https://kanorussia.ru/) | 33 | 0 | 10 страниц в индексе | [2ГИС 5.0, 6 отзывов](https://2gis.ru/moscow/firm/70000001091252691/tab/reviews) | Премиум, рабочие станции и бенч серии BEE. В органике отсутствует полностью. 6 отзывов при оценке 5.0 нерепрезентативны |

---

## 3. Короткий список: куда смотреть в первую очередь

Если нужен один референс на задачу, вот развилка.

1. **Бенчмарк ассортимента и структуры каталога** → [express-office.ru](https://www.express-office.ru/) и [felix.ru/catalog/mebel-dlya-personala/rabochie-stantsii-open-space/](https://www.felix.ru/catalog/mebel-dlya-personala/rabochie-stantsii-open-space/). Первый держит органику всей ниши, второй показывает, как производитель раскладывает бенч на серии с ценой «от».
2. **Бенчмарк цены за рабочее место** → [office-mebel.ru](https://www.office-mebel.ru/catalog/office_mebel/ofisnaya_mebel_solution/bench_sistema_stol_na_metallokarkase_/) (артикулы с ценами), [ergostol.ru](https://ergostol.ru/catalog/bench-sistemy/) (от 12 900 ₽), [bestmebelshop.ru](https://www.bestmebelshop.ru/catalog/mebel-dlya-ofisa/category-bench-sistemy/) (от 6 390 ₽).
3. **Бенчмарк репутации и сервиса** → [dobriy-office.ru](https://dobriy-office.ru/) (2ГИС 5.0 при 54 отзывах, Yell 5.0 при 65) и [ZAMM](https://market.yandex.ru/shop--zamm-mebel/461943/reviews) (4.6 при 260 отзывах: самая большая выборка в нише, и в ней же видно, где ломается сервис).
4. **Бенчмарк контента под AI-выдачу и SEO** → [prime-wood.ru/news/top5-bench/](https://prime-wood.ru/news/top5-bench/). Обзорная статья, которая забирает коммерческий трафик у магазинов.

---

## 4. Наблюдения по рынку (без цифр эффекта)

1. **Разрыв между семядром и индексом.** У RIVA 487 298 ключей в базе и 65 страниц в индексе, у ALSAV 563 413 при 40 страницах. Спрос на «столы для персонала» существенно шире, чем то, что фабрики оформили страницами.
2. **Платный трафик в нише почти не используется производителями.** На замере 16.07.2026 Директ активно ведут ZAMM (559 объявлений), Directoria & Moder (264), МебельСтиль (225), Everprof (214). У Юнитекса, RIVA и ALSAV на замере ноль объявлений.
3. **Репутационные выборки перекошены.** Онлайн-магазины набирают десятки и сотни отзывов (ZAMM 260, Добрый офис 65 и 54), контрактные фабрики живут на единицах. Сравнивать балл 5.0 при 6 отзывах с 4.6 при 260 нельзя, и в любой презентации это нужно оговаривать.
4. **Цена входа в бенч разъехалась в 4 раза:** от 6 390 ₽ у ретейлера до 26 673 ₽ за похожий по описанию стол на металлокаркасе. Разброс объясняется комплектацией (столешница, каркас, экраны, кабель-канал), но в выдаче потребитель видит только нижнюю цифру.

---

## 5. Ограничения этой сборки (читать перед использованием в КП или презентации)

- Домены `zamm.ru`, `defo.ru`, `reviews.yandex.ru` отдают **403** при прямом обращении. Фактура по ним собрана из поисковых сниппетов, а не с самих страниц. Перед внешним использованием проверять руками.
- Цифры Keys.so на **16.07.2026**, не на дату сборки. Для решений с деньгами нужен свежий замер.
- Цены («от 6 390 ₽», «от 12 900 ₽», «от 4 326 ₽», «от 8 424 ₽») взяты из заголовков и сниппетов выдачи. Прайс-листами и КП **не сверены**, комплектация не сопоставлена. Это ориентиры, не бенчмарк.
- Выручка «Феликс» 1,1 млрд ₽ за 2023 приведена по агрегатору отчётности, первоисточник (СПАРК, бухотчётность) не открывался.
- Список клиентов Феликса за 2025 и характеристики производств помечены **[ГИПОТЕЗА]**: это пересказ выдачи, а не подтверждённые факты.
- Estel, Ergostol и Ergomebel в Keys.so-замере 16.07.2026 отсутствуют: они попали в карту через веб-поиск, их видимость не измерена. Дыра в данных, закрывается отдельным замером.
- Отзывные площадки (Отзовик, Yell, spr.ru) модерируются слабо и содержат заказные отзывы. Использовать как сигнал тона, не как метрику.

---

## Приложение. Полная выгрузка видимости по нише

Keys.so, база `msk`, замер 16.07.2026, источник `gg-seo-geo-monster/data/keyso-gentero/*/dashboard.json`. Отсортировано по `top50`. Общемебельные и непрофильные домены (hoff, divan, inmyroom, stolplit, mebelion, pm.ru) оставлены для калибровки масштаба.

| Домен | top50 | vis |
|---|---|---|
| hoff.ru | 1 104 511 | 357 349 |
| komus.ru | 882 025 | 109 322 |
| inmyroom.ru | 450 783 | 14 514 |
| divan.ru | 257 021 | 28 493 |
| mebelion.ru | 220 502 | 3 748 |
| bestmebelshop.ru | 138 837 | 21 648 |
| stolplit.ru | 113 068 | 2 508 |
| pm.ru | 70 980 | 3 500 |
| express-office.ru | 42 103 | 3 906 |
| vsestulya.ru | 37 980 | 424 |
| stoolgroup.ru | 24 822 | 1 949 |
| zamm.ru | 14 676 | 3 016 |
| nice-office.ru | 14 272 | 163 |
| ergotronica.ru | 12 825 | 182 |
| meb-biz.ru | 10 822 | 134 |
| prime-wood.ru | 9 820 | 525 |
| dobriy-office.ru | 9 091 | 527 |
| defo.ru | 8 421 | 270 |
| office-plus.ru | 7 905 | 217 |
| orgmebel.ru | 6 894 | 20 |
| mavikom.ru | 6 598 | 392 |
| roskresla.ru | 5 832 | 401 |
| unitex.ru | 5 454 | 168 |
| mebelstyle.ru | 5 148 | 185 |
| lime-office.ru | 4 726 | 28 |
| felix.ru | 4 688 | 617 |
| office-mebel.ru | 4 667 | 28 |
| mebelux.ru | 4 016 | 103 |
| eco-office.ru | 3 934 | 180 |
| slavstol.ru | 3 112 | 30 |
| ot-mebel.ru | 2 645 | 19 |
| fdmebel.ru | 2 602 | 313 |
| ofimall.ru | 2 562 | 11 |
| everprof.ru | 1 626 | 18 |
| directoria-moder.ru | 793 | 42 |
| pioner.ru | 596 | 3 |
| riva.ru | 326 | 77 |
| alsav.ru | 257 | 8 |
| kanorussia.ru | 33 | 0 |

---

**Связанные файлы:** `gg-seo-geo-monster/data/gentero-web-recon.json` (карточки ZAMM и KANO с разбором отзывов), `.claude/skills/competitor-intel/SKILL.md`.
