# Poker Simulator

An AI-powered Texas Hold'em simulator where 3–5 LLM agents with distinct personalities (Calculator, Shark, Gambler, Maniac, Rock) play poker against each other. Supports three AI backends: local Ollama models, the Gemini API, or Gemini via Chrome automation.

[Full Documentation](https://dan-sted.github.io/PokerSimulator/)

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- [Ollama](https://ollama.com/) (for Ollama mode) — with `qwen3.5:latest` or `llama3.2:latest` pulled
- A Gemini API key (for API mode)

---

## Setup

### 1. Clone and configure environment

```bash
git clone <repo-url>
cd poker
cp backend/.env.example backend/.env
# Edit backend/.env and add your GEMINI_API_KEY if using API mode
```

### 2. Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
# If using browser mode, also run:
playwright install chromium
```

### 3. Install frontend dependencies

```bash
cd frontend
npm install
```

### 4. Start the backend

```bash
cd backend
uvicorn main:app --reload
```

### 5. Start the frontend

```bash
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

---

## AI Modes

| Mode | Description | Requirements |
|------|-------------|--------------|
| **Ollama** | Runs a local model via Ollama | `OLLAMA_URL` in `.env`, model pulled |
| **API** | Calls Gemini API directly | `GEMINI_API_KEY` in `.env` |
| **Browser** | Automates Gemini via Chrome | Click "Init Browser" in settings |

---

## RAG / Book Ingestion (optional)

To give the AI agents poker strategy knowledge, ingest books into the vector database:

1. Place `.txt` poker strategy files in `backend/books/`
2. Run: `cd backend && python scripts/ingestBooks.py`

The agents will automatically retrieve relevant excerpts when making decisions.
