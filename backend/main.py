import os
import asyncio
import chromadb
from datetime import datetime
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Literal
from google import genai

load_dotenv()

_THIS_DIR       = os.path.dirname(os.path.abspath(__file__))
PERSISTENT_PATH = os.path.join(_THIS_DIR, "database")

# ── Player personalities ──────────────────────────────────────────────────────

PLAYERS = {
    "Calculator": ("sklansky",  "calculator_prompt.txt"),
    "Shark":      ("negreanu",  "shark_prompt.txt"),
    "Gambler":    ("rounder",   "gambler_prompt.txt"),
    "Maniac":     ("seidman",   "maniac_prompt.txt"),
    "Rock":       ("dummies",   "rock_prompt.txt"),
}

_db = chromadb.PersistentClient(path=PERSISTENT_PATH)
_collections = {
    name: _db.get_or_create_collection(collection)
    for name, (collection, _) in PLAYERS.items()
}

def _load_prompt(filename: str) -> str:
    path = os.path.join(_THIS_DIR, "llm", "personality_prompts", filename)
    with open(path) as f:
        return f.read()

_prompts = {name: _load_prompt(pfile) for name, (_, pfile) in PLAYERS.items()}
_client: Optional[object] = None
if os.getenv("GEMINI_API_KEY"):
    _client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# ── Browser state ─────────────────────────────────────────────────────────────

_browser_ready        = False
_initialized_players: set = set()

# ── Active game sessions ──────────────────────────────────────────────────────
# game_id → {stacks, dealer_idx, round_number, stop, task}
_active_games: dict[int, dict] = {}
# game_id → asyncio.Queue for events pushed to WebSocket
_game_queues:  dict[int, asyncio.Queue] = {}

# ── App setup ─────────────────────────────────────────────────────────────────

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── DB init on startup ────────────────────────────────────────────────────────

@app.on_event("startup")
def on_startup():
    from db import create_tables
    create_tables()

# ── Request models ────────────────────────────────────────────────────────────

class BrowserInitRequest(BaseModel):
    players: list[str] = []

class CreateGameRequest(BaseModel):
    player_count:   int                              = 3
    starting_stack: int                              = 1000
    ai_mode:        Literal["api", "browser", "ollama"] = "ollama"
    ollama_model:   Optional[str]                    = None
    action_speed:   float                            = 1.0   # seconds

# ── Helper ────────────────────────────────────────────────────────────────────

def _make_config(req: CreateGameRequest):
    from game_engine import GameConfig
    return GameConfig(
        mode           = req.ai_mode,
        ollama_model   = req.ollama_model,
        player_count   = req.player_count,
        starting_stack = req.starting_stack,
        action_speed   = req.action_speed,
        prompts        = _prompts,
        collections    = _collections,
        gemini_client  = _client,
        browser_ready  = [_browser_ready],
    )

async def _emit(game_id: int, event: dict):
    q = _game_queues.get(game_id)
    if q:
        await q.put(event)

# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/")
def home():
    return {"message": "Poker Backend Running"}

# ── Browser endpoints (unchanged) ─────────────────────────────────────────────

@app.get("/browser/status")
def browser_status():
    return {"ready": _browser_ready}

@app.get("/browser/session-status")
def browser_session_status():
    from gemini_browser import STATE_FILE
    return {"has_session": os.path.exists(STATE_FILE)}

@app.post("/browser/login")
def browser_login():
    from gemini_browser import start_login_flow
    start_login_flow()
    return {"status": "login_browser_opened"}

@app.post("/browser/login-confirm")
async def browser_login_confirm():
    from gemini_browser import confirm_login
    await asyncio.to_thread(confirm_login)
    from gemini_browser import STATE_FILE
    return {"status": "session_saved", "has_session": os.path.exists(STATE_FILE)}

@app.delete("/browser/session")
def browser_clear_session():
    from gemini_browser import STATE_FILE
    if os.path.exists(STATE_FILE):
        os.remove(STATE_FILE)
        return {"status": "cleared"}
    return {"status": "no_session"}

@app.post("/browser/shutdown")
async def browser_shutdown():
    global _browser_ready, _initialized_players
    if not _browser_ready:
        return {"status": "not_initialized"}
    try:
        from gemini_browser import shutdown_browser
        await asyncio.to_thread(shutdown_browser)
        _browser_ready = False
        _initialized_players = set()
        return {"status": "shutdown"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/browser/init")
async def browser_init(body: BrowserInitRequest = None):
    global _browser_ready, _initialized_players
    player_ids  = body.players if body and body.players else list(PLAYERS.keys())
    invalid     = [p for p in player_ids if p not in PLAYERS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Unknown players: {invalid}")
    new_players = [p for p in player_ids if p not in _initialized_players]
    if not new_players:
        return {"status": "already_initialized", "initialized": list(_initialized_players)}
    try:
        from gemini_browser import initialize_browser, init_player_chat, add_player
        if not _browser_ready:
            await asyncio.to_thread(initialize_browser, new_players)
        else:
            for p in new_players:
                await asyncio.to_thread(add_player, p)
        for p in new_players:
            await asyncio.to_thread(init_player_chat, p, _prompts[p])
        _initialized_players.update(new_players)
        _browser_ready = True
        return {"status": "initialized", "initialized": list(_initialized_players)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Game endpoints ────────────────────────────────────────────────────────────

@app.post("/games")
def create_game(req: CreateGameRequest):
    from db import get_session, Game
    game = Game(
        player_count   = req.player_count,
        starting_stack = req.starting_stack,
        ai_mode        = req.ai_mode,
        ollama_model   = req.ollama_model,
    )
    with get_session() as session:
        session.add(game)
        session.commit()
        session.refresh(game)
        gid = game.id

    from game_engine import PLAYER_NAMES
    all_players = PLAYER_NAMES[:req.player_count]
    _active_games[gid] = {
        "stacks":       {p: req.starting_stack for p in all_players},
        "dealer_idx":   0,
        "round_number": 0,
        "stop":         False,
        "task":         None,
        "config_req":   req,
    }
    _game_queues[gid] = asyncio.Queue()
    return {"game_id": gid}


@app.post("/games/{game_id}/rounds/next")
async def start_next_round(game_id: int):
    if game_id not in _active_games:
        raise HTTPException(status_code=404, detail="Game not found")
    gs = _active_games[game_id]
    if gs.get("task") and not gs["task"].done():
        raise HTTPException(status_code=409, detail="Round already in progress")

    gs["stop"]         = False
    gs["round_number"] += 1
    round_num          = gs["round_number"]
    config             = _make_config(gs["config_req"])

    async def _run():
        from game_engine import run_round
        try:
            await run_round(
                game_id      = game_id,
                round_number = round_num,
                game_stacks  = gs["stacks"],
                dealer_idx   = gs["dealer_idx"],
                config       = config,
                stop_check   = lambda: gs["stop"],
                emit         = lambda e: _emit(game_id, e),
            )
        except Exception as e:
            await _emit(game_id, {"type": "error", "message": str(e)})
        finally:
            gs["dealer_idx"] += 1

    gs["task"] = asyncio.create_task(_run())
    return {"status": "started", "round_number": round_num}


@app.post("/games/{game_id}/stop")
async def stop_game(game_id: int):
    if game_id not in _active_games:
        raise HTTPException(status_code=404, detail="Game not found")
    _active_games[game_id]["stop"] = True
    return {"status": "stop_requested"}


@app.get("/games")
def list_games():
    from db import get_session, Game, Round
    from sqlmodel import select
    with get_session() as session:
        games = session.exec(select(Game).order_by(Game.created_at.desc())).all()
        result = []
        for g in games:
            rounds = session.exec(select(Round).where(Round.game_id == g.id)).all()
            result.append({
                "id":               g.id,
                "created_at":       g.created_at.isoformat(),
                "ended_at":         g.ended_at.isoformat() if g.ended_at else None,
                "player_count":     g.player_count,
                "starting_stack":   g.starting_stack,
                "ai_mode":          g.ai_mode,
                "ollama_model":     g.ollama_model,
                "tournament_winner": g.tournament_winner,
                "round_count":      len(rounds),
            })
        return result


@app.get("/games/{game_id}")
def get_game(game_id: int):
    from db import get_session, Game, Round, Action, PlayerStack
    from sqlmodel import select
    with get_session() as session:
        game = session.get(Game, game_id)
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")
        rounds = session.exec(select(Round).where(Round.game_id == game_id)
                              .order_by(Round.round_number)).all()
        rounds_out = []
        for r in rounds:
            actions = session.exec(select(Action).where(Action.round_id == r.id)
                                   .order_by(Action.sequence)).all()
            stacks  = session.exec(select(PlayerStack).where(PlayerStack.round_id == r.id)).all()
            rounds_out.append({
                "id":              r.id,
                "round_number":    r.round_number,
                "dealer":          r.dealer,
                "sb":              r.sb,
                "bb":              r.bb,
                "pot":             r.pot,
                "community_cards": r.community_cards,
                "winner":          r.winner,
                "winning_hand":    r.winning_hand,
                "player_stacks":   [{"player": s.player, "start": s.stack_start, "end": s.stack_end} for s in stacks],
                "actions":         [{"player": a.player, "street": a.street, "action": a.action,
                                     "amount": a.amount, "reasoning": a.reasoning} for a in actions],
            })
        return {
            "id":               game.id,
            "created_at":       game.created_at.isoformat(),
            "player_count":     game.player_count,
            "starting_stack":   game.starting_stack,
            "ai_mode":          game.ai_mode,
            "tournament_winner": game.tournament_winner,
            "rounds":           rounds_out,
        }

# ── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/games/{game_id}/ws")
async def game_ws(websocket: WebSocket, game_id: int):
    await websocket.accept()

    # Ensure queue exists (created by POST /games)
    if game_id not in _game_queues:
        _game_queues[game_id] = asyncio.Queue()
    queue = _game_queues[game_id]

    async def _send_loop():
        while True:
            event = await queue.get()
            if event is None:       # sentinel: WS is closing
                break
            try:
                await websocket.send_json(event)
            except Exception:
                break

    async def _recv_loop():
        try:
            while True:
                msg = await websocket.receive_json()
                if msg.get("type") == "stop" and game_id in _active_games:
                    _active_games[game_id]["stop"] = True
        except (WebSocketDisconnect, Exception):
            pass

    try:
        await asyncio.gather(_send_loop(), _recv_loop())
    finally:
        _game_queues.pop(game_id, None)
