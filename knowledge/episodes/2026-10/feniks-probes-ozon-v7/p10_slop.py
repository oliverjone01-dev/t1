import json, subprocess
N = '/tmp/claude-0/-home-user-t1/76dea677-6fab-5e1c-b5c2-6cb8af229fe7/scratchpad/2026-10-14-ozon-variant1-plan.md'
ev = {'tool_name': 'Write', 'tool_input': {'file_path': '/tmp/x/note.md', 'content': open(N).read()}}
r = subprocess.run(['bash', '/home/user/t1/.claude/hooks/anti-slop-checker.sh'], input=json.dumps(ev), capture_output=True, text=True, cwd='/home/user/t1')
print('rc', r.returncode); print('stdout', r.stdout[:2000]); print('stderr', r.stderr[:500])
