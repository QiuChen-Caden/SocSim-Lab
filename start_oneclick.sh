#!/bin/bash
set -euo pipefail

# SocSim Lab - One-click startup (keeps original start.sh untouched)

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"
DATA_DIR="$ROOT/data"

echo "========================================"
echo "SocSim Lab - One-click Startup"
echo "========================================"
echo "Root: $ROOT"
echo

command -v python3 >/dev/null || { echo "ERROR: python3 not found."; exit 1; }
command -v node >/dev/null || { echo "ERROR: node not found."; exit 1; }

mkdir -p "$DATA_DIR"

echo "[1/4] Freeing occupied ports (5173, 8765)..."
if command -v lsof >/dev/null; then
  for p in 5173 8765; do
    pid="$(lsof -ti tcp:$p || true)"
    if [[ -n "${pid}" ]]; then
      kill -9 $pid || true
      echo "  stopped port $p pid(s): $pid"
    else
      echo "  port $p is free"
    fi
  done
else
  echo "  lsof not found, skipping automatic port cleanup"
fi

echo "[2/4] Starting backend..."
(
  cd "$BACKEND_DIR"
  [[ -d venv ]] || python3 -m venv venv
  # shellcheck disable=SC1091
  source venv/bin/activate
  python3 -c "import fastapi" >/dev/null 2>&1 || pip install -r requirements.txt
  export OASIS_DB_PATH="$DATA_DIR/oasis_frontend.db"
  nohup python main.py >/tmp/socsim-backend.log 2>&1 &
  echo "  backend log: /tmp/socsim-backend.log"
)

echo "[3/4] Starting frontend..."
(
  cd "$FRONTEND_DIR"
  [[ -d node_modules/vite ]] || npm install
  nohup npm run dev -- --host 127.0.0.1 --port 5173 >/tmp/socsim-frontend.log 2>&1 &
  echo "  frontend log: /tmp/socsim-frontend.log"
)

echo "[4/4] Done."
echo "Frontend: http://localhost:5173"
echo "Backend API: http://127.0.0.1:8765"
echo "Backend docs: http://127.0.0.1:8765/docs"
echo
echo "Original startup scripts are unchanged:"
echo "- start.bat"
echo "- start.sh"
