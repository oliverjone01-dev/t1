#!/bin/bash
# ФЕНИКС #484: actionlint+shellcheck и workflow_hygiene на голове a8b1100d (и сравнение с cda91883/базой)
B=/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/fx484
AL=$B/al/actionlint
SC=$B/sc/shellcheck_py-0.11.0.1.data/scripts/shellcheck
for rev in 4445697070f51a2335badda7966c44e9d5a8df96 cda91883813839c1186f1304fd8945799b1c0c79 a8b1100d19f44c388f5506367b7766b89beb2cf8; do
  d="$B/rev-${rev:0:8}/.github/workflows"; mkdir -p "$d"
  git -C /home/user/t1-wt show "$rev:.github/workflows/orders-backfill.yml" > "$d/orders-backfill.yml"
  echo "===== ${rev:0:8} actionlint"
  (cd "$B/rev-${rev:0:8}" && "$AL" -shellcheck "$SC" -no-color -format '{{range $err := .}}{{$err.Filepath}}:{{$err.Line}}:{{$err.Column}}: {{$err.Message}} [{{$err.Kind}}]{{"\n"}}{{end}}' .github/workflows/orders-backfill.yml; echo "rc=$?")
  echo "===== ${rev:0:8} hygiene"
  (cd "$B/rev-${rev:0:8}" && python3 -I /home/user/t1-wt/tools/ci/workflow_hygiene.py .github/workflows/orders-backfill.yml; echo "rc=$?")
done
