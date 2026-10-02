@echo off
rem Copyright (C) 2026 Tide Card contributors
rem SPDX-License-Identifier: GPL-3.0-only
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

call :find_node
if not errorlevel 1 goto run

echo No usable Node.js found. Installing the current Node.js LTS with WinGet...
where winget >nul 2>nul
if errorlevel 1 goto offline_install
call winget install --id OpenJS.NodeJS.LTS --exact --source winget
if errorlevel 1 goto offline_install
call :find_node
if not errorlevel 1 goto run

:offline_install
set "NODE_INSTALLER=%~dp0third_party\nodejs\node-v24.21.0-x64.msi"
if not exist "%NODE_INSTALLER%" goto missing_installer
echo WinGet is unavailable or did not install a usable runtime. Using the bundled Node.js installer.
echo An administrator confirmation may appear. No Internet connection is needed for this installer.
start "" /wait "%SystemRoot%\System32\msiexec.exe" /i "%NODE_INSTALLER%" /passive /norestart /L*v "%TEMP%\tide-card-node-install.log"
set "INSTALL_EXIT=%errorlevel%"
if "%INSTALL_EXIT%"=="0" goto check_install
if "%INSTALL_EXIT%"=="3010" goto check_install
goto install_failed

:check_install
call :find_node
if not errorlevel 1 goto run
echo The installer completed but Node.js was not found. Restart Windows and try again.
goto install_failed

:find_node
set "NODE_EXE="
for /f "delims=" %%I in ('where node 2^>nul') do if not defined NODE_EXE call :try_node "%%I"
if not defined NODE_EXE call :try_node "%ProgramW6432%\nodejs\node.exe"
if not defined NODE_EXE call :try_node "%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE call :try_node "%LOCALAPPDATA%\Microsoft\WinGet\Links\node.exe"
if not defined NODE_EXE call :try_node "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if defined NODE_EXE exit /b 0
exit /b 1

:try_node
if not exist "%~1" exit /b 1
"%~1" -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)" >nul 2>nul
if errorlevel 1 exit /b 1
set "NODE_EXE=%~1"
exit /b 0

:run
echo Using: %NODE_EXE%
"%NODE_EXE%" server.mjs
set "GAME_EXIT=%errorlevel%"
echo Game server stopped with exit code %GAME_EXIT%.
pause
exit /b %GAME_EXIT%

:missing_installer
echo WinGet is unavailable or failed, and node-v24.21.0-x64.msi is missing from third_party\nodejs.
echo Extract the complete distribution ZIP, or install Node.js LTS from https://nodejs.org/en/download/ and run this file again.
pause
exit /b 1

:install_failed
echo Node.js installation did not complete. Check the message above, then run this file again.
echo Installer exit code: %INSTALL_EXIT%. Log: %TEMP%\tide-card-node-install.log
pause
exit /b 1
