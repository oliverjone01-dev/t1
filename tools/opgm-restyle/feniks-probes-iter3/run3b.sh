#!/bin/bash
# ФЕНИКС iter3: cabname-check, d1check, contrast-layers автора (копия, байт в байт) на новых мутантах. Последовательно: d1check пишет общий out/d1.harness.html.
export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
SP=/tmp/claude-0/-home-user-t1/16fce438-701e-5124-a7d4-75100c05e8b9/scratchpad
T=$SP/feniks-iter3/tools; V=$SP/feniks-iter3/v
OP=$SP/opgm/op-gm-automation
cd "$T" || exit 2
run(){ echo "\$ $*" | sed "s|$V/||g; s|$OP|<op>|g; s|/home/user/t1/tools/opgm-restyle/||g"; "$@" 2>&1 | grep -E "$PAT" | cut -c1-230; echo "  код: ${PIPESTATUS[0]}"; echo; }
date +%T
PAT='БАЗА|ПОВЕРХНОСТЕЙ|БЕЗ ИМЕНИ|ПРОВАЛ|ИТОГ|op-cab|ks-tile|график'
run node cabname-check.cjs --op "$OP" --src "$V/f3-cab-swap"
PAT='^FAIL|ИТОГ|^PASS  6'
run node d1check.cjs --op "$OP" --src "$V/f3-d1now"
run node d1check.cjs --op "$OP" --src "$V/f3-d1noyear"
run node d1check.cjs --op "$OP" --src "$V/f3-d1noyear" --dates 2027-05-03T09:00:00+03:00,2027-04-06T09:00:00+03:00
run node d1check.cjs --op "$OP" --src /home/user/t1/tools/opgm-restyle/variants/d1fix --dates 2027-01-11T09:00:00+03:00
date +%T
PAT='КОНТРОЛЬ|контроль|БАТАРЕЯ|провалов|ИТОГО'
run node contrast-layers.cjs --op "$OP" --src "$V/f3-vis" --views pulse,speed2,dlg --widths 1280,390
date +%T
