# sections: ozon-research
# Порт шага «Build Ozon research (/ozon-research/)»: Next.js в статику. Отличие от GitHub - подпапка
# /ozon-research вместо /t1/ozon-research (сайт в корне домена).
# Сборка идёт минуту-две, а сайт пересобирается на каждый выкат: готовая статика кэшируется по
# хэшу папки ozon-research в main - пересборка только когда исследование реально поменялось.
src=$(gg_src main)
[ -s "$src/ozon-research/package.json" ] || gg_die "нет ozon-research в main"
key=$(git -C "$src" rev-parse HEAD:ozon-research)
cache="$GG_ROOT/cache/site-ozon-research"
if [ ! -s "$cache/$key/index.html" ]; then
  [ -e "$src/ozon-research/node_modules" ] || gg_die "нет node_modules у ozon-research (релиз main без npm ci)"
  tmp=$(mktemp -d "$GG_ROOT/cache/ozon-build.XXXXXX")
  trap 'rm -rf "$tmp"' EXIT
  cp -r "$src/ozon-research/." "$tmp/"   # node_modules - ссылка на кэш, копируется ссылкой
  ( cd "$tmp" && PAGES_BASE=/ozon-research NEXT_PUBLIC_NO_PHOTOS=1 NEXT_TELEMETRY_DISABLED=1 npm run build ) >&2
  [ -s "$tmp/out/index.html" ] || gg_die "Next.js не собрал out/index.html"
  cp "$tmp/demo/ozon-research.html" "$tmp/out/onepage.html"
  rm -rf "${cache:?}"; mkdir -p "$cache"
  mv "$tmp/out" "$cache/$key"
  gg_log "Карта ниш Ozon: собрана заново ($key)"
fi
mkdir -p "$SITE/ozon-research"
cp -al "$cache/$key/." "$SITE/ozon-research/"
[ -f "$SITE/ozon-research/onepage.html" ] || gg_die "нет onepage.html"
gg_log "Карта ниш Ozon: /ozon-research/, страниц $(find "$SITE/ozon-research" -name '*.html' | wc -l)"
