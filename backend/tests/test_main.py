"""
test_main.py — integration-style tests for FastAPI endpoints in main.py.

conftest.py has already patched sys.modules for chromadb / google.genai /
gemini_browser before this module is imported.

We use httpx.AsyncClient with ASGITransport so requests never hit the network.
The DB engine is patched to in-memory SQLite so no real poker.db is touched.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from sqlmodel import create_engine, SQLModel, Session
from sqlalchemy.pool import StaticPool
from httpx import AsyncClient, ASGITransport

import db as db_module


# ── DB fixture (in-memory) ────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def use_in_memory_db(monkeypatch):
    """Redirect all DB access to a fresh in-memory SQLite for each test.

    StaticPool is essential: the default SingletonThreadPool gives each thread
    its own connection (and thus its own empty database).  ASGI handlers run
    in a thread-pool executor, so without StaticPool the handler sees a blank
    database even though create_all() was called in the test thread.
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
    SQLModel.metadata.create_all(engine)
    monkeypatch.setattr(db_module, "engine", engine)
    monkeypatch.setattr(db_module, "get_session", lambda: Session(engine))
    return engine


# ── App fixture ───────────────────────────────────────────────────────────────

@pytest.fixture()
async def client():
    from main import app, _active_games, _game_queues
    # Clear global state between tests
    _active_games.clear()
    _game_queues.clear()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


# ── Health ────────────────────────────────────────────────────────────────────

class TestHealth:
    async def test_health_check(self, client):
        resp = await client.get("/")
        assert resp.status_code == 200
        assert resp.json() == {"message": "Poker Backend Running"}


# ── POST /games ───────────────────────────────────────────────────────────────

class TestCreateGame:
    async def test_returns_game_id(self, client):
        resp = await client.post("/games", json={
            "player_count": 3, "starting_stack": 1000, "ai_mode": "ollama"
        })
        assert resp.status_code == 200
        body = resp.json()
        assert "game_id" in body
        assert isinstance(body["game_id"], int)

    async def test_default_values_accepted(self, client):
        resp = await client.post("/games", json={})
        assert resp.status_code == 200
        assert "game_id" in resp.json()

    async def test_different_player_counts(self, client):
        for count in (3, 4, 5):
            resp = await client.post("/games", json={"player_count": count})
            assert resp.status_code == 200

    async def test_game_stored_in_active_games(self, client):
        from main import _active_games
        resp = await client.post("/games", json={"player_count": 3})
        gid  = resp.json()["game_id"]
        assert gid in _active_games

    async def test_initial_stacks_correct(self, client):
        from main import _active_games
        resp = await client.post("/games", json={"player_count": 3, "starting_stack": 500})
        gid  = resp.json()["game_id"]
        stacks = _active_games[gid]["stacks"]
        assert all(v == 500 for v in stacks.values())
        assert len(stacks) == 3


# ── POST /games/{id}/rounds/next ──────────────────────────────────────────────

class TestStartNextRound:
    async def test_404_for_unknown_game(self, client):
        resp = await client.post("/games/99999/rounds/next")
        assert resp.status_code == 404

    async def test_started_status_returned(self, client):
        from unittest.mock import patch, AsyncMock
        create_resp = await client.post("/games", json={"player_count": 3})
        gid = create_resp.json()["game_id"]

        with patch("main.run_round", new=AsyncMock(return_value=None)):
            resp = await client.post(f"/games/{gid}/rounds/next")

        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "started"
        assert body["round_number"] == 1

    async def test_round_number_increments(self, client):
        from unittest.mock import patch, AsyncMock
        import asyncio
        create_resp = await client.post("/games", json={"player_count": 3})
        gid = create_resp.json()["game_id"]

        with patch("main.run_round", new=AsyncMock(return_value=None)):
            r1 = await client.post(f"/games/{gid}/rounds/next")
            # Wait for the background task to finish before starting round 2
            from main import _active_games
            task = _active_games[gid].get("task")
            if task:
                await asyncio.wait_for(task, timeout=2.0)

            r2 = await client.post(f"/games/{gid}/rounds/next")

        assert r1.json()["round_number"] == 1
        assert r2.json()["round_number"] == 2


# ── POST /games/{id}/stop ─────────────────────────────────────────────────────

class TestStopGame:
    async def test_404_for_unknown_game(self, client):
        resp = await client.post("/games/99999/stop")
        assert resp.status_code == 404

    async def test_stop_returns_stop_requested(self, client):
        create_resp = await client.post("/games", json={})
        gid  = create_resp.json()["game_id"]
        resp = await client.post(f"/games/{gid}/stop")
        assert resp.status_code == 200
        assert resp.json()["status"] == "stop_requested"

    async def test_stop_sets_flag(self, client):
        from main import _active_games
        create_resp = await client.post("/games", json={})
        gid  = create_resp.json()["game_id"]
        await client.post(f"/games/{gid}/stop")
        assert _active_games[gid]["stop"] is True


# ── GET /games ────────────────────────────────────────────────────────────────

class TestListGames:
    async def test_returns_list_unauthenticated(self, client):
        # Unauthenticated → empty list (not 401)
        resp = await client.get("/games")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_created_game_appears_in_list(self, client):
        # Register user, create game with auth, list with same auth
        reg = await client.post("/auth/register", json={"username": "listuser1", "password": "password123"})
        token = reg.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        await client.post("/games", json={"player_count": 3, "starting_stack": 1000}, headers=headers)
        resp = await client.get("/games", headers=headers)
        assert len(resp.json()) >= 1

    async def test_list_entry_has_expected_keys(self, client):
        reg = await client.post("/auth/register", json={"username": "listuser2", "password": "password123"})
        token = reg.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        await client.post("/games", json={}, headers=headers)
        resp  = await client.get("/games", headers=headers)
        entry = resp.json()[0]
        for key in ("id", "player_count", "starting_stack", "ai_mode", "round_count"):
            assert key in entry, f"Missing key: {key}"


# ── GET /games/{id} ───────────────────────────────────────────────────────────

class TestGetGame:
    async def test_404_for_unknown_game(self, client):
        resp = await client.get("/games/99999")
        assert resp.status_code == 404

    async def test_returns_correct_structure(self, client):
        create_resp = await client.post("/games", json={
            "player_count": 3, "starting_stack": 1000, "ai_mode": "ollama"
        })
        gid  = create_resp.json()["game_id"]
        resp = await client.get(f"/games/{gid}")
        assert resp.status_code == 200
        body = resp.json()
        for key in ("id", "player_count", "starting_stack", "ai_mode", "rounds"):
            assert key in body, f"Missing key: {key}"

    async def test_rounds_is_empty_list_initially(self, client):
        create_resp = await client.post("/games", json={})
        gid  = create_resp.json()["game_id"]
        resp = await client.get(f"/games/{gid}")
        assert resp.json()["rounds"] == []

    async def test_player_count_matches(self, client):
        create_resp = await client.post("/games", json={"player_count": 4})
        gid  = create_resp.json()["game_id"]
        resp = await client.get(f"/games/{gid}")
        assert resp.json()["player_count"] == 4
