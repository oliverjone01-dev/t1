# ФЕНИКС iter5: арифметика к gaps 2-3 и 7 (числа из таблицы теста 3 docx и вывода probe_cpo.py)
konux = dict(vw_hi=54718, vw_lo=3088, sp_hi=30004, sp_lo=2024, ord_hi=4.1, ord_lo=1.5, cart_hi=265, cart_lo=39)
kuvino = dict(vw_hi=21360, vw_lo=1712, sp_hi=19984, sp_lo=651, ord_hi=2.8, ord_lo=0.7, cart_hi=24, cart_lo=7)
for n, x in (('KONUX', konux), ('KUVINO', kuvino)):
    print(n, 'показы x%.1f' % (x['vw_hi'] / x['vw_lo']), 'бюджет x%.1f' % (x['sp_hi'] / x['sp_lo']),
          'цена 1000 показов %.0f -> %.0f ₽ (x%.2f)' % (x['sp_lo'] / x['vw_lo'] * 1000, x['sp_hi'] / x['vw_hi'] * 1000,
                                                    (x['sp_hi'] / x['vw_hi']) / (x['sp_lo'] / x['vw_lo'])),
          'заказы +%.1f/нед' % (x['ord_hi'] - x['ord_lo']), 'корзины %d vs %d' % (x['cart_hi'], x['cart_lo']))
# ставка за заказ, выключение 28.08-03.09 (probe_cpo.py): заказы без отмен в день
before, off, after = 140 / 14, 42 / 7, 130 / 14
before_ex19 = (140 - 21) / 13
print('заказы/день до %.2f (без 19.08: %.2f), выкл %.2f, после %.2f; падение %.0f%%...%.0f%%' % (
    before, before_ex19, off, after, (1 - off / before_ex19) * 100, (1 - off / before) * 100))
print('показы в поиске/день до 105435, выкл 35333 (%.0f%%), после 86833' % ((1 - 35333 / 105435) * 100))
