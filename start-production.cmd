@echo off
setlocal

REM Optional: set an absolute path if you prefer (overrides script location)
set "PROJECT_DIR=%~dp0"
REM Example:
REM set "PROJECT_DIR=C:\path\to\Guestbooking\"

cd /d "%PROJECT_DIR%"

call npm run build
if errorlevel 1 (
  echo Build failed. Aborting.
  exit /b 1
)

call npm run start -- -H 0.0.0.0 -p 3000
