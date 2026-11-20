# sections: academy
# Порт части шага «Assemble site (prod)»: библиотека собирается здесь (node, пароль ACADEMY_PASS),
# кабинеты и сводка штаба кладутся готовыми из gg-sales-academy/sealed/ (уже зашифрованы).
# В GitHub без секрета раздел пропускается; здесь без секрета шаг падает - nginx отдаёт /academy/
# из GitHub, пока ключ не внесён. Обе страховки персональных данных - как в GitHub.
src="$(gg_src main)/gg-sales-academy"
[ -s "$src/src/build-library.mjs" ] || gg_die "нет $src/src/build-library.mjs"
gg_load_secrets
[ -n "${ACADEMY_PASS:-}" ] || gg_die "нет ACADEMY_PASS в secrets.env - /academy/ не публикуется (остаётся из GitHub)"
out="$SITE/academy"
mkdir -p "$out/img"
ACADEMY_PASS="$ACADEMY_PASS" node "$src/src/build-library.mjs" >"$out/index.html"
[ -s "$out/index.html" ] || gg_die "библиотека академии пустая"
# Страховка 1: в библиотеке нет людей и сделок
if grep -qE "crm/deal/details|clientText|$GG_ROSTER_RE" "$out/index.html"; then
  rm -rf "${out:?}"; gg_die "в библиотеке академии персональные данные - публикация остановлена"
fi
cp "$src"/sealed/*.html "$out/"
# Страховка 2: кабинеты и сводка только запечатанные
for f in "$out"/k-*.html "$out/rop-summary.html"; do
  if grep -qE "$GG_ROSTER_RE" "$f"; then
    rm -rf "${out:?}"; gg_die "$(basename "$f") не запечатан (видна фамилия) - публикация остановлена"
  fi
done
# Иллюстрации: пустая папка - штатно
for ext in svg webp; do
  if compgen -G "$src/img/*.$ext" >/dev/null; then cp "$src"/img/*."$ext" "$out/img/"; fi
done
gg_log "Академия: /academy/, кабинетов $(find "$out" -maxdepth 1 -name 'k-*.html' | wc -l) + сводка, картинок $(find "$out/img" -type f | wc -l)"
