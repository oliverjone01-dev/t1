# sections: op-gm
# Порт шага «Build OP-GM automation (isolated, /op-gm/)» из deploy-pages.yml: статика из ветки op-gm-automation-v1 как есть, без npm.
src="$(gg_src op-gm-automation-v1)/op-gm-automation/public"
[ -d "$src" ] || gg_die "нет $src"
mkdir -p "$SITE/op-gm"
cp -r "$src/." "$SITE/op-gm/"
gg_log "/op-gm/ из op-gm-automation-v1 (${src%/op-gm-automation/public})"
