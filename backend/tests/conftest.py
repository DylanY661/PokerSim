"""
conftest.py — patches heavy module-level side-effects before any test module
imports main.py.

main.py runs these at import time:
  - chromadb.PersistentClient(...)   → needs a real filesystem + chromadb
  - google.genai.Client(...)         → needs GEMINI_API_KEY
  - open() on each personality prompt file

By stuffing fake modules into sys.modules here (conftest is loaded first by
pytest) every subsequent `import main` or `from main import app` sees mocks
instead of the real libraries, so tests can run without any external services.
"""
import sys
import os
from unittest.mock import MagicMock, patch

# ── Stub out chromadb ──────────────────────────────────────────────────────────
chromadb_mock = MagicMock()
# get_or_create_collection returns a collection mock whose .query() returns
# the shape that _build_prompt expects: {"documents": [["snippet"]]}
collection_mock = MagicMock()
collection_mock.query.return_value = {"documents": [["Test poker knowledge."]]}
chromadb_mock.PersistentClient.return_value.get_or_create_collection.return_value = collection_mock
sys.modules["chromadb"] = chromadb_mock

# ── Stub out google.genai ──────────────────────────────────────────────────────
google_mock = MagicMock()
genai_mock  = MagicMock()
google_mock.genai = genai_mock
sys.modules["google"]       = google_mock
sys.modules["google.genai"] = genai_mock

# ── Stub out gemini_browser ───────────────────────────────────────────────────
gemini_browser_mock = MagicMock()
gemini_browser_mock.STATE_FILE = "/tmp/fake_state.json"
sys.modules["gemini_browser"] = gemini_browser_mock

# ── Stub out langchain / other heavy deps (used by scripts, not main) ─────────
for mod in [
    "langchain", "langchain.text_splitter",
    "langchain_community", "langchain_community.document_loaders",
    "langchain_google_genai",
    "langchain_text_splitters",
]:
    sys.modules.setdefault(mod, MagicMock())

# ── Point the DB at an in-memory SQLite so tests never touch poker.db ─────────
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

# ── Patch open() so _load_prompt() doesn't need the real prompt files ─────────
import builtins
_real_open = builtins.open

def _patched_open(path, *args, **kwargs):
    # Intercept reads of personality_prompt .txt files
    if isinstance(path, str) and "personality_prompts" in path and path.endswith(".txt"):
        from io import StringIO
        class _FakeFile:
            def read(self): return "You are a poker player."
            def __enter__(self): return self
            def __exit__(self, *a): pass
        return _FakeFile()
    return _real_open(path, *args, **kwargs)

builtins.open = _patched_open
