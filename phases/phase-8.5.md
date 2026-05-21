# Phase 8.5 — The Player Polish

**Job:** Layer visual richness onto the Phase 8 player. Pulsing 
brass star animation on left panel while audio plays, download 
button in sticky footer. Waveform/hourglass deferred to Phase 8.7.

## Decisions Made
- **D13:** Waveform visualizer — deferred. Quill animation 
  handles player top area in Phase 8.7. Phase 8.5 does not touch 
  the player top area.
- **Pulsing animation:** Star icon (☆) on left panel part card 
  throbs with gold glow while audio is actively playing. Uses CSS 
  keyframe — opacity + box-shadow pulse. Stops when paused or track 
  ends. Keyed off `isPlaying` state from ReadingRoom.
- **Left panel playing state:** Throb only. No border, no background 
  change — just the star throb.
- **Download button:** Added to sticky footer bar in right panel. 
  Visible only when selected part is `audio_ready`. Downloads the 
  MP3 directly via browser anchor tag with `download` attribute.

## Objectives
- Left panel: star icon on currently-playing part card pulses with 
  gold glow animation while `isPlaying === true`
- Animation stops immediately when audio pauses or ends
- Sticky footer: download button appears for `audio_ready` parts
- Download triggers browser file download of the part's MP3
- No changes to player top area (reserved for Phase 8.7)

## Sub-Phases
8.5.1 Pulsing star — left panel animation wired to isPlaying
8.5.2 Download button — footer button, constructs MP3 URL, triggers download

## Files Affected
**Modified:**
- `frontend/src/pages/ReadingRoom.jsx` — pulsing star CSS/animation, 
  download button in footer

## Tasks

### 8.5.1 Tasks
- [ ] Add CSS keyframe `throb` in ReadingRoom (or global CSS):
  ```css
  @keyframes throb {
    0%, 100% { opacity: 0.4; filter: drop-shadow(0 0 0px rgba(201,168,76,0)); }
    50%       { opacity: 1;   filter: drop-shadow(0 0 6px rgba(201,168,76,0.8)); }
  }
  ```
- [ ] In left panel part card rendering, find where star icon renders
- [ ] Apply `animation: throb 1.4s ease-in-out infinite` to star icon 
  when `isPlaying && selectedPartId === part.part_number`
- [ ] When condition false: `animation: none`, opacity normal
- [ ] Verify: play audio → star on that card throbs. Pause → stops. 
  Switch part → old star stops, new star does not throb (not playing).

### 8.5.2 Tasks
- [ ] In sticky footer (right panel bottom bar), add download button 
  next to existing controls — visible only when `audio_ready` part selected:
  ```jsx
  {selectedPartState === 'audio_ready' && (
    <a
      href={getAudioUrl(bookFolder, selectedPartId, selectedPartTitle)}
      download={`${bookFolder}_Part${selectedPartId}_${selectedPartTitle}.mp3`}
      style={{ /* match footer icon button style */ }}
    >
      <Download size={16} strokeWidth={1.5} color="var(--gold)" />
    </a>
  )}
  ```
- [ ] Import `Download` from `lucide-react`
- [ ] Confirm `getAudioUrl()` already exists (Phase 8) — reuse it
- [ ] Verify: `audio_ready` part → download button visible, click → 
  browser downloads MP3. `script_ready` part → button not shown.

## Done When
- Playing audio → star on left panel card for that part pulses gold
- Pause → pulse stops immediately
- Download button visible in footer for `audio_ready` parts
- Click download → browser saves MP3 file
- `script_ready` parts → no download button
- No console errors

## Physical Checklist
- [ ] Select `audio_ready` part, press play → star icon on that card throbs
- [ ] Press pause → throb stops
- [ ] Audio ends naturally → throb stops
- [ ] Select different part → previously throbbing star stops
- [ ] `script_ready` part selected → no throb, no download button
- [ ] `audio_ready` part selected → download button visible in footer
- [ ] Click download → browser download dialog / file saved
- [ ] Downloaded file is valid MP3, plays correctly
- [ ] No console errors throughout

## Notes
- Quill deferred to Phase 8.7 before implementation began — moved to 
  standalone sandbox approach to allow safe iteration without touching app code.
- `throb` keyframe uses `filter: drop-shadow()` not `box-shadow` — required 
  because Lucide icons render as SVG, and `box-shadow` has no effect on SVG elements.
- Download button wrapped with Revise + Make a Podcast in a `marginLeft: auto` 
  flex group — fixes layout conflict when `reviseConfirmPending` warning span 
  also uses `marginRight: auto` in the same flex row.
- `color` prop removed from `<Download>` icon — inherits `currentColor` from 
  parent `<a>` tag instead. More reliable across browsers.
- Global `a:hover { color: var(--text) }` in index.css would override download 
  anchor color on hover — suppressed with `.footer-download` CSS class.
- Console errors on Animal Farm reading room confirmed as browser extension 
  noise (content-script.js), not app errors. All phase checks passed.
