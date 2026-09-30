@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

set "NODE_EXE="
for /f "delims=" %%I in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%I"
if defined NODE_EXE (
  call :verify_node
  if not errorlevel 1 goto run
)

set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%NODE_EXE%" (
  call :verify_node
  if not errorlevel 1 goto run
)

echo No usable Node.js found. Installing the current Node.js LTS with WinGet...
where winget >nul 2>nul
if errorlevel 1 goto missing_winget
winget install --id OpenJS.NodeJS.LTS --exact --source winget
if errorlevel 1 goto install_failed

set "NODE_EXE="
if exist "%ProgramW6432%\nodejs\node.exe" set "NODE_EXE=%ProgramW6432%\nodejs\node.exe"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\Microsoft\WinGet\Links\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Microsoft\WinGet\Links\node.exe"
if not defined NODE_EXE for /f "delims=" %%I in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%I"
if not defined NODE_EXE goto install_failed
call :verify_node
if errorlevel 1 goto install_failed
goto run

:verify_node
"%NODE_EXE%" -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)" >nul 2>nul
if errorlevel 1 exit /b 1
exit /b 0

:run
echo Using: %NODE_EXE%
"%NODE_EXE%" server.mjs
set "GAME_EXIT=%errorlevel%"
echo Game server stopped with exit code %GAME_EXIT%.
pause
exit /b %GAME_EXIT%

:missing_winget
echo WinGet is not available. Install App Installer or Node.js LTS from https://nodejs.org/en/download/ and run this file again.
pause
exit /b 1

:install_failed
echo Node.js installation did not complete. Check the message above, then run this file again.
pause
exit /b 1
