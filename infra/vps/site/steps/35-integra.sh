# sections: integra
# Порт шага «Build INTEGRA plan (isolated, /integra/)» из deploy-pages.yml: статика из ветки claude/gentero-plan-03609o как есть, без npm.
src="$(gg_src claude/gentero-plan-03609o)/gentero-integra/public"
[ -d "$src" ] || gg_die "нет $src"
mkdir -p "$SITE/integra"
cp -r "$src/." "$SITE/integra/"
gg_log "/integra/ из claude/gentero-plan-03609o (${src%/gentero-integra/public})"
