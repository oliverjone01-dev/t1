# ФЕНИКС, итерация 3, проба 8 (R2): есть ли в выгрузках Маркета остаток или цена KONUX GGT-35-1-3-100-180 на октябрь
# (0 заказов 01-12.10 при 4,8 корзины в день). Только чтение. Запуск: python3 -I feniks_iter3_8_konux13_stock.py
D = '/home/user/t1/analytics-mvp/data-ym/'
S = 'GGT-35-1-3-100-180'
for f in ('skus_live_30d.json', 'sku_offer.json', 'catalog.json', 'svod_orders.json', 'pnl_sku_30d.json'):
    t = open(D + f, encoding='utf-8').read()
    i = t.find(S)
    print(f, 'найдено' if i != -1 else 'нет', '|', t[max(0, i - 150):i + 450].replace('\n', ' ') if i != -1 else '')
    print('====')
