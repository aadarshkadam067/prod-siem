#!/bin/bash
# ============================================================
#  AI SOC SIEM — Stop Script
# ============================================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}[+]${NC} Stopping AI SOC SIEM..."

# Stop FastAPI
if [ -f "$PROJECT_DIR/logs/fastapi.pid" ]; then
    PID=$(cat "$PROJECT_DIR/logs/fastapi.pid")
    kill $PID 2>/dev/null && echo -e "${GREEN}[✔]${NC} FastAPI stopped" || true
    rm -f "$PROJECT_DIR/logs/fastapi.pid"
fi
pkill -f "uvicorn main:app" 2>/dev/null || true

# Stop AI Engine
if [ -f "$PROJECT_DIR/logs/ai_engine.pid" ]; then
    PID=$(cat "$PROJECT_DIR/logs/ai_engine.pid")
    kill $PID 2>/dev/null && echo -e "${GREEN}[✔]${NC} AI engine stopped" || true
    rm -f "$PROJECT_DIR/logs/ai_engine.pid"
fi
pkill -f "decision_engine.py" 2>/dev/null || true

# Stop Docker stack
echo -e "${BLUE}[+]${NC} Stopping Docker stack..."
cd "$PROJECT_DIR"
docker compose down 2>/dev/null || sudo docker compose down 2>/dev/null || true

echo -e "${GREEN}[✔]${NC} All services stopped"
