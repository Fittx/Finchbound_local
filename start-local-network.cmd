@echo off
rem Double-click to run Finchbound so phones on the same Wi-Fi can open it. Close the window to stop.
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies, first run only...
  call corepack pnpm install || goto :error
)
call npm run local:lan
goto :eof
:error
echo Setup failed. Check that Node 22.12 or newer is installed.
pause
