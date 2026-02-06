@echo off
REM SocSim Lab - Startup Script
REM This script starts both the backend and frontend servers

echo ========================================
echo SocSim Lab - Starting Development Environment
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.10+ to run the backend
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js 18+ to run the frontend
    pause
    exit /b 1
)

echo Step 1: Starting Backend Server...
echo ========================================
cd backend

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    echo Creating Python virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install dependencies if needed
if not exist "venv\Lib\site-packages\fastapi" (
    echo Installing backend dependencies...
    pip install -r requirements.txt
)

REM Import personas if database doesn't exist
if not exist "data\oasis_frontend.db" (
    echo.
    echo Importing Twitter personas...
    python import_personas.py
)

REM Start backend in new window
echo Starting backend server on http://localhost:8000
start "SocSim Backend" cmd /k "cd /d %CD% && venv\Scripts\activate.bat && set PYTHONIOENCODING=utf-8 && python main.py"

cd ..

echo.
echo Step 2: Starting Frontend Server...
echo ========================================
cd frontend

REM Install frontend dependencies if needed
if not exist "node_modules\vite" (
    echo Installing frontend dependencies...
    call npm.cmd install
)

REM Copy .env file if it doesn't exist
if not exist ".env" (
    echo Creating .env file from example...
    copy .env.example .env
)

REM Start frontend
echo Starting frontend server on http://localhost:5173
call npm.cmd run dev

cd ..

echo.
echo ========================================
echo Development environment stopped
echo ========================================
pause
