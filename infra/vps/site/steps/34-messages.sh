# sections: messages
# Порт шага «Build GG message automation (isolated, /messages/)» из deploy-pages.yml: статика из ветки claude/gg-message-automation-ffpwpd как есть, без npm.
src="$(gg_src claude/gg-message-automation-ffpwpd)/gg-message-automation/public"
[ -d "$src" ] || gg_die "нет $src"
mkdir -p "$SITE/messages"
cp -r "$src/." "$SITE/messages/"
gg_log "/messages/ из claude/gg-message-automation-ffpwpd (${src%/gg-message-automation/public})"
