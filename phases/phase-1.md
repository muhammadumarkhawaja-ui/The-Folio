# Phase 1 — The Skeleton

**Job:** Project folder structure created. FastAPI backend running. 
React + Vite frontend running. Frontend and backend can communicate.

## Decisions Made
- Python env: venv inside project root
- JS package manager: npm
- Backend port: 8000
- Frontend port: 5173
- Launch method: single `start.bat` script runs both
- Connection test: `/health` endpoint returns `{"status": "ok"}`, 
  frontend fetches it and displays "Backend connected" in green

## Objectives
- Scaffold full folder structure matching claude.md layout
- Backend: FastAPI app running on localhost:8000
- Frontend: React + Vite app running on localhost:5173
- CORS configured so frontend can call backend
- `/health` endpoint live
- Frontend fetches `/health` on load and shows connection status
- `start.bat` launches both servers with one double-click

## Sub-Phases
1.1 Folder scaffold — create all dirs and placeholder files
1.2 Backend setup — venv, install deps, FastAPI app with /health
1.3 Frontend setup — npm create vite, install deps, tailwind v4
1.4 Connection — CORS on backend, fetch /health on frontend
1.5 Start script — start.bat launches both

## Files Affected
**Created:**
- `folio/backend/main.py`
- `folio/backend/prompts.py` (empty placeholder)
- `folio/backend/requirements.txt`
- `folio/backend/output/` (empty dir)
- `folio/frontend/` (full Vite scaffold)
- `folio/.env` (empty placeholder, GEMINI_API_KEY slot)
- `folio/start.bat`

## Tasks

### 1.1 Folder Scaffold
- [x] Create `backend/output/` directory
- [x] Create `backend/prompts.py` (already existed with full prompt content)
- [x] Create `.env` with `GEMINI_API_KEY=` slot
- [x] Create `phases/` dir if not exists

### 1.2 Backend Setup
- [x] Create venv inside `backend/`
- [x] Write `requirements.txt` (fastapi, uvicorn, pymupdf, google-genai, edge-tts, pydub, audioop-lts, python-dotenv)
- [x] Install backend deps via pip
- [x] Write `main.py` with FastAPI app, CORS, `/health` endpoint

### 1.3 Frontend Setup
- [x] Scaffold frontend with `npm create vite` (React + JS)
- [x] Install frontend deps (lucide-react)
- [x] Install and configure Tailwind CSS v4

### 1.4 Connection
- [x] Confirm CORS in `main.py` allows `localhost:5173`
- [x] Write frontend health check component — fetches `/health`, shows green "Backend connected"

### 1.5 Start Script
- [x] Write `start.bat` — launches uvicorn and npm dev in separate windows

## Done When
- `start.bat` launches both servers without error
- `localhost:8000/health` returns `{"status": "ok"}`
- `localhost:5173` loads and displays green "Backend connected" text
- No console errors in browser or terminals

## Physical Checklist
- [x] Both servers start from start.bat
- [x] localhost:8000/health returns 200 + correct JSON
- [x] localhost:5173 loads without error (HTTP 200 confirmed)
- [ ] Green "Backend connected" visible on frontend — verify in browser
- [ ] Browser console: no errors — verify in browser

## Notes
- Python version is 3.14. `audioop` was removed from stdlib in 3.13 — `audioop-lts` 
  is installed as a shim so pydub works. Do not remove it.
- `google-generativeai` is deprecated. Package installed is `google-genai`. 
  Correct import in all future code: `from google import genai` (NOT `google.generativeai`).
- venv lives at `backend/venv/`. Always activate or call `venv\Scripts\python.exe` 
  directly when running backend commands.
- Tailwind v4 has no `tailwind.config.js`. Config is done via CSS `@layer` / `@theme` 
  directives. Adding custom tokens in phase 3 goes inside `index.css`.
- `start.bat` opens two separate cmd windows — one per server. Closing either window 
  kills that server. Both must be open for app to work.
- Frontend `App.jsx` is a placeholder health check. Safe to fully overwrite in phase 3.
