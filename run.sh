#!/bin/bash
# ============================================================
#  AI SOC SIEM — Run Script
#  Starts FastAPI backend + AI decision engine
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

OK()  { echo -e "${GREEN}[✔]${NC} $1"; }
INFO(){ echo -e "${BLUE}[+]${NC} $1"; }
WARN(){ echo -e "${YELLOW}[!]${NC} $1"; }
FAIL(){ echo -e "${RED}[✘]${NC} $1"; exit 1; }

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   AI SOC SIEM — Starting System           ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# ── Check .env ────────────────────────────────────────────
if [ ! -f "$PROJECT_DIR/.env" ]; then
    FAIL ".env file not found. Run ./setup.sh first."
fi

source "$PROJECT_DIR/.env"

if [ -z "$GROQ_API_KEY" ] || [ "$GROQ_API_KEY" = "your_groq_key_here" ]; then
    FAIL "GROQ_API_KEY not set in .env\nGet free key at: https://console.groq.com\nThen: nano .env"
fi

# ── Check venv ────────────────────────────────────────────
if [ ! -f "$PROJECT_DIR/venv/bin/activate" ]; then
    FAIL "Virtual environment not found. Run ./setup.sh first."
fi
source "$PROJECT_DIR/venv/bin/activate"
OK "Virtual environment activated"

# ── Ensure pip packages are installed ─────────────────────
if ! "$PROJECT_DIR/venv/bin/python3" -c "import fastapi, uvicorn, groq" 2>/dev/null; then
    WARN "Missing packages — running pip install..."
    "$PROJECT_DIR/venv/bin/pip" install -r "$PROJECT_DIR/requirements.txt" -q \
        && OK "Packages installed" \
        || FAIL "pip install failed — check your internet and run ./setup.sh"
fi

# ── Ensure Docker stack is running ───────────────────────
INFO "Checking Docker services..."
cd "$PROJECT_DIR"

DOCKER_CMD="docker"
command -v docker &>/dev/null || FAIL "Docker not installed"
docker ps &>/dev/null || DOCKER_CMD="sudo docker"

RUNNING=$($DOCKER_CMD compose ps --services --filter "status=running" 2>/dev/null | wc -l)
if [ "$RUNNING" -lt 3 ]; then
    INFO "Starting Docker stack..."
    # Force-remove any containers with conflicting names regardless of which
    # compose project created them — compose down won't catch orphans from
    # other projects or manually created containers
    for name in thehive cortex kibana elasticsearch cassandra redis; do
        $DOCKER_CMD rm -f "$name" 2>/dev/null || true
    done
    $DOCKER_CMD compose down --remove-orphans 2>/dev/null || true
    $DOCKER_CMD compose up -d
    INFO "Waiting 30 seconds for services to initialize..."
    sleep 30
fi
OK "Docker services running ($RUNNING containers up)"

# ── Wait for Elasticsearch ────────────────────────────────
INFO "Checking Elasticsearch..."
for i in $(seq 1 12); do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -u elastic:changeme http://localhost:9200/_cluster/health 2>/dev/null || echo "000")
    if [ "$STATUS" = "200" ]; then
        OK "Elasticsearch ready"
        break
    fi
    echo -n "."
    sleep 5
done

# ── Kill any existing processes ───────────────────────────
INFO "Stopping any existing SIEM processes..."
pkill -f "uvicorn main:app" 2>/dev/null && sleep 2 || true
pkill -f "decision_engine.py" 2>/dev/null && sleep 1 || true

# ── Create logs dir ───────────────────────────────────────
mkdir -p "$PROJECT_DIR/logs" "$PROJECT_DIR/reports"

# ── Start FastAPI Backend ─────────────────────────────────
INFO "Starting FastAPI backend..."
cd "$PROJECT_DIR"
nohup "$PROJECT_DIR/venv/bin/python3" -m uvicorn main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --log-level info \
    > "$PROJECT_DIR/logs/fastapi.log" 2>&1 &
FASTAPI_PID=$!
echo $FASTAPI_PID > "$PROJECT_DIR/logs/fastapi.pid"

# Wait for FastAPI to be ready (up to 24s)
FASTAPI_READY=0
sleep 4
for i in $(seq 1 10); do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>/dev/null || echo "000")
    if [ "$STATUS" = "200" ]; then
        OK "FastAPI backend running (PID: $FASTAPI_PID)"
        FASTAPI_READY=1
        break
    fi
    sleep 2
done
if [ "$FASTAPI_READY" -eq 0 ]; then
    WARN "FastAPI did not start — last log lines:"
    tail -20 "$PROJECT_DIR/logs/fastapi.log" 2>/dev/null | sed "s/^/    /"
    FAIL "Backend failed to start. Fix the error above, then re-run ./run.sh"
fi

# ── Start AI Decision Engine ──────────────────────────────
INFO "Starting AI decision engine daemon..."
cd "$PROJECT_DIR"
nohup "$PROJECT_DIR/venv/bin/python3" ai_engine/decision_engine.py --mode daemon \
    > "$PROJECT_DIR/logs/ai_engine.log" 2>&1 &
AI_PID=$!
echo $AI_PID > "$PROJECT_DIR/logs/ai_engine.pid"
sleep 2
OK "AI decision engine running (PID: $AI_PID)"

# ── Summary ───────────────────────────────────────────────
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   System Running!                         ${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "  ${BLUE}FastAPI Backend:${NC}    http://localhost:8000"
echo -e "  ${BLUE}API Docs:${NC}           http://localhost:8000/docs"
echo -e "  ${BLUE}Kibana:${NC}             http://localhost:5601"
echo -e "  ${BLUE}TheHive:${NC}            http://localhost:9000"
echo -e "  ${BLUE}Cortex:${NC}             http://localhost:9001"
echo -e "  ${BLUE}Elasticsearch:${NC}      http://localhost:9200"
echo ""
echo -e "  ${BLUE}Logs:${NC}"
echo -e "    FastAPI:    tail -f $PROJECT_DIR/logs/fastapi.log"
echo -e "    AI Engine:  tail -f $PROJECT_DIR/logs/ai_engine.log"
echo ""
echo -e "  ${BLUE}Stop system:${NC}        ./stop.sh"
echo -e "  ${BLUE}Health check:${NC}       ./health_check.sh"
echo ""

# ── Run health check ──────────────────────────────────────
sleep 2
"$PROJECT_DIR/health_check.sh" || true

# Start continuous alert generator
nohup python3 soc_simulation/continuous_generator.py \
  > "$PROJECT_DIR/logs/alert_generator.log" 2>&1 &
echo $! > "$PROJECT_DIR/logs/generator.pid"
echo "[✔] Alert generator running"
