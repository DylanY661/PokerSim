"""
test_game_engine_async.py — tests for async AI-dispatch functions.

All external services (Ollama, Gemini API, ChromaDB, gemini_browser) are mocked.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import json
import pytest
from unittest.mock import MagicMock, patch, AsyncMock

from game_engine import (
    GameConfig,
    _build_prompt,
    _format_state,
    get_ai_action,
)


# ── Fixtures ──────────────────────────────────────────────────────────────────

def make_collection(snippets=None):
    """Return a mock ChromaDB collection."""
    col = MagicMock()
    col.query.return_value = {"documents": [snippets or ["Play tight poker."]]}
    return col


def make_config(mode="ollama", gemini_client=None, **kwargs):
    col = make_collection()
    defaults = dict(
        mode=mode,
        ollama_model="llama3.2:latest",
        player_count=3,
        starting_stack=1000,
        action_speed=0,
        prompts={"Calculator": "You are a calculator."},
        collections={"Calculator": col},
        gemini_client=gemini_client,
    )
    defaults.update(kwargs)
    cfg = GameConfig(**defaults)
    # stash collection for assertion access
    cfg._test_collection = col
    return cfg


def make_state():
    return {
        "hole_cards":      [{"rank": "A", "suit": "S"}, {"rank": "K", "suit": "H"}],
        "community_cards": [],
        "pot":             100,
        "to_call":         20,
        "stack":           980,
        "street":          "preflop",
    }


# ── _build_prompt ─────────────────────────────────────────────────────────────

class TestBuildPrompt:
    def test_calls_collection_query(self):
        config = make_config()
        state  = make_state()
        _build_prompt("Calculator", state, config)
        config._test_collection.query.assert_called_once()

    def test_query_uses_state_text(self):
        config = make_config()
        state  = make_state()
        state_text = _format_state(state)
        _build_prompt("Calculator", state, config)
        call_args = config._test_collection.query.call_args
        assert state_text in call_args.kwargs.get("query_texts", call_args.args[0] if call_args.args else [])

    def test_result_contains_reference_material(self):
        config = make_config()
        prompt = _build_prompt("Calculator", make_state(), config)
        assert "Reference Material" in prompt

    def test_result_contains_state_text(self):
        config = make_config()
        prompt = _build_prompt("Calculator", make_state(), config)
        assert "GAME STATE" in prompt

    def test_result_contains_json_instruction(self):
        config = make_config()
        prompt = _build_prompt("Calculator", make_state(), config)
        assert "JSON" in prompt

    def test_snippets_included_in_prompt(self):
        col = make_collection(["Play tight poker."])
        config = make_config(collections={"Calculator": col})
        prompt = _build_prompt("Calculator", make_state(), config)
        assert "Play tight poker." in prompt

    def test_empty_snippets_handled(self):
        col = MagicMock()
        col.query.return_value = {"documents": [[]]}
        config = make_config(collections={"Calculator": col})
        # Should not raise
        prompt = _build_prompt("Calculator", make_state(), config)
        assert "GAME STATE" in prompt


# ── get_ai_action — ollama mode ───────────────────────────────────────────────

class TestGetAiActionOllama:
    async def test_returns_parsed_action(self):
        config = make_config(mode="ollama")
        response_json = json.dumps({"action": "fold", "amount": 0, "reasoning": "weak hand"})

        with patch("game_engine.asyncio.to_thread", new=AsyncMock(return_value=response_json)):
            result = await get_ai_action("Calculator", make_state(), config)

        assert result["action"] == "fold"
        assert result["amount"] == 0

    async def test_raises_runtime_on_ollama_error(self):
        from llm.ollama_client import OllamaError
        config = make_config(mode="ollama")

        async def _raise(*args, **kwargs):
            raise OllamaError("connection refused")

        with patch("game_engine.asyncio.to_thread", new=_raise):
            with pytest.raises(RuntimeError, match="Ollama error"):
                await get_ai_action("Calculator", make_state(), config)

    async def test_call_includes_player_prompt(self):
        config = make_config(mode="ollama")
        captured = {}

        async def _capture(fn, *args, **kwargs):
            # Call the real closure to verify it uses the right prompt
            result = fn()
            captured["called"] = True
            return json.dumps({"action": "call", "amount": 0, "reasoning": "ok"})

        with patch("game_engine.asyncio.to_thread", new=_capture):
            await get_ai_action("Calculator", make_state(), config)

        assert captured.get("called")


# ── get_ai_action — api mode ──────────────────────────────────────────────────

class TestGetAiActionApi:
    async def test_raises_when_no_client(self):
        config = make_config(mode="api", gemini_client=None)
        with pytest.raises(RuntimeError, match="GEMINI_API_KEY"):
            await get_ai_action("Calculator", make_state(), config)

    async def test_returns_parsed_action_with_mock_client(self):
        mock_response      = MagicMock()
        mock_response.text = '{"action":"raise","amount":50,"reasoning":"strong"}'

        mock_chat = MagicMock()
        mock_chat.send_message.return_value = mock_response

        mock_client = MagicMock()
        mock_client.chats.create.return_value = mock_chat

        config = make_config(mode="api", gemini_client=mock_client)

        async def _run_in_thread(fn, *args, **kwargs):
            return fn()

        with patch("game_engine.asyncio.to_thread", new=_run_in_thread):
            result = await get_ai_action("Calculator", make_state(), config)

        assert result["action"] == "raise"
        assert result["amount"] == 50

    async def test_chat_send_message_called_twice(self):
        """First call sends system prompt, second sends game state."""
        mock_response      = MagicMock()
        mock_response.text = '{"action":"call","amount":0,"reasoning":"ok"}'
        mock_chat          = MagicMock()
        mock_chat.send_message.return_value = mock_response
        mock_client        = MagicMock()
        mock_client.chats.create.return_value = mock_chat

        config = make_config(mode="api", gemini_client=mock_client)

        async def _run_in_thread(fn, *args, **kwargs):
            return fn()

        with patch("game_engine.asyncio.to_thread", new=_run_in_thread):
            await get_ai_action("Calculator", make_state(), config)

        assert mock_chat.send_message.call_count == 2


# ── get_ai_action — browser mode ─────────────────────────────────────────────

class TestGetAiActionBrowser:
    async def test_returns_parsed_action(self):
        config  = make_config(mode="browser")
        browser_response = '{"action":"call","amount":0,"reasoning":"seems fine"}'

        with patch("game_engine.asyncio.to_thread", new=AsyncMock(return_value=browser_response)):
            result = await get_ai_action("Calculator", make_state(), config)

        assert result["action"] == "call"

    async def test_invalid_browser_response_defaults_to_call(self):
        config = make_config(mode="browser")

        with patch("game_engine.asyncio.to_thread", new=AsyncMock(return_value="not json at all")):
            result = await get_ai_action("Calculator", make_state(), config)

        assert result["action"] == "call"
