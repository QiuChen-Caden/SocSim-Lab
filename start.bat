@echo off
REM SocSim Lab - Startup Script
REM This script starts both backend and frontend servers

setlocal

REM Set project root directory
set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "FRONTEND_DIR=%ROOT%frontend"
set "DATA_DIR=%ROOT%data"
set "OASIS_DB_PATH=%DATA_DIR%\oasis_frontend.db"

REM Set log file path to fixed location
set "BACKEND_LOG_FILE=C:\Users\Lenovo\Desktop\SocSim-Lab\backend_launch_check.err.log"

REM Set conda environment name
set "CONDA_ENV=socsim-env"

echo ========================================
echo SocSim Lab - Starting Development Environment
echo ========================================
echo.
echo Backend Log File: %BACKEND_LOG_FILE%
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
    echo ERROR: Node.js is not installed or not in PATH.
    echo Please install Node.js 18+ to run frontend.
    pause
    exit /b 1
)

echo Step 1: Preparing Backend Environment...
echo ========================================
cd /d "%BACKEND_DIR%"
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"

REM Create conda env if it doesn't exist
if not exist "%BACKEND_DIR%\env_setup_done.flag" (
    echo Creating Conda env %CONDA_ENV% (Python 3.11)...
    conda run -n %CONDA_ENV% python --version >nul 2>&1
    if errorlevel 1 (
        conda create -n %CONDA_ENV% python=3.11 -y
        if errorlevel 1 (
            echo ERROR: failed to create Conda environment %CONDA_ENV%.
            pause
            exit /b 1
        )
    )

    REM Check if oasis-main submodule exists
    if not exist "%ROOT%oasis-main" (
        echo WARNING: oasis-main submodule not found at %ROOT%oasis-main
        echo Please ensure oasis-main is present in the project root.
        echo.
        echo Skipping oasis-main installation...
    ) else (
        REM Install oasis-main if oasis-main exists
        echo Installing OASIS (oasis-main)...
        conda run -n %CONDA_ENV% python -m pip install -e ..\oasis-main
    )

    REM Mark conda setup as done
    echo env_setup_done > "%BACKEND_DIR%\env_setup_done.flag"
)
if exist "%BACKEND_DIR%\env_setup_done.flag" (
    conda run -n %CONDA_ENV% python --version >nul 2>&1
    if errorlevel 1 (
        echo Conda env %CONDA_ENV% missing, recreating...
        conda create -n %CONDA_ENV% python=3.11 -y
        if errorlevel 1 (
            echo ERROR: failed to create Conda environment %CONDA_ENV%.
            pause
            exit /b 1
        )
    )
)

REM Install backend dependencies if needed
echo Installing backend dependencies...
conda run -n %CONDA_ENV% python -m pip install -r requirements.txt

REM Import personas if database doesn't exist
if not exist "%OASIS_DB_PATH%" (
    echo.
    echo Importing Twitter personas...
    conda run -n %CONDA_ENV% python import_personas.py --file ../twitter_personas_20260123_222506.json
)

echo.
echo Step 2: Starting Backend Server...
echo ========================================
echo.
echo Backend will log to: %BACKEND_LOG_FILE%
echo.
echo Starting backend server on http://localhost:8000
echo.

REM Start backend in new window
start "SocSim Backend" cmd /k conda run -n %CONDA_ENV% python main.py

cd /d "%FRONTEND_DIR%"

REM Step 3: Starting Frontend Server...
echo ========================================
echo.

REM Check frontend dependencies
if not exist "node_modules\.vite" (
    echo Installing frontend dependencies...
    call npm.cmd install
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
