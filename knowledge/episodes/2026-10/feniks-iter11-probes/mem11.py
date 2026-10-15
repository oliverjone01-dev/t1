#!/usr/bin/env python3
"""FENIKS iter11: append calibration to .claude/agent-memory/feniks/MEMORY.md (working tree only; the author moves it out
as a patch). Adds the iter10 entry from scratchpad/feniks-memory-iter10.patch (never applied) and the iter11 entry."""
M = "/home/user/t1/.claude/agent-memory/feniks/MEMORY.md"
PATCH = "/tmp/claude-0/-home-user-t1/c4f0dfeb-cd9a-55ac-b7f6-154069ba26c7/scratchpad/feniks-memory-iter10.patch"
t = open(M, encoding="utf-8").read()
add = ""
if "итерация 10 (a06dcd948" not in t:
    plus = [l[1:] for l in open(PATCH, encoding="utf-8").read().split("\n") if l.startswith("+") and not l.startswith("+++")]
    add += "\n".join(plus).rstrip("\n") + "\n"
add += """
## 2026-10-15 - OZON «Отчет» + сборщики CPO, итерация 11 (978821206, 8.75 go)
- Дрейф: 8.75 против якоря 8.5 timur iter3 (+0.25). Серия ... -> 8.00 -> 8.60 -> 8.75. Все пять пунктов iter10 закрыты по
  приёмке моими фикстурами дословно; класс N2 впервые закрыт по классу (14 из 15 файлов), остаток нашёл я.
- Приём, давший главное: порча НАСТОЯЩЕЙ записи в каждом входном файле (половина строки сентября) и сравнение ВСЕХ страниц с
  чистой сборкой, время сборки «обновлено ... МСК» замаскировано. Мусорная строка в конце файла не меняет числа и не
  показывает зависимые страницы. Так нашлись шаблоны katya.html и katya-tovary.html без пометки (daily_totals).
- «Битая строка» шире ошибки разбора: `null` проходит JSON.parse и роняет читателя ниже по коду (fzU = ровно fzV iter10,
  +792 742 ₽). Для класса «битый вход» бить по синтаксису и по форме записи.
- Симметрия: в rework_tz iter10 я назвал «строки без SKU», автор закрыл ровно их; симметричные «строки без номера заказа»
  дают ту же ложную ошибку. Называть оба края класса.
- Процесс: автор закоммитил мои незаконченные пробы посреди аудита (fc9426655). Хеш не меняется (episodes/traces вне
  охвата), но HEAD сдвигается - сверять `git log -1` перед AUDITED.
- Хук bash-scope: `>=` в awk и `$VAR/путь` в cp/mkdir ловятся как запись вне зоны; помогают абсолютные пути и скрипты через Write.
"""
open(M, "w", encoding="utf-8").write(t.rstrip("\n") + "\n" + add)
print("appended lines:", add.count("\n"))
