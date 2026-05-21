@echo off
echo Starting The Folio...

start "The Folio - Backend" cmd /k "cd /d %~dp0backend && venv\Scripts\uvicorn main:app --reload --port 8000"
start "The Folio - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Both servers starting. Open http://localhost:5173
