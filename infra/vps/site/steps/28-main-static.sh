# sections: smm markplan stand-protocol
# Порт части шага «Assemble site (prod)» из deploy-pages.yml: статика из main копируется как есть.
# Ссылки на github.io внутри переписывает nginx (sub_filter), файлы не правим.
src=$(gg_src main)
for d in smm/public GG-markplan-2026/public; do [ -d "$src/$d" ] || gg_die "нет $d в main"; done
mkdir -p "$SITE/smm" "$SITE/markplan"
cp -r "$src/smm/public/." "$SITE/smm/"
cp -r "$src/GG-markplan-2026/public/." "$SITE/markplan/"
# Протокол стенда в GitHub необязателен (if -d): так же и здесь
if [ -d "$src/stand-protocol/public" ]; then
  mkdir -p "$SITE/stand-protocol"
  cp -r "$src/stand-protocol/public/." "$SITE/stand-protocol/"
fi
gg_log "Статика main: /smm/, /markplan/$( [ -d "$SITE/stand-protocol" ] && echo ', /stand-protocol/'), main ${src##*/}"
