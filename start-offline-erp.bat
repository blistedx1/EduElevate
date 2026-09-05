@echo off
title EduElevate Coaching Management Service - Live Dev Agent & Fast Refresh
echo =========================================================
echo   EduElevate Coaching Management Service - Live Dev Agent
echo =========================================================
echo Starting EduElevate Live Development Server on http://localhost:3000 ...
echo [Features]: Fast Refresh, Multi-Branch Engine, Batch Suite
cd /d "%~dp0"
start http://localhost:3000/app
npm run dev
pause

