# The Folio

The Folio is a local web application that turns PDF books into two-host, podcast-style audio episodes. Upload a PDF, and the app splits the book into balanced narrative parts, writes a conversational script between two distinct AI hosts, and renders that script into a playable MP3 — all running entirely on your own machine.

It runs fully on `localhost` and stores everything on the local filesystem. No database, no cloud account, no telemetry.

## How It Works

1. **Upload** — Drop in a PDF. PyMuPDF extracts the text and reads the table of contents (falling back to chapter-heading detection if there is no TOC).
2. **Confirm** — You confirm or edit the detected book title.
3. **Split** — Gemini analyzes the book and divides it into balanced parts based on narrative density.
4. **Script** — For any part you pick, Gemini generates a 180–220 line two-host dialogue.
5. **Listen** — Edge TTS renders the script line by line, merges it into a single MP3, and a player appears in the Reading Room.

All progress is tracked per book and survives restarts.

- **Library** — every book you have made, as cards. Open or delete.
- **Upload** — PDF upload and title confirmation.
- **Reading Room** — a two-panel workspace. Left: the parts list with status icons and estimated listen time. Right: the dialogue script, revision controls, and the audio player.

## Tech Stack

- **Frontend:** React (Vite), Tailwind CSS v4, Lucide React
- **Backend:** FastAPI, Uvicorn
- **PDF parsing:** PyMuPDF
- **Script generation:** Google Gemini (`gemini-2.5-flash`) via `google-genai`
- **Audio synthesis:** Microsoft Edge TTS (free, no API key required)
- **Audio processing:** pydub + FFmpeg
- **Storage:** Local filesystem only

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- [FFmpeg](https://ffmpeg.org/download.html) installed and on your `PATH` (required to merge audio)
- A free [Google Gemini API key](https://aistudio.google.com/app/apikey)

Edge TTS needs no key — it is the only voice provider and is free.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/muhammadumarkhawaja-ui/The-Folio.git
   cd The-Folio
   ```

2. Set up the backend:
   ```bash
   cd backend
   python -m venv venv
   venv\Scripts\activate        # Windows
   # source venv/bin/activate   # macOS / Linux
   pip install -r requirements.txt
   cd ..
   ```

3. Add your Gemini API key. Create a file named `.env` in the project root:
   ```
   GEMINI_API_KEY=your_key_here
   ```

4. Set up the frontend:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

### Running the App

**Windows (quick start):** double-click `start.bat`. It launches both servers in separate terminals.

**Manual start (any OS):**

```bash
# Terminal 1 — backend
cd backend
venv\Scripts\activate
uvicorn main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm run dev
```

Then open **http://localhost:5173** in your browser.

## Project Structure

```
The-Folio/
├── backend/
│   ├── main.py            # FastAPI app and endpoints
│   ├── prompts.py         # Gemini prompt templates
│   ├── requirements.txt
│   └── output/            # Generated books, scripts, and audio (gitignored)
├── frontend/
│   └── src/               # React app
├── .env                   # Your Gemini API key (gitignored)
└── start.bat              # Windows launcher
```

## Notes

- The Folio is built for personal use and runs only on `localhost`.
- Generated books, scripts, and audio live under `backend/output/` and are not committed to the repository.
- PDFs must have a detectable chapter structure (TOC or chapter headings); books without one are rejected on upload.
- Maximum PDF size is 50 MB.

## License

Personal project — released for educational and personal use.
