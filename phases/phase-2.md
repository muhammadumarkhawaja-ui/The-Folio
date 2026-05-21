# Phase 2 — The Ingestion Engine

**Job:** PDF upload works. PyMuPDF extracts text. TOC extracted 
first, chapter text search as fallback. Title always asked, 
pre-filled with best guess. Prompt A runs. parts.json and 
book_state.json saved to output folder.

## Decisions Made
- **Upload UI:** Drag+drop zone with hover highlight. Click-to-browse fallback.
- **Title confirmation:** Inline on Upload page. Pre-filled from PDF metadata or filename. User edits if needed, clicks Confirm.
- **Loading screen:** Spinner + "Analyzing your book…" text. Replaces upload form while Prompt A runs.
- **Error display:** Replaces loading screen inline. Retry or Try Different PDF button shown.
- **Duplicate books:** Block upload if output/[BookName]/ already exists. Error: "A book with this title already exists. Delete it from the Library first."
- **PDF size limit:** 50MB. Rejected with error if exceeded.
- **Auto-redirect:** After Prompt A succeeds, frontend auto-redirects to Reading Room for that book.
- **D1:** TOC first, chapter text search fallback. Both fail → block upload. Error: "No chapter structure detected in this PDF. The Folio requires a book with chapters. Please try a different PDF."
- **D17:** Always ask user to confirm title, pre-filled with best guess.
- **GEMINI_API_KEY startup check:** Backend logs warning on startup if key missing. App still starts.
- **D7:** book_state.json tracks per-part state, survives server restarts.
- **PC1:** Prompt A does not use page numbers. Slicing by chapter headings.
- **parts.json schema:** Raw Prompt A response saved as-is.
- **D19:** Gemini response validation — parse JSON, retry once on failure. Double fail → inline error with Retry button. Error: "Gemini returned invalid data after 2 attempts. Check your API key or try again later."

## Objectives
- POST /upload endpoint: receive PDF, enforce 50MB limit, check for duplicates, extract text with PyMuPDF, detect chapter structure, save book_text.txt, return title guess
- POST /analyze endpoint: receive confirmed title + book folder, run Prompt A, validate + retry, save parts.json + book_state.json, return book folder name
- Frontend Upload page: drag+drop zone, inline title confirm, loading spinner, all error states handled
- Frontend wired to backend: upload → confirm → analyze → redirect to Reading Room

## Sub-Phases
2.1 Backend foundations — startup key check, filename sanitization utility
2.2 Upload endpoint — PDF receive, size check, duplicate check, text extract, chapter detect, book_text.txt saved, title guess returned
2.3 Analyze endpoint — Prompt A call, JSON validate + retry, parts.json + book_state.json saved
2.4 Frontend Upload page — drag+drop UI, title field, loading state, error states
2.5 Wire up — frontend calls /upload then /analyze, handles all responses, auto-redirects

## Files Affected
**Modified:**
- `backend/main.py` — startup check, /upload endpoint, /analyze endpoint, sanitize utility
- `frontend/src/App.jsx` — add route to Upload page

**Created:**
- `frontend/src/pages/Upload.jsx` — full Upload page component

## Tasks

### 2.1 Tasks
- [x] Add GEMINI_API_KEY startup check to main.py — log warning if missing
- [x] Write sanitize_name() utility in main.py — strip special chars, spaces → underscores

### 2.2 Tasks
- [x] Add POST /upload endpoint
- [x] Enforce 50MB file size limit — return 400 with error message if exceeded
- [x] Check if output/[BookName]/ already exists — return 409 if duplicate
- [x] Extract text from PDF using PyMuPDF — save to output/[BookName]/book_text.txt
- [x] Attempt TOC extraction (fitz toc) — use if chapters found
- [x] Fallback to chapter heading text search if TOC empty
- [x] Return 400 with error if both methods find no chapters
- [x] Extract title from PDF metadata, fall back to filename
- [x] Return {title_guess, book_folder} on success

### 2.3 Tasks
- [x] Add POST /analyze endpoint — receives {book_folder, confirmed_title}
- [x] Rename book folder if title changed from guess
- [x] Load book_text.txt, call Gemini with Prompt A
- [x] Parse JSON response — retry once on failure
- [x] Return 500 with error message on double fail
- [x] Save parts.json (raw Prompt A response)
- [x] Build and save book_state.json — all parts set to "empty"
- [x] Return {book_folder} on success

### 2.4 Tasks
- [x] Create frontend/src/pages/Upload.jsx
- [x] Build drag+drop zone — accepts PDF only, hover highlight on dragover
- [x] Add click-to-browse fallback (hidden file input)
- [x] Client-side 50MB check before sending
- [x] Step 1 view: drop zone visible, title field hidden
- [x] Step 2 view: after PDF received, drop zone hidden, title field shown pre-filled, Confirm button
- [x] Loading view: spinner + "Analyzing your book…" text
- [x] Error view: error message + action button (Retry or Try Different PDF)

### 2.5 Tasks
- [x] On PDF drop/select: POST to /upload, handle response, populate title field
- [x] On Confirm: POST to /analyze with book_folder + confirmed_title
- [x] On success: redirect to /reading-room/[book_folder]
- [x] On /upload error (size/duplicate/no-chapters): show error view
- [x] On /analyze error (Gemini fail): show error view with Retry button
- [x] Add /upload route to App.jsx

## Done When
- Drag+drop (or click) a PDF → title pre-filled → confirm → spinner → auto-redirect to Reading Room URL
- output/[BookName]/book_text.txt exists after upload
- output/[BookName]/parts.json exists after analyze
- output/[BookName]/book_state.json exists with all parts = "empty"
- 50MB PDF rejected with error on frontend
- Duplicate book blocked with error on frontend
- No-chapter PDF blocked with error on frontend
- Gemini double fail shows error + Retry button

## Physical Checklist
- [ ] Drop a valid PDF → title pre-filled → confirm → spinner → redirect fires
- [ ] book_text.txt exists in correct output folder
- [ ] parts.json exists and matches expected schema
- [ ] book_state.json exists with correct structure
- [ ] Upload PDF over 50MB → error shown
- [ ] Upload same book twice → blocked with error
- [ ] Upload PDF with no chapters → error shown
- [ ] Remove GEMINI_API_KEY from .env → warning in backend terminal
- [ ] Restore key, re-test full flow

## Notes
- Gemini model: use `gemini-2.5-flash`. gemini-1.5-pro removed from v1beta API. gemini-2.0-flash has limit:0 on this project's free tier. gemini-2.5-flash confirmed working.
- PROMPT_A contains literal JSON in the template body. Never use `.format()` — it breaks on curly braces. Always use `.replace("{toc_data}", ...).replace("{full_book_text}", ...)`.
- toc_data.txt must be saved during /upload (while fitz doc is open) and read back during /analyze. Doc is closed before analyze runs.
- FastAPI requires `python-multipart` installed for UploadFile to work. It's in requirements.txt but must be pip-installed in the venv.
- Unhandled exceptions from Gemini client escape the retry loop as non-HTTPException → FastAPI returns HTML 500 → frontend `res.json()` throws → misleading "could not reach backend" error. All Gemini calls wrapped in try/except that raises HTTPException.
- book_state.json parts keys are strings ("1", "2", ...) not integers. Consistent across all phases.
- output/ folder is gitignored. Each book lives at output/[sanitized_title]/. Duplicate check is folder existence check.
- load_dotenv() finds root .env from backend/ working directory by searching up the tree. No path argument needed.
