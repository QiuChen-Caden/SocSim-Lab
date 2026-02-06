#!/bin/bash
# SocSim Lab - Startup Script
# This script starts both the backend and frontend servers

echo "========================================"
echo "SocSim Lab - Starting Development Environment"
echo "========================================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed"
    echo "Please install Python 3.10+ to run the backend"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed"
    echo "Please install Node.js 18+ to run the frontend"
    exit 1
fi

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

    # Deactivate virtual environment
    if [ -n "$VIRTUAL_ENV" ]; then
        deactivate
    fi

    echo "Development environment stopped"
    exit 0
}

# Trap SIGINT and SIGTERM
trap cleanup SIGINT SIGTERM

# Step 1: Start Backend Server
echo "Step 1: Starting Backend Server..."
echo "========================================"
cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies if needed
if [ ! -d "venv/lib/python*/site-packages/fastapi" ]; then
    echo "Installing backend dependencies..."
    pip install -r requirements.txt
fi

# Import personas if database doesn't exist
if [ ! -f "data/oasis_frontend.db" ]; then
    echo ""
    echo "Importing Twitter personas..."
    python import_personas.py
fi

# Start backend in background
echo "Starting backend server on http://localhost:8000"
python main.py &
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
cd frontend

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
