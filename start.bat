@echo off
REM SocSim Lab - Startup Script
REM This script starts both the backend and frontend servers
setlocal

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "FRONTEND_DIR=%ROOT%frontend"
set "DATA_DIR=%ROOT%data"
set "OASIS_DB_PATH=%DATA_DIR%\oasis_frontend.db"
set "OASIS_RUNTIME_DB_PATH=%DATA_DIR%\oasis_simulation_run.db"
set "CONDA_ENV=socsim-py311"

echo ========================================
echo SocSim Lab - Starting Development Environment
echo ========================================
echo.

REM Check if Conda is installed
where conda >nul 2>&1
if errorlevel 1 (
    echo ERROR: conda not found in PATH.
    echo Please install Anaconda/Miniconda and retry.
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

if not exist "%ROOT%oasis-main" (
    echo ERROR: oasis-main folder not found at %ROOT%oasis-main
    echo Please ensure oasis-main is present in the project root.
    pause
    exit /b 1
)

if not exist "%DATA_DIR%" (
    mkdir "%DATA_DIR%"
)

echo Step 1: Preparing Backend Environment...
echo ========================================
cd /d "%BACKEND_DIR%"

REM Create conda env if it doesn't exist
set "ENV_FOUND="
for /f %%i in ('conda env list ^| findstr /i /c:"%CONDA_ENV%"') do set "ENV_FOUND=1"
if not defined ENV_FOUND (
    echo Creating Conda env %CONDA_ENV% (Python 3.11)...
    conda create -n %CONDA_ENV% python=3.11 -y
)

REM Install backend dependencies if needed
conda run -n %CONDA_ENV% python -m pip show fastapi >nul 2>&1
if errorlevel 1 (
    echo Installing backend dependencies...
    conda run -n %CONDA_ENV% python -m pip install -r requirements.txt
)

REM Install OASIS (oasis-main) if needed
conda run -n %CONDA_ENV% python -m pip show camel-oasis >nul 2>&1
if errorlevel 1 (
    echo Installing OASIS (oasis-main)...
    conda run -n %CONDA_ENV% python -m pip install -e ..\oasis-main
)

REM Import personas if database doesn't exist
if not exist "%OASIS_DB_PATH%" (
    echo.
    echo Importing Twitter personas...
    set "OASIS_DB_PATH=%OASIS_DB_PATH%"
    conda run -n %CONDA_ENV% python import_personas.py --file twitter_personas_20260123_222506.json
)

REM Start backend in new window
echo Starting backend server on http://localhost:8000
start "SocSim Backend" cmd /k "cd /d %CD% && set OASIS_DB_PATH=%OASIS_DB_PATH% && set OASIS_RUNTIME_DB_PATH=%OASIS_RUNTIME_DB_PATH% && set PYTHONIOENCODING=utf-8 && conda run -n %CONDA_ENV% python main.py"

cd ..

echo.
echo Step 2: Starting Frontend Server...
echo ========================================
cd /d "%FRONTEND_DIR%"

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
endlocal
