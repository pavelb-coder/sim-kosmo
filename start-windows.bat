@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

if "%~1"=="" (
    set "PORT=8086"
) else (
    set "PORT=%~1"
)

echo ========================================================
echo   КосмоЛаб (sim-kosmo) — запуск на Windows (порт %PORT%)
echo ========================================================

where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Найден Node.js. Запуск сервера на http://localhost:%PORT% ...
    node server.js --port %PORT% --open
    goto :eof
)

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Node.js не найден, запуск через Python на http://localhost:%PORT% ...
    start "" "http://localhost:%PORT%"
    python -m http.server %PORT% --bind 0.0.0.0
    goto :eof
)

where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Запуск через Python Launcher на http://localhost:%PORT% ...
    start "" "http://localhost:%PORT%"
    py -3 -m http.server %PORT% --bind 0.0.0.0
    goto :eof
)

echo [!] Не найден ни Node.js, ни Python 3.
echo Установите Node.js (https://nodejs.org/) или откройте онлайн-версию:
echo https://pavelb-coder.github.io/sim-kosmo/
start "" "https://pavelb-coder.github.io/sim-kosmo/"
pause
