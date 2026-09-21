@echo off
setlocal
cd /d "%~dp0"
if errorlevel 1 exit /b 1
echo Building Agent Room...
call npm.cmd run build:ordered
if errorlevel 1 (
    echo.
    echo Build failed. Fix the errors above and run start.bat again.
    echo The server launcher was not run.
    pause
    exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local.ps1"
if errorlevel 1 (
    echo.
    echo Agent Room could not start. See .local\server-error.log for details.
    pause
    exit /b 1
)
echo.
echo Open in your browser: http://localhost:5173/
echo.
pause
exit /b 0
