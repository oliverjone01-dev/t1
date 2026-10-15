# C4: собрать текст всех листов (выгрузка dump.py) в событие PreToolUse для anti-slop-checker.sh
# python3 -I -B dump.py <xlsx> <dir>; python3 -I -B c4_event.py <dir> | bash .claude/hooks/anti-slop-checker.sh
import json, glob, os, sys
d = sys.argv[1]
txt = '\n'.join(open(p).read() for p in sorted(glob.glob(os.path.join(d, '*.txt'))))
print(json.dumps({'tool_name': 'Write', 'tool_input': {'file_path': '/tmp/book.txt', 'content': txt}}, ensure_ascii=False))
