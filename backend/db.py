import os
import json
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, create_engine, Session

_THIS_DIR    = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = f"sqlite:///{os.path.join(_THIS_DIR, 'poker.db')}"
engine       = create_engine(DATABASE_URL, echo=False)


class User(SQLModel, table=True):
    id:            Optional[int] = Field(default=None, primary_key=True)
    username:      str           = Field(unique=True, index=True)
    password_hash: Optional[str] = Field(default=None)  # None for OAuth-only accounts
    google_id:     Optional[str] = Field(default=None, unique=True, index=True)
    email:         Optional[str] = Field(default=None)
    created_at:    datetime      = Field(default_factory=datetime.utcnow)


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


def migrate_db():
    """Migrate existing DB schema — safe to run on every startup."""
    import sqlite3
    db_path = os.path.join(_THIS_DIR, 'poker.db')
    if not os.path.exists(db_path):
        return
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.execute("PRAGMA table_info(user)")
    col_info = {row[1]: row for row in cur.fetchall()}

    # Add new columns if missing
    if 'google_id' not in col_info:
        cur.execute("ALTER TABLE user ADD COLUMN google_id TEXT")
    if 'email' not in col_info:
        cur.execute("ALTER TABLE user ADD COLUMN email TEXT")

    # SQLite doesn't support ALTER COLUMN — if password_hash is still NOT NULL,
    # recreate the table so OAuth users (password_hash=NULL) can be inserted.
    cur.execute("PRAGMA table_info(user)")
    ph_row = next((r for r in cur.fetchall() if r[1] == 'password_hash'), None)
    if ph_row and ph_row[3] == 1:  # notnull flag
        cur.executescript("""
            PRAGMA foreign_keys = OFF;
            ALTER TABLE user RENAME TO _user_old;
            CREATE TABLE user (
                id            INTEGER PRIMARY KEY,
                username      VARCHAR NOT NULL,
                password_hash VARCHAR,
                google_id     TEXT,
                email         TEXT,
                created_at    DATETIME NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_user_username  ON user (username);
            CREATE UNIQUE INDEX IF NOT EXISTS ix_user_google_id ON user (google_id);
            INSERT INTO user (id, username, password_hash, google_id, email, created_at)
                SELECT id, username, password_hash,
                       NULL as google_id, NULL as email, created_at
                FROM _user_old;
            DROP TABLE _user_old;
            PRAGMA foreign_keys = ON;
        """)

    conn.commit()
    conn.close()


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
