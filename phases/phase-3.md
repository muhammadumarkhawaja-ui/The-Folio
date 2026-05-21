# Phase 3 — The Shell

**Job:** All 3 pages exist with correct navigation. Library, 
Upload, Reading Room. Academia design system fully applied. 
Empty shells but look exactly right.

## Decisions Made
- **Nav:** Top bar. Logo left, breadcrumb center/right, dark/light toggle top-right.
- **Aesthetic direction:** Royal Naval Academia — Oxford/Cambridge energy. Navy + brass gold. Authoritative, distinguished.
- **Color modes:** Dark royal (deep navy-black bg, cream text, gold accents) + Light royal (pale blue-white bg, navy text, gold accents). Toggle switches between them.
- **Exact palette:**
  - Dark mode: bg `#0a0e1a`, surface `#0f1628`, text `#e8e0cc`, accent navy `#1a3a6b`, gold `#c9a84c`, border `#2a3f6b`
  - Light mode: bg `#f0f4ff`, surface `#e8edf8`, text `#0a0e1a`, accent navy `#1a3a6b`, gold `#c9a84c`, border `#b8c4d8`
- **Texture/atmosphere:** Subtle SVG noise grain overlay (blue-tinted, low opacity). Soft vignette on page edges. Royal feel, not rough.
- **The unforgettable thing:** Animated page transitions — fade + slight horizontal slide, like turning a page. Smooth, literary.
- **Breadcrumb:** The Folio → Library → [Book Title] → Reading Room. Shows hierarchy. Updates per page.
- **Font roles:**
  - Cinzel → logo, page headings, section titles
  - Cormorant Garamond → body text, dialogue, descriptions
  - Crimson Pro → UI labels, buttons, metadata, nav links
- **Icons:** Lucide React, stroke-width 1.5, gold (`#c9a84c`) colored
- **Panel divider:** Thin 1px gold (`#c9a84c`) line between Reading Room panels. Clean, regal.
- **Reading Room URL:** `/reading-room/:bookFolder` — param carries book name. Refresh keeps book loaded.
- **Reading Room empty shell:** Two panels visible. Left: "Parts will appear here." Right: "Select a part to begin."

## Objectives
- Design system: CSS custom properties in index.css for dark + light mode. Google Fonts loaded.
- React Router: routes for /, /upload, /reading-room/:bookFolder
- TopBar component: The Folio logo (Cinzel), breadcrumb trail, dark/light toggle
- Library page: empty shell, styled, shows "No books yet" placeholder
- Upload page: existing Upload.jsx restyled with Academia design
- Reading Room page: two-panel layout shell, both panels empty but styled

## Sub-Phases
3.1 Design system — Tailwind v4 tokens + CSS vars in index.css, Google Fonts import, dark/light mode vars
3.2 App shell + routing — React Router setup, routes for all 3 pages, default to Library
3.3 TopBar component — logo, breadcrumb, dark/light toggle, wired to all pages
3.4 Library page shell — empty state placeholder, full Academia styling
3.5 Upload page reskin — apply Academia design to existing Upload.jsx
3.6 Reading Room shell — two-panel layout, left + right placeholders, styled

## Files Affected
**Modified:**
- `frontend/src/index.css` — design tokens, Google Fonts @import, CSS vars for dark/light
- `frontend/src/App.jsx` — React Router, all 3 routes, theme state

**Created:**
- `frontend/src/components/TopBar.jsx` — logo, breadcrumb, toggle
- `frontend/src/pages/Library.jsx` — empty shell
- `frontend/src/pages/ReadingRoom.jsx` — two-panel shell

**Restyled:**
- `frontend/src/pages/Upload.jsx` — Academia design applied, logic untouched

## Tasks

### 3.1 Tasks
- [x] Add Google Fonts @import to index.css (Cormorant Garamond, Crimson Pro, Cinzel)
- [x] Define CSS custom properties for dark royal mode (default): bg #0a0e1a, surface #0f1628, text #e8e0cc, accent #1a3a6b, gold #c9a84c, border #2a3f6b
- [x] Define CSS custom properties for light royal mode: bg #f0f4ff, surface #e8edf8, text #0a0e1a, accent #1a3a6b, gold #c9a84c, border #b8c4d8
- [x] Add Tailwind v4 @theme tokens that reference CSS vars (bg, text, accent, gold, border)
- [x] Apply base body styles: Cormorant Garamond body font, bg, text color
- [x] Add SVG noise grain overlay (blue-tinted, ~4% opacity) as fixed pseudo-element on body
- [x] Add soft vignette via radial-gradient fixed overlay on body

### 3.2 Tasks
- [x] Install react-router-dom
- [x] Rewrite App.jsx: BrowserRouter, Routes for /, /upload, /reading-room/:bookFolder
- [x] Thread theme state (dark/light) down from App.jsx via context or prop
- [x] Apply theme class to root element so CSS vars switch
- [x] Add page transition wrapper: fade + slight horizontal slide on route change (CSS keyframe animation on route key)

### 3.3 Tasks
- [x] Create frontend/src/components/TopBar.jsx
- [x] Logo: "The Folio" in Cinzel, links to /
- [x] Breadcrumb: context-aware — changes per active page + book title
- [x] Dark/light toggle: sun/moon icon, switches theme class on root
- [x] Style TopBar with Academia design (border-bottom, bg, height)

### 3.4 Tasks
- [x] Create frontend/src/pages/Library.jsx
- [x] Full-page layout with TopBar
- [x] Empty state: book icon + "Your library is empty. Upload a book to begin." centered
- [x] Style with Academia design

### 3.5 Tasks
- [x] Apply Academia colors, fonts, spacing to Upload.jsx
- [x] Drag+drop zone styled (dashed border, accent color, hover state)
- [x] Title confirm field + Confirm button styled
- [x] Loading + error states styled
- [x] Logic and API calls untouched

### 3.6 Tasks
- [x] Create frontend/src/pages/ReadingRoom.jsx
- [x] Two-panel layout: left 1/3, right 2/3, full height below TopBar
- [x] Left panel: placeholder text "Parts will appear here." centered
- [x] Right panel: placeholder text "Select a part to begin." centered
- [x] Divider between panels
- [x] Style with Academia design

## Done When
- All 3 pages load at correct URLs with no errors
- TopBar visible on all pages with correct breadcrumb per page
- Dark/light toggle works — switches theme across entire app instantly
- Library shows empty state placeholder, styled
- Upload page looks Academia — fonts, colors, spacing correct
- Reading Room shows two-panel layout with placeholders
- No console errors

## Physical Checklist

### Routing & Navigation
- [ ] localhost:5173 loads Library page (not Upload, not 404)
- [ ] /upload loads Upload page
- [ ] /reading-room/TestBook loads Reading Room (no crash, useParams works)
- [ ] Clicking "Upload a Book" CTA on Library → navigates to /upload
- [ ] Clicking "The Folio" logo in TopBar → returns to Library from any page
- [ ] Browser back/forward buttons work correctly between pages

### TopBar
- [ ] TopBar visible on all 3 pages
- [ ] TopBar height ~64px, correct background (var(--surface)), gold bottom border
- [ ] Logo "The Folio" renders in Cinzel font, gold color
- [ ] Breadcrumb on Library: shows "Library" only
- [ ] Breadcrumb on Upload: shows "Library → Upload" with Library as a link
- [ ] Breadcrumb on /reading-room/Test_Book: shows "Library → Test Book" (underscores → spaces)
- [ ] Dark/light toggle button visible top-right
- [ ] Toggle shows Moon icon in dark mode, Sun icon in light mode

### Theme & Colors (Dark Mode — default)
- [ ] Page background is deep navy-black (#0a0e1a)
- [ ] TopBar / surface elements are slightly lighter (#0f1628)
- [ ] Body text is warm cream (#e8e0cc)
- [ ] Gold accents (#c9a84c) on logo, icons, borders, buttons
- [ ] Muted text elements visibly dimmer than primary text

### Theme & Colors (Light Mode — after toggle)
- [ ] Background switches to pale blue-white (#f0f4ff)
- [ ] Text switches to near-black (#0a0e1a)
- [ ] Gold accents remain the same (#c9a84c)
- [ ] All 3 pages update instantly on toggle — no stale dark remnants
- [ ] Toggle back to dark restores original dark palette

### Atmosphere & Texture
- [ ] Subtle grain/noise overlay visible on dark background (not jarring, low opacity)
- [ ] Soft vignette darkens page edges (dark mode especially)
- [ ] Grain + vignette do NOT block clicks or interact with UI elements

### Page Transitions
- [ ] Navigating between pages shows a subtle fade + slide animation
- [ ] Animation is smooth, not janky or flickery
- [ ] No white flash between route changes

### Typography
- [ ] Cinzel used: "The Folio" logo, "YOUR LIBRARY" heading, "UPLOAD A BOOK" heading, "PARTS" panel label
- [ ] Cormorant Garamond used: body/subtext on Library, drop zone primary text, italic placeholders in Reading Room, loading text
- [ ] Crimson Pro used: breadcrumb links, "Upload a Book" CTA button, "Confirm & Analyse" button, secondary labels
- [ ] No fallback sans-serif fonts visible anywhere (all Google Fonts loaded)

### Library Page
- [ ] Page is centered vertically and horizontally
- [ ] BookOpen icon rendered, gold, ~52px
- [ ] "YOUR LIBRARY" heading in Cinzel, uppercase, correct color
- [ ] Subtext "No books yet. Upload a PDF to begin." in Cormorant Garamond, muted
- [ ] "Upload a Book" button: gold border, gold text, Crimson Pro font
- [ ] Two gradient rules (transparent → gold → transparent) visible above and below content

### Upload Page
- [ ] Drop zone visible: dashed border (gold-muted), correct padding
- [ ] UploadCloud icon centered in drop zone, gold-muted color
- [ ] "Drop a PDF here" in Cormorant Garamond
- [ ] "or click to browse" in Crimson Pro, muted
- [ ] Hovering over drop zone → border turns gold, background lifts to surface-raised
- [ ] "UPLOAD A BOOK" heading in Cinzel at top
- [ ] Gradient rule below heading

### Reading Room Page
- [ ] Two panels visible side by side, full height below TopBar
- [ ] Left panel takes ~1/3 width, right panel takes ~2/3
- [ ] Left panel background is var(--surface), right panel is var(--bg) — visibly different
- [ ] Gold 1px vertical divider between panels (subtle opacity)
- [ ] "PARTS" label in Cinzel top-left panel, uppercase, muted color
- [ ] Gradient rule below "PARTS" label
- [ ] BookOpen icon + "Parts will appear here." italic text, centered in left panel
- [ ] Book title (from URL "TestBook" → "TestBook") shown in Cinzel in right panel header
- [ ] Scroll icon + "Select a part to begin." italic text, centered in right panel
- [ ] No horizontal scrollbar on the workspace

### Console & Errors
- [ ] No console errors on Library
- [ ] No console errors on Upload
- [ ] No console errors on Reading Room
- [ ] No React key warnings or prop-type warnings

## Notes

**ThemeContext** — exported from App.jsx as `ThemeContext` + `useTheme` hook. Any future component needing theme state imports `useTheme` from `../App` (or `../../App`). Theme is `'dark'` or `'light'` string. Toggle via `toggleTheme()`.

**CSS vars** — all colors are CSS custom properties on `:root` (dark default) and `:root.light` (light). Never hardcode hex values in components. Always use `var(--gold)`, `var(--bg)`, `var(--surface)`, `var(--surface-raised)`, `var(--text)`, `var(--text-muted)`, `var(--border)`, `var(--gold-muted)`.

**TopBar height** — fixed at 64px. All full-height page layouts use `calc(100vh - 64px)` for their container height. Reading Room already does this. Keep consistent across future pages.

**Font usage rule** — Cinzel: headings, labels, panel titles, logo. Cormorant Garamond: body text, dialogue, descriptions, italic placeholders. Crimson Pro: buttons, UI labels, metadata, nav. Do not mix roles.

**Icons** — Lucide React, strokeWidth 1.5 (some decorative icons use strokeWidth 1), color `var(--gold)` or `var(--gold-muted)` for muted contexts.

**Reading Room URL param** — `useParams()` gives `bookFolder` (underscore-separated). Convert to display title: `bookFolder.replace(/_/g, ' ')`. Already done in ReadingRoom.jsx.

**Routing** — React Router v7 (react-router-dom). BrowserRouter in App.jsx. InnerApp pattern used so `useLocation` works inside BrowserRouter. Do not move TopBar outside InnerApp.

**Page transitions** — CSS `@keyframes pageEnter` on `.page-transition` class. Triggered by `key={location.pathname}` on route wrapper div in InnerApp. No framer-motion dependency.

**Grain + vignette** — body::before (SVG fractalNoise, mix-blend-mode overlay, ~4% opacity) and body::after (radial-gradient vignette using `var(--vignette)`). Both `pointer-events: none`. Do not remove — core to Academia atmosphere.

**Upload hover fix** — drop zone uses both `dragOver` state (file drag) and `hovered` state (mouse hover) to trigger gold border + surface-raised bg. Both must be true for full hover coverage.
