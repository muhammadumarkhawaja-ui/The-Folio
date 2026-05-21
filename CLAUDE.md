# The Folio — Claude.md

> **CRITICAL RULE: CAVEMAN MODE ALWAYS.** 
> **Short. Direct. No filler. No apologies. Do task, report result, stop.**
> **This is a required skill to save tokens. You must obey this rule at all times.**

## Project Description
The Folio is a local web application that transforms PDF books into 
two-host podcast-style audio episodes automatically. User uploads a 
PDF, the app splits it into balanced parts based on narrative density, 
generates a two-host conversational script for each part, and converts 
that script into audio using two distinct voices. Runs entirely on 
localhost. Personal use only.

The two hosts are:
- Alex (male) — en-US-GuyNeural — leads narrative, drives story forward
- Morgan (female) — en-US-JennyNeural — analysis, questions, depth

## Workflow
1. User uploads PDF → PyMuPDF extracts text → TOC extracted first, 
   chapter text search as fallback
2. User confirms book title (always asked, pre-filled with best guess)
3. Gemini runs Prompt A → returns structured parts list → saved to 
   parts.json and book_state.json
4. User clicks a part in Reading Room → skeleton load → Prompt B runs 
   → script.json saved → dialogue displayed
5. User clicks Make a Podcast → Edge TTS generates audio line by line 
   → merged into MP3 → audio player appears
6. All state tracked in book_state.json per book. Survives restarts.
7. book_state.json structure is fixed and must be consistent 
   across all phases:
   {
     "book_title": "...",
     "parts": {
       "1": "empty",
       "2": "script_ready",
       "3": "audio_ready"
     }
   }
   Three states only: empty, script_ready, audio_ready.

## Pages
- Library — all past books as cards. Open or delete.
- Upload — PDF upload + title confirmation.
- Reading Room — two panel workspace. Left: parts list with 3-state 
  status icons and estimated listen time. Right: skeleton load → 
  script dialogue → Revise Script + Make a Podcast buttons → 
  audio player.
- App always opens on Library page.

## Tech Stack
Frontend: React (Vite), Tailwind CSS v4, Lucide React, 
          Google Fonts (Cormorant Garamond, Crimson Pro, Cinzel)
Backend:  FastAPI, PyMuPDF, google-genai, edge-tts, 
          pydub, audioop-lts, python-dotenv, uvicorn
APIs:     Gemini 1.5 Pro (GEMINI_API_KEY in .env), 
          Edge TTS (free, no key)
Storage:  Local filesystem only. No database.

## Folder Layout
folio/
├── claude.md
├── .env
├── backend/
│ ├── main.py
│ ├── prompts.py
│ └── output/
│ └── [BookName]/
│ ├── book_text.txt
│ ├── parts.json
│ ├── book_state.json
│ └── Part1_[Title]/
│ ├── script.json
│ └── [BookName]Part1[Title].mp3
├── frontend/
│ ├── src/
│ └── ...
└── phases/
├── phase-1.md
├── phase-2.md
└── ...

All folder and file names sanitized before creation — 
special characters stripped entirely, spaces replaced with underscores.
Example: Harry's Book: A Story → Harrys_Book_A_Story

## Phases
1.  The Skeleton — project structure, backend + frontend running 
    and talking
2.  The Ingestion Engine — PDF upload, text extraction, TOC parsing, 
    title confirmation, Prompt A, parts.json + book_state.json saved
3.  The Shell — all 3 pages with navigation, Academia design fully 
    applied, empty shells
4.  The Parts Panel — left panel live, reads parts.json and 
    book_state.json, status icons, estimated listen time
5.  The Script Engine — click triggers Prompt B, skeleton load, 
    script.json saved, state updated, Gemini validation + retry, 
    rate limit queue
6.  The Script Panel — right panel displays dialogue, Revise Script 
    works, both buttons correctly active/inactive by state
7.  The Voice — Make a Podcast triggers Edge TTS, MP3 generated, 
    state updated, progress shown
8.  The Player — backend MP3 serving, functional audio player, 
    play/pause, skip/rewind, speed control, keyboard shortcuts
8.5 The Player Polish — waveform visualizer, pulsing animation, 
    left panel playing indicator, download button
8.7 The Quill — standalone sandbox (quill-test.html). 
    Build + perfect animation in isolation, then port to app.
9.  The Library — Library page fully live, book cards, open + delete
10. The Prompts — Prompt A and B tuned, TOC fed to Prompt A, 
    line count target, Part 1 conditional, all prompt fixes applied

## Prompts
Full prompt text stored in backend/prompts.py.
Prompts must not be altered without explicit user instruction.

PROMPT A — Splits book into parts. Returns JSON with book_title 
and parts array. Each part has part_number, title, chapter_range, 
anchor_event, start_chapter, end_chapter. Page numbers are 
NOT used for slicing — slicing is done by chapter heading detection.

PROMPT B — Generates two-host dialogue script for one part. 
Returns JSON array of {host, line} objects. 
Alex leads narrative. Morgan adds analysis.
Target: 180-220 lines of dialogue.
Contains conditional: if Part 1 open by setting the scene, 
if any other part begin by resolving previous cliffhanger.

## Phase MD Structure Rules
- Sub-phases numbered 1.1, 1.2, 1.3 etc (phase number + dot + index)
- Tasks section has a separate task list per sub-phase, labeled by sub-phase number
- Example:
  ### 1.1 Tasks
  - [ ] task one
  - [ ] task two
  ### 1.2 Tasks
  - [ ] task three

## Future Features
- **Simplify ReadingRoom.jsx** — component is 859-line function with 510-line 
  `renderRightPanel`. Split into sub-components (LeftPanel, RightPanel, 
  PlayerControls, ScriptView) to improve maintainability. Not urgent — 
  no bugs, just a refactor opportunity.

## Current Phase
**Phase 1 — The Skeleton** ✅ DONE
**Phase 2 — The Ingestion Engine** ✅ DONE
**Phase 3 — The Shell** ✅ DONE
**Phase 4 — The Parts Panel** ✅ DONE
**Phase 5 — The Script Engine** ✅ DONE
**Phase 6 — The Script Panel** ✅ DONE
**Phase 7 — The Voice** ✅ DONE
**Phase 8 — The Player** ✅ DONE
**Phase 8.5 — The Player Polish** ✅ DONE
**Phase 8.7 — The Quill** ✅ DONE
**Phase 9 — The Library** ✅ DONE

## Claude Behavior Rules
1. Read claude.md every session before doing anything else.
2. Do NOT read phase files unless explicitly told to by user.
3. Before starting any phase, run a full interrogation session:
   - User is non-technical. Explain everything in plain English.
   - Offer 2-3 options for every decision with pros and cons.
   - Wait for user to choose before proceeding.
   - Only after interrogation is complete, fill phase MD and begin work.
4. Brainstorming is already done. Decisions live in relevant phase MDs 
   as context for interrogation — not as replacements for it.
5. Obey CAVEMAN MODE rule at the top of this file. No exceptions.
6. Claude can edit files. Do the work, do not just describe it.
7. Keep master updates in claude.md only. 
   Keep granular task tracking in phase files only.
8. Phase MD notes section — never fill it yourself. 
   User fills it only when explicitly instructed.
9. NEVER push to GitHub or any remote. Local commits only. 
   Pushing is the user's job.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Known Issues & Fixes

- **Python functions not found:** Graph can go stale and stop indexing 
  Python files. Fix: run `build_or_update_graph_tool` with 
  `full_rebuild: true`. Verified fix — Phase 5 session.
- **`file_summary` returns 0 results with relative paths:** Graph stores 
  absolute Windows paths. Pass full path: 
  `C:\path\to\project\backend\main.py` 
  not `backend/main.py`. Use `semantic_search_nodes` by function name 
  instead — more reliable than file_summary.

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. If search returns 0 results unexpectedly, run full rebuild first.
3. Use `semantic_search_nodes` by function/class name — more reliable 
   than `file_summary` on Windows.
4. Use `detect_changes` for code review.
5. Use `get_affected_flows` to understand impact.
6. Use `query_graph` pattern="tests_for" to check coverage.
