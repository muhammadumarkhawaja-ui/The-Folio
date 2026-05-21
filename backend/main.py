import asyncio
import glob
import json
import os
import re
import shutil
import time
from pathlib import Path
from dotenv import load_dotenv
import edge_tts
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pydub import AudioSegment
import fitz
from google import genai

from prompts import PROMPT_A, PROMPT_B

load_dotenv()

if not os.getenv("GEMINI_API_KEY"):
    print("WARNING: GEMINI_API_KEY not found in .env. Book upload will fail.")

app = FastAPI()


@app.on_event("startup")
async def cleanup_stale_locks():
    lock_files = glob.glob("output/**/*.lock", recursive=True)
    now = time.time()
    for lock_file in lock_files:
        if os.path.exists(lock_file):
            age_seconds = now - os.path.getmtime(lock_file)
            if age_seconds > 1800:  # 30 minutes
                os.remove(lock_file)
                print(f"[startup] Cleaned stale lock: {lock_file}")
    if not shutil.which("ffmpeg"):
        print("WARNING: ffmpeg not found. Audio generation will fail. Install ffmpeg and restart.")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
app.mount("/output", StaticFiles(directory=str(OUTPUT_DIR)), name="output")

MAX_PDF_BYTES = 50 * 1024 * 1024

CHAPTER_PATTERN = re.compile(
    r"^(chapter|part)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten"
    r"|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty"
    r"|i{1,3}|iv|vi{0,3}|ix|xi{0,3}|xiv|xv|xvi{0,3}|xix|xx)\b",
    re.IGNORECASE | re.MULTILINE,
)


def get_lock_path(book_folder: str, part_number: int, part_title: str) -> str:
    part_dir = os.path.join(
        "output", book_folder,
        f"Part{part_number}_{sanitize_name(part_title)}"
    )
    return os.path.join(part_dir, "generating.lock")


def sanitize_name(name: str) -> str:
    name = re.sub(r"[^\w\s]", "", name)
    name = re.sub(r"\s+", "_", name.strip())
    return name


def validate_book_folder(folder: str) -> None:
    if not folder or ".." in folder or "/" in folder or "\\" in folder or folder.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid book folder name.")


def write_json_atomic(path: Path, data: dict) -> None:
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def extract_title_guess(doc: fitz.Document, filename: str) -> str:
    meta_title = doc.metadata.get("title", "").strip()
    if meta_title:
        return meta_title
    name = Path(filename).stem.replace("_", " ").replace("-", " ")
    return name.strip() or "Untitled"


def extract_chapter_data(doc: fitz.Document) -> tuple[bool, str]:
    toc = doc.get_toc()
    if toc:
        lines = [f"{entry[1]} (page {entry[2]})" for entry in toc]
        return True, "TOC:\n" + "\n".join(lines)
    full_text = "".join(page.get_text() for page in doc)
    matches = CHAPTER_PATTERN.findall(full_text)
    if len(matches) >= 2:
        return True, "No TOC available. Chapter headings detected in text."
    return False, ""


def extract_part_text(book_text: str, start_chapter: int, end_chapter: int) -> str:
    matches = list(CHAPTER_PATTERN.finditer(book_text))
    if not matches or start_chapter < 1:
        return book_text
    start_idx = start_chapter - 1
    end_idx = end_chapter  # first chapter after the range
    if start_idx >= len(matches):
        return book_text
    start_pos = matches[start_idx].start()
    end_pos = matches[end_idx].start() if end_idx < len(matches) else len(book_text)
    return book_text[start_pos:end_pos]


def strip_json_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"```$", "", text.strip())
    return text.strip()


def call_prompt_a(toc_data: str, full_book_text: str) -> dict:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured.")
    client = genai.Client(api_key=api_key)
    prompt = PROMPT_A.replace("{toc_data}", toc_data).replace("{full_book_text}", full_book_text)

    for attempt in range(2):
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash", contents=prompt
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Gemini API error: {e}")
        try:
            return json.loads(strip_json_fences(response.text))
        except (json.JSONDecodeError, AttributeError):
            if attempt == 1:
                raise HTTPException(
                    status_code=500,
                    detail="Gemini returned invalid data after 2 attempts. Check your API key or try again later.",
                )


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    content = await file.read()

    if len(content) > MAX_PDF_BYTES:
        raise HTTPException(status_code=400, detail="PDF exceeds 50MB limit.")

    try:
        doc = fitz.open(stream=content, filetype="pdf")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read PDF. File may be corrupt.")

    title_guess = extract_title_guess(doc, file.filename or "upload.pdf")
    book_folder = sanitize_name(title_guess) or "Untitled"

    book_dir = OUTPUT_DIR / book_folder
    if book_dir.exists():
        raise HTTPException(
            status_code=409,
            detail="A book with this title already exists. Delete it from the Library first.",
        )

    has_chapters, toc_str = extract_chapter_data(doc)
    if not has_chapters:
        raise HTTPException(
            status_code=400,
            detail="No chapter structure detected in this PDF. The Folio requires a book with chapters. Please try a different PDF.",
        )

    full_text = "".join(page.get_text() for page in doc)
    doc.close()

    book_dir.mkdir(parents=True)
    (book_dir / "book_text.txt").write_text(full_text, encoding="utf-8")
    (book_dir / "toc_data.txt").write_text(toc_str, encoding="utf-8")

    return {"title_guess": title_guess, "book_folder": book_folder}


class AnalyzeRequest(BaseModel):
    book_folder: str
    confirmed_title: str


class GenerateRequest(BaseModel):
    book_folder: str
    part_number: int


class PodcastRequest(BaseModel):
    book_folder: str
    part_number: int


@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    validate_book_folder(req.book_folder)
    book_dir = OUTPUT_DIR / req.book_folder

    if not book_dir.exists():
        raise HTTPException(status_code=404, detail="Book folder not found.")

    # Rename folder if user changed the title
    new_folder = sanitize_name(req.confirmed_title) or req.book_folder
    if new_folder != req.book_folder:
        new_dir = OUTPUT_DIR / new_folder
        if new_dir.exists():
            raise HTTPException(
                status_code=409,
                detail="A book with this title already exists. Delete it from the Library first.",
            )
        book_dir.rename(new_dir)
        book_dir = new_dir

    full_text = (book_dir / "book_text.txt").read_text(encoding="utf-8")
    toc_data = (book_dir / "toc_data.txt").read_text(encoding="utf-8")

    parts_data = call_prompt_a(toc_data, full_text)

    write_json_atomic(book_dir / "parts.json", parts_data)

    parts_state = {
        str(p["part_number"]): "empty" for p in parts_data.get("parts", [])
    }
    book_state = {
        "book_title": req.confirmed_title,
        "parts": parts_state,
    }
    write_json_atomic(book_dir / "book_state.json", book_state)

    return {"book_folder": new_folder}


@app.get("/book/{book_folder}")
def get_book(book_folder: str):
    validate_book_folder(book_folder)
    book_dir = OUTPUT_DIR / book_folder

    if not book_dir.exists():
        raise HTTPException(status_code=404, detail="Book not found.")

    parts_file = book_dir / "parts.json"
    state_file = book_dir / "book_state.json"

    if not parts_file.exists():
        raise HTTPException(status_code=404, detail="parts.json not found.")

    try:
        parts_json = json.loads(parts_file.read_text(encoding="utf-8"))
        state_json = json.loads(state_file.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        raise HTTPException(status_code=500, detail=f"Could not read book data: {e}")

    parts_list = parts_json.get("parts", [])

    for part in parts_list:
        part_num = part["part_number"]
        part_dir = book_dir / f"Part{part_num}_{sanitize_name(part['title'])}"

        part["is_generating"] = (part_dir / "generating.lock").exists()
        part["is_audio_generating"] = (part_dir / "audio.lock").exists()

        script_path = part_dir / "script.json"
        if script_path.exists():
            try:
                script_data = json.loads(script_path.read_text(encoding="utf-8"))
                part["word_count"] = sum(len(item["line"].split()) for item in script_data)
            except (json.JSONDecodeError, KeyError):
                part["word_count"] = None
        else:
            part["word_count"] = None

    return {
        "book_title": parts_json.get("book_title", book_folder.replace("_", " ")),
        "parts": parts_list,
        "state": state_json.get("parts", {}),
    }


async def generate_script_task(book_folder: str, part_number: int):
    # Resolve lock path early so finally can always clean it up,
    # even if parts.json read fails before we learn part_title.
    _lock_candidates = glob.glob(
        str(OUTPUT_DIR / book_folder / f"Part{part_number}_*" / "generating.lock")
    )
    lock_path = Path(_lock_candidates[0]) if _lock_candidates else None
    try:
        parts_path = OUTPUT_DIR / book_folder / "parts.json"
        parts_data = json.loads(parts_path.read_text(encoding="utf-8"))
        part = next(
            (p for p in parts_data.get("parts", []) if p["part_number"] == part_number),
            None,
        )
        if part is None:
            print(f"[generate] Part {part_number} not found in parts.json")
            return

        part_title = part["title"]
        chapter_range = part["chapter_range"]
        try:
            start_chapter = int(part.get("start_chapter", 1))
            end_chapter = int(part.get("end_chapter", 1))
        except (TypeError, ValueError):
            start_chapter = 1
            end_chapter = 1

        part_dir = OUTPUT_DIR / book_folder / f"Part{part_number}_{sanitize_name(part_title)}"
        lock_path = part_dir / "generating.lock"  # refine to exact path now that we know title

        # Delete existing MP3 if present (Revise Script flow)
        existing_mp3s = glob.glob(str(part_dir / "*.mp3"))
        if existing_mp3s:
            for mp3_path in existing_mp3s:
                os.remove(mp3_path)
                print(f"[generate] Deleted existing audio: {mp3_path}")
            state_path = OUTPUT_DIR / book_folder / "book_state.json"
            state_data = json.loads(state_path.read_text(encoding="utf-8"))
            state_data["parts"][str(part_number)] = "script_ready"
            write_json_atomic(state_path, state_data)
            print(f"[generate] Reverted state to script_ready for Part {part_number}")

        book_text = (OUTPUT_DIR / book_folder / "book_text.txt").read_text(encoding="utf-8")
        part_text = extract_part_text(book_text, start_chapter, end_chapter)

        prompt = (
            PROMPT_B
            .replace("{part_number}", str(part_number))
            .replace("{part_title}", part_title)
            .replace("{chapter_range}", chapter_range)
            .replace("{part_text}", part_text)
        )

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            print("[generate] GEMINI_API_KEY not set — aborting")
            return

        client = genai.Client(api_key=api_key)
        script_data = None

        for attempt in range(2):
            try:
                response = client.models.generate_content(
                    model="gemini-2.5-flash", contents=prompt
                )
                parsed = json.loads(strip_json_fences(response.text))
                if not isinstance(parsed, list):
                    raise ValueError("Response is not a list")
                for item in parsed:
                    if "host" not in item or "line" not in item:
                        raise ValueError("Item missing host or line key")
                script_data = parsed
                break
            except Exception as e:
                print(f"[generate] Attempt {attempt + 1} failed: {e}")
                if attempt == 1:
                    print(f"[generate] Double fail for Part {part_number} — state stays empty")
                    return

        if script_data is None:
            return

        part_dir.mkdir(parents=True, exist_ok=True)
        write_json_atomic(part_dir / "script.json", script_data)

        state_path = OUTPUT_DIR / book_folder / "book_state.json"
        state_data = json.loads(state_path.read_text(encoding="utf-8"))
        state_data["parts"][str(part_number)] = "script_ready"
        write_json_atomic(state_path, state_data)

        print(f"[generate] Part {part_number} done — {len(script_data)} lines")

    except Exception as e:
        print(f"[generate] Unexpected error: {e}")
    finally:
        if lock_path and lock_path.exists():
            lock_path.unlink()


@app.post("/generate")
async def generate(req: GenerateRequest, background_tasks: BackgroundTasks):
    validate_book_folder(req.book_folder)
    parts_path = OUTPUT_DIR / req.book_folder / "parts.json"
    if not parts_path.exists():
        raise HTTPException(status_code=404, detail="Book not found.")

    try:
        parts_data = json.loads(parts_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        raise HTTPException(status_code=500, detail=f"Could not read parts.json: {e}")

    parts_list = parts_data.get("parts", [])
    part = next((p for p in parts_list if p["part_number"] == req.part_number), None)
    if part is None:
        raise HTTPException(status_code=404, detail=f"Part {req.part_number} not found.")

    part_dir = OUTPUT_DIR / req.book_folder / f"Part{req.part_number}_{sanitize_name(part['title'])}"
    part_dir.mkdir(parents=True, exist_ok=True)

    lock_path = part_dir / "generating.lock"
    if lock_path.exists():
        raise HTTPException(status_code=409, detail="Script generation already in progress.")
    lock_path.touch()

    background_tasks.add_task(generate_script_task, req.book_folder, req.part_number)
    return JSONResponse({"status": "started"}, status_code=202)


async def generate_audio_task(book_folder: str, part_number: int):
    _lock_candidates = glob.glob(
        str(OUTPUT_DIR / book_folder / f"Part{part_number}_*" / "audio.lock")
    )
    audio_lock_path = Path(_lock_candidates[0]) if _lock_candidates else None

    voice_map = {"Alex": "en-US-GuyNeural", "Morgan": "en-US-JennyNeural"}
    script = []
    temp_paths = []
    mp3_path = None
    progress_path = None

    try:
        parts_data = json.loads((OUTPUT_DIR / book_folder / "parts.json").read_text(encoding="utf-8"))
        part = next((p for p in parts_data.get("parts", []) if p["part_number"] == part_number), None)
        if part is None:
            print(f"[podcast] Part {part_number} not found in parts.json")
            return

        part_dir = OUTPUT_DIR / book_folder / f"Part{part_number}_{sanitize_name(part['title'])}"
        progress_path = part_dir / "progress.json"
        script = json.loads((part_dir / "script.json").read_text(encoding="utf-8"))
        temp_paths = [part_dir / f"temp_{i:04d}.mp3" for i in range(len(script))]
        mp3_filename = f"{book_folder}Part{part_number}{sanitize_name(part['title'])}.mp3"
        mp3_path = part_dir / mp3_filename

        for i, item in enumerate(script):
            voice = voice_map.get(item["host"], "en-US-GuyNeural")
            communicate = edge_tts.Communicate(item["line"], voice)
            await communicate.save(str(temp_paths[i]))
            progress_path.write_text(
                json.dumps({"current": i + 1, "total": len(script)}), encoding="utf-8"
            )
            await asyncio.sleep(0.1)

        silence = AudioSegment.silent(duration=300)
        combined = AudioSegment.empty()
        for i, path in enumerate(temp_paths):
            segment = AudioSegment.from_mp3(str(path))
            if i > 0:
                combined += silence
            combined += segment

        combined.export(str(mp3_path), format="mp3")

        state_path = OUTPUT_DIR / book_folder / "book_state.json"
        state_data = json.loads(state_path.read_text(encoding="utf-8"))
        state_data["parts"][str(part_number)] = "audio_ready"
        write_json_atomic(state_path, state_data)

        for path in temp_paths:
            if path.exists():
                path.unlink()
        if progress_path.exists():
            progress_path.unlink()

        print(f"[podcast] Audio ready: {mp3_path}")

    except Exception as e:
        print(f"[podcast] Audio generation failed: {e}")
        for path in temp_paths:
            if path.exists():
                path.unlink()
        try:
            if mp3_path and mp3_path.exists():
                mp3_path.unlink()
        except Exception:
            pass
        if progress_path and progress_path.exists():
            progress_path.unlink()

    finally:
        if audio_lock_path and audio_lock_path.exists():
            audio_lock_path.unlink()


@app.post("/podcast")
async def podcast(req: PodcastRequest, background_tasks: BackgroundTasks):
    validate_book_folder(req.book_folder)
    parts_path = OUTPUT_DIR / req.book_folder / "parts.json"
    if not parts_path.exists():
        raise HTTPException(status_code=404, detail="Book not found.")

    try:
        parts_data = json.loads(parts_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        raise HTTPException(status_code=500, detail=f"Could not read parts.json: {e}")

    parts_list = parts_data.get("parts", [])
    part = next((p for p in parts_list if p["part_number"] == req.part_number), None)
    if part is None:
        raise HTTPException(status_code=404, detail=f"Part {req.part_number} not found.")

    part_dir = OUTPUT_DIR / req.book_folder / f"Part{req.part_number}_{sanitize_name(part['title'])}"
    part_dir.mkdir(parents=True, exist_ok=True)

    script_path = part_dir / "script.json"
    if not script_path.exists():
        raise HTTPException(status_code=404, detail="Script not found. Generate script first.")

    try:
        script_data = json.loads(script_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        raise HTTPException(status_code=500, detail=f"Could not read script.json: {e}")

    total = len(script_data)

    audio_lock_path = part_dir / "audio.lock"
    if audio_lock_path.exists():
        raise HTTPException(status_code=409, detail="Audio generation already in progress.")
    audio_lock_path.touch()

    (part_dir / "progress.json").write_text(
        json.dumps({"current": 0, "total": total}), encoding="utf-8"
    )

    background_tasks.add_task(generate_audio_task, req.book_folder, req.part_number)
    return JSONResponse({"status": "started"}, status_code=202)


@app.get("/script/{book_folder}/{part_number}")
def get_script(book_folder: str, part_number: int):
    validate_book_folder(book_folder)
    parts_path = OUTPUT_DIR / book_folder / "parts.json"
    if not parts_path.exists():
        raise HTTPException(status_code=404, detail="Book not found.")

    try:
        parts_data = json.loads(parts_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        raise HTTPException(status_code=500, detail=f"Could not read parts.json: {e}")

    part = next(
        (p for p in parts_data.get("parts", []) if p["part_number"] == part_number),
        None,
    )
    if part is None:
        raise HTTPException(status_code=404, detail=f"Part {part_number} not found.")

    script_path = OUTPUT_DIR / book_folder / f"Part{part_number}_{sanitize_name(part['title'])}" / "script.json"
    if not script_path.exists():
        raise HTTPException(status_code=404, detail="Script not found.")

    try:
        return json.loads(script_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        raise HTTPException(status_code=500, detail=f"Could not read script.json: {e}")


@app.get("/books")
def get_books():
    if not OUTPUT_DIR.exists():
        return []

    books = []
    for book_dir in OUTPUT_DIR.iterdir():
        if not book_dir.is_dir():
            continue
        parts_file = book_dir / "parts.json"
        state_file = book_dir / "book_state.json"
        if not parts_file.exists() or not state_file.exists():
            continue
        try:
            parts_data = json.loads(parts_file.read_text(encoding="utf-8"))
            state_data = json.loads(state_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue

        total_parts = len(parts_data.get("parts", []))
        audio_ready_count = sum(
            1 for v in state_data.get("parts", {}).values() if v == "audio_ready"
        )
        books.append({
            "folder": book_dir.name,
            "title": state_data.get("book_title", book_dir.name.replace("_", " ")),
            "total_parts": total_parts,
            "audio_ready_count": audio_ready_count,
            "created_at": book_dir.stat().st_ctime,
        })

    books.sort(key=lambda b: b["created_at"], reverse=True)
    return books


@app.delete("/book/{folder}")
def delete_book(folder: str):
    validate_book_folder(folder)
    book_dir = OUTPUT_DIR / folder
    if not book_dir.exists():
        raise HTTPException(status_code=404, detail="Book not found.")

    shutil.rmtree(book_dir)
    return {"deleted": True}


@app.get("/podcast-progress/{book_folder}/{part_number}")
def get_podcast_progress(book_folder: str, part_number: int):
    validate_book_folder(book_folder)
    parts_path = OUTPUT_DIR / book_folder / "parts.json"
    if not parts_path.exists():
        return {"current": 0, "total": 0}

    try:
        parts_data = json.loads(parts_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"current": 0, "total": 0}

    part = next(
        (p for p in parts_data.get("parts", []) if p["part_number"] == part_number),
        None,
    )
    if part is None:
        return {"current": 0, "total": 0}

    progress_path = OUTPUT_DIR / book_folder / f"Part{part_number}_{sanitize_name(part['title'])}" / "progress.json"
    if not progress_path.exists():
        return {"current": 0, "total": 0}

    try:
        return json.loads(progress_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"current": 0, "total": 0}
