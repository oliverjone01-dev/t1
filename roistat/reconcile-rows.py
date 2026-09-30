#!/usr/bin/env python3
"""Раскладка расхождения сверки ПО СТРОКАМ: Ройстат против снимка Битрикса.

Зачем. Агрегаты за август по воронке 49 сошлись на 97.5%: Битрикс 113 продаж и
13 472 158, Ройстат `payment_revenue` 109 и 13 145 742. Остаток 326 416 (2.5%)
был записан как «не объяснён». Шаг 5 скилла data-guard требует другого: любой
остаток объясняется СПИСКОМ СТРОК. Этот скрипт его и выдаёт.

Вход: файл, который пишет roistat/probe-orders.mjs (строки воронки из
integration/order/list: id, статус, даты, числа - клиентских полей в нём нет), и
снимок Битрикса из ветки rop-dashboard-v1.

Что скрипт делает и чего НЕ делает:
  - НЕ называет расхождение ошибкой, пока не показал, что популяции и даты по
    обеим сторонам одинаковы. Разные срезы, названные ошибкой данных, - это
    запись E016 в реестре, класс К5.
  - Сдвиг месяца раскладывает ТАБЛИЦЕЙ СДВИГА, а не списывает в расхождение:
    сутки Ройстата режутся по UTC, поэтому московские 00:00-03:00 первого числа
    уходят в предыдущий месяц. Это проверяемая гипотеза, и она проверяется.
  - Ключ стыка проверяется до выводов. Если id Ройстата не ложатся на id
    снимка, пустой стык выглядит как «Ройстат потерял всё» - это молчаливая
    ложь, поэтому при нулевом пересечении скрипт падает (fail-closed).
  - Обе стороны - API, и Ройстат берёт данные ИЗ Битрикса. Стык ловит потерю и
    подмену по дороге, но не ошибку, которая уже есть в Битриксе.

Определение «продажи» и список стадий класса paid берутся из reconcile-bitrix.py,
а не переписываются здесь: одна логика - одна функция (шаг 4 скилла data-guard).

Запуск:
  python3 roistat/reconcile-rows.py --orders /tmp/roistat-orders.json --month 2026-08
  ... --date-field paid_date --money-field revenue --rop /path/rop.json
"""
import argparse, collections, importlib.util, json, os, pathlib, sys

HERE = pathlib.Path(__file__).resolve().parent

# Одна логика - одна функция: стадии класса paid и чтение снимка живут в
# reconcile-bitrix.py. Имя файла с дефисом, поэтому импорт по пути.
_spec = importlib.util.spec_from_file_location("rb", HERE / "reconcile-bitrix.py")
rb = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rb)

PAID_STAGES = set(rb.PAID_STAGES_C49)
load_snapshot = rb.load
rub = rb.rub
month = rb.month


def parse_args():
    ap = argparse.ArgumentParser()
    ap.add_argument("--orders", required=True, help="файл от roistat/probe-orders.mjs")
    ap.add_argument("--month", default=None, help="YYYY-MM; по умолчанию из файла")
    ap.add_argument("--rop", default=None, help="путь к rop.json (по умолчанию из git)")
    ap.add_argument("--date-field", default=None,
                    help="поле даты Ройстата, кладущее сделку в месяц; по умолчанию подбирается")
    ap.add_argument("--money-field", default=None,
                    help="поле денег Ройстата; по умолчанию подбирается")
    ap.add_argument("--ref-sum", type=float, default=None,
                    help="payment_revenue из analytics/data за месяц - для подбора полей")
    ap.add_argument("--ref-count", type=int, default=None, help="payment_sales за месяц")
    ap.add_argument("--tz-shift-hours", type=int, default=3,
                    help="сдвиг Москвы к UTC: сутки Ройстата режутся по UTC")
    return ap.parse_args()


def bitrix_id(roistat_id):
    """id Ройстата -> id сделки Битрикса. `deal_4127` -> `4127`, лиды не сделки."""
    s = str(roistat_id)
    if s.startswith("deal_"):
        return s[5:]
    return None


def main():
    a = parse_args()
    # Ноль как эталон это «эталона нет», а не «цель равна нулю»: workflow
    # передаёт 0, когда probe-orders не смог снять агрегат. Молча искать
    # комбинацию, ближайшую к нулю, значит выдать мусор за подбор.
    if a.ref_sum is not None and a.ref_sum <= 0:
        a.ref_sum = None
    with open(a.orders, encoding="utf-8") as f:
        o = json.load(f)
    m = a.month or o.get("month")
    funnel = str(o.get("funnel"))
    rows = o.get("rows") or []

    print("=== Раскладка расхождения ПО СТРОКАМ, %s, воронка %s ===" % (m, funnel))
    print("Ройстат: %s, снят %s" % (o.get("source"), o.get("generated_at")))
    print("  база: total на старте %s, на конец %s, собрано уникальных %s, движение %+d"
          % (o.get("total_before"), o.get("total_after"), o.get("unique"), o.get("moved") or 0))
    print("  строк воронки %s в файле: %d" % (funnel, len(rows)))
    if o.get("moved"):
        print("  ПОМЕТКА: база двигалась во время обхода. Появиться могли только записи")
        print("  текущего дня, месяц %s закрыт - на раскладку это не влияет." % m)

    snap = load_snapshot(a.rop)
    deals = [d for d in snap.get("deals", []) if str(d.get("category")) == funnel]
    print("Битрикс: снимок %s, %s; сделок воронки %s: %d"
          % (snap.get("generated_at"), snap.get("source"), funnel, len(deals)))

    # --- ключ стыка проверяется ДО любых выводов ---
    by_bx = {str(d.get("id")): d for d in deals}
    r_deals = [r for r in rows if bitrix_id(r.get("id"))]
    r_leads = len(rows) - len(r_deals)
    hit = sum(1 for r in r_deals if bitrix_id(r["id"]) in by_bx)
    print("\n--- ключ стыка: id Ройстата `deal_N` против id сделки Битрикса ---")
    print("  строк-сделок у Ройстата %d, строк-лидов %d" % (len(r_deals), r_leads))
    print("  из сделок Ройстата нашлись в снимке: %d (%.1f%%)"
          % (hit, 100.0 * hit / max(1, len(r_deals))))
    if not r_deals or hit == 0:
        sys.exit("КЛЮЧ НЕ СОШЁЛСЯ: ни одна сделка Ройстата не нашлась в снимке.\n"
                 "Пустой стык выглядел бы как «Ройстат потерял всё». Разобрать формат id,\n"
                 "раскладку не делать.")
    if hit < len(r_deals) * 0.5:
        print("  ВНИМАНИЕ: сошлось меньше половины - вывод ниже недостоверен")

    # --- какое поле даты и денег кладёт сделку в месяц ---
    date_fields = [k for k in (o.get("date_fields") or [])]
    num_fields = [k for k in (o.get("num_fields") or [])]

    def sel(df, mf, mm):
        out = []
        for r in r_deals:
            v = r.get(df)
            if isinstance(v, str) and v[:7] == mm:
                out.append((bitrix_id(r["id"]), float(r.get(mf) or 0), v))
        return out

    df, mf = a.date_field, a.money_field
    if not (df and mf):
        print("\n--- подбор поля даты и поля денег под агрегат Ройстата ---")
        if a.ref_sum is None:
            print("  эталон не передан (--ref-sum). Печатаю все комбинации, выбор за глазами.")
        best, table = None, []
        for d_ in date_fields:
            for n_ in num_fields:
                s = sel(d_, n_, m)
                if not s:
                    continue
                total = sum(x[1] for x in s)
                if total == 0:
                    continue
                table.append((d_, n_, len(s), total))
                if a.ref_sum:
                    err = abs(total - a.ref_sum) / a.ref_sum
                    if best is None or err < best[0]:
                        best = (err, d_, n_, len(s), total)
        for d_, n_, n, total in sorted(table, key=lambda x: -x[3]):
            mark = ""
            if a.ref_sum and abs(total - a.ref_sum) / a.ref_sum < 0.01:
                mark = "  <-- совпало с эталоном"
            print("  %-20s %-20s строк %5d  сумма %16s%s" % (d_, n_, n, rub(total), mark))
        if not table:
            sys.exit("НИ ОДНА комбинация не кладёт сделки Ройстата в %s. Раскладку не делать." % m)
        if best and best[0] < 0.01:
            _, df, mf, _, _ = best
            print("  выбраны: дата %s, деньги %s (промах %.2f%%)" % (df, mf, 100 * best[0]))
        else:
            d_, n_, _, _ = max(table, key=lambda x: x[3])
            df, mf = a.date_field or d_, a.money_field or n_
            if a.ref_sum:
                print("  НИ ОДНА комбинация не воспроизвела эталон %s ближе 1%%." % rub(a.ref_sum))
                print("  Значит месяц Ройстат считает НЕ полем из order/list, и раскладка ниже")
                print("  показывает популяции, а не тождество. Это надо читать как гипотезу.")
            print("  для раскладки взяты: дата %s, деньги %s" % (df, mf))

    # --- популяции обеих сторон по одному определению ---
    def first_paid(d):
        dates = [dt for code, dt in (d.get("hist") or []) if code in PAID_STAGES]
        return min(dates) if dates else None

    bx_month, bx_all = {}, {}
    for d in deals:
        dt = first_paid(d)
        if not dt:
            continue
        bx_all[str(d.get("id"))] = (float(d.get("budget") or 0), dt)
        if month(dt) == m:
            bx_month[str(d.get("id"))] = (float(d.get("budget") or 0), dt)

    rs_month = {}
    for bid, val, dt in sel(df, mf, m):
        rs_month[bid] = (val, dt)

    rs_sum = sum(v for v, _ in rs_month.values())
    bx_sum = sum(v for v, _ in bx_month.values())
    print("\n--- популяции по одному определению ---")
    print("  Ройстат, %s в %s:        строк %4d  сумма %16s" % (df, m, len(rs_month), rub(rs_sum)))
    print("  Битрикс, первый вход в paid: строк %4d  сумма %16s" % (len(bx_month), rub(bx_sum)))
    print("  стадии paid: " + ", ".join(sorted(PAID_STAGES)))

    only_bx = sorted(set(bx_month) - set(rs_month))
    only_rs = sorted(set(rs_month) - set(bx_month))
    both = sorted(set(bx_month) & set(rs_month))
    diff_amt = [k for k in both if abs(bx_month[k][0] - rs_month[k][0]) > 0.5]

    s_only_bx = sum(bx_month[k][0] for k in only_bx)
    s_only_rs = sum(rs_month[k][0] for k in only_rs)
    s_diff = sum(bx_month[k][0] - rs_month[k][0] for k in diff_amt)

    print("\n--- ИЗ ЧЕГО СКЛАДЫВАЕТСЯ РАСХОЖДЕНИЕ ---")
    print("  только у Битрикса        строк %4d  сумма %16s" % (len(only_bx), rub(s_only_bx)))
    print("  только у Ройстата        строк %4d  сумма %16s" % (len(only_rs), rub(s_only_rs)))
    print("  у обоих, суммы разные    строк %4d  разница %15s" % (len(diff_amt), rub(s_diff)))
    print("  у обоих, суммы равны     строк %4d" % (len(both) - len(diff_amt)))
    checked = s_only_bx - s_only_rs + s_diff
    print("  ---")
    print("  сумма частей             %16s" % rub(checked))
    print("  Битрикс минус Ройстат    %16s" % rub(bx_sum - rs_sum))
    ok = abs(checked - (bx_sum - rs_sum)) < 1.0
    print("  части складываются в расхождение: %s" % ("ДА" if ok else "НЕТ - раскладка неполная"))
    if not ok:
        print("  Раскладка неполная, значит объяснением она пока не является.")

    # --- построчно: что именно и где ---
    def where(bid):
        d = by_bx.get(bid) or {}
        dt = first_paid(d)
        return "стадия %s, первый paid %s, создана %s" % (d.get("stageCode"), dt, d.get("created"))

    if only_bx:
        print("\n  СТРОКИ ТОЛЬКО У БИТРИКСА (id сделки, сумма, где она в Битриксе):")
        for bid in sorted(only_bx, key=lambda k: -bx_month[k][0]):
            amt, dt = bx_month[bid]
            r = next((x for x in r_deals if bitrix_id(x["id"]) == bid), None)
            seen = ("у Ройстата есть, но %s = %s" % (df, r.get(df))) if r else "у Ройстата строки нет вовсе"
            print("    %-10s %14s  %s | %s" % (bid, rub(amt), where(bid), seen))
    if only_rs:
        print("\n  СТРОКИ ТОЛЬКО У РОЙСТАТА (id сделки, сумма, где она в Ройстате):")
        for bid in sorted(only_rs, key=lambda k: -rs_month[k][0]):
            amt, dt = rs_month[bid]
            inbx = bid in by_bx
            note = where(bid) if inbx else "в снимке Битрикса сделки нет"
            print("    %-10s %14s  %s = %s | %s" % (bid, rub(amt), df, dt, note))
    if diff_amt:
        print("\n  СТРОКИ С РАЗНЫМИ СУММАМИ (id, Битрикс, Ройстат, разница):")
        for bid in sorted(diff_amt, key=lambda k: -abs(bx_month[k][0] - rs_month[k][0])):
            b, r = bx_month[bid][0], rs_month[bid][0]
            print("    %-10s %14s %14s %14s  %s" % (bid, rub(b), rub(r), rub(b - r), where(bid)))

    # --- направление, не зависящее от даты Ройстата ---
    #
    # Прогон 36735896587 показал: на верхнем уровне записи order/list из дат есть
    # только creation_date и update_date, и ни одна из них не «дата продажи».
    # Значит августовскую популяцию Ройстата по дате можно и не собрать вовсе.
    #
    # Но раскладка расхождения этого и не требует. Битрикс говорит: столько-то
    # сделок вошли в оплаченную стадию в августе. По каждой из них можно спросить
    # Ройстат БЕЗ всякой даты: есть ли у тебя такой заказ и какая на нём выручка.
    # Это раскладывает разрыв в ту сторону, где он и возник, и не зависит от того,
    # нашлось поле даты или нет.
    r_by_bx = {}
    for r in r_deals:
        r_by_bx[bitrix_id(r["id"])] = r
    # Лид может ссылаться на сделку через order_id_alias - такая ссылка тоже стык.
    alias_by_bx = {}
    for r in rows:
        al = r.get("alias")
        if al and str(al).startswith("deal_"):
            alias_by_bx.setdefault(str(al)[5:], r)

    print("\n--- НЕЗАВИСИМО ОТ ДАТЫ РОЙСТАТА: где августовские продажи Битрикса ---")
    print("  Битрикс: %d сделок вошли в оплаченную стадию в %s, сумма %s"
          % (len(bx_month), m, rub(bx_sum)))
    missing, present, via_alias = [], [], []
    for bid in sorted(bx_month, key=lambda k: -bx_month[k][0]):
        if bid in r_by_bx:
            present.append(bid)
        elif bid in alias_by_bx:
            via_alias.append(bid)
        else:
            missing.append(bid)
    print("  у Ройстата есть такой заказ (id сделки):        %4d  сумма %16s"
          % (len(present), rub(sum(bx_month[k][0] for k in present))))
    print("  найден только через ссылку лида order_id_alias: %4d  сумма %16s"
          % (len(via_alias), rub(sum(bx_month[k][0] for k in via_alias))))
    print("  у Ройстата НЕТ вовсе:                           %4d  сумма %16s"
          % (len(missing), rub(sum(bx_month[k][0] for k in missing))))
    if missing:
        print("\n  СДЕЛКИ, КОТОРЫХ У РОЙСТАТА НЕТ (id, сумма Битрикса, стадия, дата продажи):")
        for bid in missing:
            amt, dt = bx_month[bid]
            print("    %-10s %14s  %s" % (bid, rub(amt), where(bid)))
    if via_alias:
        print("\n  НАЙДЕНЫ ТОЛЬКО ЧЕРЕЗ ССЫЛКУ ЛИДА (id сделки, сумма Битрикса):")
        for bid in via_alias:
            print("    %-10s %14s  %s" % (bid, rub(bx_month[bid][0]), where(bid)))

    # Сумма на стороне Ройстата по этим же сделкам, если поле денег выбрано.
    if mf and present:
        r_amt = sum(float(r_by_bx[b].get(mf) or 0) for b in present)
        b_amt = sum(bx_month[b][0] for b in present)
        print("\n  по сделкам, которые есть у обоих (%d штук), поле `%s`:" % (len(present), mf))
        print("    Битрикс budget   %16s" % rub(b_amt))
        print("    Ройстат %-8s %16s" % (mf, rub(r_amt)))
        print("    разница          %16s" % rub(b_amt - r_amt))
        neq = [b for b in present if abs(float(r_by_bx[b].get(mf) or 0) - bx_month[b][0]) > 0.5]
        print("    сделок с разной суммой: %d" % len(neq))
        for b in sorted(neq, key=lambda k: -abs(float(r_by_bx[k].get(mf) or 0) - bx_month[k][0]))[:25]:
            print("      %-10s Битрикс %14s  Ройстат %14s  разница %14s"
                  % (b, rub(bx_month[b][0]), rub(float(r_by_bx[b].get(mf) or 0)),
                     rub(bx_month[b][0] - float(r_by_bx[b].get(mf) or 0))))

    # --- сдвиг месяца: таблица, а не вердикт ---
    # Гипотеза из API.md: сутки Ройстата режутся по UTC, поэтому московские
    # 00:00-03:00 первого числа падают в предыдущий месяц. Проверяется тем, что
    # у «пропавших» строк дата попадает именно в это окно, а не вообще рядом.
    print("\n--- таблица сдвига: где эти сделки у другой стороны ---")
    shift = collections.Counter()
    edge = []
    for bid in only_bx:
        r = next((x for x in r_deals if bitrix_id(x["id"]) == bid), None)
        mm = month(r.get(df)) if r and isinstance(r.get(df), str) else None
        shift[mm or "строки нет"] += 1
        dt = bx_month[bid][1]
        if isinstance(dt, str) and (dt[8:10] in ("01",) or dt[8:10] == "31"):
            edge.append((bid, dt))
    for k, v in shift.most_common():
        print("  только у Битрикса, а у Ройстата месяц %-12s строк %d" % (k, v))
    print("  из них дата Битрикса стоит на границе месяца (1 или 31 число): %d" % len(edge))
    for bid, dt in edge:
        print("    %-10s %s" % (bid, dt))
    if not edge and only_bx:
        print("  Граничных дат НЕТ, значит гипотеза «сдвиг суток на %d часа из-за UTC»" % a.tz_shift_hours)
        print("  этот остаток НЕ объясняет. Причина в другом.")
    elif edge:
        print("  Даты на границе есть - гипотезу сдвига на %d часа проверять этими id." % a.tz_shift_hours)
    print("\n  Дата в снимке хранится числом без времени, поэтому доказать сдвиг на")
    print("  три часа ТОЛЬКО из снимка нельзя: нужно время события из Битрикса.")

    print("\n--- чем эта сверка не является ---")
    print("  Обе стороны - API, и Ройстат берёт данные ИЗ Битрикса. Стык ловит потерю и")
    print("  подмену по дороге, но НЕ ловит ошибку, которая уже есть в самом Битриксе.")
    print("  Полностью независимой стороной были бы деньги банка или документы реализации.")


if __name__ == "__main__":
    main()
