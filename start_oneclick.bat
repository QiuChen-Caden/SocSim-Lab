@echo off
setlocal

REM SocSim Lab - One-click startup (keeps original start.bat untouched)
REM Starts backend and frontend in separate terminals, with basic env checks

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "FRONTEND_DIR=%ROOT%frontend"
set "DATA_DIR=%ROOT%data"

echo ========================================
echo SocSim Lab - One-click Startup
echo ========================================
echo Root: %ROOT%
echo.

where python >nul 2>&1
if errorlevel 1 (
  echo ERROR: python not found in PATH.
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: node not found in PATH.
  exit /b 1
)

if not exist "%DATA_DIR%" (
  mkdir "%DATA_DIR%"
)

echo [1/4] Freeing occupied ports (5173, 8765)...
powershell -NoProfile -Command "$ports=@(5173,8765); foreach($port in $ports){ $p=(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique); if($p){ $p | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }; Write-Host ('  stopped port '+$port+' pid(s): '+($p -join ',')) } else { Write-Host ('  port '+$port+' is free') } }"

echo [2/4] Starting backend terminal...
start "SocSim Backend (OneClick)" cmd /k ^
"cd /d %BACKEND_DIR% && ^
if not exist venv (python -m venv venv) && ^
call venv\Scripts\activate.bat && ^
if not exist venv\Lib\site-packages\fastapi (pip install -r requirements.txt) && ^
set OASIS_DB_PATH=%DATA_DIR%\oasis_frontend.db && ^
python main.py"

echo [3/4] Starting frontend terminal...
start "SocSim Frontend (OneClick)" cmd /k ^
"cd /d %FRONTEND_DIR% && ^
if not exist node_modules\vite (npm install) && ^
npm run dev -- --host 127.0.0.1 --port 5173"

echo [4/4] Done.
echo Frontend: http://localhost:5173
echo Backend API: http://127.0.0.1:8765
echo Backend docs: http://127.0.0.1:8765/docs
echo.
echo Original startup scripts are unchanged:
echo - start.bat
echo - start.sh

endlocal
