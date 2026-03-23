"""
test_db.py — unit tests for db.py using an in-memory SQLite engine.

The monkeypatch fixture replaces db.engine and db.get_session so that
no data is written to the real poker.db file.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import json
import pytest
from sqlmodel import create_engine, SQLModel, Session, select

import db as db_module
from db import Round, PlayerStack, Action, Game, save_round


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture()
def in_memory_engine(monkeypatch):
    """Create a fresh in-memory SQLite engine and patch db module to use it."""
    engine = create_engine("sqlite:///:memory:", echo=False)
    SQLModel.metadata.create_all(engine)

    monkeypatch.setattr(db_module, "engine", engine)
    monkeypatch.setattr(db_module, "get_session", lambda: Session(engine))
    return engine


@pytest.fixture()
def game_id(in_memory_engine):
    """Insert a Game row and return its id so Round FK constraints are satisfied."""
    with Session(in_memory_engine) as session:
        game = Game(player_count=3, starting_stack=1000, ai_mode="ollama")
        session.add(game)
        session.commit()
        session.refresh(game)
        return game.id


def minimal_round_data(game_id):
    return {
        "game_id":        game_id,
        "round_number":   1,
        "dealer":         "Calculator",
        "sb":             "Shark",
        "bb":             "Gambler",
        "pot":            300,
        "community_cards": [{"rank": "A", "suit": "S"}, {"rank": "K", "suit": "H"},
                             {"rank": "Q", "suit": "D"}, {"rank": "J", "suit": "C"},
                             {"rank": "T", "suit": "H"}],
        "winner":         "Calculator",
        "winning_hand":   "Straight Flush",
        "initial_stacks": {"Calculator": 1000, "Shark": 1000, "Gambler": 1000},
        "final_stacks":   {"Calculator": 1300, "Shark": 850,  "Gambler": 850},
        "actions":        [],
    }


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestSaveRound:
    def test_creates_round_record(self, in_memory_engine, game_id):
        save_round(minimal_round_data(game_id))
        with Session(in_memory_engine) as s:
            rounds = s.exec(select(Round)).all()
        assert len(rounds) == 1
        assert rounds[0].pot    == 300
        assert rounds[0].winner == "Calculator"

    def test_round_dealer_sb_bb(self, in_memory_engine, game_id):
        save_round(minimal_round_data(game_id))
        with Session(in_memory_engine) as s:
            rnd = s.exec(select(Round)).first()
        assert rnd.dealer == "Calculator"
        assert rnd.sb     == "Shark"
        assert rnd.bb     == "Gambler"

    def test_creates_player_stacks(self, in_memory_engine, game_id):
        save_round(minimal_round_data(game_id))
        with Session(in_memory_engine) as s:
            stacks = s.exec(select(PlayerStack)).all()
        assert len(stacks) == 3
        by_player = {ps.player: ps for ps in stacks}
        assert by_player["Calculator"].stack_start == 1000
        assert by_player["Calculator"].stack_end   == 1300
        assert by_player["Shark"].stack_start      == 1000
        assert by_player["Shark"].stack_end        == 850

    def test_creates_actions_in_order(self, in_memory_engine, game_id):
        data = minimal_round_data(game_id)
        data["actions"] = [
            {"player": "Calculator", "street": "preflop", "action": "raise",  "amount": 50,  "reasoning": "strong"},
            {"player": "Shark",      "street": "preflop", "action": "fold",   "amount": 0,   "reasoning": "weak"},
            {"player": "Gambler",    "street": "preflop", "action": "call",   "amount": 50,  "reasoning": "ok"},
        ]
        save_round(data)
        with Session(in_memory_engine) as s:
            actions = s.exec(select(Action).order_by(Action.sequence)).all()
        assert len(actions) == 3
        assert actions[0].sequence == 0 and actions[0].player == "Calculator"
        assert actions[1].sequence == 1 and actions[1].player == "Shark"
        assert actions[2].sequence == 2 and actions[2].player == "Gambler"

    def test_community_cards_serialized_as_json(self, in_memory_engine, game_id):
        data = minimal_round_data(game_id)
        save_round(data)
        with Session(in_memory_engine) as s:
            rnd = s.exec(select(Round)).first()
        parsed = json.loads(rnd.community_cards)
        assert len(parsed) == 5
        assert parsed[0]["rank"] == "A" and parsed[0]["suit"] == "S"

    def test_empty_community_cards(self, in_memory_engine, game_id):
        data = minimal_round_data(game_id)
        data["community_cards"] = []
        save_round(data)
        with Session(in_memory_engine) as s:
            rnd = s.exec(select(Round)).first()
        assert json.loads(rnd.community_cards) == []

    def test_empty_actions(self, in_memory_engine, game_id):
        save_round(minimal_round_data(game_id))
        with Session(in_memory_engine) as s:
            actions = s.exec(select(Action)).all()
        assert len(actions) == 0

    def test_multiple_rounds_same_game(self, in_memory_engine, game_id):
        d1 = minimal_round_data(game_id)
        d1["round_number"] = 1
        d2 = minimal_round_data(game_id)
        d2["round_number"] = 2
        save_round(d1)
        save_round(d2)
        with Session(in_memory_engine) as s:
            rounds = s.exec(select(Round)).all()
        assert len(rounds) == 2

    def test_action_fields_persisted(self, in_memory_engine, game_id):
        data = minimal_round_data(game_id)
        data["actions"] = [
            {"player": "Shark", "street": "flop", "action": "raise",
             "amount": 100, "reasoning": "nut flush draw"},
        ]
        save_round(data)
        with Session(in_memory_engine) as s:
            action = s.exec(select(Action)).first()
        assert action.player    == "Shark"
        assert action.street    == "flop"
        assert action.action    == "raise"
        assert action.amount    == 100
        assert action.reasoning == "nut flush draw"

    def test_winner_is_none_when_not_provided(self, in_memory_engine, game_id):
        data = minimal_round_data(game_id)
        data["winner"]       = None
        data["winning_hand"] = None
        save_round(data)
        with Session(in_memory_engine) as s:
            rnd = s.exec(select(Round)).first()
        assert rnd.winner       is None
        assert rnd.winning_hand is None
