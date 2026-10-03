# sections: plan
# Порт шага «Build PLAN radar (/plan/ + sealed /plan/v2/)»: открытая статика + запечатанная v2.
# Гейт как в GitHub: фамилия ростера в открытом тексте = стоп, раздел остаётся прошлым.
src="$(gg_src main)/genglass-plan-calculator"
[ -s "$src/index.html" ] && [ -d "$src/v2" ] || gg_die "нет $src/index.html или v2/"
mkdir -p "$SITE/plan"
cp "$src/index.html" "$SITE/plan/"
cp -r "$src/v2" "$SITE/plan/v2"
if grep -rInE "$GG_ROSTER_RE" "$SITE/plan/" >&2; then
  rm -rf "${SITE:?}/plan"
  gg_die "План-Радар: фамилия ростера в открытом тексте - публикация остановлена"
fi
gg_log "План-Радар: /plan/ и /plan/v2/, ростер чист"
