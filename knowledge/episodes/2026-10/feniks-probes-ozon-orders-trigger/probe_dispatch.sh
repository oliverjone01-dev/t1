#!/bin/bash
# ФЕНИКС #484, проба D1-dispatch: шаг «Запуск ozon-snapshots после сбора по съёму» (a8b1100d) против
# подставного API (python http.server на localhost). Сценарии: 204 сразу; 500 x2 затем 204; всегда 500;
# 422 (workflow без dispatch/ref не тот); соединение отклонено. sleep - no-op (логика ретраев та же).
# Проверяем: код возврата шага, число попыток, тело запроса (ref), путь, заголовок Authorization.
set -u
B=/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/fx484/dispatch
mkdir -p "$B"; R="$B/run-$(date +%s%N)"; mkdir -p "$R/bin"
printf '#!/bin/sh\nexit 0\n' > "$R/bin/sleep"; chmod +x "$R/bin/sleep"
YML=$(git -C /home/user/t1-wt show a8b1100d19f44c388f5506367b7766b89beb2cf8:.github/workflows/orders-backfill.yml)
printf '%s\n' "$YML" | python3 -I -c '
import sys, yaml
d = yaml.safe_load(sys.stdin.read())
for s in d["jobs"]["orders"]["steps"]:
    if s.get("name", "").startswith("Запуск ozon-snapshots"):
        print("IF:", s.get("if"), file=sys.stderr)
        print(s["run"].replace("${{ secrets.GITHUB_TOKEN }}", "ghs_FAKE"))
' > "$R/step.sh" 2> "$R/if.txt"
cat "$R/if.txt"
cat > "$R/srv.py" <<'PY'
import http.server, json, sys
seq = sys.argv[2].split(",")
state = {"i": 0}
log = open(sys.argv[3], "a")
class H(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0)); body = self.rfile.read(n).decode()
        code = int(seq[min(state["i"], len(seq) - 1)]); state["i"] += 1
        log.write(json.dumps({"path": self.path, "auth": self.headers.get("Authorization"), "body": body, "code": code}) + "\n"); log.flush()
        self.send_response(code); self.end_headers()
        if code != 204: self.wfile.write(b'{"message":"probe"}')
    def log_message(self, *a): pass
http.server.HTTPServer(("127.0.0.1", int(sys.argv[1])), H).serve_forever()
PY
run_case () { # name, seq, port
  local name="$1" seq="$2" port="$3" log="$R/$1.log"
  : > "$log"
  if [ "$seq" != "refused" ]; then python3 -I "$R/srv.py" "$port" "$seq" "$log" & local pid=$!; sleep_real=1; /bin/sleep 0.6; fi
  ( cd "$R" && PATH="$R/bin:$PATH" GITHUB_API_URL="http://127.0.0.1:$port" GITHUB_REPOSITORY="oliverjone01-dev/t1" \
      bash --noprofile --norc -eo pipefail "$R/step.sh" > "$R/$name.out" 2>&1 ); local rc=$?
  [ "$seq" != "refused" ] && kill "$pid" 2>/dev/null
  echo "== $name: код шага $rc; запросов к API $(wc -l < "$log"); последняя строка вывода: $(tail -n 1 "$R/$name.out")"
  head -n 1 "$log"
}
run_case ok "204" 18731
run_case flaky "500,500,204" 18732
run_case down "500" 18733
run_case unproc "422" 18734
run_case refused "refused" 18739
grep -h "попытка 1" "$R/refused.out" | head -1
echo "каталог: $R"
