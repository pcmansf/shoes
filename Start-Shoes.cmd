@echo off
setlocal
cd /d "%~dp0"
set "SHOES_NODE="
for /f "delims=" %%i in ('where node 2^>nul') do if not defined SHOES_NODE set "SHOES_NODE=%%i"
if not defined SHOES_NODE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "SHOES_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined SHOES_NODE (
  echo Node.js 22.13 or newer is required. Install it from https://nodejs.org/ and try again.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:5173 in your browser.
echo Keep this window open while using Shoes. Close it to stop the app.
"%SHOES_NODE%" server.mjs
pause
