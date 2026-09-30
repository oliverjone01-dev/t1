#!/usr/bin/env python3
"""Независимая сторона сверки витрины Ройстата: снимок Битрикса.

Зачем отдельный скрипт. Сверка выручки в Ройстате с самим Ройстатом ничего не
доказывает (класс К5 из реестра, запись E015). Вторая цифра должна прийти из
другой системы. Ройстат доступен только из GitHub Actions, снимок Битрикса
лежит в репозитории - поэтому стороны считаются раздельно, а сводит их сессия.

Снимок: ветка rop-dashboard-v1, analytics-mvp/rop/data/rop.json, его кладёт
воркфлоу b24-snapshots.yml прямым обращением к Bitrix24.

Что скрипт печатает и почему именно так:
  - выручку выигранных сделок ДВУМЯ датами привязки (закрытие и создание).
    Это не избыточность: пока неизвестно, какой датой Ройстат относит деньги к
    периоду, сравнивать можно только с обеими. Разница между ними больше, чем
    любое расхождение систем, поэтому сначала дата, потом вердикт (E016);
  - границы популяции. В снимке только воронка 49 «GG RF Заказы», в Ройстате
    воронок больше. Сравнивать общий итог Ройстата с этой цифрой нельзя -
    это К2, числитель и знаменатель из разных популяций;
  - месяц массового переноса. Он виден сам, по аномалии, а не задан руками.

Запуск:
  python3 roistat/reconcile-bitrix.py --month 2026-08
  python3 roistat/reconcile-bitrix.py --month 2026-08 --rop /path/rop.json
"""
import argparse, collections, json, subprocess, sys

SNAPSHOT_REF = "origin/rop-dashboard-v1:analytics-mvp/rop/data/rop.json"


def load(path):
    if path:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    out = subprocess.run(["git", "show", SNAPSHOT_REF], capture_output=True)
    if out.returncode:
        sys.exit("не читается снимок %s: %s" % (SNAPSHOT_REF, out.stderr.decode()[:200]))
    return json.loads(out.stdout)


def rub(x):
    return f"{round(x):,}".replace(",", " ")


def month(s):
    return s[:7] if s else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--month", required=True, help="YYYY-MM")
    ap.add_argument("--rop", default=None, help="путь к rop.json (по умолчанию из git)")
    a = ap.parse_args()

    d = load(a.rop)
    deals, leads = d.get("deals", []), d.get("leads", [])

    print("=== Битрикс: независимая сторона сверки ===")
    print("снимок %s, источник %s" % (d.get("generated_at"), d.get("source")))
    print("сделок %d, лидов %d" % (len(deals), len(leads)))

    cats = collections.Counter((x.get("category"), x.get("categoryName")) for x in deals)
    print("воронки в снимке: " + ", ".join("%s «%s» - %d" % (c, n, k) for (c, n), k in cats.most_common()))
    print("ГРАНИЦА ПОПУЛЯЦИИ: это не весь холдинг. Итог Ройстата по всем воронкам")
    print("с этой цифрой сравнивать нельзя (К2).")

    # --- инварианты снимка до любых выводов ---
    ids = [x.get("id") for x in deals]
    dup = len(ids) - len(set(ids))
    nodate = sum(1 for x in deals if x.get("won") and not x.get("closed"))
    neg = sum(1 for x in deals if (x.get("budget") or 0) < 0)
    print("\nинварианты снимка: дублей id %d, выигранных без даты закрытия %d, отрицательных бюджетов %d"
          % (dup, nodate, neg))
    if dup:
        print("  ДУБЛИ ЕСТЬ - суммы ниже завышены, сверку не делать, пока не разобрано")

    # --- месяц массового переноса виден сам ---
    by_created = collections.Counter(month(x.get("created")) for x in deals if x.get("created"))
    top_m, top_n = by_created.most_common(1)[0]
    share = 100.0 * top_n / max(1, sum(by_created.values()))
    if share > 25:
        print("\nМЕСЯЦ ПЕРЕНОСА: %s держит %.0f%% всех сделок (%d из %d). Это штамп импорта,"
              % (top_m, share, top_n, sum(by_created.values())))
        print("а не месяц продаж - в сверку он не годится ни с какой стороны.")

    # --- две даты привязки ---
    m = a.month
    def agg(pred, datef):
        n, s = 0, 0.0
        for x in deals:
            if pred(x) and month(datef(x)) == m:
                n += 1
                s += float(x.get("budget") or 0)
        return n, s

    won_closed = agg(lambda x: x.get("won"), lambda x: x.get("closed"))
    won_created = agg(lambda x: x.get("won"), lambda x: x.get("created"))
    all_created = agg(lambda x: True, lambda x: x.get("created"))
    lead_n = sum(1 for x in leads if month(x.get("created")) == m)

    print("\n=== %s, воронка 49 ===" % m)
    print("  выигранные, месяц ЗАКРЫТИЯ     сделок %5d   сумма budget %16s" % (won_closed[0], rub(won_closed[1])))
    print("  выигранные, месяц СОЗДАНИЯ     сделок %5d   сумма budget %16s" % (won_created[0], rub(won_created[1])))
    print("  все сделки, месяц СОЗДАНИЯ     сделок %5d   сумма budget %16s" % (all_created[0], rub(all_created[1])))
    print("  лиды Б24, месяц создания       %d" % lead_n)
    if won_closed[1] and won_created[1]:
        print("  дата привязки меняет выручку в %.1f раза - сначала дата, потом вердикт"
              % (max(won_closed[1], won_created[1]) / min(won_closed[1], won_created[1])))

    # --- по источнику Битрикса ---
    print("\n  по полю source (выигранные, месяц закрытия). Это НЕ marker_level_1 Ройстата:")
    print("  поле заполняет менеджер, канал Ройстата приходит с визита. Совпадение строк")
    print("  здесь - совпадение смыслов, а не ключей, сводить их автоматом нельзя.")
    by_src = collections.defaultdict(lambda: [0, 0.0])
    for x in deals:
        if x.get("won") and month(x.get("closed")) == m:
            k = x.get("source") or "(пусто)"
            by_src[k][0] += 1
            by_src[k][1] += float(x.get("budget") or 0)
    tot = sum(v[1] for v in by_src.values())
    for k, v in sorted(by_src.items(), key=lambda kv: -kv[1][1])[:15]:
        print("    %-40s %4d %14s  %5.1f%%" % (k[:40], v[0], rub(v[1]), 100 * v[1] / tot if tot else 0))


if __name__ == "__main__":
    main()
