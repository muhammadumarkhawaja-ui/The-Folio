"""
The Folio — Prompts

Full text of Prompt A and Prompt B for Gemini.
Do not alter without explicit user instruction.
"""

PROMPT_A = """MISSION: STRUCTURAL EDITOR
I have uploaded the text of a book below. Your task is to architect
a multi-part Audiobook Series structure.

THE SPLIT LOGIC:

DIVIDE the book into parts.
EQUAL WEIGHT: Balance parts based on narrative density so each
podcast episode targets 20-30 minutes of audio.
No limit on part count. Each part must be long enough that all
relevant events are included.
OUTPUT: Return a structured JSON response with exactly this format:
{
"book_title": "Detected book title",
"parts": [
{
"part_number": 1,
"title": "Part title",
"chapter_range": "Chapters 1-3",
"anchor_event": "The single most important moment in this
section, described in 2-3 sentences.",
"start_chapter": 1,
"end_chapter": 3
}
]
}
NOTE: Slicing is done by chapter headings, not page numbers.
Do not return page numbers.

TOC AND CHAPTER DATA:
{toc_data}

BOOK TEXT:
{full_book_text}
"""

PROMPT_B = """ROLE: You are generating a two-host podcast script for one part
of a book. The two hosts are Alex (male, leads narrative, drives
story forward) and Morgan (female, provides analysis, asks
questions, adds depth).

OUTPUT FORMAT: Return only a JSON array with no extra text:
[
{"host": "Alex", "line": "..."},
{"host": "Morgan", "line": "..."}
]

TARGET LENGTH: Aim for 180-220 lines of dialogue total.

═══════════════════════════════════════════════════════════════════
SECTION I — MAJOR EVENTS TO COVER (In Strict Chronological Order)
═══════════════════════════════════════════════════════════════════

THOROUGHNESS: Cover every significant event, decision, revelation,
and character moment in this specific part.
COMPLETENESS: Include all important things. Do NOT miss anything,
with the strict exception of exactly 2 of the least relevant events
which may be omitted to maintain narrative flow.
CHRONOLOGY: Events must be covered in exact sequence.
DETAIL: Each event discussed with enough clarity that the flow
makes it obvious what is happening without further context.
QUOTES: If a line is significant enough to illustrate a major idea,
include it using: "The Book writes and I quote" followed by the text.
═══════════════════════════════════════════════════════════════════
SECTION II — INSTRUCTIONS FOR NARRATION
═══════════════════════════════════════════════════════════════════

THE 85/15 RULE: 85% narration, 15% analysis. Analysis woven
naturally as insights or context, never in its own block.
CHARACTER HANDLING: Introduce characters briefly and naturally
when they first appear, assuming audience needs a quick refresher.
NO RECAPS: Listener has heard all previous parts. No recapping
unless past events appear as memory, consequence, or context.
OPENING: If this is Part 1, open by setting the scene and
introducing the world of the book naturally. If this is any
other part, begin by immediately continuing or resolving the
cliffhanger from the previous part.
THE CLIFFHANGER: End on an organic cliffhanger drawn directly
from the book's own text. Do not invent or exaggerate. Find the
natural point of highest tension.
PART TO COVER:
Part {part_number}: {part_title}
Chapters: {chapter_range}

BOOK TEXT FOR THIS SECTION:
{part_text}
"""
