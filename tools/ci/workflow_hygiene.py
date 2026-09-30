#!/usr/bin/env python3
"""workflow_hygiene.py - проверка гигиены GitHub Actions (класс К12 скилла data-guard).

Ошибка (exit 1): невалидный YAML (так CI падал на каждый push около недели).
Предупреждения (::warning, не роняют CI):
  - cron на минуте 0: в начале часа GitHub откладывает и сбрасывает запуски;
  - нет concurrency у workflow с расписанием или git push;
  - `|| true`, `|| echo`, `continue-on-error: true` в workflow, который пушит данные: сбой шага не виден, данные тихо замерзают;
  - пайп в run без `shell: bash`: без pipefail падение первой команды не роняет шаг.
Запуск: python3 tools/ci/workflow_hygiene.py [файлы...] (по умолчанию все .github/workflows/*.yml)
"""
import glob
import re
import sys

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None


def warn(f, line, msg):
    print(f"::warning file={f},line={line}::{msg}")


def main(files):
    files = files or sorted(glob.glob(".github/workflows/*.yml") + glob.glob(".github/workflows/*.yaml"))
    errors = 0
    for f in files:
        text = open(f, encoding="utf-8").read()
        if yaml is not None:
            try:
                yaml.safe_load(text)
            except yaml.YAMLError as e:
                mark = getattr(e, "problem_mark", None)
                one_line = str(e).replace("\n", " ")
                print(f"::error file={f},line={(mark.line + 1) if mark else 1}::невалидный YAML: {one_line}")
                errors += 1
                continue
        lines = text.splitlines()
        has_cron = any(re.search(r"^\s*-?\s*cron:", l) for l in lines)
        pushes = "git push" in text
        if (has_cron or pushes) and not re.search(r"^concurrency:", text, re.M) and not re.search(r"^\s{4}concurrency:", text, re.M):
            warn(f, 1, "К12: нет concurrency у workflow с расписанием или git push: параллельные прогоны конфликтуют при push")
        shell_bash_default = bool(re.search(r"defaults:\s*\n\s+run:\s*\n\s+shell:\s*bash", text))
        for i, l in enumerate(lines, 1):
            m = re.search(r"cron:\s*['\"]([^'\"]+)['\"]", l)
            if m and m.group(1).split()[0] == "0" and m.group(1).split()[1] != "0":
                warn(f, i, f"К12: cron '{m.group(1)}' на минуте 0: GitHub откладывает и сбрасывает запуски в начале часа, сдвинь на несколько минут раньше")
            if pushes and re.search(r"\|\|\s*(true|echo)\b|continue-on-error:\s*true", l) and "dg-ok" not in l:
                warn(f, i, "К7: fail-open в workflow, который пушит данные. Если это намеренно мягкий шаг, пометь комментарием # dg-ok и причиной")
        if not shell_bash_default:
            in_run, step_shell_bash = False, False
            for i, l in enumerate(lines, 1):
                if re.match(r"^\s*-\s", l):
                    step_shell_bash = False
                if re.search(r"shell:\s*bash", l):
                    step_shell_bash = True
                if re.search(r"^\s*run:\s*\|", l):
                    in_run = True
                    continue
                if in_run and re.search(r"[^|]\|\s*(tee|head|jq|python3?|node|grep)\b", l) and not step_shell_bash:
                    warn(f, i, "К7: пайп без shell: bash (нет pipefail), падение первой команды не уронит шаг")
                    in_run = False
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
