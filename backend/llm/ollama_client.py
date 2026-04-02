import os
import requests
import json
from dotenv import load_dotenv
from types import SimpleNamespace

load_dotenv()
OLLAMA_URL = os.getenv("OLLAMA_URL")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL")

class OllamaError(Exception):
    pass

def generate(prompt, system_prompt=None, timeout=120, params=None, model=None):
    url = OLLAMA_URL.rstrip("/") + "/api/generate"

    # payload setup
    payload = {
        "model": model or OLLAMA_MODEL,
        "prompt": prompt,
        "system": system_prompt, 
        "format": "json",
        "stream": False,         
    }
    
    if params:
        payload.update(params)

    try:
        resp = requests.post(url, json=payload, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()
        # decode the JSON string stored in data['response']
        resp = json.loads(data.get("response", "{}"))

        action = resp.get("action")
        amount = resp.get("amount")
        reasoning = resp.get("reasoning")

        result = {"action": action, "amount": amount, "reasoning": reasoning}
        resultJSON = json.dumps(result)



    except requests.exceptions.RequestException as e:
        raise OllamaError(f"HTTP Error: {str(e)}")

    return resultJSON