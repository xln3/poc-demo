#!/bin/bash
# Health monitor — polls service health endpoints and alerts on failure.
# Usage:
#   ./deploy/health-monitor.sh                 # one-shot check
#   ./deploy/health-monitor.sh --loop 60       # check every 60 seconds
#   ALERT_WEBHOOK=https://hooks.slack.com/... ./deploy/health-monitor.sh --loop 60
#
# Environment variables:
#   BASE_URL       — base URL to check (default: http://localhost:5175)
#   ALERT_WEBHOOK  — Slack/webhook URL for failure notifications (optional)
#   ALERT_EMAIL    — email address for notifications via `mail` command (optional)

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:5175}"
ALERT_WEBHOOK="${ALERT_WEBHOOK:-}"
ALERT_EMAIL="${ALERT_EMAIL:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

check_endpoint() {
    local name="$1" url="$2" expect_field="$3"
    local http_code body

    http_code=$(curl -sf -o /tmp/health_body.txt -w '%{http_code}' --max-time 10 "$url" 2>/dev/null) || http_code="000"
    body=$(cat /tmp/health_body.txt 2>/dev/null || echo "")

    if [ "$http_code" = "200" ]; then
        if [ -n "$expect_field" ] && ! echo "$body" | grep -q "$expect_field"; then
            echo -e "${YELLOW}[WARN]${NC} $name — HTTP 200 but missing '$expect_field' in response"
            return 1
        fi
        echo -e "${GREEN}[OK]${NC}   $name — HTTP $http_code"
        return 0
    else
        echo -e "${RED}[FAIL]${NC} $name — HTTP $http_code"
        return 1
    fi
}

send_alert() {
    local message="$1"
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    if [ -n "$ALERT_WEBHOOK" ]; then
        curl -sf -X POST "$ALERT_WEBHOOK" \
            -H 'Content-Type: application/json' \
            -d "{\"text\": \"🚨 POC-Demo Health Alert ($timestamp)\\n$message\"}" \
            > /dev/null 2>&1 || echo "  (webhook send failed)"
    fi

    if [ -n "$ALERT_EMAIL" ] && command -v mail &> /dev/null; then
        echo "$message" | mail -s "POC-Demo Health Alert ($timestamp)" "$ALERT_EMAIL" 2>/dev/null || true
    fi
}

run_checks() {
    local failures=0
    local fail_messages=""

    echo "=== POC-Demo Health Check — $(date) ==="
    echo "Target: $BASE_URL"
    echo ""

    # Frontend (nginx)
    if ! check_endpoint "Frontend (nginx)" "$BASE_URL/" ""; then
        failures=$((failures + 1))
        fail_messages="${fail_messages}Frontend (nginx) is DOWN\n"
    fi

    # Backend API
    if ! check_endpoint "Backend API" "$BASE_URL/health" '"status"'; then
        failures=$((failures + 1))
        fail_messages="${fail_messages}Backend API is DOWN\n"
    fi

    # Database (via backend health)
    local health_body
    health_body=$(curl -sf --max-time 10 "$BASE_URL/health" 2>/dev/null || echo "")
    if echo "$health_body" | grep -q '"database":"error"'; then
        echo -e "${RED}[FAIL]${NC} Database — reported as error in /health"
        failures=$((failures + 1))
        fail_messages="${fail_messages}Database connection is failing\n"
    elif echo "$health_body" | grep -q '"database":"ok"'; then
        echo -e "${GREEN}[OK]${NC}   Database — connected"
    fi

    # Docker daemon
    if docker info > /dev/null 2>&1; then
        local running
        running=$(docker ps --filter "name=poc-demo" --format '{{.Names}}' 2>/dev/null | wc -l)
        echo -e "${GREEN}[OK]${NC}   Docker — $running poc-demo containers running"
    else
        echo -e "${YELLOW}[WARN]${NC} Docker — cannot connect to daemon"
    fi

    echo ""
    if [ "$failures" -gt 0 ]; then
        echo -e "${RED}$failures check(s) FAILED${NC}"
        send_alert "$(echo -e "$fail_messages")"
        return 1
    else
        echo -e "${GREEN}All checks passed${NC}"
        return 0
    fi
}

# Main
if [ "${1:-}" = "--loop" ]; then
    interval="${2:-60}"
    echo "Starting health monitor loop (interval: ${interval}s)"
    echo "Press Ctrl+C to stop"
    echo ""
    while true; do
        run_checks || true
        echo ""
        sleep "$interval"
    done
else
    run_checks
fi
