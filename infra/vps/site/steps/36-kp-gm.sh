# sections: kp-gm
# Порт шага «Build KP GLASS-MEMORY (isolated, /kp-gm/)»: папка ветки kp-glass-memory как есть,
# без README; штамп сборки = короткий коммит ветки (v.txt и __BUILD__ в index.html), как в GitHub.
src="$(gg_src kp-glass-memory)"
[ -s "$src/kp-glass-memory/index.html" ] || gg_die "нет $src/kp-glass-memory/index.html"
mkdir -p "$SITE/kp-gm"
cp -r "$src/kp-glass-memory/." "$SITE/kp-gm/"
rm -f "$SITE/kp-gm/README.md"
stamp=$(git -C "$src" rev-parse --short HEAD)
printf '%s' "$stamp" >"$SITE/kp-gm/v.txt"
sed -i "s/__BUILD__/$stamp/" "$SITE/kp-gm/index.html"
gg_log "КП GLASS-MEMORY: /kp-gm/, сборка $stamp"
