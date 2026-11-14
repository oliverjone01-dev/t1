# sections: phoenix
# Порт части шага «Assemble site (prod)»: собранный React из phoenix/dist (dist лежит в git).
# Отличия от GitHub, обе - только адрес и пароль, не содержимое:
#  1. Сборка сделана под подпапку Pages /t1/phoenix/ - на сервере сайт в корне, путь меняем на /phoenix/.
#  2. Пароль как у хаба (HUB_PASS). В GitHub без секрета остаётся дефолтный хэш из репозитория,
#     здесь без секрета шаг падает: раздел не публикуется, nginx отдаёт его из GitHub.
src="$(gg_src main)/phoenix/dist"
[ -s "$src/index.html" ] || gg_die "нет $src/index.html"
gg_load_secrets
[ -n "${HUB_PASS:-}" ] || gg_die "нет HUB_PASS в secrets.env - /phoenix/ не публикуется (остаётся из GitHub)"
mkdir -p "$SITE/phoenix"
cp -r "$src/." "$SITE/phoenix/"
grep -rlF '/t1/phoenix/' "$SITE/phoenix" | while read -r f; do sed -i 's#/t1/phoenix/#/phoenix/#g' "$f"; done
if grep -rqE "[\"'(]/t1/" "$SITE/phoenix"; then gg_die "в /phoenix/ остались пути /t1/ - страница бы не загрузилась"; fi
hash=$(printf '%s' "$HUB_PASS" | sha256sum | cut -d' ' -f1)
old=2ef8f96e6281d75d01cec0c80866292dbeff89683f008467ab13fae421a5f868
if [ -d "$SITE/phoenix/a" ]; then
  grep -lF "$old" "$SITE"/phoenix/a/*.js >/dev/null || gg_die "в бандле /phoenix/ нет дефолтного хэша пароля - пароль не подменить"
  sed -i "s/$old/$hash/g" "$SITE"/phoenix/a/*.js
fi
gg_log "Феникс: /phoenix/, пароль из HUB_PASS"
