import os
import json
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, create_engine, Session

_THIS_DIR    = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = f"sqlite:///{os.path.join(_THIS_DIR, 'poker.db')}"
engine       = create_engine(DATABASE_URL, echo=False)


class Game(SQLModel, table=True):
    id:                Optional[int]      = Field(default=None, primary_key=True)
    created_at:        datetime           = Field(default_factory=datetime.utcnow)
    ended_at:          Optional[datetime] = None
    player_count:      int
    starting_stack:    int
    ai_mode:           str
    ollama_model:      Optional[str]      = None
    tournament_winner: Optional[str]      = None
    human_player:      Optional[str]      = None   # future: human-in-the-loop seat
    user_id:           Optional[int]      = None   # future: FK → users.id


class Round(SQLModel, table=True):
    id:              Optional[int] = Field(default=None, primary_key=True)
    game_id:         int           = Field(foreign_key="game.id")
    round_number:    int
    dealer:          str
    sb:              str
    bb:              str
    pot:             int           = 0
    community_cards: str           = "[]"   # JSON array of {rank, suit}
    winner:          Optional[str] = None
    winning_hand:    Optional[str] = None


class PlayerStack(SQLModel, table=True):
    id:          Optional[int] = Field(default=None, primary_key=True)
    round_id:    int           = Field(foreign_key="round.id")
    player:      str
    stack_start: int
    stack_end:   int           = 0


class Action(SQLModel, table=True):
    id:        Optional[int] = Field(default=None, primary_key=True)
    round_id:  int           = Field(foreign_key="round.id")
    player:    str
    street:    str
    action:    str
    amount:    int           = 0
    reasoning: str           = ""
    sequence:  int           = 0


def create_tables():
    SQLModel.metadata.create_all(engine)


def get_session() -> Session:
    return Session(engine)


def save_round(round_data: dict):
    """Persist a completed round and all its actions to the DB."""
    with get_session() as session:
        rnd = Round(
            game_id         = round_data["game_id"],
            round_number    = round_data["round_number"],
            dealer          = round_data["dealer"],
            sb              = round_data["sb"],
            bb              = round_data["bb"],
            pot             = round_data["pot"],
            community_cards = json.dumps(round_data.get("community_cards", [])),
            winner          = round_data.get("winner"),
            winning_hand    = round_data.get("winning_hand"),
        )
        session.add(rnd)
        session.flush()  # get rnd.id

        initial_stacks = round_data.get("initial_stacks", {})
        final_stacks   = round_data.get("final_stacks", {})
        for player, start in initial_stacks.items():
            session.add(PlayerStack(
                round_id    = rnd.id,
                player      = player,
                stack_start = start,
                stack_end   = final_stacks.get(player, 0),
            ))

        for i, act in enumerate(round_data.get("actions", [])):
            session.add(Action(
                round_id  = rnd.id,
                player    = act["player"],
                street    = act["street"],
                action    = act["action"],
                amount    = act.get("amount", 0),
                reasoning = act.get("reasoning", ""),
                sequence  = i,
            ))

        session.commit()
