#!/bin/bash
set -euo pipefail

# SocSim Lab - One-click startup (keeps original start.sh untouched)

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"
DATA_DIR="$ROOT/data"
OASIS_DB_PATH="$DATA_DIR/oasis_frontend.db"
OASIS_RUNTIME_DB_PATH="$DATA_DIR/oasis_simulation_run.db"
CONDA_ENV="socsim-py311"

echo "========================================"
echo "SocSim Lab - One-click Startup"
echo "========================================"
echo "Root: $ROOT"
echo

USE_CONDA=0
if command -v conda >/dev/null; then
  USE_CONDA=1
else
  echo "WARN: conda not found. Falling back to python3 venv."
fi

if [[ "$USE_CONDA" -eq 0 ]]; then
  command -v python3 >/dev/null || { echo "ERROR: python3 not found."; exit 1; }
  PY_VER="$(python3 - <<'PY'
import sys
print(f"{sys.version_info.major}.{sys.version_info.minor}")
PY
)"
  PY_MAJOR="${PY_VER%%.*}"
  PY_MINOR="${PY_VER#*.}"
  PY_MINOR="${PY_MINOR%%.*}"
  if [[ "$PY_MAJOR" -gt 3 || ( "$PY_MAJOR" -eq 3 && "$PY_MINOR" -ge 12 ) ]]; then
    echo "ERROR: Python $PY_VER detected. OASIS requires Python < 3.12."
    exit 1
  fi
  if [[ "$PY_MAJOR" -lt 3 || ( "$PY_MAJOR" -eq 3 && "$PY_MINOR" -lt 10 ) ]]; then
    echo "ERROR: Python $PY_VER detected. Please install Python 3.10+."
    exit 1
  fi
fi
command -v node >/dev/null || { echo "ERROR: node not found."; exit 1; }

if [[ ! -d "$ROOT/oasis-main" ]]; then
  echo "ERROR: oasis-main folder not found at $ROOT/oasis-main"
  exit 1
fi

mkdir -p "$DATA_DIR"

echo "[1/4] Freeing occupied ports (5173, 8000)..."
if command -v lsof >/dev/null; then
  for p in 5173 8000; do
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

echo "[2/4] Preparing backend..."
(
  cd "$BACKEND_DIR"
  if [[ "$USE_CONDA" -eq 1 ]]; then
    if ! conda env list | grep -q "$CONDA_ENV"; then
      echo "  creating Conda env $CONDA_ENV (Python 3.11)..."
      conda create -n "$CONDA_ENV" python=3.11 -y
    fi
    conda run -n "$CONDA_ENV" python -m pip show fastapi >/dev/null 2>&1 || \
      conda run -n "$CONDA_ENV" python -m pip install -r requirements.txt
    conda run -n "$CONDA_ENV" python -m pip show camel-oasis >/dev/null 2>&1 || \
      conda run -n "$CONDA_ENV" python -m pip install -e ../oasis-main
    if [[ ! -f "$OASIS_DB_PATH" ]]; then
      echo "  importing Twitter personas..."
      OASIS_DB_PATH="$OASIS_DB_PATH" conda run -n "$CONDA_ENV" python import_personas.py --file twitter_personas_20260123_222506.json
    fi
    export OASIS_DB_PATH
    export OASIS_RUNTIME_DB_PATH
    export PYTHONIOENCODING=utf-8
    nohup conda run -n "$CONDA_ENV" python main.py >/tmp/socsim-backend.log 2>&1 &
  else
    [[ -d venv ]] || python3 -m venv venv
    # shellcheck disable=SC1091
    source venv/bin/activate
    python -m pip show fastapi >/dev/null 2>&1 || python -m pip install -r requirements.txt
    python -m pip show camel-oasis >/dev/null 2>&1 || python -m pip install -e ../oasis-main
    if [[ ! -f "$OASIS_DB_PATH" ]]; then
      echo "  importing Twitter personas..."
      OASIS_DB_PATH="$OASIS_DB_PATH" python import_personas.py --file twitter_personas_20260123_222506.json
    fi
    export OASIS_DB_PATH
    export OASIS_RUNTIME_DB_PATH
    export PYTHONIOENCODING=utf-8
    nohup python main.py >/tmp/socsim-backend.log 2>&1 &
  fi
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
echo "Backend API: http://127.0.0.1:8000"
echo "Backend docs: http://127.0.0.1:8000/docs"
echo
echo "Original startup scripts are unchanged:"
echo "- start.bat"
echo "- start.sh"
