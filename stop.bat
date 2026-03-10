@echo off
REM SocSim Lab - 停止所有服务

echo ========================================
echo  SocSim Lab - 停止服务
echo ========================================
echo.

REM 尝试停止后端和前端进程
echo 正在停止服务...
taskkill /FI "WINDOWTITLE eq SocSim Backend*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq SocSim Frontend*" /F >nul 2>&1
taskkill /FI "IMAGENAME eq python.exe" /FI "WINDOWTITLE eq cmd*" /F >nul 2>&1
taskkill /FI "IMAGENAME eq node.exe" /F >nul 2>&1

echo.
echo [v] 服务已停止
echo.
pause
