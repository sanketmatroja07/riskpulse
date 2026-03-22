#!/bin/bash
set -e

# ============================================================
# RiskPulse - One Command Startup (Local Mode)
# No Docker, Postgres, or Redis required!
# Uses SQLite + in-process workers
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
API_DIR="$SCRIPT_DIR/apps/api"
WEB_DIR="$SCRIPT_DIR/apps/web"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down...${NC}"
    kill $API_PID $WEB_PID $WORKER_PID 2>/dev/null
    wait $API_PID $WEB_PID $WORKER_PID 2>/dev/null
    echo -e "${GREEN}All processes stopped.${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM

echo -e "${BLUE}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║        RiskPulse - Local Dev Mode        ║"
echo "  ║   Investigation Automation Platform      ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${NC}"

# ---- Step 1: Check prerequisites ----
echo -e "${YELLOW}[1/5] Checking prerequisites...${NC}"

if ! command -v python3 &>/dev/null; then
    echo -e "${RED}ERROR: python3 not found. Install Python 3.11+${NC}"
    exit 1
fi

if ! command -v node &>/dev/null; then
    echo -e "${RED}ERROR: node not found. Install Node.js 18+${NC}"
    exit 1
fi

echo "  Python: $(python3 --version)"
echo "  Node:   $(node --version)"

# ---- Step 2: Setup Python virtual env + deps ----
echo -e "${YELLOW}[2/5] Setting up Python backend...${NC}"

cd "$API_DIR"
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "  Created virtual environment"
fi

source venv/bin/activate
pip install -q --upgrade pip 2>/dev/null
pip install -q -r requirements.txt 2>&1 | tail -1
echo "  Python dependencies installed"

# ---- Step 3: Seed the database ----
echo -e "${YELLOW}[3/5] Initializing database + seed data...${NC}"

export MODE=local
cd "$API_DIR"

# Use --fresh flag to reset the database
if [ "$1" = "--fresh" ]; then
    echo "  Removing old database for fresh start..."
    rm -f data/riskpulse.db
fi

python3 seed/seed_data.py

# ---- Step 4: Install frontend deps ----
echo -e "${YELLOW}[4/5] Setting up frontend...${NC}"

cd "$WEB_DIR"
if [ ! -d "node_modules" ]; then
    npm install --silent 2>&1 | tail -3
    echo "  Frontend dependencies installed"
else
    echo "  Frontend dependencies already installed"
fi

# ---- Step 5: Start everything ----
echo -e "${YELLOW}[5/5] Starting services...${NC}"
echo ""

# Start API
cd "$API_DIR"
source venv/bin/activate
export MODE=local
uvicorn main:app --host 0.0.0.0 --port 8000 --reload --log-level info &
API_PID=$!
echo -e "  ${GREEN}✓ API server starting on http://localhost:8000${NC}"
echo -e "    Swagger docs: ${BLUE}http://localhost:8000/docs${NC}"

# Start Worker (background) - use -m so models/ is found
cd "$API_DIR"
PYTHONPATH="$API_DIR" python3 workers/worker_main.py &
WORKER_PID=$!
echo -e "  ${GREEN}✓ Worker process started${NC}"

# Start Frontend (use 3001 if 3000 is busy, e.g. portfolio)
cd "$WEB_DIR"
WEB_PORT=3000
if (lsof -i :3000 &>/dev/null); then
  WEB_PORT=3001
  echo -e "  ${YELLOW}Port 3000 in use, using 3001${NC}"
fi
npx next dev -p "$WEB_PORT" &
WEB_PID=$!
echo -e "  ${GREEN}✓ Frontend starting on http://localhost:$WEB_PORT${NC}"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  RiskPulse v2.0 - SaaS Edition is running!${NC}"
echo ""
echo -e "  Frontend:  ${BLUE}http://localhost:$WEB_PORT${NC}"
echo -e "  API:       ${BLUE}http://localhost:8000${NC}"
echo -e "  API Docs:  ${BLUE}http://localhost:8000/docs${NC}"
echo ""
echo -e "  Demo accounts (org: RiskPulse Demo):"
echo -e "    Admin:    admin@riskpulse.io / riskpulse123"
echo -e "    Analyst:  sarah.chen@riskpulse.io / riskpulse123"
echo -e "    Engineer: alex.kumar@riskpulse.io / riskpulse123"
echo -e "    Viewer:   viewer@riskpulse.io / riskpulse123"
echo ""
echo -e "  New: Sign up at ${BLUE}http://localhost:3000/signup${NC} to create your own org"
echo -e "  Settings: ${BLUE}http://localhost:3000/settings${NC} (API keys, billing, team)"
echo ""
echo -e "  ${YELLOW}Press Ctrl+C to stop all services${NC}"
echo -e "  ${YELLOW}Use './run.sh --fresh' to reset the database${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""

# Wait for all processes
wait
