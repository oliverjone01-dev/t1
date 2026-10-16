#!/bin/bash
# ФЕНИКС #484: достать actionlint и shellcheck в scratch (недоверенные архивы - в отдельные каталоги)
set -u
B=/tmp/claude-0/-home-user-t1/76832855-1f9d-5a4f-aeaa-595f7a6dd8fa/scratchpad/fx484
mkdir -p "$B/al-dl" "$B/al" "$B/sc"
curl -sS -L --max-time 60 -o "$B/al-dl/actionlint.tgz" \
  "https://github.com/rhysd/actionlint/releases/download/v1.7.7/actionlint_1.7.7_linux_amd64.tar.gz"
echo "curl rc=$?"; ls -la "$B/al-dl"
file "$B/al-dl/actionlint.tgz" 2>/dev/null
tar -xzf "$B/al-dl/actionlint.tgz" -C "$B/al" actionlint && "$B/al/actionlint" -version
cd "$B/sc" && python3 -I -m zipfile -e "$B/pipdl/shellcheck_py-0.11.0.1-py2.py3-none-manylinux1_x86_64.manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_5_x86_64.whl" "$B/sc/"
SC=$(find "$B/sc" -type f -name shellcheck | head -1); echo "shellcheck: $SC"; chmod +x "$SC" && "$SC" --version | head -2
