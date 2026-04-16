#!/bin/bash
# start.sh — launch backend + frontend together
# Usage: ./start.sh
# Stop:  Ctrl+C (kills both processes cleanly)

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

OK()   { echo -e "${GREEN}[✔]${NC} $1"; }
INFO() { echo -e "${BLUE}[+]${NC} $1"; }
WARN() { echo -e "${YELLOW}[!]${NC} $1"; }
FAIL() { echo -e "${RED}[✘]${NC} $1"; exit 1; }

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$PROJECT_DIR/frontend"
LOG_DIR="$PROJECT_DIR/logs"
mkdir -p "$LOG_DIR"

BACKEND_PID=""
FRONTEND_PID=""

# ── Cleanup on Ctrl+C or exit ─────────────────────────────
cleanup() {
    echo ""
    echo -e "${YELLOW}[!]${NC} Shutting down..."

    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID" 2>/dev/null
        OK "Backend stopped (PID $BACKEND_PID)"
    fi

    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" 2>/dev/null
        OK "Frontend stopped (PID $FRONTEND_PID)"
    fi

    # Kill any stragglers from previous runs
    pkill -f "uvicorn main:app" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true

    echo -e "${GREEN}[✔]${NC} All processes stopped."
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# ─────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       AI SOC SIEM — Starting Up        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# ── Preflight checks ──────────────────────────────────────
[ ! -f "$PROJECT_DIR/.env" ] && FAIL ".env not found — run ./setup.sh first"

source "$PROJECT_DIR/.env"

if [ -z "$GROQ_API_KEY" ] || [ "$GROQ_API_KEY" = "your_groq_key_here" ]; then
    FAIL "GROQ_API_KEY not set in .env\nGet your free key at: https://console.groq.com"
fi
OK "GROQ_API_KEY found"

[ ! -f "$PROJECT_DIR/venv/bin/activate" ] && FAIL "Python venv not found — run ./setup.sh first"

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    INFO "node_modules missing — running npm install..."
    cd "$FRONTEND_DIR"
    npm install --silent
    OK "npm install complete"
    cd "$PROJECT_DIR"
fi

# ── Kill any leftover processes from a previous run ───────
pkill -f "uvicorn main:app" 2>/dev/null && sleep 1 || true
pkill -f "vite" 2>/dev/null && sleep 1 || true

# ── Activate Python venv ──────────────────────────────────
source "$PROJECT_DIR/venv/bin/activate"

# ── Start FastAPI backend ─────────────────────────────────
INFO "Starting FastAPI backend..."
cd "$PROJECT_DIR"

uvicorn main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --log-level warning \
    > "$LOG_DIR/fastapi.log" 2>&1 &
BACKEND_PID=$!

# Wait for backend to be ready (up to 15s)
READY=0
for i in $(seq 1 15); do
    sleep 1
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>/dev/null || echo "000")
    if [ "$STATUS" = "200" ]; then
        READY=1
        break
    fi
done

if [ "$READY" -eq 0 ]; then
    WARN "Backend didn't respond on /health — check logs/fastapi.log"
else
    OK "Backend running → http://localhost:8000  (PID $BACKEND_PID)"
fi

# ── Start Vite frontend ────────────────────────────────────
INFO "Starting frontend..."
cd "$FRONTEND_DIR"

npm run dev \
    > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!

# Wait for Vite to be ready
sleep 3
VITE_READY=0
for i in $(seq 1 10); do
    sleep 1
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null | grep -qE "^(200|304)"; then
        VITE_READY=1
        break
    fi
done

if [ "$VITE_READY" -eq 0 ]; then
    WARN "Frontend didn't respond yet — check logs/frontend.log"
else
    OK "Frontend running → http://localhost:3000  (PID $FRONTEND_PID)"
fi

# ─────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           System is live!              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}Dashboard:${NC}   http://localhost:3000"
echo -e "  ${CYAN}API:${NC}         http://localhost:8000"
echo -e "  ${CYAN}API Docs:${NC}    http://localhost:8000/docs"
echo ""
echo -e "  ${CYAN}Logs:${NC}"
echo -e "    Backend:   tail -f $LOG_DIR/fastapi.log"
echo -e "    Frontend:  tail -f $LOG_DIR/frontend.log"
echo ""
echo -e "  ${YELLOW}Press Ctrl+C to stop both processes${NC}"
echo ""

# Keep script alive so Ctrl+C triggers cleanup
wait
