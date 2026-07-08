#!/usr/bin/env bash
# yd-report.sh — Yandex Direct Reports API wrapper
# Usage: ./yd-report.sh <report_type> [date_from] [date_to]
# report_type: campaign | adgroup | keyword | search_query
# Example: ./yd-report.sh campaign 2026-01-01 2026-01-31

set -euo pipefail

SECRETS_FILE="${HOME}/.secrets/yandex-direct.json"
REPORTS_URL="https://api.direct.yandex.com/json/v5/reports"

# Credentials priority: (1) env vars > (2) repo-local .env (gitignored) >
# (3) ~/.secrets file. Real tokens never live in git.
OAUTH_TOKEN="${YANDEX_DIRECT_TOKEN:-}"
CLIENT_LOGIN="${YANDEX_DIRECT_LOGIN:-}"

if [[ -z "$OAUTH_TOKEN" ]]; then
    ENV_FILE="${YANDEX_DIRECT_ENV_FILE:-}"
    if [[ -z "$ENV_FILE" ]]; then
        REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || true)
        [[ -n "$REPO_ROOT" && -f "$REPO_ROOT/yandex-direct/.env" ]] && ENV_FILE="$REPO_ROOT/yandex-direct/.env"
    fi
    if [[ -n "$ENV_FILE" && -f "$ENV_FILE" ]]; then
        set -a; source "$ENV_FILE"; set +a
        OAUTH_TOKEN="${YANDEX_DIRECT_TOKEN:-}"
        CLIENT_LOGIN="${YANDEX_DIRECT_LOGIN:-}"
    fi
fi

if [[ -z "$OAUTH_TOKEN" && -f "$SECRETS_FILE" ]]; then
    OAUTH_TOKEN=$(jq -r '.oauth_token // empty' "$SECRETS_FILE")
    CLIENT_LOGIN=$(jq -r '.client_login // empty' "$SECRETS_FILE")
fi

if [[ -z "$OAUTH_TOKEN" || "$OAUTH_TOKEN" == "null" ]]; then
    echo "ERROR: token not found. Set env var YANDEX_DIRECT_TOKEN, or add oauth_token to $SECRETS_FILE" >&2
    exit 1
fi

REPORT_TYPE="${1:?Usage: yd-report.sh <campaign|adgroup|keyword|search_query> [date_from] [date_to]}"
DATE_FROM="${2:-$(date -d '-30 days' +%Y-%m-%d 2>/dev/null || date -v-30d +%Y-%m-%d)}"
DATE_TO="${3:-$(date +%Y-%m-%d)}"

# Map report type to fields
case "$REPORT_TYPE" in
    campaign)
        FIELD_NAMES='["CampaignName","CampaignId","Impressions","Clicks","Ctr","AvgCpc","Cost","Conversions","CostPerConversion","ConversionRate"]'
        REPORT_NAME="Campaign Report"
        REPORT_PRESET="CAMPAIGN_PERFORMANCE_REPORT"
        ;;
    adgroup)
        FIELD_NAMES='["CampaignName","AdGroupName","AdGroupId","Impressions","Clicks","Ctr","AvgCpc","Cost","Conversions","CostPerConversion"]'
        REPORT_NAME="Ad Group Report"
        REPORT_PRESET="ADGROUP_PERFORMANCE_REPORT"
        ;;
    keyword)
        FIELD_NAMES='["CampaignName","AdGroupName","Criteria","CriteriaId","Impressions","Clicks","Ctr","AvgCpc","Cost","Conversions","CostPerConversion"]'
        REPORT_NAME="Keyword Report"
        REPORT_PRESET="CRITERIA_PERFORMANCE_REPORT"
        ;;
    search_query)
        FIELD_NAMES='["CampaignName","AdGroupName","Query","Impressions","Clicks","Ctr","AvgCpc","Cost","Conversions"]'
        REPORT_NAME="Search Query Report"
        REPORT_PRESET="SEARCH_QUERY_PERFORMANCE_REPORT"
        ;;
    *)
        echo "ERROR: Unknown report type '$REPORT_TYPE'. Use: campaign, adgroup, keyword, search_query" >&2
        exit 1
        ;;
esac

# Build report request
REQUEST_BODY=$(cat <<EOF
{
    "params": {
        "SelectionCriteria": {
            "DateFrom": "$DATE_FROM",
            "DateTo": "$DATE_TO"
        },
        "FieldNames": $FIELD_NAMES,
        "ReportName": "$REPORT_NAME $(date +%s)",
        "ReportType": "$REPORT_PRESET",
        "DateRangeType": "CUSTOM_DATE",
        "Format": "TSV",
        "IncludeVAT": "YES",
        "IncludeDiscount": "NO"
    }
}
EOF
)

# Optional Client-Login header (required for agency accounts)
LOGIN_HEADER=()
if [[ -n "${CLIENT_LOGIN:-}" ]]; then
    LOGIN_HEADER=(-H "Client-Login: ${CLIENT_LOGIN}")
fi

# Request report (may need polling for large reports)
HTTP_CODE=$(curl -s -o /tmp/yd-report-response.txt -w "%{http_code}" \
    -X POST "$REPORTS_URL" \
    -H "Authorization: Bearer ${OAUTH_TOKEN}" \
    "${LOGIN_HEADER[@]}" \
    -H "Content-Type: application/json; charset=utf-8" \
    -H "Accept-Language: ru" \
    -H "processingMode: auto" \
    -H "returnMoneyInMicros: false" \
    -d "$REQUEST_BODY")

case "$HTTP_CODE" in
    200)
        echo "Report ready:"
        cat /tmp/yd-report-response.txt
        ;;
    201)
        echo "Report queued. Retry in 10-20 seconds."
        RETRY_AFTER=$(grep -i 'retryIn' /tmp/yd-report-response.txt || echo "15")
        echo "Retry after: ${RETRY_AFTER}s"
        ;;
    202)
        echo "Report is being generated. Retry in 10-20 seconds."
        ;;
    400)
        echo "ERROR: Bad request" >&2
        cat /tmp/yd-report-response.txt >&2
        exit 1
        ;;
    *)
        echo "ERROR: HTTP $HTTP_CODE" >&2
        cat /tmp/yd-report-response.txt >&2
        exit 1
        ;;
esac
