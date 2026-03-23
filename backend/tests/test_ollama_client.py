"""
test_ollama_client.py — unit tests for llm/ollama_client.py.

requests.post is mocked so no real Ollama server is needed.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import json
import pytest
from unittest.mock import MagicMock, patch

# Set required env vars before importing the module
os.environ.setdefault("OLLAMA_URL", "http://localhost:11434")
os.environ.setdefault("OLLAMA_MODEL", "llama3.2:latest")

from llm.ollama_client import generate, OllamaError


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_response_payload(action="raise", amount=20, reasoning="strong hand"):
    inner = json.dumps({"action": action, "amount": amount, "reasoning": reasoning})
    return {"response": inner}


def make_mock_response(payload, status_code=200):
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    mock_resp.json.return_value = payload
    mock_resp.raise_for_status = MagicMock()
    return mock_resp


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestGenerate:
    def test_success_returns_json_string(self):
        payload   = make_response_payload(action="raise", amount=20, reasoning="strong hand")
        mock_resp = make_mock_response(payload)

        with patch("llm.ollama_client.requests.post", return_value=mock_resp):
            result = generate(prompt="test prompt", model="llama3.2:latest")

        parsed = json.loads(result)
        assert parsed["action"] == "raise"
        assert parsed["amount"] == 20
        assert parsed["reasoning"] == "strong hand"

    def test_fold_action(self):
        payload   = make_response_payload(action="fold", amount=0, reasoning="bad hand")
        mock_resp = make_mock_response(payload)

        with patch("llm.ollama_client.requests.post", return_value=mock_resp):
            result = generate(prompt="test", model="llama3.2:latest")

        assert json.loads(result)["action"] == "fold"

    def test_http_error_raises_ollama_error(self):
        import requests as req_lib
        with patch("llm.ollama_client.requests.post",
                   side_effect=req_lib.exceptions.RequestException("connection refused")):
            with pytest.raises(OllamaError, match="HTTP Error"):
                generate(prompt="test", model="llama3.2:latest")

    def test_timeout_raises_ollama_error(self):
        import requests as req_lib
        with patch("llm.ollama_client.requests.post",
                   side_effect=req_lib.exceptions.Timeout("timed out")):
            with pytest.raises(OllamaError):
                generate(prompt="test", model="llama3.2:latest")

    def test_uses_override_model(self):
        payload   = make_response_payload()
        mock_resp = make_mock_response(payload)

        with patch("llm.ollama_client.requests.post", return_value=mock_resp) as mock_post:
            generate(prompt="test", model="custom-model:latest")

        call_kwargs = mock_post.call_args
        sent_payload = call_kwargs.kwargs.get("json") or call_kwargs.args[1]
        assert sent_payload["model"] == "custom-model:latest"

    def test_stream_is_false(self):
        """stream=False is CRITICAL to prevent NDJSON parsing errors."""
        payload   = make_response_payload()
        mock_resp = make_mock_response(payload)

        with patch("llm.ollama_client.requests.post", return_value=mock_resp) as mock_post:
            generate(prompt="test", model="llama3.2:latest")

        sent_payload = mock_post.call_args.kwargs.get("json") or mock_post.call_args.args[1]
        assert sent_payload["stream"] is False

    def test_format_is_json(self):
        payload   = make_response_payload()
        mock_resp = make_mock_response(payload)

        with patch("llm.ollama_client.requests.post", return_value=mock_resp) as mock_post:
            generate(prompt="test", model="llama3.2:latest")

        sent_payload = mock_post.call_args.kwargs.get("json") or mock_post.call_args.args[1]
        assert sent_payload["format"] == "json"

    def test_system_prompt_included_in_payload(self):
        payload   = make_response_payload()
        mock_resp = make_mock_response(payload)

        with patch("llm.ollama_client.requests.post", return_value=mock_resp) as mock_post:
            generate(prompt="test", system_prompt="You are a poker player.", model="llama3.2:latest")

        sent_payload = mock_post.call_args.kwargs.get("json") or mock_post.call_args.args[1]
        assert sent_payload["system"] == "You are a poker player."

    def test_extra_params_merged_into_payload(self):
        payload   = make_response_payload()
        mock_resp = make_mock_response(payload)

        with patch("llm.ollama_client.requests.post", return_value=mock_resp) as mock_post:
            generate(prompt="test", model="llama3.2:latest",
                     params={"temperature": 0.0, "max_tokens": 256})

        sent_payload = mock_post.call_args.kwargs.get("json") or mock_post.call_args.args[1]
        assert sent_payload["temperature"] == 0.0
        assert sent_payload["max_tokens"] == 256

    def test_result_is_string(self):
        payload   = make_response_payload()
        mock_resp = make_mock_response(payload)

        with patch("llm.ollama_client.requests.post", return_value=mock_resp):
            result = generate(prompt="test", model="llama3.2:latest")

        assert isinstance(result, str)

    def test_posts_to_correct_url(self):
        payload   = make_response_payload()
        mock_resp = make_mock_response(payload)
        base_url  = os.environ["OLLAMA_URL"]

        with patch("llm.ollama_client.requests.post", return_value=mock_resp) as mock_post:
            generate(prompt="test", model="llama3.2:latest")

        called_url = mock_post.call_args.args[0] if mock_post.call_args.args else mock_post.call_args.kwargs["url"]
        assert "/api/generate" in called_url
