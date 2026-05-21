# Phase 7 — The Voice

**Job:** Make a Podcast button triggers Edge TTS. Script lines 
sent to correct voices. Audio chunks merged into one MP3 via 
pydub. book_state.json updated to audio_ready. Progress bar + 
line counter shown during generation.

## Decisions Made
- Alex voice: en-US-GuyNeural
- Morgan voice: en-US-JennyNeural
- pydub + ffmpeg for merging. User responsible for ffmpeg install.
- ffmpeg startup check: shutil.which("ffmpeg"). If missing, log 
  WARNING in terminal — app still starts.
- No parallel generation. One part at a time.
- **Q1:** Async fire-and-poll with progress endpoint. POST /podcast 
  returns 202. Backend writes progress.json per line. Frontend polls 
  /podcast-progress every 2s. Shows line counter.
- **Q2:** Progress bar + line counter. Thin gold bar fills across right 
  panel. "Generating line {n} of {total}" text below it.
- **Q3:** 300ms silence between dialogue lines (pydub AudioSegment.silent).
- **Q4:** Left panel locked during audio generation (audioGeneratingPartId 
  client-side state, same pattern as generatingPartId).
- **Q5:** On audio complete, return to script view. Poll detects 
  audio_ready transition. panelMode → 'script'.
- Audio lock file: audio.lock (separate from generating.lock). Lives 
  in part folder. GET /book checks it and returns is_audio_generating.
- 100ms delay between each TTS line request (rate limit protection).
- TTS failure: wipe all temp files + partial MP3 + progress.json. 
  panelMode → 'audio_error'. Make a Podcast button becomes active again.
- Stale audio.lock cleanup on startup: same 30-minute rule. Existing 
  glob pattern `output/**/*.lock` already catches audio.lock — no 
  extra code needed.
- MP3 filename: {book_folder}Part{n}{sanitized_title}.mp3 inside part_dir.

## Objectives
- Backend ffmpeg check on startup. Warning if missing.
- POST /podcast: load script.json, create audio.lock, write initial 
  progress.json, launch BackgroundTask, return 202.
- generate_audio_task: TTS each line with correct voice, 100ms delay, 
  update progress.json per line, save temp MP3 files, merge with 300ms 
  silence between lines, save final MP3, update book_state.json to 
  audio_ready, delete audio.lock + temp files + progress.json on success.
  On failure: delete all temp files + partial MP3 + progress.json + 
  audio.lock (via finally).
- GET /podcast-progress/{book_folder}/{part_number}: read + return 
  progress.json. Return {"current": 0, "total": 0} if not found.
- GET /book: add is_audio_generating per part (audio.lock exists check).
- Frontend handlePodcast: POST /podcast → audioGeneratingPartId set → 
  panelMode = 'audio_generating'.
- Progress panel: gold progress bar (fills to current/total%) + 
  "Generating line {n} of {total}" text. Polls /podcast-progress every 2s.
- Poll transition: detect audio_ready in 5s book poll → fetchScript() → 
  panelMode = 'script'.
- Failure detection: is_audio_generating flips false but state still 
  script_ready → panelMode = 'audio_error'.
- Left panel lock: audioGeneratingPartId !== null → same dim/no-click 
  behavior as generatingPartId.
- Audio error state: 'audio_error' panelMode, error message, 
  "Back to Script" button (returns to script view, not retry).

## Sub-Phases
7.1 Backend foundations — ffmpeg startup check, confirm stale audio.lock 
    cleanup covered by existing glob pattern
7.2 POST /podcast endpoint — load script, create lock + progress.json, 
    launch BackgroundTask, return 202
7.3 Background audio task — TTS per line, progress updates, 300ms silence 
    merge, final MP3 save, state update, cleanup on success + failure
7.4 GET /podcast-progress endpoint — read + return progress.json
7.5 GET /book extension — add is_audio_generating from audio.lock check
7.6 Frontend — handlePodcast, audioGeneratingPartId + podcastProgress state, 
    progress bar UI, poll transitions, left panel lock extension, 
    audio error state

## Files Affected
**Modified:**
- `backend/main.py` — ffmpeg check in startup, POST /podcast, 
  generate_audio_task, GET /podcast-progress, GET /book 
  is_audio_generating field. New imports: shutil, asyncio, 
  edge_tts, AudioSegment from pydub.
- `frontend/src/pages/ReadingRoom.jsx` — handlePodcast wire, 
  audioGeneratingPartId + audioGeneratingPartIdRef + podcastProgress 
  state, panelMode extensions ('audio_generating', 'audio_error'), 
  progress bar + line counter JSX, poll transition for audio_ready, 
  left panel lock extension, audio error JSX, selectedPartId 
  useEffect extension.

## Tasks

### 7.1 Tasks
- [ ] Add imports to main.py: `import shutil`, `import asyncio`, 
  `import edge_tts`, `from pydub import AudioSegment`.
- [ ] Inside existing `cleanup_stale_locks` startup handler, after 
  lock cleanup loop, add ffmpeg check:
  ```python
  if not shutil.which("ffmpeg"):
      print("WARNING: ffmpeg not found. Audio generation will fail. Install ffmpeg and restart.")
  ```
- [ ] Verify existing glob pattern `output/**/*.lock` catches audio.lock 
  (it does — no change needed to cleanup loop).

### 7.2 Tasks
- [ ] Add Pydantic model to main.py:
  ```python
  class PodcastRequest(BaseModel):
      book_folder: str
      part_number: int
  ```
- [ ] Add POST /podcast endpoint. Load 
  `output/{book_folder}/parts.json`, find part by part_number — 
  return 404 if not found.
- [ ] In endpoint: build `part_dir = os.path.join("output", book_folder, f"Part{part['part_number']}_{sanitize_name(part['title'])}")`. 
  `os.makedirs(part_dir, exist_ok=True)`.
- [ ] In endpoint: load `script.json` from part_dir. Get total line 
  count (`total = len(script_data)`). Return 404 if script.json missing.
- [ ] In endpoint: create audio.lock:
  ```python
  audio_lock_path = os.path.join(part_dir, "audio.lock")
  open(audio_lock_path, "w").close()
  ```
- [ ] In endpoint: write initial progress.json:
  ```python
  with open(os.path.join(part_dir, "progress.json"), "w") as f:
      json.dump({"current": 0, "total": total}, f)
  ```
- [ ] Add BackgroundTasks param, call 
  `background_tasks.add_task(generate_audio_task, book_folder, part_number)`.
- [ ] Return `JSONResponse({"status": "started"}, status_code=202)`.

### 7.3 Tasks
- [ ] Write `async def generate_audio_task(book_folder: str, part_number: int)` 
  in main.py.
- [ ] Resolve paths before try block (same pattern as generate_script_task):
  ```python
  # Resolve part dir and paths before try — so finally can always clean up
  parts_data = json.load(open(os.path.join("output", book_folder, "parts.json")))
  part = next((p for p in parts_data["parts"] if p["part_number"] == part_number), None)
  if not part:
      return
  part_dir = os.path.join("output", book_folder, f"Part{part['part_number']}_{sanitize_name(part['title'])}")
  audio_lock_path = os.path.join(part_dir, "audio.lock")
  progress_path = os.path.join(part_dir, "progress.json")
  ```
- [ ] Wrap entire task body in try/except/finally:
  - `except`: log error, cleanup partial files (see below).
  - `finally`: if audio.lock exists, `os.remove(audio_lock_path)`.
- [ ] In task (try block): load `script.json` from part_dir.
- [ ] Define voice map:
  ```python
  voice_map = {"Alex": "en-US-GuyNeural", "Morgan": "en-US-JennyNeural"}
  ```
- [ ] Build temp file paths list:
  ```python
  temp_paths = [os.path.join(part_dir, f"temp_{i:04d}.mp3") for i in range(len(script))]
  ```
- [ ] Loop through script lines:
  ```python
  for i, item in enumerate(script):
      voice = voice_map.get(item["host"], "en-US-GuyNeural")
      communicate = edge_tts.Communicate(item["line"], voice)
      await communicate.save(temp_paths[i])
      with open(progress_path, "w") as f:
          json.dump({"current": i + 1, "total": len(script)}, f)
      await asyncio.sleep(0.1)
  ```
- [ ] After loop: merge with pydub + 300ms silence:
  ```python
  silence = AudioSegment.silent(duration=300)
  combined = AudioSegment.empty()
  for i, path in enumerate(temp_paths):
      segment = AudioSegment.from_mp3(path)
      if i > 0:
          combined += silence
      combined += segment
  ```
- [ ] Build final MP3 path + export:
  ```python
  mp3_filename = f"{book_folder}Part{part_number}{sanitize_name(part['title'])}.mp3"
  mp3_path = os.path.join(part_dir, mp3_filename)
  combined.export(mp3_path, format="mp3")
  ```
- [ ] Update book_state.json on success:
  ```python
  state_path = os.path.join("output", book_folder, "book_state.json")
  with open(state_path) as f:
      state = json.load(f)
  state["parts"][str(part_number)] = "audio_ready"
  with open(state_path, "w") as f:
      json.dump(state, f)
  ```
- [ ] Cleanup on success — delete temp files + progress.json:
  ```python
  for path in temp_paths:
      if os.path.exists(path):
          os.remove(path)
  if os.path.exists(progress_path):
      os.remove(progress_path)
  print(f"[podcast] Audio ready: {mp3_path}")
  ```
- [ ] In except block — cleanup on failure:
  ```python
  for path in temp_paths:
      if os.path.exists(path):
          os.remove(path)
  if os.path.exists(mp3_path):
      os.remove(mp3_path)
  if os.path.exists(progress_path):
      os.remove(progress_path)
  print(f"[podcast] Audio generation failed: {e}")
  ```
  Note: `mp3_path` may not be assigned if failure happened before that line.
  Wrap `os.remove(mp3_path)` in its own try/except NameError.

### 7.4 Tasks
- [ ] Add GET /podcast-progress/{book_folder}/{part_number} endpoint.
- [ ] Load parts.json, find part — return `{"current": 0, "total": 0}` 
  if not found (no 404 — frontend handles gracefully).
- [ ] Build progress_path: 
  `os.path.join("output", book_folder, f"Part{part_number}_{sanitize_name(part['title'])}", "progress.json")`
- [ ] If progress.json not found: return `{"current": 0, "total": 0}`.
- [ ] Load and return progress.json contents.

### 7.5 Tasks
- [ ] In GET /book/{book_folder} endpoint, inside the per-part loop, 
  alongside the existing `is_generating` check, add:
  ```python
  audio_lock = os.path.join(part_dir, "audio.lock")
  part["is_audio_generating"] = os.path.exists(audio_lock)
  ```

### 7.6 Tasks
- [ ] Add state in ReadingRoom component:
  ```js
  const [audioGeneratingPartId, setAudioGeneratingPartId] = useState(null);
  const [podcastProgress, setPodcastProgress] = useState({ current: 0, total: 0 });
  ```
- [ ] Add ref for poll closure (same pattern as panelModeRef):
  ```js
  const audioGeneratingPartIdRef = useRef(audioGeneratingPartId);
  useEffect(() => { audioGeneratingPartIdRef.current = audioGeneratingPartId; }, [audioGeneratingPartId]);
  ```
- [ ] Wire handlePodcast() — replace the Phase 6 stub:
  ```js
  function handlePodcast() {
      const { podcastActive } = getButtonStates(bookData, selectedPartId);
      if (!podcastActive || selectedPartId === null) return;
      fetch('http://localhost:8000/podcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ book_folder: bookFolder, part_number: selectedPartId }),
      })
          .then(res => { if (!res.ok) throw new Error(); })
          .then(() => {
              setAudioGeneratingPartId(selectedPartId);
              setPanelMode('audio_generating');
              setPodcastProgress({ current: 0, total: 0 });
          })
          .catch(() => setPanelMode('audio_error'));
  }
  ```
- [ ] Add progress polling useEffect (2s interval, runs only during audio gen):
  ```js
  useEffect(() => {
      if (panelMode !== 'audio_generating' || audioGeneratingPartId === null) return;
      const interval = setInterval(() => {
          fetch(`http://localhost:8000/podcast-progress/${bookFolder}/${audioGeneratingPartId}`)
              .then(res => res.ok ? res.json() : null)
              .then(data => { if (data) setPodcastProgress(data); })
              .catch(() => {});
      }, 2000);
      return () => clearInterval(interval);
  }, [panelMode, audioGeneratingPartId, bookFolder]);
  ```
- [ ] In existing 5s poll useEffect, after the existing panelMode === 'generating' 
  check block, add audio transition detection:
  ```js
  if (panelModeRef.current === 'audio_generating' && audioGeneratingPartIdRef.current !== null) {
      const audioPartId = audioGeneratingPartIdRef.current;
      const partState = data.state[String(audioPartId)];
      if (partState === 'audio_ready') {
          fetchScript(audioPartId);   // returns to script view (Q5)
          setAudioGeneratingPartId(null);
      } else {
          const part = data.parts.find(p => p.part_number === audioPartId);
          if (part && !part.is_audio_generating) {
              // audio.lock gone, state not audio_ready = task failed
              setPanelMode('audio_error');
              setAudioGeneratingPartId(null);
          }
      }
  }
  ```
- [ ] Build progress bar JSX for panelMode === 'audio_generating'. 
  Add as a branch in the right panel conditional (alongside existing 
  'idle', 'generating', 'script', 'error' branches):
  ```jsx
  ) : panelMode === 'audio_generating' ? (
      <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%', gap: 24, padding: '0 48px'
      }}>
          <div style={{ width: '100%', maxWidth: 320 }}>
              <div style={{
                  height: 2, background: 'var(--border)', borderRadius: 1,
                  overflow: 'hidden',
              }}>
                  <div style={{
                      height: '100%', background: 'var(--gold)',
                      width: podcastProgress.total > 0
                          ? `${(podcastProgress.current / podcastProgress.total) * 100}%`
                          : '0%',
                      transition: 'width 0.4s ease',
                  }} />
              </div>
          </div>
          <p style={{
              fontFamily: "'Crimson Pro', serif", fontSize: 14,
              color: 'var(--text-muted)', margin: 0, textAlign: 'center'
          }}>
              {podcastProgress.total > 0
                  ? `Generating line ${podcastProgress.current} of ${podcastProgress.total}`
                  : 'Preparing audio…'}
          </p>
      </div>
  ```
- [ ] Build audio error JSX for panelMode === 'audio_error':
  ```jsx
  ) : panelMode === 'audio_error' ? (
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
              Audio generation failed.
          </p>
          <p style={{
              fontFamily: "'Crimson Pro', serif", fontSize: 13,
              color: 'var(--text-muted)', margin: 0
          }}>
              Please try again.
          </p>
          <button
              onClick={() => {
                  setPanelMode('script');
                  setAudioGeneratingPartId(null);
              }}
              style={{
                  border: '1px solid var(--gold)', color: 'var(--gold)',
                  background: 'transparent', fontFamily: "'Crimson Pro', serif",
                  fontSize: 13, padding: '8px 20px', cursor: 'pointer',
                  letterSpacing: 0.5,
              }}
          >
              Back to Script
          </button>
      </div>
  ```
- [ ] Extend left panel lock: update the isLocked flag passed to renderPartCard:
  ```js
  const isLocked = generatingPartId !== null || audioGeneratingPartId !== null;
  ```
- [ ] Extend selectedPartId useEffect to reset audio state on part switch:
  ```js
  useEffect(() => {
      setReviseConfirmPending(false);
      if (panelMode === 'audio_generating' || panelMode === 'audio_error') {
          setPanelMode('idle');
          setAudioGeneratingPartId(null);
      }
  }, [selectedPartId]);
  ```

## Done When
- Click Make a Podcast (script_ready part) → 202 returned immediately → 
  progress bar + "Preparing audio…" appears → line counter starts 
  incrementing every 2s
- Left panel dims immediately on click (all other cards locked)
- TTS finishes all lines → pydub merges → MP3 on disk at correct path
- book_state.json = audio_ready for that part
- Poll detects audio_ready → panel returns to script view → star icon 
  in left panel
- Make a Podcast button greyed (opacity 0.35, not-allowed) for 
  audio_ready parts
- Revise Script on audio_ready part → confirmation banner → second 
  click → MP3 deleted → generation starts (audio_ready deferred 
  tests from Phase 6 now testable)
- TTS failure → audio error panel shows → "Back to Script" returns 
  to script view
- No temp/partial MP3 files left on disk after failure
- ffmpeg missing → WARNING in terminal on startup, app still runs
- Stale audio.lock (30+ min) deleted on backend restart
- 300ms silence audible between dialogue turns in MP3
- Left panel fully unlocks after generation completes or fails

## Physical Checklist

### Backend — Startup
- [x] Start backend → no extra errors in terminal
- [x] Remove ffmpeg from PATH → restart backend → WARNING logged → 
  app starts fine, no crash
- [x] Create audio.lock older than 30 min in any part folder → 
  restart backend → lock deleted (dir listing confirms)

### Backend — POST /podcast
- [x] POST /podcast with valid book_folder + part_number → 202 immediately
- [x] audio.lock created at correct part_dir path immediately on POST
- [x] progress.json created with {"current": 0, "total": N}
- [x] 404 returned for unknown part_number

### Backend — generate_audio_task
- [x] All script lines processed → N temp_XXXX.mp3 files created during task
- [x] progress.json current count increments per line (check file mid-task)
- [x] Final MP3 exists at correct path with correct filename after task
- [x] book_state.json shows audio_ready for that part
- [x] All temp files deleted on success
- [x] progress.json deleted on success
- [x] audio.lock deleted on success
- [x] Simulate failure → no temp/partial files remain on disk
- [x] book_state.json unchanged (s1tays script_ready) on failure

### Backend — GET /podcast-progress
- [x] Returns {"current": N, "total": M} while task running
- [x] Returns {"current": 0, "total": 0} if progress.json not found
- [x] Returns {"current": 0, "total": 0} if part not found (no crash)

### Backend — GET /book Extension
- [x] While audio.lock exists → is_audio_generating: true in response
- [x] After audio.lock deleted → is_audio_generating: false in response

### Frontend — Make a Podcast Flow
- [ ] Click Make a Podcast → POST fires (Network tab) → right panel 
  switches to progress bar immediately
- [ ] "Preparing audio…" shown before first progress.json fetch
- [ ] Line counter shows "Generating line X of Y" after first poll
- [ ] Gold progress bar fills left-to-right as lines complete
- [ ] Left panel dims immediately (audioGeneratingPartId set client-side)
- [ ] Audio done → poll detects audio_ready → right panel returns to 
  script view (no page refresh)
- [ ] Star icon appears in left panel for completed part
- [ ] Make a Podcast button greyed (opacity 0.35) for audio_ready part

### Frontend — Error State
- [ ] Audio failure → 'audio_error' panelMode → error UI shows
- [ ] "Back to Script" button → panelMode = 'script' → script re-renders
- [ ] Left panel unlocks after error (audioGeneratingPartId cleared)

### Frontend — Left Panel Lock
- [ ] All non-selected cards dimmed during audio generation
- [ ] Active generating card NOT dimmed
- [ ] Cards unlock after generation completes or fails

### Frontend — Revise Script Audio_Ready (deferred from Phase 6)
- [ ] Click Revise Script on audio_ready part → confirmation banner appears 
  in footer: "This will delete your existing audio. Click again to confirm."
- [ ] Banner: Crimson Pro, italic, muted, left-aligned in footer
- [ ] Second click → skeleton appears, POST /generate fires
- [ ] MP3 deleted from disk during background task
- [ ] Navigate to different part mid-confirmation → banner gone on return

### Frontend — Make a Podcast Greyed (deferred from Phase 6)
- [ ] Click greyed Make a Podcast (audio_ready) → no action, 
  not-allowed cursor confirmed

### Audio Quality
- [ ] MP3 plays in a media player without error
- [ ] 300ms silence audible between each dialogue turn
- [ ] Alex and Morgan voices clearly distinct
- [ ] No clipping, distortion, or truncation at line boundaries

### No Regressions
- [ ] TopBar visible, breadcrumb correct during all states
- [ ] Dark/light toggle works across all panel states
- [ ] 5s book poll continues during audio generation
- [ ] Script generation (Phase 5/6) still works correctly
- [ ] No console errors on any state transition

## Notes
- **audio.lock before try bug fixed post-implementation:** Original `generate_audio_task` 
  defined `audio_lock_path` inside the function body but outside the try block. If 
  `parts.json` read failed, `finally` never ran and `audio.lock` was permanently orphaned. 
  Fix: resolve `audio_lock_path` via glob before the try block (same pattern as 
  `generate_script_task`). Initialize `progress_path = None` before try; guard with 
  `if progress_path and progress_path.exists()` in except/finally.
- **handlePartClick audio guard bug fixed post-implementation:** Original guard 
  `audioGeneratingPartId !== null && audioGeneratingPartId !== part.part_number` only 
  blocked OTHER cards during audio gen. Clicking the actively-generating card fell through, 
  called `fetchScript()`, overwrote `panelMode='audio_generating'` with `'generating'`, 
  killed progress bar. Fix: simplified to `if (audioGeneratingPartId !== null) return` — 
  blocks ALL card clicks during audio generation.
- **audioGeneratingPartIdRef pattern:** Same stale closure problem as `panelModeRef` 
  in Phase 5. The 5s poll useEffect reads `audioGeneratingPartIdRef.current` not 
  `audioGeneratingPartId`. Any future polling logic that needs audio state must follow 
  this pattern.
- **MP3 filename format:** `{book_folder}Part{n}{sanitize_name(part_title)}.mp3` inside 
  `Part{n}_{sanitize_name(title)}/`. Phase 8 needs this exact path to serve/stream the file.
- **Progress endpoint returns {0,0} not 404:** `/podcast-progress` always returns 200 
  with `{current: 0, total: 0}` when progress.json missing. Frontend shows "Preparing 
  audio…" until first real data arrives.
- **TTS rate limit protection:** 100ms `asyncio.sleep` between each line. Animal Farm 
  Part 1 (59 lines) took ~3 minutes. Phase 8 audio player should not assume fast load.
- **pydub + ffmpeg dependency:** pydub requires ffmpeg on PATH for MP3 encoding. 
  Installed via WinGet. Startup warning fires if missing — app still runs, audio 
  generation fails at merge step.
- **300ms silence verified audible:** Between each dialogue turn in final MP3. 
  `AudioSegment.silent(duration=300)` inserted before every segment except first.
- **Failure cleanup verified:** Backend killed mid-generation → no temp files, no partial 
  MP3, `book_state.json` stays `script_ready`. `audio.lock` cleaned by `finally` block.
