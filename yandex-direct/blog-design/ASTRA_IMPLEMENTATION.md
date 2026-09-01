# Как макет ложится на WordPress + Astra

Макет: `article-template.html`. Кнопка «Разметка Astra» в правом нижнем углу
подсвечивает блоки и подписывает, во что каждый превращается в WordPress.

Принцип: Astra отвечает за каркас, шапку, подвал, сайдбар и адаптив. Дочерняя тема
отвечает за типографику, линейки и три-четыре собственных блока. Ни одного
конструктора страниц (Elementor и подобные) в шаблоне статьи: они ломают
типографическую сетку и добавляют 300-500 КБ на каждую страницу.

---

## 1. Настройки Astra без кода

Внешний вид → Настроить:

| Раздел | Значение | Почему |
|---|---|---|
| Global → Container → Layout | Content Boxed | «полоса» на фоне, как в макете |
| Global → Container → Width | 1180 | совпадает с лендингом |
| Global → Colors | текст `#16181A`, фон сайта `#DCDCD5`, фон контейнера `#E6E6E1`, ссылка `#16181A`, ховер `#27479A` | токены из лендинга |
| Global → Typography → Body | Alegreya Sans, 400, 18px, 1.62 | |
| Global → Typography → H1-H3 | Alegreya, 800 | |
| Sidebars → Default Layout | No Sidebar | лендинг и служебные страницы без колонки |
| Sidebars → Single Post | Right Sidebar | сайдбар только у статей и рубрик |
| Sidebars → Archive | Right Sidebar | |
| Sidebars → Width | 26% | даёт около 300px при контейнере 1180 |
| Blog → Single Post → Structure | снять «Title», «Meta» | шапку статьи рисуем свою, с номером выпуска |
| Blog → Blog Archive → Structure | снять всё лишнее | список выпусков собираем шаблоном |

Дальше вся визуальная часть идёт из дочерней темы.

---

## 2. Файлы дочерней темы

```
wp-content/themes/astra-child/
├── style.css                     заголовок темы, импорт токенов
├── functions.php                 подключение стилей, хуки, шорткоды, виджет-зона
├── assets/
│   ├── css/blog.css              всё оформление из макета
│   ├── fonts/                    woff2 локально, подмножество кириллицы
│   └── js/blog.js                оглавление, цели Метрики
├── single.php                    шаблон статьи
├── archive.php                   шаблон рубрики
└── template-parts/
    ├── masthead.php
    ├── article-header.php
    ├── coupon.php                конвертор 2
    ├── tg-inline.php             конвертор 1, врезка в тексте
    └── sidebar-blog.php
```

### style.css

```css
/*
Theme Name: Astra Child - Деньги в Директе
Template: astra
Version: 1.0
*/
```

### functions.php

```php
<?php
add_action( 'wp_enqueue_scripts', function () {
    wp_enqueue_style( 'astra-child', get_stylesheet_uri(), [ 'astra-theme-css' ], '1.0' );
    wp_enqueue_style(
        'blog-design',
        get_stylesheet_directory_uri() . '/assets/css/blog.css',
        [ 'astra-child' ],
        filemtime( get_stylesheet_directory() . '/assets/css/blog.css' )
    );
    wp_enqueue_script(
        'blog-design',
        get_stylesheet_directory_uri() . '/assets/js/blog.js',
        [], '1.0', true
    );
}, 20 );

// Своя виджет-зона вместо Main Sidebar: состав колонки фиксирован и не зависит
// от того, что кто-то перетащил в стандартный сайдбар.
add_action( 'widgets_init', function () {
    register_sidebar( [
        'name'          => 'Колонка блога',
        'id'            => 'blog-sidebar',
        'before_widget' => '<div class="side-block %2$s">',
        'after_widget'  => '</div>',
        'before_title'  => '<div class="side-h">',
        'after_title'   => '</div>',
    ] );
} );

// Мастхед издания над контентом
add_action( 'astra_content_before', function () {
    if ( is_singular( 'post' ) || is_category() || is_home() ) {
        get_template_part( 'template-parts/masthead' );
    }
} );

// Мобильная полоса с Telegram
add_action( 'wp_footer', function () {
    if ( is_singular( 'post' ) || is_category() ) {
        echo '<div class="mbar"><div class="t">Разбор чужого кабинета<br>каждый вторник</div>'
           . '<a href="' . esc_url( get_option( 'blog_tg_url' ) ) . '" data-goal="tg_sub_mobile">Подписаться</a></div>';
    }
} );
```

Полезные хуки Astra, если не хочется трогать `single.php`:
`astra_content_before`, `astra_entry_content_before`, `astra_entry_content_after`,
`astra_entry_after`, `astra_sidebars_before`, `astra_footer_before`.
Проверить их наличие в конкретной версии темы можно через `Astra → Hooks`
в документации или плагином, показывающим точки вставки.

---

## 3. Блоки макета и их источник в WordPress

| Блок макета | Реализация |
|---|---|
| Мастхед издания | `template-parts/masthead.php`, номер выпуска и дата из полей записи |
| Меню рубрик | обычное меню WordPress, класс `topnav`, текущая рубрика получает `.here` |
| Кикер статьи | `template-parts/article-header.php`: рубрика, `issue_number`, дата, время чтения |
| Номер выпуска | поле ACF `issue_number`, либо счётчик по дате публикации |
| Время чтения | считается по `str_word_count` от `the_content`, 180 слов в минуту |
| H1 и лид | заголовок записи и `the_excerpt` |
| Оглавление | собирается в `blog.js` по всем `h2[id]` внутри `.body`, вставляется перед первым абзацем |
| Реплика на полях | шорткод `[note]` и `[note warm]` |
| Таблица диагностики | синхронизированный паттерн Gutenberg «Таблица разрывов» |
| Блок самопроверки | синхронизированный паттерн «Проверьте у себя» |
| Врезка Telegram | `template-parts/tg-inline.php`, вставляется фильтром или паттерном |
| Купон | `template-parts/coupon.php` через `astra_entry_content_after` |
| FAQ | блок «Подробности» (details) в редакторе, разметка через SEO-плагин |
| Из этой рубрики | `WP_Query` по той же рубрике, три записи, исключая текущую |
| Сайдбар | виджет-зона `blog-sidebar` плюс `template-parts/sidebar-blog.php` для хвоста |
| Хвост колонки | выводится после виджетов, `margin-top:auto` и `position:sticky` |

### Шорткод реплики на полях

```php
add_shortcode( 'note', function ( $atts, $content = '' ) {
    $warm = isset( $atts[0] ) && 'warm' === $atts[0] ? ' warm' : '';
    return '<div class="note' . $warm . '">' . wp_kses_post( $content ) . '</div>';
} );
```

В редакторе: `[note]«ну сейчас скажет, что нужен аудит за 50 тысяч»[/note]`

### Врезка Telegram: одна на статью, автоматически

```php
add_filter( 'the_content', function ( $content ) {
    if ( ! is_singular( 'post' ) || ! in_the_loop() || ! is_main_query() ) {
        return $content;
    }
    // Ручная вставка приоритетнее: если автор поставил паттерн сам, не дублируем.
    if ( false !== strpos( $content, 'tg-inline' ) ) {
        return $content;
    }
    $parts = explode( '</p>', $content );
    $total = count( $parts );
    if ( $total < 6 ) {
        return $content;
    }
    $at = (int) floor( $total * 0.65 );

    ob_start();
    get_template_part( 'template-parts/tg-inline' );
    $block = ob_get_clean();

    array_splice( $parts, $at, 0, [ $block ] );
    return implode( '</p>', $parts );
}, 20 );
```

Проверка на `tg-inline` в тексте нужна, чтобы конвертор остался ровно один:
это главное правило концепции, и его легко случайно нарушить.

---

## 4. Шрифты

Четыре гарнитуры это много, поэтому только локально и только нужные начертания:

| Гарнитура | Начертания | Где |
|---|---|---|
| Alegreya | 800, 700, 700 italic | заголовки |
| Alegreya Sans | 400, 700 | текст и интерфейс |
| JetBrains Mono | 500 | цифры и метки |
| Caveat | 500, 700 | реплики на полях |

```css
@font-face {
  font-family: 'Alegreya';
  src: url('../fonts/alegreya-800-cyrillic.woff2') format('woff2');
  font-weight: 800;
  font-display: swap;
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}
```

Подмножество только кириллицы и базовой латиницы сокращает каждый файл в разы.
В Astra отключить Google Fonts (Global → Typography → Google Fonts → Off),
иначе тема подтянет их вторым запросом.

Caveat нужен исключительно для реплик на полях. Если бюджет на вес страницы
жёсткий, её можно грузить отложенно: без неё реплика деградирует в наклонный
курсив и страница не разваливается.

---

## 5. SEO и разметка

| Что | Как |
|---|---|
| Article / BlogPosting | Yoast или Rank Math, автоматически |
| BreadcrumbList | хлебные крошки плагина, выводить над кикером |
| FAQPage | блок FAQ плагина, либо ручной JSON-LD из блока «Короткие ответы» |
| Person / автор | страница «Об авторе» плюс `author` в разметке статьи |
| Оглавление | якоря `h2[id]` дают шанс на быстрые ссылки в выдаче |
| Перелинковка | блок «Из этой рубрики» плюс ручные ссылки внутри текста на опорную статью кластера |
| Канонические адреса | `/blog/<рубрика>/<слаг>/`, рубрика в адресе, потому что рубрика это кластер |
| Скорость | Astra без конструктора, критический CSS в `<head>`, картинки в webp, ленивые ниже первого экрана |

Лид под H1 в 2-3 предложениях написан так, чтобы его можно было целиком забрать
в ответ поисковика или AI-выдачи. Это же требование к первому абзацу каждого
раздела H2.

---

## 6. Цели Метрики

Все кнопки в макете уже размечены атрибутом `data-goal`. Один обработчик:

```js
document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-goal]');
  if (!el) return;
  if (typeof ym === 'function') {
    ym(window.YM_ID, 'reachGoal', el.dataset.goal);
  }
});
```

Цели: `tg_sub_side`, `tg_sub_inline`, `tg_sub_tail`, `tg_sub_mobile`, `lead_audit`.
Разделение по плейсменту обязательно, иначе непонятно, какая из трёх точек
подписки работает, а какую можно убрать.

Купон отправляется на тот же приёмник, что и форма лендинга. В макете отправка
заглушена: `onsubmit="return false;"`, точку приёма нужно подставить.

---

## 7. Чек-лист запуска

- [ ] Дочерняя тема активирована, стили грузятся после `astra-theme-css`
- [ ] Контейнер 1180, сайдбар справа только у статей и рубрик
- [ ] Заголовок и мета записи в Astra отключены, шапку рисует шаблон
- [ ] Шрифты локальные, Google Fonts у Astra выключены
- [ ] Виджет-зона «Колонка блога» заполнена: Telegram, рубрики, последние выпуски, автор
- [ ] Врезка Telegram выводится ровно один раз (проверить на статье с ручным паттерном)
- [ ] Купон один и только после текста
- [ ] Ни одного поп-апа и exit-intent на сайте
- [ ] Пять целей заведены в Метрике и срабатывают
- [ ] Купон уходит в приёмник заявок, письмо доходит и не падает в спам
- [ ] Восемь рубрик созданы, у каждой есть описание для страницы рубрики
- [ ] Цифры-заглушки заменены: счётчики рубрик, число подписчиков, номер выпуска
- [ ] Проверено на 375px: сайдбар под статьёй, нижняя полоса не перекрывает купон
- [ ] Клавиатурная навигация: фокус виден на всех ссылках, кнопках и полях
