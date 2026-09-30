# GENGROUP - Переезд на VPS - v2

- **Дата:** 2026-09-30
- **Прошлая сессия:** https://claude.ai/code/session_01H91198tXr5pT5C2Jtu7VmB
- **Прошлый handoff:** `sessions/handoff/2026-09-29-gengroup-vps-perenos-v1.md` (в ветке `claude/friendly-brahmagupta-me4gk0`)
- **Ветка:** `claude/trusting-carson-uvgcft` (PR oliverjone01-dev/t1#435, журнал и handoff). Код контура в `claude/friendly-brahmagupta-me4gk0` (PR oliverjone01-dev/t1#423).

## 1. Цель
Все дашборды, сборы данных и расписания переезжают с GitHub Actions/Pages на свой сервер в РФ без потери
функционала, потом переходят на новый дизайн (Контур DS 1.5: `kontur-ds/`, демо `analytics-mvp/platform/`).
Готово: 4 волны из `infra/vps/INVENTORY.md` (ветка #423) переключены, Pages выключен, репозиторий закрыт.

## 2. Сделано (30.09)
- Сервер Timeweb Cloud, Москва: 4 vCPU / 8 ГБ / 80 ГБ NVMe, Ubuntu 24.04.5, hostname `gg-dash`,
  2 000 ₽/мес (1 800 конфиг + 200 IPv4, бэкапы Timeweb выключены). IP знает ЯДИ; в репозиторий не пишем, пока он публичный.
- `bootstrap.sh` прошёл целиком (через HTTPS-клон, см. Решения). `gg-poll.timer` работает, релизы
  контура (fab715a6dd0f), `rop-dashboard-v1`, `office-dashboard-v1` собраны, сайт собран ok=3 failed=0,
  данные засеяны из git (70 МБ).
- Домен **dash.genglas.ru** (одна «s»! genglas.ru, не genglass) A → IP сервера, AAAA и CAA пусты.
  Сертификат Let's Encrypt до 2026-12-29, автопродление certbot, почта marketing.yanchoglov@gmail.com.
- nginx: на сервере РУКАМИ исправлен `/etc/nginx/sites-available/gg.conf` (http2 в listen, sub_filter_types
  без text/html). Проверено с сервера: `/healthz` 200, `/rop/` без пароля 401. Логин `yanchoglov` создан,
  `/rop/` открывается в браузере с сервера.
- PR #435: удалены `export-contacts.yml` и `export-leads.yml` (коммитили xlsx с контактами в публичную ветку),
  область «Переезд VPS» в `knowledge/sessions/INDEX.md`, журнал `knowledge/sessions/vps.md` (вехи, риски, правило работы).
- Исправления для ветки #423 готовы и проверены, но НЕ запушены (нет разрешения ЯДИ пушить в чужую ветку):
  `sessions/handoff/2026-09-30-vps-pr423-patches/` - 3 патча поверх слияния main в #423:
  0001 infra-check pipefail+concurrency (гигиена К12); 0002 `cd /` в bin/* и bootstrap + шаг 8 smoke
  (setpriv снимает DAC у root); 0003 nginx 1.24 `http2` в listen, `nginx_reload` в bootstrap падает на ошибке.
  Проверено: smoke-local ВСЁ ЗЕЛЁНОЕ, без 0002 шаг 8 падает той же ошибкой, что на сервере; shellcheck 0.11 чисто;
  nginx 1.24.0 локально: nginx -t ok, 401/200/healthz 200/.gg 403/подмена github.io/HTTP2.

## 3. Решения и почему
- ЯДИ: «сначала переезд, потом всё закрываем, никак иначе». Закрытие репо, выключение Pages, GitHub Pro - после переезда (фаза 4). Фаза 0 «закрыть в день 1» из README #423 отменена.
- ЯДИ: «я ни разу не работал с серверами - все вопросы ты должен предвидеть»: безопасность, нагрузку, оптимизацию, надёжность поднимать самому, с готовыми командами и «почему». Команды давать целиком, копипастой, без плейсхолдеров в угловых скобках (ЯДИ вставил `<почта>` буквально).
- Claude: переезд и редизайн по очереди. Сначала дашборд 1:1 + сверка с GitHub, потом Контур DS (иначе расхождение не приписать одной причине, К5/К9).
- Claude: репозиторий читается сервером по HTTPS без ключа, пока публичный. Deploy key `GG_DASH_TIMWEB` (`ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFv60yLpvOYn0gkZh7W8PF3JFtKBPb84UNzVW6WycsDy gg-vps-gg-dash`) создан на сервере, в GitHub НЕ добавлен: Deploy keys отдаёт ЯДИ 404, владелец аккаунт `oliverjone01-dev`.
- Claude: логины по фамилии латиницей, один человек = один логин, общих нет.
- Сотрудникам ссылку dash.genglas.ru не давать, пока сервер не собирает данные сам и не прошёл сверку 3-5 дней: сейчас данные /rop/ заморожены на засеве ~09:00 UTC 30.09.

## 4. Факты и цифры
- С сервера: `api.anthropic.com` 403, `github.com` 200 - замер 30.09 [ДАННЫЕ]. Claude на сервере в РФ не работает.
- gg-status 30.09 09:02 UTC: диск 12% (8.6 из 77 ГБ), git 669 МБ, src 499 МБ, cache 765 МБ, data 70 МБ [ДАННЫЕ].
- nginx на Ubuntu 24.04 = 1.24.0, `http2 on;` не знает [ДАННЫЕ, воспроизведено].
- Баланс Timeweb 3 000 ₽ при 2 000 ₽/мес почасово - хватит примерно до середины ноября [расчёт].
- Пилот `rop-snapshot` (fetch-rop.ts) вызывает только: crm.activity.list, crm.deal.fields/list, crm.dealcategory.list, crm.item.list, crm.item.productrow.list, crm.lead.fields/list, crm.stagehistory.list, crm.status.list, crm.timeline.comment.list, user.get [ДАННЫЕ, grep ветки rop-dashboard-v1]. Скоупы вебхука: `crm`, `user`.

## 5. Карта файлов
- `knowledge/sessions/vps.md` - журнал области: вехи, риски, правило работы с ЯДИ.
- `knowledge/semantic/data-privacy-migration.md` - порядок по ПД (сначала сервер, потом Pages, потом приватность).
- Ветка #423 `infra/vps/`: README (фазы), INVENTORY (волны), `conf/secrets.env.example` (имена секретов), `bootstrap.sh`, `bin/gg-*`, `jobs/rop-snapshot.sh`, `nginx/gg.conf.template`, `test/smoke-local.sh`.
- `sessions/handoff/2026-09-30-vps-pr423-patches/` - неотправленные исправления #423.

## 6. Грабли
- Команды контура от gg запускать из `/`: `cd / && sudo -u gg gg-status`, пока патч 0002 не на сервере (иначе find из /root → код 1).
- Повторный `bootstrap.sh` без патча 0003 снова сломает nginx (перезапишет ручную правку). Запускать с `REPO=https://github.com/oliverjone01-dev/t1.git OPS_BRANCH=claude/friendly-brahmagupta-me4gk0 DOMAIN=dash.genglas.ru LE_EMAIL=marketing.yanchoglov@gmail.com`.
- Слияние main в #423 конфликтует только в `traces/2026-09-29/agents.jsonl`: объединение строк по ts без потерь (123 + 53 → 134).
- smoke-local требует локальные ветки `rop-dashboard-v1`, `office-dashboard-v1`; в git worktree не работает (alternates), нужен обычный клон.
- Хук subagent_stop пишет строку в `traces/<дата>/agents.jsonl` почти каждый ход; копить и коммитить пачкой.
- Контейнер Claude: dns.google/cloudflare-dns закрыты, резолв через getent работает; shellcheck ставится `pip install shellcheck-py`; nginx 1.24 ставится apt после `apt-get update`.
- fail2ban банит после нескольких неверных паролей (nginx-http-auth).

## 7. Открыто
- ЯДИ: разрешение пушить в ветку #423 (слияние main + 3 патча). #423 конфликтует с main, CI не перезапускался.
- ЯДИ: вебхук Bitrix24 для сервера, бот алертов + чат, S3-бакет, копия SSH-ключа, 2FA в Timeweb.
- Владелец `oliverjone01-dev`: deploy key в GitHub (обязательно до закрытия репо), 2FA.
- Иван: ИИ-задачи (ai-rop-nightly, sales-audit) - Anthropic недоступен из РФ; обход через GitHub Actions/зарубежный сервер упирается в условия Anthropic; вариант В - российская модель. Плюс 152-ФЗ с юристом.
- #435 ждёт merge (CI зелёный).

## 8. Следующий шаг
Ответить ЯДИ на вопрос «как мне на сервер перенести все секреты, чтобы оттуда шли доступы, с чего начать».
Суть ответа: из GitHub Secrets значения прочитать нельзя, ключи выпускаются заново в первоисточнике и
вносятся только в `/etc/gg/secrets.env` через nano по SSH, по волнам, а не все сразу. Начать с пилота:
(1) бот алертов (BotFather) + ID чата → `GG_ALERT_BOT_TOKEN`, `GG_ALERT_CHAT_ID`; (2) входящий вебхук
Bitrix24 (Разработчикам → Другое → Входящий вебхук), скоупы только `crm` и `user`, лучше от отдельного
пользователя с правами только на чтение CRM (вебхук действует с правами создателя) → `B24_WEBHOOK_URL`.
Дать команды: шаблон в secrets.env (`curl .../conf/secrets.env.example`), права `root:gg 0640`, проверка
без показа значений (`sed -n 's/^\([A-Z_0-9]*\)=.\+/\1 = заполнено/p'`), затем `cd / && sudo -u gg gg-job rop-snapshot`,
сверка /rop/ с github.io, затем `/usr/local/sbin/gg-apply-timers`. До этого снова попросить разрешение на пуш #423.

## 9. Фон
- Открытые PR: oliverjone01-dev/t1#435 (мой, draft), oliverjone01-dev/t1#423 (контур, draft, конфликт). Здесь отписаны, новая сессия подписывается.
- Рутина trig_01JczLgYd1D7zFLgVsTgkoMM (чек-ин 11:42 UTC) удалена при переезде.

## 10. Как пользователь любит работать
- ЯДИ = Янчоглов Дмитрий Иванович, ведёт работу; решения за Иваном Раюшкиным. Пишет коротко, по-русски, без пунктуации, присылает скриншоты PowerShell и Timeweb.
- Новичок в серверах: объяснять «куда нажимать», что безопасно присылать в чат (IP, открытый ключ, вывод команд) и что нет (пароли, ключи API, закрытый ключ). Windows + PowerShell, вставка правой кнопкой.
- Без длинного тире.
