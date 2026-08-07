#!/usr/bin/env bash
# yd-creds.sh — resolve Yandex Direct OAuth credentials for the wrapper scripts.
#
# Sourced (not executed) by yd-api.sh / yd-report.sh. On success exports:
#   OAUTH_TOKEN   — Bearer token for api.direct.yandex.com
#   CLIENT_LOGIN  — client login for agency accounts (may be empty)
#
# Priority matches yandex-direct/README.md:
#   1. Environment variables      YANDEX_DIRECT_TOKEN / YANDEX_DIRECT_LOGIN  (web default)
#   2. Repo-local .env            yandex-direct/.env                          (gitignored)
#   3. Local secrets file         ~/.secrets/yandex-direct.json               (terminal use)
#
# Exits non-zero with an actionable message when no token is found.

# Absolute dir of this file, so the repo-local .env is found regardless of CWD.
_YD_CREDS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# scripts → direct → skills → yandex-direct
_YD_ENV_FILE="$(cd "${_YD_CREDS_DIR}/../../.." && pwd)/.env"
_YD_SECRETS_FILE="${HOME}/.secrets/yandex-direct.json"

OAUTH_TOKEN=""
CLIENT_LOGIN=""

if [[ -n "${YANDEX_DIRECT_TOKEN:-}" ]]; then
    # 1. Environment variables (recommended for Claude Code on the web)
    OAUTH_TOKEN="${YANDEX_DIRECT_TOKEN}"
    CLIENT_LOGIN="${YANDEX_DIRECT_LOGIN:-}"
elif [[ -f "${_YD_ENV_FILE}" ]]; then
    # 2. Repo-local .env (gitignored; simple KEY=value file)
    # shellcheck disable=SC1090
    set -a; source "${_YD_ENV_FILE}"; set +a
    OAUTH_TOKEN="${YANDEX_DIRECT_TOKEN:-}"
    CLIENT_LOGIN="${YANDEX_DIRECT_LOGIN:-}"
elif [[ -f "${_YD_SECRETS_FILE}" ]]; then
    # 3. Local secrets file (for terminal use)
    OAUTH_TOKEN="$(jq -r '.oauth_token // empty' "${_YD_SECRETS_FILE}")"
    CLIENT_LOGIN="$(jq -r '.client_login // empty' "${_YD_SECRETS_FILE}")"
fi

if [[ -z "${OAUTH_TOKEN}" || "${OAUTH_TOKEN}" == "null" ]]; then
    echo "ERROR: Yandex Direct token not found." >&2
    echo "  Provide one of:" >&2
    echo "    - env var YANDEX_DIRECT_TOKEN (+ optional YANDEX_DIRECT_LOGIN)" >&2
    echo "    - ${_YD_ENV_FILE} with YANDEX_DIRECT_TOKEN=..." >&2
    echo "    - ${_YD_SECRETS_FILE} with {\"oauth_token\":\"...\"}" >&2
    exit 1
fi

export OAUTH_TOKEN CLIENT_LOGIN
