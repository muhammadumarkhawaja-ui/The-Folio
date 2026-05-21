# Phase 4 — The Parts Panel

**Job:** Reading Room left panel live. Loads parts from parts.json. 
Displays part titles, chapter ranges, estimated listen time, 
4-state status icons. Reads state from book_state.json. 
Right panel shows styled book title + instruction when idle.

## Decisions Made
- **D1:** Single GET /book/:bookFolder endpoint returns parts + state combined.
- **D2:** Stacked card layout — icon + title on top row, chapter range + time on bottom row.
- **D3:** 4 icon states:
  - Hollow circle = empty (no script)
  - Blinking hollow circle = generating (Prompt B in progress)
  - Full circle = script_ready
  - Star = audio_ready
  All icons use var(--gold). Blinking via CSS keyframe animation.
- **D4:** Poll /book/:bookFolder every 5 seconds. Updates parts array + state only.
  Does NOT touch selectedPartId or right panel — no audio interruption risk.
- **D5:** Click highlights part visually (gold left border, surface-raised bg).
  No script trigger in Phase 4 — that is Phase 5.
- **D11:** Listen time = script word count ÷ 150 wpm. Show "—" when state is empty.
- **Generating state (lock file approach):** book_state.json stays locked to 3 values
  (empty, script_ready, audio_ready). Generating state tracked via a
  `generating.lock` file on disk inside each part's folder. Backend creates it when
  Prompt B starts (Phase 5 wires this), deletes it when done. GET /book endpoint
  checks for the lock file and returns `is_generating: true` per part. Frontend
  reads this from poll response — NOT from React local state. Survives page
  refresh, navigation away, and backend restarts cleanly.
- **Stale lock cleanup:** On backend startup, any .lock file older than 30 minutes
  is deleted (handles crash-during-generation scenario).
- **Right panel idle state:** Book title (from URL param) centered in Cormorant
  Garamond. Subtitle "Select a part to generate its script." in Crimson Pro, muted.
  Styled intentionally — Academia feel, not a placeholder.

## Objectives
- Backend: GET /book/{book_folder} reads parts.json + book_state.json + checks
  generating.lock per part + reads script.json word counts. Returns combined JSON.
- Backend: startup event cleans stale .lock files older than 30 minutes.
- Backend: get_lock_path() helper function ready for Phase 5 to call.
- Left panel: fetches data on mount, renders part cards with all 4 icon states.
  Icon state derived from response data (is_generating + state), never React local state.
- Part card: stacked layout — icon + title (top), chapter range + listen time (bottom).
- Listen time calculated from script.json word count when available, "—" when empty.
- Polling: every 5 seconds, updates parts array (is_generating) + state dict. No
  side effects on selectedPartId or right panel.
- Click: highlights selected part, no script trigger.
- Right panel idle: book title + instruction, Academia styled.
- Loading state: skeleton shimmer while fetching.
- Error state: inline message if backend unreachable.

## Sub-Phases
4.1 Backend endpoint — GET /book/{book_folder}: reads parts.json + book_state.json +
    checks generating.lock per part + script word counts, returns combined JSON
4.2 Lock file infrastructure — startup stale lock cleanup, get_lock_path() helper
4.3 Part card component — stacked layout, all 4 icon states + CSS animations,
    getIconStatus() reads from response data not React state
4.4 Panel wiring — left panel fetch on mount, render cards, loading + error states
4.5 Selection + polling — click sets highlight, poll every 5s updates parts array only,
    no generatingPartId local state
4.6 Right panel idle state — book title + instruction, Academia styled

## Files Affected
**Modified:**
- `backend/main.py` — GET /book/{book_folder} endpoint, startup stale lock cleanup,
  get_lock_path() helper, add glob + time imports
- `frontend/src/pages/ReadingRoom.jsx` — left panel wiring, part cards, polling,
  selection state, right panel idle state
- `frontend/src/index.css` — blink-pulse keyframe animation

## Tasks

### 4.1 Tasks
- [ ] Add GET /book/{book_folder} endpoint to main.py
- [ ] In endpoint: build `book_path = os.path.join("output", book_folder)`.
  Return 404 if folder does not exist or parts.json missing.
- [ ] Load `output/{book_folder}/parts.json` — extract the `parts` array.
  (Prompt A response shape: `{"book_title": "...", "parts": [...]}`)
- [ ] Load `output/{book_folder}/book_state.json` — extract the `parts` dict.
  (Shape: `{"parts": {"1": "empty", "2": "script_ready", ...}}`)
- [ ] For each part in parts array, compute part_dir:
  `part_dir = os.path.join(book_path, f"Part{part['part_number']}_{sanitize_name(part['title'])}")`
- [ ] For each part: set `part["is_generating"] = os.path.exists(os.path.join(part_dir, "generating.lock"))`
- [ ] For each part: if `{part_dir}/script.json` exists, load it and set
  `part["word_count"] = sum(len(item["line"].split()) for item in script_data)`.
  Else set `part["word_count"] = None`.
- [ ] Return combined response:
  ```python
  return {
      "book_title": parts_json.get("book_title", book_folder.replace("_", " ")),
      "parts": parts_list,
      "state": state_json["parts"]
  }
  ```
- [ ] Wrap all file reads in try/except — return HTTP 500 with message if JSON
  is malformed.

### 4.2 Tasks
- [ ] Add `import glob` and `import time` to main.py imports.
- [ ] Add startup stale lock cleanup — place directly after `app = FastAPI(...)`:
  ```python
  @app.on_event("startup")
  async def cleanup_stale_locks():
      lock_files = glob.glob("output/**/*.lock", recursive=True)
      now = time.time()
      for lock_file in lock_files:
          if os.path.exists(lock_file):
              age_seconds = now - os.path.getmtime(lock_file)
              if age_seconds > 1800:  # 30 minutes
                  os.remove(lock_file)
                  print(f"[startup] Cleaned stale lock: {lock_file}")
  ```
- [ ] Add get_lock_path() helper — place near other utility functions (near sanitize_name):
  ```python
  def get_lock_path(book_folder: str, part_number: int, part_title: str) -> str:
      part_dir = os.path.join(
          "output", book_folder,
          f"Part{part_number}_{sanitize_name(part_title)}"
      )
      return os.path.join(part_dir, "generating.lock")
  ```
  Phase 5 will call `get_lock_path()` to create and delete lock files. Phase 4
  only defines it.
- [ ] Manual smoke test: start backend → terminal shows no errors. Create a .lock
  file manually in any output subfolder, set its modified time to 2+ hours ago,
  restart backend → file is deleted. Confirm with dir listing.

### 4.3 Tasks
- [ ] Add CSS keyframe to `frontend/src/index.css`:
  ```css
  @keyframes blink-pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.2; }
  }
  ```
- [ ] Add getIconStatus() helper in ReadingRoom.jsx (above component definition).
  Derives icon state from response data only — no React state involved:
  ```js
  function getIconStatus(part, stateMap) {
      if (part.is_generating) return 'generating';
      const s = stateMap[String(part.part_number)];
      if (s === 'audio_ready') return 'audio_ready';
      if (s === 'script_ready') return 'script_ready';
      return 'empty';
  }
  ```
- [ ] Add renderStatusIcon(status) helper in ReadingRoom.jsx.
  Import `Circle, Star` from 'lucide-react' at top of file:
  ```jsx
  function renderStatusIcon(status) {
      if (status === 'generating') {
          return (
              <Circle
                  size={14} strokeWidth={1.5} color="var(--gold)"
                  style={{ animation: 'blink-pulse 1.2s ease-in-out infinite', flexShrink: 0 }}
              />
          );
      }
      if (status === 'script_ready') {
          return <Circle size={14} strokeWidth={1.5} color="var(--gold)" fill="var(--gold)" style={{ flexShrink: 0 }} />;
      }
      if (status === 'audio_ready') {
          return <Star size={14} strokeWidth={1.5} color="var(--gold)" fill="var(--gold)" style={{ flexShrink: 0 }} />;
      }
      return <Circle size={14} strokeWidth={1.5} color="var(--gold-muted)" style={{ flexShrink: 0 }} />;
  }
  ```
- [ ] Add formatListenTime(wordCount) helper in ReadingRoom.jsx:
  ```js
  function formatListenTime(wordCount) {
      if (wordCount === null || wordCount === undefined) return '—';
      const mins = Math.round(wordCount / 150);
      if (mins < 60) return `${mins}m`;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  ```
- [ ] Add renderPartCard(part, stateMap, selectedPartId, onSelect) render function
  in ReadingRoom.jsx. Inline hover via onMouseEnter/Leave (no Tailwind needed):
  ```jsx
  function renderPartCard(part, stateMap, selectedPartId, onSelect) {
      const iconStatus = getIconStatus(part, stateMap);
      const isSelected = selectedPartId === part.part_number;
      return (
          <div
              key={part.part_number}
              onClick={() => onSelect(part.part_number)}
              onMouseEnter={e => {
                  if (!isSelected) e.currentTarget.style.background = 'var(--surface-raised)';
              }}
              onMouseLeave={e => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
              }}
              style={{
                  borderLeft: isSelected ? '3px solid var(--gold)' : '3px solid transparent',
                  background: isSelected ? 'var(--surface-raised)' : 'transparent',
                  cursor: 'pointer',
                  padding: '12px 16px',
                  transition: 'background 0.15s',
              }}
          >
              {/* Top row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {renderStatusIcon(iconStatus)}
                  <span style={{
                      fontFamily: "'Crimson Pro', serif",
                      color: 'var(--text)', fontSize: 15, lineHeight: 1.3
                  }}>
                      Part {part.part_number}: {part.title}
                  </span>
              </div>
              {/* Bottom row */}
              <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  marginTop: 4, paddingLeft: 22
              }}>
                  <span style={{
                      fontFamily: "'Crimson Pro', serif",
                      color: 'var(--text-muted)', fontSize: 12
                  }}>
                      {part.chapter_range}
                  </span>
                  <span style={{
                      fontFamily: "'Crimson Pro', serif",
                      color: 'var(--text-muted)', fontSize: 12
                  }}>
                      {formatListenTime(part.word_count)}
                  </span>
              </div>
          </div>
      );
  }
  ```

### 4.4 Tasks
- [ ] In ReadingRoom component, add state variables:
  ```js
  const [bookData, setBookData] = useState(null);   // { book_title, parts, state }
  const [loadError, setLoadError] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState(null);
  ```
  No generatingPartId — generating state comes exclusively from bookData.parts[n].is_generating.
- [ ] Add initial fetch useEffect:
  ```js
  useEffect(() => {
      fetch(`http://localhost:8000/book/${bookFolder}`)
          .then(res => {
              if (!res.ok) throw new Error('not ok');
              return res.json();
          })
          .then(data => setBookData(data))
          .catch(() => setLoadError(true));
  }, [bookFolder]);
  ```
- [ ] In left panel JSX, replace existing placeholder content with:
  ```jsx
  {loadError ? (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%', gap: 8 }}>
          <AlertCircle size={20} color="var(--text-muted)" strokeWidth={1.5} />
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic',
              color: 'var(--text-muted)', fontSize: 14 }}>
              Could not load book data.
          </span>
      </div>
  ) : !bookData ? (
      // Loading skeleton: 4 shimmer cards
      [1,2,3,4].map(i => (
          <div key={i} style={{
              margin: '8px 16px', height: 58, borderRadius: 4,
              background: 'var(--surface-raised)',
              animation: 'blink-pulse 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.1}s`
          }} />
      ))
  ) : (
      bookData.parts.map(part =>
          renderPartCard(part, bookData.state, selectedPartId, setSelectedPartId)
      )
  )}
  ```
  Import AlertCircle from 'lucide-react'.
- [ ] Keep the existing "PARTS" label + gradient rule above this content block.

### 4.5 Tasks
- [ ] Add polling useEffect. Depends on bookFolder and whether bookData has loaded
  (use `!!bookData` to avoid polling before first successful fetch):
  ```js
  useEffect(() => {
      if (!bookData) return;
      const interval = setInterval(() => {
          fetch(`http://localhost:8000/book/${bookFolder}`)
              .then(res => res.ok ? res.json() : null)
              .then(data => {
                  if (!data) return;
                  setBookData(prev => ({
                      ...prev,
                      parts: data.parts,
                      state: data.state,
                  }));
              })
              .catch(() => {});   // silent fail — icons freeze, no crash
      }, 5000);
      return () => clearInterval(interval);
  }, [bookFolder, !!bookData]);
  ```
  Critical: `setBookData` updater uses `prev` spread — selectedPartId is separate
  state and is never touched by this updater. Poll cannot affect selection.
- [ ] Verify in browser Network tab: after page load, requests to /book/{bookFolder}
  appear every 5 seconds.

### 4.6 Tasks
- [ ] In right panel JSX, replace existing "Select a part to begin." placeholder with:
  ```jsx
  {selectedPartId === null ? (
      <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%', gap: 16, padding: '0 48px',
          textAlign: 'center'
      }}>
          <ScrollText size={32} strokeWidth={1} color="var(--gold-muted)"
              style={{ marginBottom: 8 }} />
          <h2 style={{
              fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic',
              fontSize: 28, color: 'var(--text)', fontWeight: 400, margin: 0
          }}>
              {bookFolder.replace(/_/g, ' ')}
          </h2>
          <p style={{
              fontFamily: "'Crimson Pro', serif", fontSize: 14,
              color: 'var(--text-muted)', margin: 0
          }}>
              Select a part to generate its script.
          </p>
      </div>
  ) : (
      // Phase 5 fills this. For now, empty div.
      <div />
  )}
  ```
  Import ScrollText from 'lucide-react'.

## Done When
- Navigate to /reading-room/[bookFolder] → left panel loads parts (not placeholder)
- Each card shows correct icon: hollow circle (empty), full circle (script_ready),
  star (audio_ready). Blinking hollow circle when generating.lock file exists for a part.
- Listen time shows "—" for empty parts, formatted time for others
- Clicking a part → gold left border highlight, stays highlighted
- Panel icons update every 5 seconds without resetting selection or disrupting UI
- Right panel shows book title (italic, Cormorant Garamond) + subtitle when nothing selected
- Loading skeleton visible briefly on first fetch
- Error state shows if backend unreachable
- Backend startup: no errors. Stale lock cleanup runs silently.
- get_lock_path() exists in main.py and returns correct string (Phase 5 will use it)

## Physical Checklist

### Backend — Endpoint
- [x] GET /book/{book_folder} returns 200 + correct JSON for a real book
- [x] Response `parts` includes is_generating (bool) and word_count (int or null) per part
- [x] Response `state` dict has string keys ("1", "2", ...) with correct values
- [x] Returns 404 for nonexistent book folder
- [x] word_count is null for empty parts, integer for parts that have script.json

### Backend — Lock File Infrastructure
- [x] Start backend → no errors in terminal
- [x] Manually create `output/[book]/Part1_[title]/generating.lock` →
  GET /book/[book] returns `"is_generating": true` for Part 1
- [x] Delete the lock file → GET /book/[book] returns `"is_generating": false`
- [x] Create a lock file, change its modified time to 2+ hours ago, restart backend →
  lock file deleted on startup (confirm with dir listing)
- [x] get_lock_path("My_Book", 1, "The Beginning") returns
  `output/My_Book/Part1_The_Beginning/generating.lock`

### Left Panel — Data
- [x] Left panel loads parts list (not old "Parts will appear here." placeholder)
- [x] Part titles match parts.json content
- [x] Chapter ranges display correctly
- [x] Part count in panel matches part count in parts.json

### Left Panel — Icons
- [x] Empty parts show hollow circle (muted gold, not filled)
- [x] Script-ready parts show filled circle (bright gold)
- [x] Audio-ready parts show filled star (bright gold)
- [x] Manually create generating.lock → part shows blinking hollow circle within 5s
- [x] Delete lock → blinking stops within 5s (next poll cycle)
- [x] Listen time shows "—" for empty, formatted "Xm" or "Xh Ym" for others

### Left Panel — Interaction
- [x] Clicking a part → gold left border + surface-raised bg appears on that card
- [x] Clicking a different part → highlight moves, old card loses highlight
- [x] Hover state lifts card background slightly, cursor is pointer
- [x] Poll fires every 5 seconds (Network tab shows repeated /book/... requests)
- [x] Poll updates icons without resetting the selected part highlight

### Right Panel — Idle State
- [x] Book title visible centered, italic Cormorant Garamond, when no part selected
- [x] "Select a part to generate its script." subtitle visible, Crimson Pro, muted
- [x] ScrollText icon visible above title, gold-muted

### Loading + Error
- [x] On page load: 4 grey pulsing skeleton cards visible briefly before parts appear
- [x] Stop backend → reload page → AlertCircle icon + "Could not load book data." shown
- [x] Restart backend → reload page → parts load correctly

### Lock File Refresh Survival Test
- [x] Open Reading Room → parts load
- [x] Create generating.lock for Part 1 → blinking circle appears within 5s (no reload)
- [x] Refresh the page → blinking circle still appears (lock file still on disk)
- [x] Delete lock file → blinking stops within 5s (no page refresh needed)
- [x] Navigate to Library → navigate back → blinking circle still shows (lock file on disk)

### No Regressions
- [x] TopBar visible, breadcrumb shows correct book title
- [x] Dark/light toggle works across all panels
- [x] No console errors on load, on poll, or on click

## Notes

**Lock file convention** — `generating.lock` lives inside the part folder:
`output/{book_folder}/Part{n}_{sanitized_title}/generating.lock`
Phase 5 must call `get_lock_path(book_folder, part_number, part_title)` from main.py to create it at Prompt B start and delete it when done (or on error). Never create the lock anywhere else.

**get_lock_path() location** — defined in main.py near sanitize_name(). Phase 5 imports nothing new — just calls it directly since it's in the same file.

**book_state.json stays 3-value only** — generating state is NOT written to book_state.json. It lives exclusively on disk as a lock file. book_state.json values: "empty", "script_ready", "audio_ready". Never add a 4th value.

**Poll dependency array** — `[bookFolder, !!bookData]` — double-bang intentional. Starts polling only after first successful fetch. Do not change to `[bookFolder, bookData]` — causes extra re-renders.

**setBookData spread pattern** — poll uses `setBookData(prev => ({ ...prev, parts: data.parts, state: data.state }))`. Never replace entire bookData in poll — selectedPartId is separate state and must not be touched by poll.

**Right panel Phase 5 slot** — when `selectedPartId !== null`, renders `<div />` placeholder. Phase 5 replaces this with skeleton → script display logic.

**Word count source** — comes from script.json line-by-line sum: `sum(len(item["line"].split()) for item in script_data)`. Phase 5 writes script.json in same format: array of `{host, line}` objects. If format changes, word_count calc in GET /book breaks.

**Windows file extension trap** — during testing, Windows hides extensions by default. `generating.lock` becomes `generating.lock.txt` silently. Phase 5 creates lock files programmatically so not a risk in prod — only a manual testing gotcha.
