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

# Класс `paid` воронки 49 по версии самого Ройстата (integration/status/list,
# run 36697832771). Список не выбран нами и не подобран под ответ: он снят из
# API той системы, с которой идёт сверка.
PAID_STAGES_C49 = (
    "C49:EXECUTING",       # Предоплата получена
    "C49:FINAL_INVOICE",   # Заказ в производстве
    "C49:1",               # Заказ произведен
    "C49:2",               # Заказ отправлен
    "C49:WON",             # Сделка успешна
)


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
    ap.add_argument("--paid-stages", default=None,
                    help="stageCode через запятую; по умолчанию класс paid воронки 49 по версии Ройстата")
    ap.add_argument("--roistat-revenue", type=float, default=None,
                    help="payment_revenue Ройстата за этот месяц - тогда печатается расхождение")
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

    # --- популяция «продажа» по определению самого Ройстата ---
    #
    # Ройстат относит сделку к продаже не по флагу `won`, а по классу статуса.
    # Карта статусов снята у него же (integration/status/list, run 36697832771):
    # в воронке 49 класс `paid` несут ПЯТЬ стадий, а не одна. Сравнивать его
    # выручку с выигранными сделками Битрикса - это К2, разные популяции.
    #
    # Дата продажи берётся как ПЕРВЫЙ вход сделки в любую из этих стадий, по
    # истории стадий (`hist`), а не по полю `closed`: у невыигранных сделок
    # `closed` это плановая дата закрытия, а не событие. На этом поле сверка
    # молча сравнивала бы план с фактом.
    m = a.month
    paid_stages = set(a.paid_stages.split(",")) if a.paid_stages else set(PAID_STAGES_C49)

    def first_paid(x):
        dates = [dt for code, dt in (x.get("hist") or []) if code in paid_stages]
        return min(dates) if dates else None

    nohist = sum(1 for x in deals if not x.get("hist"))
    print("\n=== продажи по определению Ройстата (%d стадий класса paid) ===" % len(paid_stages))
    print("  стадии: " + ", ".join(sorted(paid_stages)))
    print("  дата продажи = первый вход в такую стадию по истории стадий")
    if nohist:
        print("  ВНИМАНИЕ: у %d сделок истории стадий нет, они в расчёт не попадают" % nohist)

    n, s = 0, 0.0
    for x in deals:
        dt = first_paid(x)
        if dt and month(dt) == m:
            n += 1
            s += float(x.get("budget") or 0)
    print("  %s: продаж %d, сумма budget %s" % (m, n, rub(s)))

    # --- две даты привязки, для сравнения ---
    def agg(pred, datef):
        cnt, sm = 0, 0.0
        for x in deals:
            if pred(x) and month(datef(x)) == m:
                cnt += 1
                sm += float(x.get("budget") or 0)
        return cnt, sm

    won_closed = agg(lambda x: x.get("won"), lambda x: x.get("closed"))
    won_created = agg(lambda x: x.get("won"), lambda x: x.get("created"))
    all_created = agg(lambda x: True, lambda x: x.get("created"))
    lead_n = sum(1 for x in leads if month(x.get("created")) == m)

    print("\n=== то же окно другими определениями (чтобы видеть цену определения) ===")
    print("  выигранные, месяц ЗАКРЫТИЯ     сделок %5d   сумма %16s" % (won_closed[0], rub(won_closed[1])))
    print("  выигранные, месяц СОЗДАНИЯ     сделок %5d   сумма %16s" % (won_created[0], rub(won_created[1])))
    print("  все сделки, месяц СОЗДАНИЯ     сделок %5d   сумма %16s" % (all_created[0], rub(all_created[1])))
    print("  лиды Б24, месяц создания       %d" % lead_n)
    if s and won_closed[1]:
        print("  определение «продажи» меняет сумму в %.1f раза относительно `won`"
              % (max(s, won_closed[1]) / min(s, won_closed[1])))

    if a.roistat_revenue is not None:
        r = a.roistat_revenue
        diff = s - r
        print("\n=== сверка ===")
        print("  Битрикс (снимок, история стадий) %16s" % rub(s))
        print("  Ройстат (payment_revenue)        %16s" % rub(r))
        print("  расхождение                      %16s   %.1f%%"
              % (rub(diff), 100 * diff / r if r else 0))
        print("  Обе стороны - это API, и Ройстат берёт данные ИЗ Битрикса.")
        print("  Значит сверка ловит потерю и подмену по дороге, но НЕ ловит")
        print("  ошибку, которая уже есть в самом Битриксе. Полностью независимой")
        print("  стороной были бы деньги банка или документы реализации.")


if __name__ == "__main__":
    main()
