import math
def pois_cdf(k, lam):
    s = 0.0; t = math.exp(-lam)
    for i in range(k + 1):
        if i > 0: t *= lam / i
        s += t
    return s
def p_trigger(lb, la):
    pp = 0.0; t = math.exp(-lb)
    for x in range(0, int(lb * 4 + 60)):
        if x > 0: t *= lb / x
        k = math.ceil(0.7 * x) - 1
        if k >= 0: pp += t * pois_cdf(k, la)
    return pp
for name, post, pre in (('O-18090', 7.5, 2.5), ('47-3-5-90', 13.5, 4.0), ('3-5-E-16080', 3.5, 2.57)):
    mid = (post + pre) / 2
    print(name, 'midway level %.2f/day: P(stop fires) = %.2f' % (mid, p_trigger(post * 14, mid * 14)))
