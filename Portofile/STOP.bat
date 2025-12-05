@echo off
echo.
echo Stopping all Node.js servers...
taskkill /F /IM node.exe >nul 2>&1
echo.
echo All servers stopped!
echo.
pause
