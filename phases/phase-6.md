# Phase 6 — The Script Panel

**Job:** Right panel displays generated script as readable dialogue. 
Revise Script button works (overwrites, no backup). Both buttons 
correctly active or inactive based on current state.

## Decisions Made
- **D8:** Revise Script overwrites directly. No backup kept.
- Revise Script active only when script exists (script_ready or audio_ready)
- Make a Podcast active only when script exists and audio not yet made (script_ready only)
- Dialogue displayed as readable two-host conversation
- Revise Script button behavior: if audio already exists for a part when 
  Revise Script is clicked, the existing audio file is deleted automatically 
  before regeneration begins. Old audio and new script cannot coexist. 
  Status icon reverts to script_ready after deletion.
- **Q1 — Button placement:** Sticky footer bar pinned to bottom of right panel. 
  Always visible while scrolling script. Thin gold separator line at top of bar.
- **Q2 — Revise confirmation:** Inline one-line banner on first click when audio 
  exists ("This will delete your existing audio. Click again to confirm."). 
  Second click proceeds. No confirmation when only script exists.
- **Q3 — Inactive appearance:** Both buttons always visible when script loaded. 
  Inactive = opacity 0.35, cursor not-allowed. Active = full opacity, pointer.

## Objectives
- Backend: generate_script_task deletes existing MP3 for the part at task start 
  if found. If MP3 deleted, immediately writes book_state to script_ready 
  (old script still exists — state is accurate). On success: overwrites 
  script.json, writes script_ready again (no change). On failure: state stays 
  script_ready (old script intact, no audio — consistent).
- Backend: GET /script endpoint already exists (Phase 5). No new endpoints needed.
- Frontend: sticky footer bar at bottom of right panel, visible when 
  panelMode === 'script'.
- Footer: two buttons — Revise Script (left) + Make a Podcast (right). 
  Separated by flex spacing. Gold top border on footer bar.
- Button states driven by getButtonStates() helper reading bookData.state.
- Revise Script click on script_ready: immediately POST /generate → 
  panelMode = 'generating'. No confirmation.
- Revise Script click on audio_ready: set reviseConfirmPending = true → 
  banner appears. Second click: POST /generate → panelMode = 'generating'.
- reviseConfirmPending resets on: selectedPartId change, navigation, 
  any other part click.
- Make a Podcast: active when script_ready, greyed when audio_ready or empty. 
  No action yet — Phase 7 wires it.

## Sub-Phases
6.1 Backend — MP3 deletion in generate_script_task
6.2 Sticky footer bar — layout, separator, button shells
6.3 Button state logic — getButtonStates() helper, active/inactive styles
6.4 Revise Script handler — direct trigger + inline confirmation flow
6.5 Make a Podcast placeholder — button wired, action deferred to Phase 7

## Files Affected
**Modified:**
- `backend/main.py` — generate_script_task: MP3 delete + book_state revert
- `frontend/src/pages/ReadingRoom.jsx` — sticky footer, button state, 
  revise handler, reviseConfirmPending state, getButtonStates helper

## Tasks

### 6.1 Tasks
- [ ] In generate_script_task, after part_dir is resolved and before Gemini runs:
  check for existing MP3 using `glob.glob(os.path.join(part_dir, "*.mp3"))`.
- [ ] If MP3 found: delete it with os.remove(). Log: 
  `print(f"[generate] Deleted existing audio: {mp3_path}")`.
- [ ] After MP3 deletion: load book_state.json, set 
  `state["parts"][str(part_number)] = "script_ready"`, save back.
  (Old script.json still exists — script_ready is accurate.)
- [ ] Confirm glob import already present (Phase 4 added it). No new imports.
- [ ] Confirm: on generation success, task already writes script_ready — 
  no change needed to success path.
- [ ] Confirm: on double Gemini failure, lock deleted, state stays script_ready 
  (set above) — old script intact, no audio. Correct state.

### 6.2 Tasks
- [ ] In ReadingRoom.jsx, wrap the right panel inner content in a flex column 
  layout: script area takes `flex: 1, overflowY: 'auto'`, footer is fixed height.
- [ ] Add sticky footer bar JSX inside panelMode === 'script' block, 
  below the scrollable script div:
  ```jsx
  <div style={{
      borderTop: '1px solid var(--gold-muted)',
      padding: '12px 32px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      background: 'var(--surface)',
      flexShrink: 0,
  }}>
      {/* buttons go here */}
  </div>
  ```
- [ ] Add Revise Script button inside footer:
  ```jsx
  <button
      onClick={handleRevise}
      disabled={!reviseActive}
      style={{
          border: '1px solid var(--gold)',
          color: 'var(--gold)',
          background: 'transparent',
          fontFamily: "'Crimson Pro', serif",
          fontSize: 13,
          padding: '7px 20px',
          cursor: reviseActive ? 'pointer' : 'not-allowed',
          opacity: reviseActive ? 1 : 0.35,
          letterSpacing: 0.5,
          transition: 'opacity 0.15s',
      }}
  >
      Revise Script
  </button>
  ```
- [ ] Add Make a Podcast button inside footer:
  ```jsx
  <button
      onClick={handlePodcast}
      disabled={!podcastActive}
      style={{
          border: '1px solid var(--gold)',
          color: 'var(--gold)',
          background: 'transparent',
          fontFamily: "'Crimson Pro', serif",
          fontSize: 13,
          padding: '7px 20px',
          cursor: podcastActive ? 'pointer' : 'not-allowed',
          opacity: podcastActive ? 1 : 0.35,
          letterSpacing: 0.5,
          transition: 'opacity 0.15s',
      }}
  >
      Make a Podcast
  </button>
  ```

### 6.3 Tasks
- [ ] Add getButtonStates() helper above ReadingRoom component:
  ```js
  function getButtonStates(bookData, selectedPartId) {
      if (!bookData || selectedPartId === null) {
          return { reviseActive: false, podcastActive: false };
      }
      const s = bookData.state[String(selectedPartId)];
      return {
          reviseActive: s === 'script_ready' || s === 'audio_ready',
          podcastActive: s === 'script_ready',
      };
  }
  ```
- [ ] Inside ReadingRoom component, derive button states before JSX:
  ```js
  const { reviseActive, podcastActive } = getButtonStates(bookData, selectedPartId);
  ```
- [ ] Pass reviseActive and podcastActive into button style/disabled props 
  (already wired in 6.2 task above).

### 6.4 Tasks
- [ ] Add state: `const [reviseConfirmPending, setReviseConfirmPending] = useState(false)`
- [ ] Reset reviseConfirmPending when selectedPartId changes. Add to or extend 
  existing selectedPartId useEffect, or add new one:
  ```js
  useEffect(() => {
      setReviseConfirmPending(false);
  }, [selectedPartId]);
  ```
- [ ] Write handleRevise() inside ReadingRoom component:
  ```js
  function handleRevise() {
      if (!reviseActive || selectedPartId === null) return;
      const s = bookData.state[String(selectedPartId)];
      if (s === 'audio_ready' && !reviseConfirmPending) {
          setReviseConfirmPending(true);
          return;
      }
      setReviseConfirmPending(false);
      fetch('http://localhost:8000/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ book_folder: bookFolder, part_number: selectedPartId }),
      })
          .then(res => { if (!res.ok) throw new Error(); })
          .then(() => {
              setGeneratingPartId(selectedPartId);
              setPanelMode('generating');
          })
          .catch(() => setPanelMode('error'));
  }
  ```
- [ ] Add confirmation banner JSX inside footer, above the buttons:
  ```jsx
  {reviseConfirmPending && (
      <span style={{
          fontFamily: "'Crimson Pro', serif",
          fontSize: 12,
          color: 'var(--text-muted)',
          fontStyle: 'italic',
          marginRight: 'auto',
      }}>
          This will delete your existing audio. Click again to confirm.
      </span>
  )}
  ```
  Place this span before the buttons so it appears left-aligned in the footer bar.

### 6.5 Tasks
- [ ] Write handlePodcast() inside ReadingRoom component:
  ```js
  function handlePodcast() {
      if (!podcastActive) return;
      // Phase 7 wires this
  }
  ```
- [ ] Confirm Make a Podcast button calls handlePodcast (already in 6.2 JSX).

## Done When
- Click script_ready part → skeleton loads → script renders → sticky footer 
  appears with both buttons
- state = script_ready: both buttons full opacity, pointer cursor
- state = audio_ready: Revise Script full opacity, Make a Podcast greyed + 
  not-allowed
- Click Revise Script (script_ready) → generation starts immediately, 
  skeleton reappears, footer disappears with panel mode switch
- Click Revise Script (audio_ready) → confirmation banner appears in footer. 
  Click again → generation starts, MP3 deleted from disk, state reverts to 
  script_ready in book_state.json
- Click Make a Podcast (script_ready) → no visible action (Phase 7)
- Click greyed Make a Podcast → no action, cursor not-allowed
- Navigating to a different part resets reviseConfirmPending — no stale banner
- New generated script overwrites old script, right panel updates correctly
- No console errors throughout all button states and transitions

## Physical Checklist

### Backend — MP3 Deletion
- [x] Manually place a dummy .mp3 in a part folder → POST /generate for that 
  part → MP3 deleted before Gemini runs (check disk during generation)
- [x] book_state.json shows script_ready immediately after MP3 deletion 
  (before Gemini finishes)
- [x] After generation completes: script.json overwritten, state still 
  script_ready, no MP3 on disk
- [x] Simulate double Gemini failure: state stays script_ready, old 
  script.json still present, no MP3

### Frontend — Footer Bar
- [x] Sticky footer bar visible at bottom of right panel when script loaded
- [x] Thin gold separator line at top of footer
- [x] Both buttons visible: "Revise Script" left, "Make a Podcast" right
- [x] Footer stays pinned while scrolling long script — does not scroll away

### Frontend — Button States
- [x] script_ready part: both buttons full opacity, pointer cursor
- [x] audio_ready part: Revise Script full opacity, Make a Podcast greyed 
  (opacity 0.35, not-allowed cursor)
- [x] Switch between parts with different states → button states update 
  correctly without page refresh

### Frontend — Revise Script (script_ready)
- [x] Click Revise Script on script_ready part → no confirmation banner → 
  skeleton appears immediately
- [x] panelMode = 'generating', generatingPartId set, left panel locked
- [x] POST /generate fires (check Network tab)

### Frontend — Revise Script (audio_ready)
- [ ] Click Revise Script on audio_ready part → confirmation banner appears 
  in footer ("This will delete your existing audio. Click again to confirm.")
  _(deferred to Phase 7 — no audio_ready parts exist yet)_
- [ ] Banner text: Crimson Pro, italic, muted color, left-aligned
  _(deferred to Phase 7)_
- [ ] Second click → generation starts, banner disappears with mode switch
  _(deferred to Phase 7)_
- [ ] Navigate to different part mid-confirmation → banner gone on return 
  (reviseConfirmPending reset) _(deferred to Phase 7)_

### Frontend — Make a Podcast
- [x] Click Make a Podcast on script_ready part → no crash, no action
- [ ] Click greyed Make a Podcast → no action _(deferred to Phase 7 — no audio_ready parts)_

### No Regressions
- [x] TopBar visible, breadcrumb correct
- [x] Dark/light toggle works across all panel states
- [x] Poll continues every 5s during all panel modes _(not explicitly tested)_
- [x] Left panel lock during generation still works (opacity + pointer-events) _(not explicitly tested)_
- [x] No console errors on any state or transition

## Notes
- **handlePodcast scope bug caught:** `podcastActive` is only derived inside `renderRightPanel`. 
  `handlePodcast` must call `getButtonStates()` directly — cannot reference the outer-scope 
  derived variable. Same pattern applies to any handler in Phase 7 that needs button state.
- **Skeleton fix applied post-implementation:** `handlePartClick` was calling `fetchScript()` 
  without first setting `panelMode('generating')`. Fix: always set generating mode before 
  any async fetch so skeleton shows. Apply same pattern in Phase 7 for any fetch that 
  triggers a panel state change.
- **audio_ready checklist items deferred to Phase 7:** Revise Script on audio_ready 
  (confirmation banner, second click, reset on nav) and greyed Make a Podcast 
  cannot be tested until Phase 7 produces an audio_ready part.
- **panelModeRef pattern:** polling useEffect reads `panelModeRef.current` (not `panelMode`) 
  to avoid stale closures. Any future polling logic must follow this pattern.
- **MP3 deletion is atomic with generation:** deletion happens inside `generate_script_task` 
  (background task), not a separate endpoint. State reverts to `script_ready` immediately 
  after deletion, before Gemini runs. If generation fails, state stays `script_ready` — 
  old script intact, no audio. Consistent in all paths.
- **Footer only renders in panelMode === 'script':** switching to generating/error/idle 
  automatically removes footer — no explicit hide logic needed.
