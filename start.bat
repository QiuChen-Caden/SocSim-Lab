@echo off
REM SocSim Lab v3.2 - 一键启动脚本 (Windows)
REM 此脚本会自动安装依赖并启动后端和前端服务

setlocal enabledelayedexpansion

REM 设置项目根目录
set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "FRONTEND_DIR=%ROOT%frontend"
set "DATA_DIR=%ROOT%data"

echo ========================================
echo  SocSim Lab v3.2 - 启动中...
echo ========================================
echo.

REM ========================================
REM Step 1: 检查并准备后端环境
REM ========================================
echo [1/4] 检查后端环境...
cd /d "%BACKEND_DIR%"

REM 创建数据目录
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"

REM 检查虚拟环境
if not exist "venv\Scripts\python.exe" (
    echo     - 创建 Python 虚拟环境...
    python -m venv venv
    if errorlevel 1 (
        echo     [X] Python 虚拟环境创建失败，请确保 Python 3.10+ 已安装
        pause
        exit /b 1
    )
)

REM 检查依赖
venv\Scripts\python.exe -c "import fastapi" 2>nul
if errorlevel 1 (
    echo     - 安装后端依赖...
    venv\Scripts\pip.exe install -r requirements.txt -q
)

echo     [v] 后端环境就绪
echo.

REM ========================================
REM Step 2: 检查并准备前端环境
REM ========================================
echo [2/4] 检查前端环境...
cd /d "%FRONTEND_DIR%"

if not exist "node_modules\" (
    echo     - 安装前端依赖...
    call npm install --silent
)

echo     [v] 前端环境就绪
echo.

REM ========================================
REM Step 3: 启动后端服务
REM ========================================
echo [3/4] 启动后端服务 (FastAPI)...
cd /d "%BACKEND_DIR%"
start "SocSim Backend" cmd /k "title SocSim Backend && venv\Scripts\python.exe main.py"

REM 等待后端启动
echo     - 等待后端服务就绪...
timeout /t 5 /nobreak >nul

REM 检查后端是否启动成功
curl -s http://localhost:8000/docs >nul 2>&1
if errorlevel 1 (
    echo     [!] 后端可能仍在初始化中，继续启动前端...
) else (
    echo     [v] 后端服务已启动
)
echo.

REM ========================================
REM Step 4: 启动前端服务
REM ========================================
echo [4/4] 启动前端服务 (Vite)...
cd /d "%FRONTEND_DIR%"
start "SocSim Frontend" cmd /k "title SocSim Frontend && npm run dev"

echo.
echo ========================================
echo  SocSim Lab 已启动!
echo ========================================
echo   后端 API:    http://localhost:8000
echo   API 文档:    http://localhost:8000/docs
echo   前端界面:    http://localhost:5173
echo ========================================
echo.
echo 提示: 关闭此窗口不会停止服务
echo       请在各自的服务窗口中按 Ctrl+C 停止服务
echo.
pause
