# Phase 8.5 — Player Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pulsing gold star animation to the left panel when audio is playing, and a download button in the script footer for audio-ready parts.

**Architecture:** Two isolated changes to `ReadingRoom.jsx`. Task 1 threads `isPlaying` state down to the part card renderer and applies a CSS throb animation to the star icon. Task 2 adds a download anchor to the existing sticky footer, reusing the existing `getAudioUrl` helper.

**Tech Stack:** React (inline styles + CSS keyframes), Lucide React, existing CSS custom properties (`var(--gold)`, `var(--text-muted)`, `var(--border)`)

---

### Task 1: Pulsing star animation

**Files:**
- Modify: `frontend/src/index.css` — add `throb` keyframe
- Modify: `frontend/src/pages/ReadingRoom.jsx` — update `renderStatusIcon`, `renderPartCard`, and the call site

**Context:**
- `blink-pulse` keyframe lives at `frontend/src/index.css:150` — add `throb` directly below it
- `renderStatusIcon(status)` is at line 13 — needs a second `throbbing` param
- `renderPartCard(part, stateMap, selectedPartId, generatingPartId, audioGeneratingPartId, onPartClick)` is at line 58 — needs `isPlaying` as 7th param
- The one call site is at line 819 inside the `bookData.parts.map(...)` render

- [ ] **Step 1: Add `throb` keyframe to index.css**

Open `frontend/src/index.css`. After the `blink-pulse` block (ends at line 153), add:

```css
/* ─── Audio playing throb ─────────────────────────────────────────────────── */
@keyframes throb {
  0%, 100% { opacity: 0.45; filter: drop-shadow(0 0 0px rgba(201,168,76,0)); }
  50%       { opacity: 1;    filter: drop-shadow(0 0 5px rgba(201,168,76,0.85)); }
}
```

- [ ] **Step 2: Update `renderStatusIcon` to accept `throbbing` param**

In `frontend/src/pages/ReadingRoom.jsx`, change the function signature and the `audio_ready` branch:

Old:
```js
function renderStatusIcon(status) {
```
New:
```js
function renderStatusIcon(status, throbbing = false) {
```

Old `audio_ready` return (line 25-27):
```js
  if (status === 'audio_ready') {
    return <Star size={14} strokeWidth={1.5} color="var(--gold)" fill="var(--gold)" style={{ flexShrink: 0 }} />
  }
```
New:
```js
  if (status === 'audio_ready') {
    return (
      <Star
        size={14}
        strokeWidth={1.5}
        color="var(--gold)"
        fill="var(--gold)"
        style={{
          flexShrink: 0,
          animation: throbbing ? 'throb 1.4s ease-in-out infinite' : 'none',
        }}
      />
    )
  }
```

- [ ] **Step 3: Update `renderPartCard` to receive and use `isPlaying`**

Old signature (line 58):
```js
function renderPartCard(part, stateMap, selectedPartId, generatingPartId, audioGeneratingPartId, onPartClick) {
```
New:
```js
function renderPartCard(part, stateMap, selectedPartId, generatingPartId, audioGeneratingPartId, onPartClick, isPlaying) {
```

Add `isThrobbing` after the existing `isSelected` / `isLocked` derivations (after line 63):
```js
  const isThrobbing = isPlaying && isSelected && iconStatus === 'audio_ready'
```

Update the `renderStatusIcon` call (was line 85):
```js
        {renderStatusIcon(iconStatus, isThrobbing)}
```

- [ ] **Step 4: Pass `isPlaying` at the call site**

In `ReadingRoom` return JSX, the call to `renderPartCard` is inside `bookData.parts.map(...)` (around line 819). Change:

Old:
```js
            bookData.parts.map(part =>
              renderPartCard(part, bookData.state, selectedPartId, generatingPartId, audioGeneratingPartId, handlePartClick)
            )
```
New:
```js
            bookData.parts.map(part =>
              renderPartCard(part, bookData.state, selectedPartId, generatingPartId, audioGeneratingPartId, handlePartClick, isPlaying)
            )
```

- [ ] **Step 5: Manually verify**

Start the frontend (`npm run dev` inside `frontend/`). Open Reading Room:
1. Select an `audio_ready` part → Player tab opens → press Play
2. Expected: star icon on that part card in the left panel begins throbbing (gold glow pulse, ~1.4s cycle)
3. Press Pause → Expected: throb stops immediately, icon returns to static gold star
4. Audio ends naturally → Expected: throb stops
5. While playing, click a different part → Expected: old star stops throbbing

- [ ] **Step 6: Commit**

```bash
git add frontend/src/index.css frontend/src/pages/ReadingRoom.jsx
git commit -m "feat: throb star icon on playing part in left panel"
```

---

### Task 2: Download button in footer

**Files:**
- Modify: `frontend/src/pages/ReadingRoom.jsx` — add `Download` to lucide import, add download anchor in footer

**Context:**
- Lucide import is at line 2. Add `Download` to the existing destructure (keep alphabetical).
- The sticky footer lives inside the `panelMode === 'script'` branch of `renderRightPanel`, starting around line 461.
- `partIsAudioReady` (line 390) and `selectedPartTitle` (line 391) are both in scope in the footer — they are declared at the top of the `panelMode === 'script'` block.
- `getAudioUrl(bookFolder, partNumber, partTitle)` already exists (line 35). `bookFolder` comes from `useParams` at line 124. `selectedPartId` and `selectedPartTitle` are both available in `renderRightPanel`.
- `sanitizeName` already exists (line 31) — use it to build the download filename so it matches the actual file on disk.
- The download anchor must use `download` attribute so the browser saves the file instead of playing it inline.

- [ ] **Step 1: Add `Download` to lucide import**

Line 2, current:
```js
import { AlertCircle, Circle, Pause, Play, RotateCcw, RotateCw, ScrollText, Star } from 'lucide-react'
```
New (add `Download` alphabetically):
```js
import { AlertCircle, Circle, Download, Pause, Play, RotateCcw, RotateCw, ScrollText, Star } from 'lucide-react'
```

- [ ] **Step 2: Add download anchor after "Make a Podcast" button**

Inside `renderRightPanel`, inside the footer `<div>` (the one with `borderTop: '1px solid var(--gold-muted)'`), after the closing `</button>` of the "Make a Podcast" button, add:

```jsx
              {partIsAudioReady && (
                <a
                  href={getAudioUrl(bookFolder, selectedPartId, selectedPartTitle)}
                  download={`Part${selectedPartId}_${sanitizeName(selectedPartTitle)}.mp3`}
                  style={{
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                    background: 'transparent',
                    padding: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    marginLeft: 'auto',
                  }}
                  title="Download MP3"
                >
                  <Download size={15} strokeWidth={1.5} color="var(--text-muted)" />
                </a>
              )}
```

Note: `marginLeft: 'auto'` pushes the download icon to the far right of the footer row, separate from the Revise / Make a Podcast buttons.

- [ ] **Step 3: Manually verify**

In the browser:
1. Select a `script_ready` part → footer shows Revise Script + Make a Podcast, NO download icon
2. Select an `audio_ready` part, Script tab → footer shows Revise Script + Make a Podcast + download icon on the right
3. Click the download icon → browser prompts to save / saves an `.mp3` file named `Part{n}_{title}.mp3`
4. Open the saved file — it plays correctly

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ReadingRoom.jsx
git commit -m "feat: download MP3 button in script footer for audio_ready parts"
```
