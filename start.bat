@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local.ps1"
if errorlevel 1 (
    echo.
    echo Agent Room could not start. See .local\server-error.log for details.
    pause
    exit /b 1
)
exit /b 0
