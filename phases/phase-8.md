# Phase 8 — The Player

**Job:** Backend serves MP3 via static file mount. Functional audio 
player replaces the right panel for audio_ready parts. Two tabs at 
top of right panel switch between Script view and Player view — audio 
keeps running when switching to script. Player controls at bottom: 
play/pause, 10s skip/rewind, speed selector, scrubber. Top of player 
panel left empty for Phase 8.5 waveform. Keyboard shortcuts wired.

## Decisions Made
- **D10:** Playback speed — 0.75x, 1x, 1.25x, 1.5x, 2x. HTML audio 
  element `playbackRate`. Pure frontend.
- **D14:** Keyboard shortcuts — Space play/pause, Left arrow −10s, 
  Right arrow +10s. Scoped to Reading Room only.
- **Q1:** Player replaces entire right panel. Controls pinned to bottom. 
  Top area left empty (Phase 8.5 adds waveform there). Two tabs 
  (Script / Player) at top of right panel. Switching tabs does NOT 
  pause audio.
- **Q2:** Phase 8 is functional/minimal. Polish (colors, animations, 
  waveform) deferred to Phase 8.5.
- **Q3:** Scrubber included in Phase 8. Clickable/draggable timeline 
  bar — shows current position, click to seek.
- **Q4:** Static file mount. FastAPI serves `output/` folder directly. 
  Browser handles range requests natively — required for scrubber to 
  work. Zero custom backend code for file serving.

## Objectives
- Backend: mount `output/` as static files at `/output` path.
- Frontend: two tabs ("Script" / "Player") appear in right panel header 
  whenever selected part is `audio_ready`. Script tab selected by default.
- Tab switch is purely a view toggle — does not affect audio playback.
- Player tab: top area empty, player controls bar pinned to bottom.
- Player controls: play/pause button, current time / total duration, 
  scrubber (progress bar + seek), −10s button, +10s button, speed 
  selector (0.75x 1x 1.25x 1.5x 2x).
- Audio loads from static URL constructed from book_folder + part_number 
  + part title.
- Keyboard shortcuts: Space = play/pause, Left = −10s, Right = +10s. 
  Active only when Reading Room is mounted.
- When part switches (user clicks different part in left panel), audio 
  stops and player resets.

## Sub-Phases
8.1 Backend — static file mount
8.2 Tab bar — Script / Player tabs in right panel header
8.3 Audio element + state — load MP3, play/pause, time tracking
8.4 Player controls bar — scrubber, skip buttons, speed selector
8.5 Keyboard shortcuts

## Files Affected
**Modified:**
- `backend/main.py` — add StaticFiles mount for output/
- `frontend/src/pages/ReadingRoom.jsx` — tab bar, audio element, 
  player controls, keyboard shortcuts

## Tasks

### 8.1 Tasks
- [x] In main.py, add import: `from fastapi.staticfiles import StaticFiles`
- [x] Mount output folder after app init:
  ```python
  app.mount("/output", StaticFiles(directory="output"), name="output")
  ```
- [x] Confirm: `GET http://localhost:8000/output/{book_folder}/Part{n}_{title}/{filename}.mp3` 
  returns 200 + audio stream in browser.

### 8.2 Tasks
- [x] Add state to ReadingRoom: `const [rightTab, setRightTab] = useState('script')`
  Reset to `'script'` whenever `selectedPartId` changes.
- [x] Tab bar renders only when selected part state is `audio_ready`. 
  When state is `script_ready` or `empty`, no tabs — right panel behaves 
  as before (Phase 5/6 views).
- [x] Tab bar JSX — sits at top of right panel, above content area.
- [x] Right panel content area: renders script view when `rightTab === 'script'`, 
  renders player view when `rightTab === 'player'`. Both branches always 
  mount (use CSS `display: none` / `display: block` toggle, NOT conditional 
  render) so audio element is never unmounted mid-playback.

### 8.3 Tasks
- [x] Add state:
  ```js
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  ```
- [x] Build audio URL helper:
  ```js
  function sanitizeName(s) {
    return s.replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '_')
  }
  function getAudioUrl(bookFolder, partNumber, partTitle) {
      const sanitized = sanitizeName(partTitle);
      const partDir = `Part${partNumber}_${sanitized}`;
      const filename = `${bookFolder}Part${partNumber}${sanitized}.mp3`;
      return `http://localhost:8000/output/${bookFolder}/${partDir}/${filename}`;
  }
  ```
  Note: `sanitizeName` matches backend `sanitize_name()` exactly — 
  strips non-`\w\s`, trims, then collapses whitespace to `_`.
- [x] Render hidden `<audio>` element inside player panel div (always present 
  when audio_ready part selected, regardless of active tab):
  ```jsx
  <audio
      ref={audioRef}
      src={getAudioUrl(bookFolder, selectedPartId, selectedPartTitle)}
      onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
      onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
      onEnded={() => setIsPlaying(false)}
      onPlay={() => setIsPlaying(true)}
      onPause={() => setIsPlaying(false)}
  />
  ```
- [x] `selectedPartTitle` — derive from `bookData.parts.find(p => p.part_number === selectedPartId)?.title` 
  when rendering. Pass through to audio URL.
- [x] When `selectedPartId` changes: call `audioRef.current?.pause()`, 
  reset `currentTime`, `duration`, `isPlaying` to initial values.
- [x] Sync `playbackRate` to audio element:
  ```js
  useEffect(() => {
      if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);
  ```

### 8.4 Tasks
- [x] Player controls bar — pinned to bottom of player tab content, 
  full width:
  ```jsx
  <div style={{
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      padding: '16px 32px',
      borderTop: '1px solid var(--border)',
      background: 'var(--surface)',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
  }}>
      {/* scrubber row */}
      {/* controls row */}
  </div>
  ```
- [x] Scrubber row — time label left, progress bar center, duration right:
  ```jsx
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontFamily: "'Crimson Pro', serif", fontSize: 12,
          color: 'var(--text-muted)', minWidth: 36 }}>
          {formatTime(currentTime)}
      </span>
      <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={e => {
              const t = parseFloat(e.target.value);
              if (audioRef.current) audioRef.current.currentTime = t;
              setCurrentTime(t);
          }}
          style={{ flex: 1, accentColor: 'var(--gold)', cursor: 'pointer' }}
      />
      <span style={{ fontFamily: "'Crimson Pro', serif", fontSize: 12,
          color: 'var(--text-muted)', minWidth: 36, textAlign: 'right' }}>
          {formatTime(duration)}
      </span>
  </div>
  ```
- [x] Add `formatTime(seconds)` helper above component:
  ```js
  function formatTime(s) {
      if (!s || isNaN(s)) return '0:00';
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${sec.toString().padStart(2, '0')}`;
  }
  ```
- [x] Controls row — rewind, play/pause, skip, speed selector:
  ```jsx
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      {/* −10s */}
      <button onClick={() => {
          if (audioRef.current) audioRef.current.currentTime = Math.max(0, currentTime - 10);
      }} style={iconBtnStyle}>
          <RotateCcw size={18} strokeWidth={1.5} color="var(--gold)" />
      </button>
      {/* play/pause */}
      <button onClick={() => {
          if (!audioRef.current) return;
          isPlaying ? audioRef.current.pause() : audioRef.current.play();
      }} style={{ ...iconBtnStyle, width: 40, height: 40 }}>
          {isPlaying
              ? <Pause size={20} strokeWidth={1.5} color="var(--gold)" />
              : <Play size={20} strokeWidth={1.5} color="var(--gold)" fill="var(--gold)" />}
      </button>
      {/* +10s */}
      <button onClick={() => {
          if (audioRef.current) audioRef.current.currentTime = Math.min(duration, currentTime + 10);
      }} style={iconBtnStyle}>
          <RotateCw size={18} strokeWidth={1.5} color="var(--gold)" />
      </button>
      {/* speed */}
      <select
          value={playbackRate}
          onChange={e => setPlaybackRate(parseFloat(e.target.value))}
          style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              fontFamily: "'Crimson Pro', serif",
              fontSize: 12,
              padding: '3px 6px',
              cursor: 'pointer',
          }}
      >
          {[0.75, 1, 1.25, 1.5, 2].map(r => (
              <option key={r} value={r}>{r}x</option>
          ))}
      </select>
  </div>
  ```
- [x] Define `iconBtnStyle` const above JSX:
  ```js
  const iconBtnStyle = {
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      padding: 6,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
  };
  ```
- [x] Import `RotateCcw, RotateCw, Play, Pause` from `lucide-react`.

### 8.5 Tasks
- [x] Add keyboard shortcut useEffect in ReadingRoom:
  ```js
  useEffect(() => {
      function handleKey(e) {
          if (!audioRef.current) return;
          // don't fire inside input / select elements
          if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
          if (e.code === 'Space') {
              e.preventDefault();
              isPlaying ? audioRef.current.pause() : audioRef.current.play();
          }
          if (e.code === 'ArrowLeft') {
              e.preventDefault();
              audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
          }
          if (e.code === 'ArrowRight') {
              e.preventDefault();
              audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 10);
          }
      }
      window.addEventListener('keydown', handleKey);
      return () => window.removeEventListener('keydown', handleKey);
  }, [isPlaying, duration]);
  ```

## Done When
- Select `audio_ready` part → Script tab + Player tab appear in right panel header
- Script tab shows dialogue (existing Phase 5/6 view), sticky footer visible
- Player tab shows empty top area + controls bar at bottom
- Audio loads and plays — play/pause works
- Scrubber shows current position, dragging seeks correctly
- −10s and +10s buttons work
- Speed selector changes playback rate
- Space / Left / Right keyboard shortcuts work (not inside inputs)
- Switching from Player tab to Script tab while audio plays — audio continues
- Switching to a different part — audio stops, player resets
- `script_ready` parts — no tabs, right panel behaves as before

## Physical Checklist
- [x] `GET http://localhost:8000/output/[book]/[partdir]/[file].mp3` returns 200 + audio
- [ ] `audio_ready` part selected → two tabs appear
- [ ] Script tab → dialogue rendered, sticky footer visible
- [ ] Player tab → empty top, controls bar at bottom
- [ ] Play button → audio plays, Pause stops it
- [ ] Scrubber moves in real time as audio plays
- [ ] Click scrubber midway → audio jumps to that position
- [ ] −10s / +10s buttons work at boundaries (clamps to 0 and duration)
- [ ] Speed selector → 0.75x audibly slower, 2x audibly faster
- [ ] Space key → toggles play/pause (not inside select/input)
- [ ] Left / Right arrows → seek ±10s
- [ ] Switch tab Script → Player while playing → audio still playing
- [ ] Click different part in left panel → audio stops, player resets
- [ ] `script_ready` part selected → no tabs, normal script view
- [ ] No console errors on any player interaction

## Notes

### Audio URL pattern
`http://localhost:8000/output/{bookFolder}/Part{n}_{sanitized(title)}/{bookFolder}Part{n}{sanitized(title)}.mp3`

JS `sanitizeName()` must match Python `sanitize_name()` exactly:
```js
s.replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '_')
```
Python: strips non-`\w\s`, strips leading/trailing whitespace, then `\s+` → `_`.

### StaticFiles mount — critical
`StaticFiles(directory="output")` uses CWD — breaks when uvicorn starts 
from project root. Must use absolute path:
```python
OUTPUT_DIR = Path(__file__).parent / "output"
app.mount("/output", StaticFiles(directory=str(OUTPUT_DIR)), name="output")
```
`OUTPUT_DIR` must be defined BEFORE the mount call.

### CSS display toggle — not conditional render
Both script and player divs are always mounted when `audio_ready`. 
Visibility toggled via `display: 'flex' / 'none'`. 
Never use conditional render for the player div — unmounting kills 
the `<audio>` element and stops playback mid-listen.

### Audio state architecture
- `audioRef` — the `<audio>` DOM element
- `currentTimeRef` — mirrors `currentTime` state; updated in `onTimeUpdate`; 
  read in selectedPartId effect to save position before switching parts
- `savedPositions` ref — `{ partId: seconds }` map; persists across part switches; 
  restored in `onLoadedMetadata` when new audio loads
- `prevSelectedPartIdRef` — tracks which part we're leaving so we can 
  key the saved position correctly

### Tab default by state
`audio_ready` parts open Player tab by default. All others open Script tab.
Logic lives in `selectedPartId` useEffect — reads `bookData.state` at switch time.

### Keyboard shortcuts scope
Space / Left / Right shortcuts skip if `e.target.tagName` is INPUT, SELECT, 
or TEXTAREA. Speed selector is a `<select>` — arrow keys inside it won't 
accidentally seek audio.

### Phase 8.5 entry points
- Player div top area is intentionally empty — reserved for waveform visualizer
- `isPlaying` state is the right signal for the pulsing animation on left panel
- `audioRef.current` is accessible anywhere in ReadingRoom for Phase 8.5 additions
