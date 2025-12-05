@echo off
echo.
echo ========================================
echo   Starting Portfolio + Jack AI
echo ========================================
echo.

REM Start Jack AI Platform
echo [1/2] Starting Jack AI Platform (Port 3030)...
start "Jack AI Platform" /MIN cmd /k "cd /d D:\HDD\test1\Company_App\template-WEBSITE\Axiom_App\systems\marketplace\Portofile && node jack-server.js"

REM Wait 2 seconds
timeout /t 2 /nobreak >nul

REM Start Portfolio Server
echo [2/2] Starting Portfolio Server (Port 8080)...
start "Portfolio Server" /MIN cmd /k "cd /d D:\HDD\test1\Company_App\template-WEBSITE\Axiom_App\systems\marketplace\Portofile && node server.js"

REM Wait 3 seconds
timeout /t 3 /nobreak >nul

REM Open browser
echo.
echo Opening browser at http://localhost:8080
start http://localhost:8080

echo.
echo ========================================
echo   Servers Started Successfully!
echo ========================================
echo.
echo   Portfolio: http://localhost:8080
echo   Jack AI:   http://localhost:3030
echo.
echo Press any key to exit...
pause >nul
