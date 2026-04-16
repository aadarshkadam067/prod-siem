#!/usr/bin/env bash
# ============================================================
# prod-siem — One-command setup
# ============================================================
# Usage:
#   ./setup.sh              # default: ES + Redis + backend + frontend
#   ./setup.sh --full       # also start TheHive + Cortex + Cassandra
#   ./setup.sh --infra-only # only start docker services
#   ./setup.sh --stop       # stop everything
#   ./setup.sh --reset      # nuke venv + node_modules and start clean
# ============================================================

set -euo pipefail

# ---------- Colors & helpers ----------
RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'; BLU='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${BLU}[INFO]${NC}  $*"; }
ok()    { echo -e "${GRN}[ OK ]${NC}  $*"; }
warn()  { echo -e "${YLW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*" >&2; exit 1; }

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# ---------- Parse args ----------
COMPOSE_PROFILE=""
INFRA_ONLY=false
STOP=false
RESET=false
for arg in "$@"; do
  case "$arg" in
    --full)        COMPOSE_PROFILE="--profile full" ;;
    --infra-only)  INFRA_ONLY=true ;;
    --stop)        STOP=true ;;
    --reset)       RESET=true ;;
    -h|--help)     sed -n '2,13p' "$0"; exit 0 ;;
    *) fail "Unknown argument: $arg (try --help)" ;;
  esac
done

# ---------- Stop mode ----------
if $STOP; then
  info "Stopping prod-siem..."
  pkill -f "uvicorn main:app" 2>/dev/null && ok "Backend stopped"  || warn "Backend not running"
  pkill -f "vite"             2>/dev/null && ok "Frontend stopped" || warn "Frontend not running"
  docker compose --profile full down 2>/dev/null || true
  ok "All services stopped."
  exit 0
fi

echo ""
echo "============================================"
echo "  prod-siem — AI-Powered SOC SIEM Platform"
echo "============================================"
echo ""

# ---------- Reset mode ----------
if $RESET; then
  warn "Reset mode: removing venv and frontend/node_modules"
  rm -rf venv .venv frontend/node_modules
  ok "Reset complete — proceeding with fresh install"
fi

# ---------- Preflight: required binaries ----------
info "Checking prerequisites..."
need() { command -v "$1" >/dev/null 2>&1 || fail "Missing required tool: $1
        Install with: $2"; }
need docker  "https://docs.docker.com/engine/install/"
need python3 "sudo apt install python3 python3-venv python3-pip"
need node    "sudo apt install nodejs npm  (or use nvm)"
need npm     "sudo apt install npm"
need curl    "sudo apt install curl"

docker info >/dev/null 2>&1 || fail "Docker daemon not reachable.
        Start it: sudo systemctl start docker
        Or grant access: sudo usermod -aG docker \$USER  (then log out/in)"

if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
  warn "Using legacy docker-compose v1 — consider upgrading"
else
  fail "Docker Compose not installed: https://docs.docker.com/compose/install/"
fi
ok "Prerequisites OK"

# ---------- Preflight: .env ----------
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    warn ".env not found — copying from .env.example"
    cp .env.example .env
    fail "Edit .env and add your GROQ_API_KEY, then re-run ./setup.sh
        Get a free key at: https://console.groq.com/keys"
  else
    fail ".env and .env.example both missing — cannot continue"
  fi
fi

set -a; source .env; set +a
if [ -z "${GROQ_API_KEY:-}" ] || [[ "$GROQ_API_KEY" == *"your_key_here"* ]] || [[ "$GROQ_API_KEY" == *"replace"* ]]; then
  warn "GROQ_API_KEY missing or still a placeholder — AI triage will be disabled"
fi
ok ".env loaded"

# ---------- Preflight: port conflicts ----------
check_port() {
  local port=$1 service=$2
  if command -v ss >/dev/null && ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${port}\$"; then
    fail "Port $port is already in use (needed for $service).
        Find process: sudo lsof -i :$port
        Kill it, or change the port in docker-compose.yml / .env"
  fi
}
info "Checking port availability..."
check_port 9200 "Elasticsearch"
check_port 6379 "Redis"
check_port "${APP_PORT:-8000}" "FastAPI backend"
$INFRA_ONLY || check_port 5173 "Vite frontend"
ok "Ports available"

# ---------- Bring up infrastructure ----------
info "Starting Docker infrastructure (1-3 min on first run)..."
$DC $COMPOSE_PROFILE up -d

info "Waiting for Elasticsearch..."
for i in {1..40}; do
  if curl -sfu "elastic:${ELASTICSEARCH_PASSWORD:-changeme}" http://localhost:9200/_cluster/health >/dev/null 2>&1; then
    ok "Elasticsearch is up"; break
  fi
  sleep 3
  [ "$i" -eq 40 ] && fail "Elasticsearch did not start. Check: $DC logs elasticsearch"
done

info "Waiting for Redis..."
for i in {1..15}; do
  if docker exec redis redis-cli ping 2>/dev/null | grep -q PONG; then
    ok "Redis is up"; break
  fi
  sleep 1
  [ "$i" -eq 15 ] && fail "Redis did not respond. Check: $DC logs redis"
done

if $INFRA_ONLY; then
  ok "Infrastructure-only mode — done."
  exit 0
fi

# ---------- Python backend ----------
# Detect existing venv (covers both venv/ and .venv/)
VENV_DIR=""
if   [ -d venv ];  then VENV_DIR="venv"
elif [ -d .venv ]; then VENV_DIR=".venv"
fi

if [ -z "$VENV_DIR" ]; then
  info "Creating Python virtual environment..."
  python3 -m venv venv || fail "Could not create venv. Install: sudo apt install python3-venv"
  VENV_DIR="venv"
fi

# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"
ok "Using venv: $VENV_DIR"

# ALWAYS run pip install — cheap if up to date, self-heals if requirements changed
info "Installing/updating Python dependencies..."
pip install --upgrade pip --quiet
if ! pip install -r requirements.txt --quiet; then
  warn "Quiet install failed — re-running with full output for diagnosis:"
  pip install -r requirements.txt
  fail "pip install failed (see output above)"
fi
ok "Python deps installed"

# ---------- Frontend ----------
if [ -d frontend ]; then
  info "Installing frontend dependencies..."
  pushd frontend >/dev/null
  if [ ! -d node_modules ]; then
    npm install --silent || fail "npm install failed in frontend/"
  fi
  popd >/dev/null
  ok "Frontend deps installed"
else
  warn "frontend/ not found — skipping frontend"
fi

# ---------- Start services ----------
mkdir -p logs

info "Starting FastAPI backend on :${APP_PORT:-8000}..."
nohup "$VENV_DIR/bin/uvicorn" main:app --host "${APP_HOST:-0.0.0.0}" --port "${APP_PORT:-8000}" \
  > logs/backend.log 2>&1 &
echo $! > logs/backend.pid

# Give uvicorn a moment, then verify
sleep 4
if ! kill -0 "$(cat logs/backend.pid)" 2>/dev/null; then
  echo ""
  echo -e "${RED}---------- Last 20 lines of logs/backend.log ----------${NC}"
  tail -n 20 logs/backend.log || true
  echo -e "${RED}-------------------------------------------------------${NC}"
  echo ""
  fail "Backend process exited. See log above for the actual error."
fi

# Confirm HTTP responds (process alive isn't enough)
for i in {1..10}; do
  if curl -sf "http://localhost:${APP_PORT:-8000}/health" >/dev/null 2>&1; then
    ok "Backend running and responding (PID $(cat logs/backend.pid))"
    break
  fi
  sleep 1
  if [ "$i" -eq 10 ]; then
    echo ""
    echo -e "${RED}---------- Last 20 lines of logs/backend.log ----------${NC}"
    tail -n 20 logs/backend.log || true
    echo -e "${RED}-------------------------------------------------------${NC}"
    echo ""
    fail "Backend process is alive but /health did not respond. See log above."
  fi
done

if [ -d frontend ]; then
  info "Starting Vite frontend on :5173..."
  pushd frontend >/dev/null
  nohup npm run dev > ../logs/frontend.log 2>&1 &
  echo $! > ../logs/frontend.pid
  popd >/dev/null
  sleep 2
  ok "Frontend running (PID $(cat logs/frontend.pid))"
fi

# ---------- Summary ----------
echo ""
echo -e "${GRN}============================================${NC}"
echo -e "${GRN}  prod-siem is up.${NC}"
echo -e "${GRN}============================================${NC}"
echo ""
echo "  Frontend:       http://localhost:5173"
echo "  Backend API:    http://localhost:${APP_PORT:-8000}"
echo "  API docs:       http://localhost:${APP_PORT:-8000}/docs"
echo "  Elasticsearch:  http://localhost:9200  (elastic / ${ELASTICSEARCH_PASSWORD:-changeme})"
[ -n "$COMPOSE_PROFILE" ] && echo "  TheHive:        http://localhost:9000"
[ -n "$COMPOSE_PROFILE" ] && echo "  Cortex:         http://localhost:9001"
echo ""
echo "  Logs:    tail -f logs/backend.log  logs/frontend.log"
echo "  Stop:    ./setup.sh --stop"
echo "  Reset:   ./setup.sh --reset    (nukes venv + node_modules)"
echo ""
