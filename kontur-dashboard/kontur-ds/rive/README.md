# Анимации Rive в пакете Контур DS 1.4

Где что лежит в пакете: исходники `rive/sync/`, `rive/success/`, `rive/empty/` (по `rive.yaml` и `scene.rml`),
собранные файлы `rive/*.riv`, для страницы `kit/motion.riv.js` (base64, `window.KS_RIVE_FILES`),
генератор исходников `rive/gen.py`. Пересборка: `rive rive/sync --once` (и так же success, empty),
скопировать `build/*.riv` в `rive/`, затем `node rive/bundle.mjs`.

Подключение на странице: `kit/motion.riv.js` после `kit.js`, затем `KS.rive.enable()`. Рантайм
`@rive-app/canvas-single@2.43.0` грузится с cdn.jsdelivr.net один раз и только если вызван `enable`
(около 2,8 МБ, WASM внутри JS). Без него, без сети, при запрете WASM и при «меньше движения»
работают родные анимации кита на SVG и CSS, внешне те же.

Лицензия. Рантаймы Rive под MIT. Файлы собраны локальной сборкой CLI (`--once`), без входа в аккаунт.
Для официального выпуска в продукт Rive указывает тариф Cadet (от 9 долларов за место в месяц): с ним
проект привязывается к файлу в аккаунте, и сборка идёт без водяного знака. Перед выпуском наружу
это стоит оформить; для внутреннего дашборда и прототипа достаточно локальной сборки.

Ниже исходный отчёт сборки (пути в нём от рабочей папки, где анимации делались).

---

# Kontur motion: три анимации Rive для Контур DS

Три маленькие анимации для рабочих дашбордов: индикатор синхронизации `sync`, подтверждение действия `success` и пустое состояние графика `empty`. Собраны официальным Rive CLI 1.1.1 из исходников RML, без скриптов Luau, без входа в аккаунт Rive. Проверены в веб-рантайме `@rive-app/canvas-single` 2.43.0.

Стиль: контурные линии, круглые концы и стыки, штрих 1,7 в сетке 20 (пропорционально размеру), только плавные кривые из токенов Контур DS 1.3 без перелёта, длительности 200-600 мс, фон артборда прозрачный. Все цвета приходят из View Model, тему меняет JS.

## Что в папке

```
kontur-motion/
  sync.riv  success.riv  empty.riv   собранные файлы для рантайма
  kontur-motion.riv.js               window.KS_RIVE_FILES = { sync, success, empty } в base64
  example.html                       рабочий пример с кнопками состояний, play и темой
  sync/     rive.yaml, scene.rml     исходник артборда sync (build/ - вывод CLI)
  success/  rive.yaml, scene.rml     исходник артборда success
  empty/    rive.yaml, scene.rml     исходник артборда empty
  tools/gen.py                       генератор scene.rml (условия переходов и ключи прорисовки)
  tools/bundle.mjs                   пересборка kontur-motion.riv.js из трёх .riv
  tools/filmstrip.mjs                покадровая раскадровка в веб-рантайме (шаг 1/60 с)
  tools/webtest-kontur.mjs           тест контракта через обычный API рантайма
  tools/plans/*.json                 сценарии раскадровок
  tools/webtest-output*.txt          журналы последнего прогона теста
  shots/                             скриншоты проверки
```

Три отдельных проекта, по одному артборду в каждом файле: у каждого файла свой артборд по умолчанию, и JS не нужно указывать `artboard`.

## Контракт для JS

| Файл | Артборд | State machine | View Model | Свойства (тип, по умолчанию) |
|---|---|---|---|---|
| `sync.riv` | `sync` | `sync` | `Sync` | `state`: number = 0; `ink`, `muted`, `accent`, `ok`, `crit`: color |
| `success.riv` | `success` | `success` | `Success` | `play`: trigger; `ink`, `muted`, `accent`, `ok`, `crit`: color |
| `empty.riv` | `empty` | `empty` | `Empty` | `play`: trigger; `ink`, `muted`, `accent`, `ok`, `crit`: color |

Входов state machine (устаревших `StateMachineNumber` / `StateMachineTrigger`) нет: `r.stateMachineInputs('sync')` возвращает пустой список. Всё управление идёт через View Model, это проверено в рантайме.

Цвета по умолчанию (светлая тема, ARGB): `ink` FF16191E, `muted` FF5A616C, `accent` FF3561C9, `ok` FF0D7049, `crit` FFB3261E. Тёмная тема: E9EBEF, 989FAA, 5D8AFF, 37D39B, FF6B6B.

`sync.state`: 0 idle, 1 loading, 2 done, 3 error. Передавать целые числа. Значения меньше 0 работают как idle, больше 3 как error.

```html
<script src="rive.js"></script>                  <!-- @rive-app/canvas-single 2.43, window.rive -->
<script src="kontur-motion.riv.js"></script>     <!-- window.KS_RIVE_FILES -->
<script>
const KS_THEME = {
  light: { ink: '16191E', muted: '5A616C', accent: '3561C9', ok: '0D7049', crit: 'B3261E' },
  dark:  { ink: 'E9EBEF', muted: '989FAA', accent: '5D8AFF', ok: '37D39B', crit: 'FF6B6B' },
};
function ksBuffer(b64) {
  const s = atob(b64), u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u.buffer;
}
function ksTheme(r, theme) {                       // только после onLoad
  const vmi = r.viewModelInstance;
  for (const [name, hex] of Object.entries(KS_THEME[theme])) {
    const n = parseInt(hex, 16);
    vmi.color(name).argb(255, (n >> 16) & 255, (n >> 8) & 255, n & 255);
  }
}
function ksMount(canvas, name, theme, onReady) {  // name: 'sync' | 'success' | 'empty'
  const r = new rive.Rive({
    canvas,
    buffer: ksBuffer(KS_RIVE_FILES[name]),
    stateMachine: name,                            // имя state machine совпадает с именем артборда
    autoplay: true,
    autoBind: true,
    layout: new rive.Layout({ fit: rive.Fit.Contain, alignment: rive.Alignment.Center }),
    onLoad() {
      r.resizeDrawingSurfaceToCanvas();
      ksTheme(r, theme);                           // onLoad идёт до первого кадра: вспышки светлой темы нет
      if (onReady) onReady(r);
    },
  });
  return r;
}

// <canvas id="sync" style="width:24px;height:24px">, success 48x48, empty 160x96
const sync = ksMount(document.getElementById('sync'), 'sync', 'dark');
const success = ksMount(document.getElementById('success'), 'success', 'dark');
const empty = ksMount(document.getElementById('empty'), 'empty', 'dark');

// позже, после onLoad:
sync.viewModelInstance.number('state').value = 1;       // loading; 2 done, 3 error, 0 idle
success.viewModelInstance.trigger('play').trigger();    // перезапуск
empty.viewModelInstance.trigger('play').trigger();
[sync, success, empty].forEach((r) => ksTheme(r, 'light'));   // смена темы на лету
</script>
```

Заметки:

- `r.viewModelInstance` равен `null` до `onLoad`. Всё, что меняет состояние или цвет, делать после него (или в `onReady`).
- Параметр `stateMachine` (единственное число). Множественный `stateMachines` в 2.43 работает, но пишет предупреждение об устаревании.
- Цвет можно ставить и так: `vmi.color('accent').value = 0xFF5D8AFF` (проверено, читается обратно `ff5d8aff`). `argb()` надёжнее, когда цвет собирается из строки.
- Смена темы применяется и к уже остановившейся анимации (проверено в `example.html`, снимки 07-09).
- При изменении размера окна или масштаба экрана вызвать `r.resizeDrawingSurfaceToCanvas()`.
- Рантайм держит цикл кадров, пока state machine активна, но не перерисовывает кадр без изменений. Непрерывно анимируется только `sync` в состоянии 1.
- Для другого размера достаточно CSS-размера холста: `Fit.Contain` масштабирует артборд вместе со штрихом (на 16 px штрих `sync` будет 1,36).

## Как устроен каждый артборд

Кривые (все контрольные точки в пределах 0..1, перелёта нет):

| Имя | cubic-bezier | Где |
|---|---|---|
| ease-out Контура (`--ease-out`) | .2, .8, .2, 1 | появление: прозрачность, масштаб, вход дуги |
| ease-in Контура (`--ease-in`) | .4, 0, 1, 1 | уход: гашение групп и дуги |
| std Контура (`--ease-std`) | .4, 0, .2, 1 | смена на месте: кольцо idle <-> трек |
| прорисовка | 0, 0, .58, 1 | обрезка штриха (TrimPath) у кругов, галочек, линии графика |
| «поздно» | 1, 0, 1, 0 | только прячет нижнее кольцо, когда оно уже закрыто верхним |

### sync, 24x24

Геометрия от центра (12, 12): кольцо диаметром 18 (r 9), штрих 2,04 = 1,7 x 24 / 20, круглые концы и стыки. Галочка (-3,3; 0) -> (-1,1; 2,2) -> (3,3; -2,2). Восклицательный знак: линия (0; -4,6) -> (0; 0,4) и точка диаметром 2,3 в (0; 4,1). Обрезка кругов начинается на 12 часах и идёт по часовой.

Привязка цветов: кольцо покоя `muted`, дуга `accent`, кольцо и галочка готовности `ok`, кольцо, линия и точка ошибки `crit`. `ink` в этом файле не используется.

State machine `sync` из пяти слоёв, каждый читает `state` через условие View Model:

| Слой | Состояния | Что делает |
|---|---|---|
| `ring` | idle, track, off | кольцо `muted`: 1 в покое, 0,22 как трек под дугой, 0 в done/error (прячется, когда сверху уже непрозрачное кольцо) |
| `arc` | hidden, loading, close | дуга 108° (0,3 окружности): появляется с ростом за 200 мс, в done замыкается в круг за 250 мс, при уходе втягивается и гаснет за 200 мс |
| `spin` | still, spin | вращение дуги 900 мс на оборот, линейно, цикл. Единственный цикл в наборе. При выходе из loading крутится ещё 300 мс, пока дуга гаснет или замыкается, и останавливается уже незаметно |
| `done` | hidden, hidden (loading), done after loading, done direct | кольцо `ok` и галочка |
| `error` | hidden, error | кольцо `crit`, линия и точка |

Тайминги:

- idle -> loading: трек 200 мс, дуга растёт и проявляется 200 мс, вращение сразу.
- loading -> done: дуга замыкается 0-250 мс, поверх проявляется кольцо `ok` 200-350 мс, галочка рисуется 230-460 мс. Итого 460 мс, дальше покой.
- idle или error -> done: кольцо `ok` 0-220 мс, галочка 150-420 мс.
- любое -> error: кольцо `crit` 0-200 мс, линия знака рисуется 150-330 мс, точка проявляется 300-400 мс. Итого 400 мс.
- уход из done/error: гашение 200 мс (ease-in). Возврат в idle: кольцо `muted` уже лежит под гаснущим кольцом, провала яркости нет.

Проверены все 12 переходов между четырьмя состояниями и крайние значения (-1, 4, 7).

### success, 48x48

Круг диаметром 36, штрих 4,08 = 1,7 x 48 / 20. Галочка (-6,6; 0) -> (-2,2; 4,4) -> (6,6; -4,4) от центра. Оба элемента `ok`.

State machine `success`, один слой `main`:

- `draw` (запускается сам при старте): круг прорисовывается с 12 часов 0-350 мс, вся метка масштабируется 0,96 -> 1,0 за те же 350 мс (ease-out, без перелёта), галочка рисуется 230-480 мс. Итого 480 мс, дальше покой.
- `play` (trigger View Model) из любого момента: метка гаснет за 150 мс (ease-in), затем `draw` с начала.

«Со сдвигом 120 мс» понято так: галочка стартует за 120 мс до того, как круг замкнулся, чтобы движение читалось одним жестом и укладывалось в 600 мс. Если нужен старт через 120 мс после замыкания, это одна константа в `tools/gen.py` (`f(230)` -> `f(470)`), но итог станет 720 мс.

### empty, 160x96

- Сетка: две линии y 24,5 и 48,5, штрих 1, `muted` с непрозрачностью 0,22. Ось: y 72,5, штрих 1,2, `muted` 0,55. По x от 12 до 148. Координаты на .5, чтобы тонкие линии были чёткими на 1x и 2x.
- Линия графика `accent`, штрих 1,7: левая часть (20; 58) (36; 47) (50; 52) (64; 39), правая (96; 45) (110; 35) (124; 40) (138; 27).
- Разрыв между (64; 39) и (96; 45) показан пунктиром `muted` (штрих 2,2, пробел 3,8, круглые концы) с отступом 4 px от обоих концов сплошной линии: разрыв виден, а не заштопан.
- Точка на конце: диаметр 5, `accent`.

State machine `empty`, один слой `main`:

- `draw` (при старте): перо идёт слева направо 0-560 мс с постоянной скоростью по всему маршруту (левая часть, пунктир, правая часть) и одной кривой ease-out на весь путь. Части это отдельные фигуры, поэтому кривая разложена на линейные ключи через каждые 2 кадра. Точка проявляется 470-600 мс (0,5 -> 1 по масштабу). Сетка и ось не анимируются. Дальше покой, цикла нет.
- `play`: линия гаснет за 150 мс, затем прорисовка с начала.

## Размеры

| Файл | Байт | gzip |
|---|---|---|
| `sync.riv` | 3 246 | 1 154 |
| `success.riv` | 857 | 591 |
| `empty.riv` | 1 721 | 968 |
| `kontur-motion.riv.js` (все три в base64) | 7 906 | 3 093 |

Рантайм `@rive-app/canvas-single` в этот объём не входит.

## Как проверено

1. После каждой правки `rive <proj> --verify` (0 ошибок, 0 предупреждений у всех трёх) и `rive inspect <proj> --summary` (`problems: []`, объектов 367 / 62 / 133). Отдельно запросом `jq` проверено, что у каждого cubic-ключа есть кривая.
2. Сборка `rive <proj> --once`.
3. `rive <proj> --screenshot=... --advance=...` запускался на начале, середине и конце каждого артборда (`shots/cli/`). В этой песочнице снимки CLI пустые: headless-рендер CLI идёт через EGL на Mesa llvmpipe 25.2.8, и его шейдеры не линкуются (`GLSL shader program failed to link: linking with uncompiled/unspecialized shader`). Пусто даже у стандартного примера CLI, на картинке только фон просмотрщика 1D1D1D. С `GALLIUM_DRIVER=softpipe` получается мусор. Это ограничение окружения, а не файлов, поэтому картинку проверял в веб-рантайме:
   - `tools/filmstrip.mjs`: низкоуровневый API того же рантайма, state machine продвигается ровными шагами 1/60 с (аналог `--advance`), кадры в заданные миллисекунды, увеличение x2-x8. Сценарии в `tools/plans/`, результат `shots/film_*.png`: поток idle -> loading -> done, все остальные переходы в светлой и тёмной теме, крайние значения `state`, `success` и `empty` с повтором `play` в обеих темах.
   - `tools/webtest-kontur.mjs`: обычный API, как на дашборде (`buffer`, `stateMachine`, `autoBind: true`), светлая тема и тёмная на фоне #171A1F, `sync` 0 -> 1 -> 2 и 0 -> 1 -> 3, `play` у `success` и `empty`, снимки при DPR 2 и 1 (`shots/web/01-06_*`). Потом прогон всех 12 переходов `sync` с журналом вошедших состояний и чтение значений обратно (`tools/webtest-output.txt`).
   - `example.html`: код контракта из этого README, смена темы light -> dark -> light на живых и остановившихся анимациях (`shots/web/07-09`).

Запуск проверок:

```bash
export PATH="$HOME/.rive/bin:$PATH"
cd /home/claude/rive-lab/kontur-motion
python3 tools/gen.py                        # пересобрать scene.rml
for p in sync success empty; do rive $p --verify; rive inspect $p --summary; rive $p --once; done
cp sync/build/sync.riv success/build/success.riv empty/build/empty.riv .
cd /home/claude/rive-lab
node kontur-motion/tools/filmstrip.mjs kontur-motion/tools/plans/sync_flow.json kontur-motion/shots/film_sync_flow.png
DPR=2 node kontur-motion/tools/webtest-kontur.mjs
```

После пересборки `.riv` заново собрать `kontur-motion.riv.js`: `node kontur-motion/tools/bundle.mjs`.

## Известные ограничения

- Снимки CLI в этой песочнице пустые (причина выше). На машине с рабочим GPU или EGL команда `rive <proj> --screenshot` должна давать нормальную картинку, но здесь это не проверено.
- `.rev` для редактора Rive не собирался: `--rev` требует входа в аккаунт, а входить было нельзя. Исходник для правок это `scene.rml` (и генератор `tools/gen.py`).
- `ink` объявлен во всех трёх View Model, чтобы тема ставилась одним кодом, но ни к одной фигуре не привязан.
- Режима «меньше движения» внутри файлов нет. Рекомендация: при `prefers-reduced-motion: reduce` не монтировать Rive, а показывать статичные иконки Контура (`check`, `warn`) и статичную картинку пустого состояния.
- Прямой переход done <-> error (без loading) делается перекрёстным гашением: около 150 мс старый знак ещё виден, пока рисуется новый. Мигания нет, но это не отдельная хореография.
- Дробные значения `state` между 0 и 3 не определены, передавать целые.
- `tools/gen.py` перезаписывает `scene.rml` целиком. CLI при сборке дописывает `id` элементам без него, это нормально.
