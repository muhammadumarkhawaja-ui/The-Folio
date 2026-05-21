# Phase 9 — The Library

**Job:** Library page fully live. Books displayed as covers on shelves.
First slot always a "+" card linking to Upload. Clicking a cover opens
its Reading Room. Hovering reveals a Delete button. Delete requires
two clicks (inline confirm). Sandbox-first approach — nail the visual
before touching app code.

## Decisions Made
- Re-upload blocked if book already exists. Error: "This book already
  exists. Open it from the Library, or delete it first if you want to
  start over." No overwrite allowed.
- Delete wipes entire book folder from output/
- Card shows: book name + parts remaining (parts not yet audio_ready).
  If all parts audio_ready: shows "Complete". Zero parts generated: shows
  part count (e.g. "8 parts").
- Layout: shelf rows. Each row holds N book covers side by side.
  First slot in first row is always the "+" (Upload) card.
- Hover on a book cover → Delete button fades in.
- Delete: two-click inline confirm. First click shows "Delete?" label on
  card. Second click wipes folder and removes card.
- Sort: newest first (by folder creation time).
- Loading: skeleton shimmer cards while fetching.
- Clicking a book cover → navigates to /reading-room/[book_folder].
- Sandbox file: library-test.html in project root. Deleted in 9.5.

## Objectives
- Backend GET /books — scan output/ folder, return list of books with
  title, folder name, part count, parts remaining count.
- Backend DELETE /book/{folder} — wipe folder, return 200.
- Library.jsx: shelf layout, book cover cards, "+" card always first,
  fetch /books on mount, skeleton loading, hover delete, inline confirm,
  click to navigate.
- Sandbox 9.1: static HTML file that nails the visual before any React
  code is written. Iterated with user until approved.

## Sub-Phases
9.1 Sandbox — library-test.html: shelf layout + book covers, iterate to approval
9.2 Backend — GET /books endpoint + DELETE /book/{folder} endpoint
9.3 Library core — replace Library.jsx shell with shelf layout + live data
9.4 Interactions — hover delete, two-click confirm, "+" card, click to open
9.5 Cleanup — delete library-test.html

## Files Affected
**Created:**
- `library-test.html` — sandbox (deleted in 9.5)

**Modified:**
- `frontend/src/pages/Library.jsx` — full live implementation
- `backend/main.py` — GET /books, DELETE /book/{folder}

## Tasks

### 9.1 Tasks
- [ ] Create `library-test.html` in project root
- [ ] Embed: dark navy bg (#0a0e1a), gold accent (#c9a84c), Academia fonts via Google Fonts CDN
- [ ] Build shelf rows layout — horizontal rows of book covers
- [ ] Book cover: tall rectangle (portrait ratio), dark surface bg,
      gold border, book name + "X parts remaining" text on cover
- [ ] First slot: "+" card, same shape, gold plus icon centered,
      muted label "Upload a Book"
- [ ] Hover state: delete button fades in on cover (top-right corner
      or bottom bar — to be decided during iteration)
- [ ] Show 4–6 dummy books so shelf looks populated
- [ ] Iterate with user until visual approved

### 9.2 Tasks
- [ ] Add GET /books endpoint to main.py
- [ ] Scan `output/` folder — each immediate subdirectory is a book
- [ ] For each book folder: load parts.json (get part count + titles),
      load book_state.json (count audio_ready parts)
- [ ] Return list: `[{ folder, title, total_parts, audio_ready_count,
      created_at (folder mtime) }]`
- [ ] Sort by created_at descending (newest first) before returning
- [ ] Skip folders missing parts.json or book_state.json (corrupted)
- [ ] Return empty list `[]` if output/ is empty or does not exist
- [ ] Add DELETE /book/{folder} endpoint
- [ ] Validate folder exists inside output/ — return 404 if not
- [ ] Use `shutil.rmtree` to wipe folder. Return `{"deleted": true}`.
- [ ] Security: reject any folder param containing `..` or `/` — 
      return 400. Prevents path traversal.

### 9.3 Tasks
- [ ] Rewrite Library.jsx — replace empty shell with live implementation
- [ ] Add state: `const [books, setBooks] = useState(null)` 
      (null = loading, [] = empty, [...] = loaded)
- [ ] Fetch /books on mount:
  ```js
  useEffect(() => {
    fetch('http://localhost:8000/books')
      .then(r => r.ok ? r.json() : [])
      .then(data => setBooks(data))
      .catch(() => setBooks([]));
  }, []);
  ```
- [ ] Loading state (books === null): render 4 skeleton shimmer cards
      (blink-pulse animation, same as Reading Room skeleton)
- [ ] Shelf layout: CSS flex-wrap row. Each cover fixed width (~160px),
      fixed height (~220px). Gap between covers. Rows wrap naturally.
- [ ] "+" card: always first in the list. Same dimensions as book covers.
      Gold plus icon centered. Click → navigate('/upload').
- [ ] Book cover card: dark surface bg, gold border (1px, var(--gold-muted)),
      book name in Cormorant Garamond (italic, centered), parts line in
      Crimson Pro (small, muted, bottom of card).
- [ ] Parts line text logic:
  ```js
  function partsLabel(total, audioReady) {
    if (audioReady === total) return 'Complete';
    const remaining = total - audioReady;
    return `${remaining} part${remaining !== 1 ? 's' : ''} remaining`;
  }
  ```
- [ ] Empty state (books === [] after load): show existing "No books yet"
      placeholder BUT still show the "+" card above it.

### 9.4 Tasks
- [ ] Add hover state per card:
  ```js
  const [hoveredFolder, setHoveredFolder] = useState(null);
  ```
  Set on onMouseEnter/Leave per card.
- [ ] Delete button: small "Delete" text or trash icon, fades in
      (opacity 0 → 1, transition 0.15s) when hoveredFolder matches card.
      Positioned bottom of card or top-right corner (match sandbox decision).
- [ ] Add confirm state per card:
  ```js
  const [confirmFolder, setConfirmFolder] = useState(null);
  ```
- [ ] First delete click: `setConfirmFolder(folder)` — shows "Confirm?"
      text on card in place of delete button.
- [ ] Second click (when confirmFolder === folder): call DELETE /book/{folder},
      on success remove card from books state.
- [ ] Reset confirmFolder when hover leaves card.
- [ ] Click on book cover (not delete area): navigate to
      `/reading-room/${book.folder}`.
- [ ] Stop click propagation on delete button so card click doesn't also fire.

### 9.5 Tasks
- [ ] Delete `library-test.html`
- [ ] Confirm no references to sandbox file remain in codebase

## Done When
- Library loads with shelf of book covers
- "+" card always first — click navigates to /upload
- Book covers show name + parts remaining label
- Clicking a book cover → /reading-room/[folder]
- Hovering a cover → delete button appears
- First click on delete → "Confirm?" appears
- Second click → book wiped from disk + removed from UI instantly
- Moving mouse off card resets confirm state
- Newest book appears first
- Loading: skeleton cards visible briefly before books appear
- Empty library: "+" card still shown + empty state text
- No console errors throughout

## Physical Checklist

### Backend — GET /books
- [x] GET /books returns correct list for real output/ folder
- [x] Each entry has: folder, title, total_parts, audio_ready_count, created_at
- [x] Sorted newest first
- [x] Returns [] if output/ empty or does not exist
- [x] Corrupted folders (missing parts.json) skipped silently

### Backend — DELETE /book/{folder}
- [x] DELETE /book/[folder] → 200 + folder wiped from disk
- [x] DELETE /book/nonexistent → 404
- [x] DELETE /book/../../../etc → 400 (path traversal blocked)

### Frontend — Shelf Layout
- [ ] "+" card visible, always first
- [ ] Book covers render in rows, wrap to next row when full
- [ ] Covers are portrait ratio, consistent size
- [ ] Book name readable on cover (Cormorant Garamond, italic)
- [ ] Parts remaining label visible (Crimson Pro, small, muted)

### Frontend — Interactions
- [ ] Click "+" → /upload
- [ ] Click book cover → /reading-room/[folder]
- [ ] Hover cover → delete button fades in
- [ ] Mouse off → delete button fades out, confirm resets
- [ ] First delete click → "Confirm?" shown
- [ ] Second delete click → book removed from UI + disk
- [ ] Clicking book body while confirm showing → navigates (confirm resets)

### Frontend — States
- [ ] Loading: shimmer skeleton cards visible
- [ ] Empty: "+" card shown + no-books message
- [ ] Populated: all books shown in shelf

### No Regressions
- [ ] TopBar visible, correct breadcrumb ("Library")
- [ ] Dark/light toggle works
- [ ] Upload page still works (re-upload blocked if book exists)
- [ ] Reading Room still loads correctly from Library link
- [ ] No console errors on any interaction

## Notes

### Scroll-snap layout and height
Library root uses `height: '100%'` not `calc(100vh - 64px)`. The App.jsx
page wrapper already has `flex: 1; overflow: auto` — that gives the correct
height. Library sets `overflow-y: scroll; scroll-snap-type: y mandatory`
to create its own scroll context. Sections use `height: '100%'` to match.
Do not use `position: fixed` (breaks React layout) or `100vh` (double-scrolls).

### st_ctime vs st_mtime for sort order
GET /books originally used `st_mtime` (last modification time). Bug: generating
a script or audio inside a book folder updates folder mtime → that book jumps
to "newest" position. Fixed to `st_ctime` which on Windows is true folder
creation time. Any future endpoint that sorts books by upload order must use
`st_ctime`, not `st_mtime`.

### Deterministic cover colors
Cover palette assigned via djb2-style hash of folder name:
`h = (h * 31 + charCode) >>> 0`, then `h % palette_length`.
Same folder always maps to same color across page loads without any storage.
5 palettes defined in COVER_PALETTES. Add more palettes there if needed.

### Path traversal on DELETE
Slash-based traversal (`../../etc`) returns 404 — FastAPI router normalizes
the URL path before it reaches the handler. Our `".." in folder` guard catches
dotdot embedded in a plain folder name string → 400. Both outcomes are safe.
Do not expect 400 for all traversal forms; 404 from router normalization is
correct behavior, not a gap.

### Confirm label wording
Phase doc said "Confirm?" — implementation shipped as "Sure?" and was corrected
during physical checklist. Label is in Library.jsx `S.confirmLabel` span.
If wording changes again, that is the only place to update.
