# Phase 8.7 — The Quill

**Job:** Build and perfect a quill animation in a standalone 
sandbox file. No app code touched. Once animation looks right, 
port it into the main app (ReadingRoom player top area). Then 
delete sandbox.

## Approach
Sandbox-first. Single file: `quill-test.html`. Embedded CSS + 
minimal JS. No build step, no React, no backend. Open directly in 
browser. Iterate freely. Port only when perfect.

## Decisions Made
- Animation concept: quill that writes
  - Quill moves and writes while audio playing
  - Quill freezes when paused
  - CSS-only animation (no Web Audio API needed)
  - Gold/brass color palette matching app: #c9a84c / rgba(201,168,76,...)
  - Dark navy background matching app: #0a0e1a
- Visual treatment: TBD — to be decided during sandbox iteration
- Sandbox file: `quill-test.html` in project root
- Port target: top area of Player tab in ReadingRoom 
  (currently empty, reserved since Phase 8)
- Sandbox deleted after port confirmed working

## Objectives
- Create `quill-test.html` with live animated quill
- Iterate on design until user approves look
- Port CSS + HTML structure into ReadingRoom player top area
- Wire play/pause state: animation runs when `isPlaying`, freezes when not
- Delete `quill-test.html`

## Sub-Phases
8.7.1 Sandbox — build quill-test.html, iterate to approval
8.7.2 Port — copy animation into ReadingRoom, wire isPlaying state
8.7.3 Cleanup — delete sandbox file

## Files Affected
**Created:**
- `quill-test.html` — sandbox (deleted in 8.7.3)

**Modified:**
- `frontend/src/pages/ReadingRoom.jsx` — add quill to player 
  top area, wire to isPlaying state

## Tasks

### 8.7.1 Tasks
- [x] Create `quill-test.html` in project root with:
  - Dark navy background (#0a0e1a)
  - Gold quill animation (color: #c9a84c)
  - Play/pause toggle button to test both states
  - All CSS embedded in `<style>` block
  - No external dependencies
- [x] Iterate on visual treatment until user approves

### 8.7.2 Tasks
- [x] Extract quill HTML structure and CSS from sandbox
- [x] Add to ReadingRoom player top area (the empty div reserved 
  in Phase 8)
- [x] Wire animation play/pause to `isPlaying` state:
  - Playing: call startQuill() — starts RAF loop
  - Paused: call stopQuill() — cancels RAF, freezes in place
- [x] Verify looks correct in app at correct size

### 8.7.3 Tasks
- [x] Delete `quill-test.html`
- [x] Confirm no references to sandbox file remain

## Done When
- Quill visible in Player tab top area
- Quill writes while audio plays, freezes when paused
- Matches dark academia palette (gold on navy)
- No console errors
- Sandbox file deleted

## Physical Checklist
- [x] `quill-test.html` opens in browser, animation runs
- [x] Toggle button correctly freezes/unfreezes quill
- [x] User approves visual treatment
- [x] Quill appears in ReadingRoom Player tab top area
- [x] Play audio → quill moves
- [x] Pause audio → quill freezes
- [x] Switch to Script tab → no visual glitch
- [x] Switch back to Player tab → correct state shown
- [x] `quill-test.html` deleted

## Notes

### Why JS RAF instead of CSS keyframes
CSS keyframes cannot track a path. `getPointAtLength(n)` gives the exact
(x,y) on any SVG path — quill nib stays perfectly on trail tip at every
frame. CSS approximations always drift. Any future path-following animation
must use this JS approach.

### Tangent-based rotation
Rotation is derived each frame from two nearby path samples:
```js
const a = path.getPointAtLength(Math.max(0, len - 1))
const b = path.getPointAtLength(Math.min(pl, len + 1))
const tilt = 45 + Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI * 0.35
```
TILT_SCALE = 0.35 maps wave tangent (max ~±23°) to ±8° deviation → 37°–53° range.
Change TILT_SCALE to adjust how much quill tilts with the wave.

### Pause = cancelAnimationFrame
`cancelAnimationFrame(rafId)` freezes current frame exactly. `quillElapsedRef`
persists so resume continues from same position. Never reset elapsed on pause.

### Cache init on first frame
`quillCacheRef` is null until first `applyQuillFrame` call. Cache stores
`pathLength`, `startPt`, `endPt`, `lastWritingTilt`. Reset cache
(`quillCacheRef.current = null`) whenever part changes — do not reuse
across parts even though the path is the same SVG.

### Initial render flash fix
SVG elements need correct initial attributes in JSX or first render
shows raw unstyled state (trail visible, quill at origin). Fix:
set `style={{ opacity: 0 }}` on trail wrap and `transform="translate(60 220)"`
/ `transform="rotate(45)"` on quill groups directly in JSX. JS takes over
from first RAF frame onward.

### Quill geometry (nib tip at local origin)
Nib tip sits at local (0,0). SVG `rotate()` pivots around (0,0) by
default — so rotation always pivots at the nib tip without any
transform-origin hacks. Feather extends upward to y=−95.
Do not change this coordinate convention or rotation breaks.

### Animation timing constants
`DURATION = 5000ms`, `WRITE_END = 0.70`, `FADE_END = 0.80`.
0–70%: quill writes trail left→right.
70–80%: quill holds at right edge, trail lifts 25px and fades out.
80–100%: quill slides back to start (ease-in-out), trail invisible.
Adjust FADE_LIFT (25px) to change how far trail drifts upward on fade.
