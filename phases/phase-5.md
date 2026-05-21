# Phase 5 — The Script Engine

**Job:** Clicking a part triggers Prompt B. Skeleton loading screen 
shows in right panel. Script saved to script.json. book_state.json 
updated. Status icon updates. Gemini validation and retry built 
here.

## Decisions Made
- **D8:** Click = generation. No confirm step.
- Concurrent click locked during generation. While any part is 
  generating, all other parts in left panel are unclickable. 
  Active part shows spinning indicator. Clicks resume after 
  generation completes or fails.
- **D16:** If part already has script, load existing instantly. 
  No regeneration unless Revise Script clicked.
- **D19:** Validate Gemini JSON, retry once, error on second fail.
- **D6:** Gemini free tier limit — 2 requests per minute. 
  No queue needed. User generates parts individually by clicking.
- **PC2:** Prompt B target is 180-220 lines of dialogue.
- **PC3:** Part 1 conditional opening already in Prompt B.
- Gemini double fail: error message in right panel, retry button, 
  status icon does not change state (stays empty).
- **D-A — Generation approach:** Async fire-and-poll. POST /generate 
  returns 202 immediately. Backend runs Gemini in a FastAPI 
  BackgroundTask. Lock file lifecycle: created on task start, 
  deleted on success or failure. Poll (already live from Phase 4) 
  detects state change.
- **D-B — Skeleton UI:** Dialogue shimmer — alternating Alex/Morgan 
  label + bar rows of varying width, blink-pulse animation. 
  Mimics final script layout.
- **D-C — Post-generation display:** Phase 5 fetches script.json 
  and renders dialogue with full Academia styling. Phase 6 adds 
  buttons only.
- **D-D — Retry behavior:** Retry button re-triggers POST /generate 
  immediately. No reset to idle.
- **Failure detection:** Frontend tracks panelMode local state 
  ('idle' | 'generating' | 'script' | 'error'). Poll detects when 
  selected part's is_generating flips from true to false. If state 
  is script_ready → fetch script. If state still empty → show error.

## Objectives
- Backend POST /generate: receive book_folder + part_number, load 
  parts.json to find part, create lock file, launch BackgroundTask, 
  return 202 immediately.
- Background task: load part metadata + chapter text from book_text.txt, 
  run Prompt B with Gemini, validate JSON (retry once on failure), 
  save script.json, update book_state.json to script_ready, delete 
  lock file. On double fail: delete lock file only (state stays empty).
- Backend GET /script: return script.json contents for a given part.
- Frontend click handler: if part state is empty → POST /generate → 
  panelMode = 'generating'. If part state is script_ready → fetch 
  script → panelMode = 'script'. If generating in progress → locked.
- Right panel skeleton: dialogue shimmer bars while panelMode = 
  'generating'. Poll integration detects is_generating flip → 
  transitions panelMode to 'script' or 'error'.
- Script display: render {host, line} array with full Academia styling. 
  Alex and Morgan visually distinct. Scrollable.
- Error state: error message + retry button. Retry re-POSTs /generate.
- Left panel lock: while generatingPartId !== null, all non-selected 
  cards get cursor: not-allowed + reduced opacity.

## Sub-Phases
5.1 Backend generate endpoint — POST /generate body parsing, lock 
    file create, BackgroundTask launch, 202 return
5.2 Background task — load part data, extract chapter text, run 
    Prompt B, validate + retry, save script.json + book_state.json, 
    delete lock
5.3 Backend script endpoint — GET /script/{book_folder}/{part_number} 
    returns script.json array
5.4 Frontend panel state — panelMode + generatingPartId state, click 
    handler logic, left panel lock
5.5 Right panel skeleton — shimmer rows, poll transition logic
5.6 Script fetch + display — fetchScript(), script render full Academia
5.7 Error state — error UI + retry button

## Files Affected
**Modified:**
- `backend/main.py` — POST /generate endpoint, generate_script_task 
  background function, GET /script endpoint
- `frontend/src/pages/ReadingRoom.jsx` — panelMode + generatingPartId 
  state, click handler, right panel content (skeleton + script + error)

## Tasks

### 5.1 Tasks
- [ ] Add POST /generate endpoint to main.py. Body model: 
      GenerateRequest(book_folder: str, part_number: int).
- [ ] In endpoint: load output/{book_folder}/parts.json, find part 
      where part_number matches — return 404 if not found.
- [ ] In endpoint: build part_dir via get_lock_path helper logic. 
      Create part_dir if it does not exist (os.makedirs, exist_ok=True).
- [ ] In endpoint: create lock file via get_lock_path(book_folder, 
      part_number, part["title"]) — open file in write mode to create it.
- [ ] In endpoint: add BackgroundTasks parameter, call 
      background_tasks.add_task(generate_script_task, book_folder, part_number).
- [ ] Return JSONResponse({"status": "started"}, status_code=202).

### 5.2 Tasks
- [ ] Write async def generate_script_task(book_folder: str, 
      part_number: int) in main.py.
- [ ] Wrap entire task body in try/finally — finally block deletes 
      lock file if it still exists (handles any unhandled exception).
- [ ] In task: load output/{book_folder}/parts.json, find part by 
      part_number. Extract title, chapter_range, start_chapter, end_chapter.
- [ ] In task: load output/{book_folder}/book_text.txt.
- [ ] In task: extract chapter text — scan text for start_chapter 
      heading, take text from that point to end_chapter heading (or EOF). 
      Use case-insensitive line-by-line scan. If headings not found, 
      use full book text as fallback.
- [ ] In task: read PROMPT_B from prompts.py. Build prompt string 
      using .replace() — NOT .format(). Replace all placeholders with 
      part data (part_number, title, chapter_range, chapter_text, 
      part 1 conditional). Read prompts.py first to confirm exact 
      placeholder names.
- [ ] In task: call Gemini (gemini-2.5-flash, same pattern as Phase 2). 
      Wrap in try/except. Parse response text as JSON.
- [ ] In task: validate JSON — must be a list, every item must have 
      "host" (string) and "line" (string) keys. Raise ValueError if invalid.
- [ ] In task: on validation failure — retry once (call Gemini again, 
      re-validate). On second failure — log error, let finally block 
      clean lock, return. State stays empty.
- [ ] In task (success path): save script.json to 
      output/{book_folder}/Part{n}_{sanitized_title}/script.json as 
      JSON array.
- [ ] In task (success path): load book_state.json, set 
      parts[str(part_number)] = "script_ready", save back.
- [ ] In finally: if lock file exists, os.remove(lock_file_path).

### 5.3 Tasks
- [ ] Add GET /script/{book_folder}/{part_number} endpoint to main.py.
- [ ] In endpoint: load output/{book_folder}/parts.json, find part 
      by part_number — return 404 if not found.
- [ ] Build script path: 
      output/{book_folder}/Part{n}_{sanitized_title}/script.json.
- [ ] Return 404 if script.json does not exist.
- [ ] Load and return script.json contents as JSON.

### 5.4 Tasks
- [ ] Add state to ReadingRoom: 
      const [panelMode, setPanelMode] = useState('idle')
      Values: 'idle' | 'generating' | 'script' | 'error'
- [ ] Add state: const [generatingPartId, setGeneratingPartId] = useState(null)
- [ ] Add state: const [script, setScript] = useState(null)
- [ ] Rewrite click handler (currently calls setSelectedPartId only):
  ```js
  function handlePartClick(part) {
    // locked: something generating, this part is not that part
    if (generatingPartId !== null && generatingPartId !== part.part_number) return;
    // locked: this part itself is generating (via lock file on disk)
    if (part.is_generating) return;
    setSelectedPartId(part.part_number);
    const partState = bookData.state[String(part.part_number)];
    if (partState === 'script_ready' || partState === 'audio_ready') {
      fetchScript(part.part_number);
    } else {
      // empty — trigger generation
      fetch(`http://localhost:8000/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_folder: bookFolder, part_number: part.part_number })
      }).then(res => {
        if (!res.ok) throw new Error('generate failed');
        setGeneratingPartId(part.part_number);
        setPanelMode('generating');
      }).catch(() => {
        setPanelMode('error');
      });
    }
  }
  ```
- [ ] In renderPartCard, pass isLocked = generatingPartId !== null:
      Apply to non-active cards: opacity: 0.4, cursor: 'not-allowed', 
      pointerEvents: 'none'. Active generating card keeps normal opacity.
- [ ] Update renderPartCard onClick to call handlePartClick(part).

### 5.5 Tasks
- [ ] Build skeleton shimmer JSX for panelMode === 'generating':
  ```jsx
  <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
    {[...Array(10)].map((_, i) => (
      <div key={i}>
        <div style={{
          fontFamily: "'Crimson Pro', serif", fontSize: 11,
          color: 'var(--gold)', textTransform: 'uppercase',
          letterSpacing: 1, marginBottom: 6
        }}>
          {i % 2 === 0 ? 'Alex' : 'Morgan'}
        </div>
        <div style={{
          height: 14, borderRadius: 3,
          width: `${60 + (i * 17) % 30}%`,
          background: 'var(--surface-raised)',
          animation: `blink-pulse 1.4s ease-in-out infinite`,
          animationDelay: `${i * 0.08}s`
        }} />
      </div>
    ))}
  </div>
  ```
- [ ] In polling useEffect, after setBookData spread, add transition check:
  ```js
  if (panelMode === 'generating' && selectedPartId !== null) {
    const selectedPart = data.parts.find(p => p.part_number === selectedPartId);
    if (selectedPart && !selectedPart.is_generating) {
      const partState = data.state[String(selectedPartId)];
      if (partState === 'script_ready' || partState === 'audio_ready') {
        fetchScript(selectedPartId);
      } else {
        setPanelMode('error');
        setGeneratingPartId(null);
      }
    }
  }
  ```
  Note: panelMode in polling effect needs to be read via ref to avoid 
  stale closure. Add: const panelModeRef = useRef(panelMode); 
  useEffect(() => { panelModeRef.current = panelMode; }, [panelMode]);
  Use panelModeRef.current inside poll callback.

### 5.6 Tasks
- [ ] Write fetchScript(partId) function inside ReadingRoom:
  ```js
  function fetchScript(partId) {
    fetch(`http://localhost:8000/script/${bookFolder}/${partId}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => {
        setScript(data);
        setPanelMode('script');
        setGeneratingPartId(null);
      })
      .catch(() => {
        setPanelMode('error');
        setGeneratingPartId(null);
      });
  }
  ```
- [ ] Build script display JSX for panelMode === 'script':
  ```jsx
  <div style={{ 
    padding: '24px 32px', overflowY: 'auto', height: '100%',
    display: 'flex', flexDirection: 'column', gap: 0
  }}>
    {script && script.map((item, i) => (
      <div key={i} style={{
        padding: '12px 0',
        borderTop: i > 0 ? '1px solid rgba(42,63,107,0.3)' : 'none'
      }}>
        <div style={{
          fontFamily: "'Crimson Pro', serif", fontSize: 11,
          color: item.host === 'Alex' ? 'var(--gold)' : 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4
        }}>
          {item.host}
        </div>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif", fontSize: 16,
          color: 'var(--text)', lineHeight: 1.6
        }}>
          {item.line}
        </div>
      </div>
    ))}
  </div>
  ```

### 5.7 Tasks
- [ ] Build error state JSX for panelMode === 'error':
  ```jsx
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100%', gap: 16, padding: '0 48px',
    textAlign: 'center'
  }}>
    <AlertCircle size={24} color="var(--text-muted)" strokeWidth={1.5} />
    <p style={{
      fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic',
      fontSize: 18, color: 'var(--text-muted)', margin: 0
    }}>
      Script generation failed.
    </p>
    <p style={{
      fontFamily: "'Crimson Pro', serif", fontSize: 13,
      color: 'var(--text-muted)', margin: 0
    }}>
      Gemini returned invalid data after two attempts.
    </p>
    <button
      onClick={() => {
        if (selectedPartId === null) return;
        fetch(`http://localhost:8000/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ book_folder: bookFolder, part_number: selectedPartId })
        }).then(res => {
          if (!res.ok) throw new Error();
          setGeneratingPartId(selectedPartId);
          setPanelMode('generating');
        }).catch(() => {});
      }}
      style={{
        border: '1px solid var(--gold)', color: 'var(--gold)',
        background: 'transparent', fontFamily: "'Crimson Pro', serif",
        fontSize: 13, padding: '8px 20px', cursor: 'pointer',
        letterSpacing: 0.5
      }}
    >
      Retry
    </button>
  </div>
  ```
- [ ] Confirm AlertCircle already imported (Phase 4 left panel error uses it).

## Done When
- Click empty part → 202 returned immediately → skeleton shimmer appears
- Left panel: all other cards locked (opacity + pointer-events) during generation
- Blinking circle icon appears on generating part within 5s poll cycle
- Gemini finishes → lock deleted → next poll detects script_ready → 
  script fetches → dialogue renders in right panel
- Alex lines gold label, Morgan lines muted label. Cormorant Garamond body.
- Container scrollable when script exceeds panel height
- Double Gemini failure → error state + retry button appear
- Retry re-triggers generation → skeleton reappears
- Click script_ready part → existing script loads instantly
- book_state.json has script_ready for completed parts
- script.json exists in correct part folder
- No console errors throughout flow

## Physical Checklist

### Backend — Generate Endpoint
- [x] POST /generate returns 202 immediately (not after Gemini finishes)
- [x] Lock file created at correct path immediately on POST
- [x] 404 returned if part_number not found in parts.json
- [x] GET /book still returns is_generating: true while lock exists

### Background Task
- [x] Chapter text extracted correctly for the part's range
- [x] Prompt B built with correct part data (no .format() used)
- [x] script.json saved at output/{book_folder}/Part{n}_{title}/script.json
- [x] book_state.json updated to script_ready after success
- [x] Lock file deleted after successful generation
- [x] Lock file deleted after double Gemini failure (state stays empty)
- [x] Unhandled exception in task → lock file still deleted (finally block)

### Backend — Script Endpoint
- [x] GET /script/{book_folder}/{part_number} returns script array
- [x] 404 returned if script.json not found

### Frontend — Click Handler
- [x] Click empty part → POST /generate fires → panelMode = 'generating'
- [x] Click script_ready part → fetchScript() → panelMode = 'script'
- [x] Click while generatingPartId set → no action (locked cards)
- [x] Click is_generating part → no action

### Frontend — Skeleton
- [x] Skeleton shimmer visible immediately after click on empty part
- [x] 10 rows, alternating Alex/Morgan labels
- [x] blink-pulse animation on all bars, staggered delays

### Frontend — Poll Transition
- [x] Poll detects is_generating flip → panelModeRef check works
- [x] script_ready → fetchScript() → panelMode = 'script'
- [x] Still empty → panelMode = 'error', generatingPartId = null

### Frontend — Script Display
- [x] All dialogue lines render
- [x] Alex label gold (var(--gold)), Morgan label muted (var(--text-muted))
- [x] Cormorant Garamond 16px, line-height 1.6
- [x] Divider lines between entries (except first)
- [x] Container scrollable if script exceeds panel height

### Frontend — Error State
- [x] AlertCircle icon visible
- [x] Both error text lines visible
- [x] Retry button styled correctly (gold border, gold text)
- [x] Retry re-triggers generation → skeleton reappears

### Left Panel Lock
- [x] Non-selected cards: opacity 0.4, pointer-events: none during generation
- [x] After generation completes: all cards clickable again

### No Regressions
- [x] TopBar visible, breadcrumb correct
- [x] Dark/light toggle works
- [x] Left panel poll continues (5s interval, Network tab)
- [x] No console errors on any state transition

## Notes

**start_chapter / end_chapter are integers in spec but Gemini may return strings.** Defensive `int()` conversion with try/except added in `generate_script_task`. Future phases: never trust Gemini field types — always cast defensively.

**Lock file pre-resolution must happen before the try block.** If `lock_path` is only assigned inside try, an early exception leaves the lock file orphaned forever. Pattern used: glob-scan for `Part{n}_*` before try, refine to exact path once title is known inside try. `finally` block cleans whichever path was resolved last.

**panelModeRef pattern is required for poll useEffect.** `panelMode` state read inside `setInterval` callback is always stale (closure captures initial value). Fix: `const panelModeRef = useRef(panelMode)` + sync via `useEffect`. Read `panelModeRef.current` inside the interval. Any future polling that needs to branch on current state must use this pattern.

**Left panel lock uses generatingPartId, not is_generating.** `is_generating` comes from server (poll lag). `generatingPartId` is set client-side immediately after POST 202 — gives instant lock with zero poll delay. `is_generating` is used only to block clicks on the generating card itself.

**Chapter text extraction is positional, not regex-per-line.** `CHAPTER_PATTERN.finditer()` returns match positions. Text slice is `book_text[start_pos:end_pos]`. Fallback to full book text if headings not found. Phase 6+ should not touch this logic.

**Script endpoint requires parts.json to resolve sanitized folder name.** GET /script/{book_folder}/{part_number} cannot build the path without knowing the part title (used in folder name). Always load parts.json first, find the part, then build the path.

**Gemini free tier: 2 RPM.** No queue built. User generates parts individually. Do not add concurrent generation in future phases without adding a queue/rate limiter first.
