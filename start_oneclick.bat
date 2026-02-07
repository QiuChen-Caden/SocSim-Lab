@echo off
setlocal

REM SocSim Lab - One-click startup (keeps original start.bat untouched)
REM Starts backend and frontend in separate terminals, with basic env checks

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "FRONTEND_DIR=%ROOT%frontend"
set "DATA_DIR=%ROOT%data"
set "OASIS_DB_PATH=%DATA_DIR%\oasis_frontend.db"
set "OASIS_RUNTIME_DB_PATH=%DATA_DIR%\oasis_simulation_run.db"
set "CONDA_ENV=socsim-py311"

echo ========================================
echo SocSim Lab - One-click Startup
echo ========================================
echo Root: %ROOT%
echo.

where conda >nul 2>&1
if errorlevel 1 (
  echo ERROR: conda not found in PATH.
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: node not found in PATH.
  exit /b 1
)

if not exist "%ROOT%oasis-main" (
  echo ERROR: oasis-main folder not found at %ROOT%oasis-main
  exit /b 1
)

if not exist "%DATA_DIR%" (
  mkdir "%DATA_DIR%"
)

echo [1/4] Freeing occupied ports (5173, 8000)...
powershell -NoProfile -Command "$ports=@(5173,8000); foreach($port in $ports){ $p=(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique); if($p){ $p | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }; Write-Host ('  stopped port '+$port+' pid(s): '+($p -join ',')) } else { Write-Host ('  port '+$port+' is free') } }"

echo [2/4] Preparing backend environment...
cd /d "%BACKEND_DIR%"
set "ENV_FOUND="
for /f %%i in ('conda env list ^| findstr /i /c:"%CONDA_ENV%"') do set "ENV_FOUND=1"
if not defined ENV_FOUND (
  echo Creating Conda env %CONDA_ENV% (Python 3.11)...
  conda create -n %CONDA_ENV% python=3.11 -y
)

conda run -n %CONDA_ENV% python -m pip show fastapi >nul 2>&1
if errorlevel 1 (
  echo Installing backend dependencies...
  conda run -n %CONDA_ENV% python -m pip install -r requirements.txt
)

conda run -n %CONDA_ENV% python -m pip show camel-oasis >nul 2>&1
if errorlevel 1 (
  echo Installing OASIS (oasis-main)...
  conda run -n %CONDA_ENV% python -m pip install -e ..\oasis-main
)

if not exist "%OASIS_DB_PATH%" (
  echo Importing Twitter personas...
  set "OASIS_DB_PATH=%OASIS_DB_PATH%"
  conda run -n %CONDA_ENV% python import_personas.py --file twitter_personas_20260123_222506.json
)

echo Starting backend terminal...
start "SocSim Backend (OneClick)" cmd /k "cd /d \"%BACKEND_DIR%\" && set OASIS_DB_PATH=%OASIS_DB_PATH% && set OASIS_RUNTIME_DB_PATH=%OASIS_RUNTIME_DB_PATH% && set PYTHONIOENCODING=utf-8 && conda run -n %CONDA_ENV% python main.py"

echo [3/4] Starting frontend terminal...
start "SocSim Frontend (OneClick)" cmd /k "cd /d \"%FRONTEND_DIR%\" && if not exist node_modules\\vite call npm.cmd install && call npm.cmd run dev -- --host 127.0.0.1 --port 5173"

echo [4/4] Done.
echo Frontend: http://localhost:5173
echo Backend API: http://127.0.0.1:8000
echo Backend docs: http://127.0.0.1:8000/docs
echo.
echo Original startup scripts are unchanged:
echo - start.bat
echo - start.sh

endlocal
