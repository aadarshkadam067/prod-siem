#!/bin/bash
# ============================================================
#  AI SOC SIEM — Health Check Script
# ============================================================

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL_COUNT=0
WARN_COUNT=0

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

check() {
    local NAME="$1"
    local CMD="$2"
    local EXPECTED="$3"

    RESULT=$(eval "$CMD" 2>/dev/null || echo "FAILED")

    if echo "$RESULT" | grep -q "$EXPECTED"; then
        echo -e "  ${GREEN}✔${NC} $NAME"
        ((PASS++))
        return 0
    else
        echo -e "  ${RED}✘${NC} $NAME ${RED}(got: ${RESULT:0:60})${NC}"
        ((FAIL_COUNT++))
        return 1
    fi
}

warn_check() {
    local NAME="$1"
    local CMD="$2"
    local EXPECTED="$3"

    RESULT=$(eval "$CMD" 2>/dev/null || echo "FAILED")

    if echo "$RESULT" | grep -q "$EXPECTED"; then
        echo -e "  ${GREEN}✔${NC} $NAME"
        ((PASS++))
    else
        echo -e "  ${YELLOW}!${NC} $NAME ${YELLOW}(may still be starting)${NC}"
        ((WARN_COUNT++))
    fi
}

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   AI SOC SIEM — Health Check              ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# ── Docker Containers ────────────────────────────────────
echo -e "${BLUE}Docker Services:${NC}"
check "Elasticsearch container" \
    "docker inspect --format='{{.State.Status}}' elasticsearch 2>/dev/null" \
    "running"

warn_check "Cassandra container (optional, --full profile)" \
    "docker inspect --format='{{.State.Status}}' cassandra 2>/dev/null" \
    "running"

check "Redis container" \
    "docker inspect --format='{{.State.Status}}' redis 2>/dev/null" \
    "running"

warn_check "TheHive container (optional, --full profile)" \
    "docker inspect --format='{{.State.Status}}' thehive 2>/dev/null" \
    "running"

warn_check "Cortex container (optional, --full profile)" \
    "docker inspect --format='{{.State.Status}}' cortex 2>/dev/null" \
    "running"

echo ""

# ── API Endpoints ─────────────────────────────────────────
echo -e "${BLUE}API Endpoints:${NC}"
check "Elasticsearch API" \
    "curl -s -o /dev/null -w '%{http_code}' -u elastic:changeme http://localhost:9200/_cluster/health" \
    "200"

check "Elasticsearch cluster status" \
    "curl -s -u elastic:changeme http://localhost:9200/_cluster/health" \
    "green\|yellow"

check "FastAPI backend" \
    "curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/health" \
    "200"

check "FastAPI health status" \
    "curl -s http://localhost:8000/health" \
    "healthy"

check "Redis ping" \
    "redis-cli ping" \
    "PONG"

warn_check "TheHive API (optional, --full profile)" \
    "curl -s -o /dev/null -w '%{http_code}' http://localhost:9000/api/status" \
    "200"

warn_check "Cortex API (optional, --full profile)" \
    "curl -s -o /dev/null -w '%{http_code}' http://localhost:9001/api/status" \
    "200"

echo ""

# ── Python Environment ────────────────────────────────────
echo -e "${BLUE}Python Environment:${NC}"
check "Virtual environment" \
    "test -f $PROJECT_DIR/venv/bin/activate && echo exists" \
    "exists"

check "Groq package installed" \
    "$PROJECT_DIR/venv/bin/pip show groq 2>/dev/null" \
    "groq"

check "FastAPI package installed" \
    "$PROJECT_DIR/venv/bin/pip show fastapi 2>/dev/null" \
    "fastapi"

check "Elasticsearch package installed" \
    "$PROJECT_DIR/venv/bin/pip show elasticsearch 2>/dev/null" \
    "elasticsearch"

echo ""

# ── Environment Config ────────────────────────────────────
echo -e "${BLUE}Configuration:${NC}"
check ".env file exists" \
    "test -f $PROJECT_DIR/.env && echo exists" \
    "exists"

source "$PROJECT_DIR/.env" 2>/dev/null || true

if [ -n "$GROQ_API_KEY" ] && [ "$GROQ_API_KEY" != "your_groq_key_here" ]; then
    echo -e "  ${GREEN}✔${NC} GROQ_API_KEY is set"
    ((PASS++))
else
    echo -e "  ${RED}✘${NC} GROQ_API_KEY not set — add to .env"
    ((FAIL_COUNT++))
fi

check "docker-compose.yml exists" \
    "test -f $PROJECT_DIR/docker-compose.yml && echo exists" \
    "exists"

echo ""

# ── AI Engine Test ────────────────────────────────────────
echo -e "${BLUE}AI Engine:${NC}"
if [ -n "$GROQ_API_KEY" ] && [ "$GROQ_API_KEY" != "your_groq_key_here" ]; then
    AI_RESULT=$(cd "$PROJECT_DIR" && source venv/bin/activate && python3 -c "
from groq import Groq
import os
from dotenv import load_dotenv
load_dotenv()
try:
    c = Groq(api_key=os.getenv('GROQ_API_KEY'))
    r = c.chat.completions.create(
        model='llama-3.3-70b-versatile',
        max_tokens=10,
        messages=[{'role':'user','content':'Reply: GROQ_OK'}]
    )
    print('GROQ_OK')
except Exception as e:
    print(f'ERROR: {e}')
" 2>/dev/null || echo "FAILED")

    if echo "$AI_RESULT" | grep -q "GROQ_OK"; then
        echo -e "  ${GREEN}✔${NC} Groq AI responding"
        ((PASS++))
    else
        echo -e "  ${RED}✘${NC} Groq AI not responding: ${AI_RESULT:0:80}"
        ((FAIL_COUNT++))
    fi
else
    echo -e "  ${YELLOW}!${NC} Groq AI skipped — no API key"
    ((WARN_COUNT++))
fi

# ── Processes ─────────────────────────────────────────────
echo ""
echo -e "${BLUE}Running Processes:${NC}"
if pgrep -f "uvicorn main:app" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✔${NC} FastAPI uvicorn process"
    ((PASS++))
else
    echo -e "  ${RED}✘${NC} FastAPI not running — run ./run.sh"
    ((FAIL_COUNT++))
fi

if pgrep -f "decision_engine.py" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✔${NC} AI decision engine process"
    ((PASS++))
else
    echo -e "  ${YELLOW}!${NC} AI decision engine not running — run ./run.sh"
    ((WARN_COUNT++))
fi

# ── Elasticsearch Indexes ─────────────────────────────────
echo ""
echo -e "${BLUE}Elasticsearch Indexes:${NC}"
for index in siem-alerts siem-events siem-cases; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
        -u elastic:changeme \
        "http://localhost:9200/$index" 2>/dev/null || echo "000")
    if [ "$STATUS" = "200" ]; then
        echo -e "  ${GREEN}✔${NC} Index: $index"
        ((PASS++))
    else
        echo -e "  ${YELLOW}!${NC} Index: $index (not created yet — run: python3 scripts/setup_indexes.py)"
        ((WARN_COUNT++))
    fi
done

# ── Final Summary ─────────────────────────────────────────
TOTAL=$((PASS + FAIL_COUNT + WARN_COUNT))
echo ""
echo -e "${BLUE}============================================${NC}"

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}  ✔ All systems operational${NC}"
    echo -e "  Passed: ${GREEN}$PASS${NC}  Warnings: ${YELLOW}$WARN_COUNT${NC}  Failed: ${RED}$FAIL_COUNT${NC}"
else
    echo -e "${RED}  ✘ $FAIL_COUNT critical issue(s) found${NC}"
    echo -e "  Passed: ${GREEN}$PASS${NC}  Warnings: ${YELLOW}$WARN_COUNT${NC}  Failed: ${RED}$FAIL_COUNT${NC}"
    echo ""
    echo -e "  Run ${BLUE}./setup.sh${NC} to fix issues"
fi

echo -e "${BLUE}============================================${NC}"
echo ""

[ $FAIL_COUNT -eq 0 ]
