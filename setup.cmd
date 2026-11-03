@echo off
where node >nul 2>nul || (echo Node.js 18 or newer is required: https://nodejs.org & pause & exit /b 1)
node "%~dp0setup.mjs" %*
if "%~1"=="" pause
