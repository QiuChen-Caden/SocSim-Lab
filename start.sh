#!/bin/bash
# SocSim Lab - Startup Script
# This script starts both the backend and frontend servers

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"
DATA_DIR="$ROOT/data"
OASIS_DB_PATH="$DATA_DIR/oasis_frontend.db"
OASIS_RUNTIME_DB_PATH="$DATA_DIR/oasis_simulation_run.db"
CONDA_ENV="socsim-py311"

echo "========================================"
echo "SocSim Lab - Starting Development Environment"
echo "========================================"
echo ""

# Prefer Conda if available; otherwise fall back to python3 venv.
USE_CONDA=0
if command -v conda &> /dev/null; then
    USE_CONDA=1
else
    echo "WARN: conda not found. Falling back to python3 venv."
fi

if [ "$USE_CONDA" -eq 0 ]; then
    if ! command -v python3 &> /dev/null; then
        echo "ERROR: python3 is not installed or not in PATH"
        echo "Please install Python 3.11 (recommended) or install conda."
        exit 1
    fi
    PY_VER="$(python3 - <<'PY'
import sys
print(f"{sys.version_info.major}.{sys.version_info.minor}")
PY
)"
    PY_MAJOR="${PY_VER%%.*}"
    PY_MINOR="${PY_VER#*.}"
    PY_MINOR="${PY_MINOR%%.*}"
    if [ "$PY_MAJOR" -gt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -ge 12 ]; }; then
        echo "ERROR: Python $PY_VER detected. OASIS requires Python < 3.12."
        echo "Please install Python 3.11 or use conda."
        exit 1
    fi
    if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 10 ]; }; then
        echo "ERROR: Python $PY_VER detected. Please install Python 3.10+."
        exit 1
    fi
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed"
    echo "Please install Node.js 18+ to run the frontend"
    exit 1
fi

if [ ! -d "$ROOT/oasis-main" ]; then
    echo "ERROR: oasis-main folder not found at $ROOT/oasis-main"
    echo "Please ensure oasis-main is present in the project root."
    exit 1
fi

mkdir -p "$DATA_DIR"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "========================================"
    echo "Stopping all servers..."
    echo "========================================"

    # Kill background processes
    if [ -n "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi

    echo "Development environment stopped"
    exit 0
}

# Trap SIGINT and SIGTERM
trap cleanup SIGINT SIGTERM

# Step 1: Start Backend Server
echo "Step 1: Preparing Backend Server..."
echo "========================================"
cd "$BACKEND_DIR"

if [ "$USE_CONDA" -eq 1 ]; then
    # Create conda env if it doesn't exist
    if ! conda env list | grep -q "$CONDA_ENV"; then
        echo "Creating Conda env $CONDA_ENV (Python 3.11)..."
        conda create -n "$CONDA_ENV" python=3.11 -y
    fi

    # Install dependencies if needed
    if ! conda run -n "$CONDA_ENV" python -m pip show fastapi >/dev/null 2>&1; then
        echo "Installing backend dependencies..."
        conda run -n "$CONDA_ENV" python -m pip install -r requirements.txt
    fi

    # Install OASIS (oasis-main) if needed
    if ! conda run -n "$CONDA_ENV" python -m pip show camel-oasis >/dev/null 2>&1; then
        echo "Installing OASIS (oasis-main)..."
        conda run -n "$CONDA_ENV" python -m pip install -e ../oasis-main
    fi
else
    # Fallback: venv
    if [ ! -d "venv" ]; then
        echo "Creating python venv..."
        python3 -m venv venv
    fi
    # shellcheck disable=SC1091
    source venv/bin/activate
    python -m pip show fastapi >/dev/null 2>&1 || python -m pip install -r requirements.txt
    python -m pip show camel-oasis >/dev/null 2>&1 || python -m pip install -e ../oasis-main
fi

# Import personas if database doesn't exist
if [ ! -f "$OASIS_DB_PATH" ]; then
    echo ""
    echo "Importing Twitter personas..."
    if [ "$USE_CONDA" -eq 1 ]; then
        OASIS_DB_PATH="$OASIS_DB_PATH" conda run -n "$CONDA_ENV" python import_personas.py --file twitter_personas_20260123_222506.json
    else
        OASIS_DB_PATH="$OASIS_DB_PATH" python import_personas.py --file twitter_personas_20260123_222506.json
    fi
fi

# Start backend in background
echo "Starting backend server on http://localhost:8000"
if [ "$USE_CONDA" -eq 1 ]; then
    OASIS_DB_PATH="$OASIS_DB_PATH" OASIS_RUNTIME_DB_PATH="$OASIS_RUNTIME_DB_PATH" PYTHONIOENCODING=utf-8 \
        conda run -n "$CONDA_ENV" python main.py &
else
    OASIS_DB_PATH="$OASIS_DB_PATH" OASIS_RUNTIME_DB_PATH="$OASIS_RUNTIME_DB_PATH" PYTHONIOENCODING=utf-8 \
        python main.py &
fi
BACKEND_PID=$!

cd ..

# Wait a bit for backend to start
sleep 2

# Check if backend started successfully
if ! ps -p $BACKEND_PID > /dev/null; then
    echo "ERROR: Backend failed to start. Check the logs above for errors."
    exit 1
fi

# Step 2: Start Frontend Server
echo ""
echo "Step 2: Starting Frontend Server..."
echo "========================================"
cd "$FRONTEND_DIR"

# Install frontend dependencies if needed
if [ ! -d "node_modules/vite" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

# Copy .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file from example..."
    cp .env.example .env
fi

# Start frontend (foreground, blocking)
echo "Starting frontend server on http://localhost:5173"
echo ""
echo "========================================"
echo "Servers are running!"
echo "  Frontend: http://localhost:5173"
echo "  Backend API: http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all servers"
echo "========================================"
echo ""

npm run dev

# Cleanup when frontend exits
cleanup
