@echo off
rem Double-click launcher for Windows: installs, prepares and starts the CRM.
cd /d "%~dp0"
title CRM Outreach - NON CHIUDERE QUESTA FINESTRA
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js non e' installato. Segui la Parte 1 della guida.
  echo.
  pause
  exit /b 1
)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"
if errorlevel 1 (
  echo.
  echo  La versione di Node.js e' troppo vecchia. Installa la versione LTS da nodejs.org.
  echo.
  pause
  exit /b 1
)
if not exist .env.local copy .env.example .env.local >nul
echo.
echo  Preparazione in corso... (la prima volta puo' richiedere alcuni minuti)
echo.
call npm install --no-audit --no-fund || goto errore
call npm run db:push || goto errore
call npm run build || goto errore
start "" cmd /c "timeout /t 6 >nul & start http://localhost:3000"
echo.
echo  ============================================================
echo   Il CRM e' acceso: http://localhost:3000
echo   Lascia aperta questa finestra. Per spegnere il CRM, chiudila.
echo  ============================================================
echo.
call npm run start
goto fine
:errore
echo.
echo  Qualcosa e' andato storto. Fai una foto a questa finestra e mandala.
:fine
pause
