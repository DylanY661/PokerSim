"""
test_game_engine.py — unit tests for pure (non-async) functions in game_engine.py.

No external services are touched; everything here runs in-process.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from game_engine import (
    shuffled_deck,
    _rank_five,
    _compare_hands,
    best_hand_of_7,
    _format_state,
    _parse_response,
    GameConfig,
    RANK_VAL,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def card(rank, suit):
    return {"rank": rank, "suit": suit}


def make_config(**kwargs):
    defaults = dict(
        mode="ollama",
        ollama_model="llama3.2:latest",
        player_count=3,
        starting_stack=1000,
        action_speed=0,
        prompts={},
        collections={},
    )
    defaults.update(kwargs)
    return GameConfig(**defaults)


# ── shuffled_deck ─────────────────────────────────────────────────────────────

class TestShuffledDeck:
    def test_has_52_cards(self):
        deck = shuffled_deck()
        assert len(deck) == 52

    def test_all_unique(self):
        deck = shuffled_deck()
        pairs = {(c["rank"], c["suit"]) for c in deck}
        assert len(pairs) == 52

    def test_each_card_has_rank_and_suit(self):
        deck = shuffled_deck()
        for c in deck:
            assert "rank" in c and "suit" in c

    def test_is_shuffled(self):
        # Chance of two identical 52-card shuffles is astronomically small
        results = [tuple((c["rank"], c["suit"]) for c in shuffled_deck()) for _ in range(3)]
        assert not (results[0] == results[1] == results[2]), "Deck appears unshuffled"


# ── _rank_five ────────────────────────────────────────────────────────────────

class TestRankFive:
    def test_straight_flush(self):
        hand = [card("9","H"), card("T","H"), card("J","H"), card("Q","H"), card("K","H")]
        result = _rank_five(hand)
        assert result["rank"] == 8
        assert result["name"] == "Straight Flush"
        assert result["tb"] == [RANK_VAL["K"]]

    def test_four_of_a_kind(self):
        hand = [card("A","S"), card("A","H"), card("A","D"), card("A","C"), card("K","S")]
        result = _rank_five(hand)
        assert result["rank"] == 7
        assert result["name"] == "Four of a Kind"
        assert result["tb"][0] == RANK_VAL["A"]

    def test_full_house(self):
        hand = [card("K","S"), card("K","H"), card("K","D"), card("Q","C"), card("Q","H")]
        result = _rank_five(hand)
        assert result["rank"] == 6
        assert result["name"] == "Full House"
        assert result["tb"][0] == RANK_VAL["K"]
        assert result["tb"][1] == RANK_VAL["Q"]

    def test_flush(self):
        hand = [card("2","H"), card("5","H"), card("7","H"), card("9","H"), card("J","H")]
        result = _rank_five(hand)
        assert result["rank"] == 5
        assert result["name"] == "Flush"

    def test_straight(self):
        hand = [card("5","S"), card("6","H"), card("7","D"), card("8","C"), card("9","S")]
        result = _rank_five(hand)
        assert result["rank"] == 4
        assert result["name"] == "Straight"
        assert result["tb"] == [RANK_VAL["9"]]

    def test_wheel_straight(self):
        # A-2-3-4-5: Ace plays low, high card is 5
        hand = [card("A","S"), card("2","H"), card("3","D"), card("4","C"), card("5","S")]
        result = _rank_five(hand)
        assert result["rank"] == 4
        assert result["name"] == "Straight"
        assert result["tb"] == [5]

    def test_three_of_a_kind(self):
        hand = [card("T","S"), card("T","H"), card("T","D"), card("3","C"), card("7","S")]
        result = _rank_five(hand)
        assert result["rank"] == 3
        assert result["name"] == "Three of a Kind"
        assert result["tb"][0] == RANK_VAL["T"]

    def test_two_pair(self):
        hand = [card("Q","S"), card("Q","H"), card("7","D"), card("7","C"), card("A","S")]
        result = _rank_five(hand)
        assert result["rank"] == 2
        assert result["name"] == "Two Pair"
        assert result["tb"][0] == RANK_VAL["Q"]
        assert result["tb"][1] == RANK_VAL["7"]
        assert result["tb"][2] == RANK_VAL["A"]

    def test_one_pair(self):
        hand = [card("J","S"), card("J","H"), card("2","D"), card("5","C"), card("9","S")]
        result = _rank_five(hand)
        assert result["rank"] == 1
        assert result["name"] == "One Pair"
        assert result["tb"][0] == RANK_VAL["J"]

    def test_high_card(self):
        hand = [card("2","S"), card("5","H"), card("7","D"), card("9","C"), card("J","S")]
        result = _rank_five(hand)
        assert result["rank"] == 0
        assert result["name"] == "High Card"
        assert result["tb"][0] == RANK_VAL["J"]

    def test_returns_rank_name_tb_keys(self):
        hand = [card("A","S"), card("K","H"), card("Q","D"), card("J","C"), card("9","S")]
        result = _rank_five(hand)
        assert "rank" in result
        assert "name" in result
        assert "tb" in result


# ── _compare_hands ────────────────────────────────────────────────────────────

class TestCompareHands:
    def test_higher_rank_wins(self):
        flush    = _rank_five([card("2","H"), card("5","H"), card("7","H"), card("9","H"), card("J","H")])
        straight = _rank_five([card("5","S"), card("6","H"), card("7","D"), card("8","C"), card("9","S")])
        assert _compare_hands(flush, straight) > 0

    def test_lower_rank_loses(self):
        straight = _rank_five([card("5","S"), card("6","H"), card("7","D"), card("8","C"), card("9","S")])
        flush    = _rank_five([card("2","H"), card("5","H"), card("7","H"), card("9","H"), card("J","H")])
        assert _compare_hands(straight, flush) < 0

    def test_same_rank_tiebreak_high_card_wins(self):
        ace_high   = _rank_five([card("A","S"), card("K","H"), card("Q","D"), card("J","C"), card("9","S")])
        king_high  = _rank_five([card("K","S"), card("Q","H"), card("J","D"), card("T","C"), card("8","S")])
        assert _compare_hands(ace_high, king_high) > 0

    def test_tie_returns_zero(self):
        hand_a = _rank_five([card("A","S"), card("K","H"), card("Q","D"), card("J","C"), card("9","S")])
        hand_b = _rank_five([card("A","D"), card("K","C"), card("Q","H"), card("J","S"), card("9","H")])
        assert _compare_hands(hand_a, hand_b) == 0


# ── best_hand_of_7 ────────────────────────────────────────────────────────────

class TestBestHandOf7:
    def test_finds_flush(self):
        # 5 hearts + 2 non-heart fillers
        seven = [
            card("2","H"), card("5","H"), card("7","H"), card("9","H"), card("J","H"),
            card("K","S"), card("A","D"),
        ]
        result = best_hand_of_7(seven)
        assert result is not None
        assert result["name"] == "Flush"

    def test_prefers_straight_flush_over_flush(self):
        # 9-T-J-Q-K of hearts is a straight flush; the remaining 2 add a plain flush option
        seven = [
            card("9","H"), card("T","H"), card("J","H"), card("Q","H"), card("K","H"),
            card("2","H"), card("3","H"),
        ]
        result = best_hand_of_7(seven)
        assert result is not None
        assert result["rank"] == 8

    def test_picks_best_pair_from_seven(self):
        # Contains a pair of Aces and lower cards — should find the pair
        seven = [
            card("A","S"), card("A","H"),
            card("2","D"), card("3","C"), card("5","S"), card("7","H"), card("9","D"),
        ]
        result = best_hand_of_7(seven)
        assert result is not None
        assert result["rank"] >= 1  # at least one pair

    def test_returns_none_for_empty(self):
        result = best_hand_of_7([])
        assert result is None

    def test_result_has_required_keys(self):
        seven = [
            card("A","S"), card("K","H"), card("Q","D"), card("J","C"), card("9","S"),
            card("3","H"), card("7","D"),
        ]
        result = best_hand_of_7(seven)
        assert result is not None
        assert {"rank", "name", "tb"}.issubset(result.keys())


# ── _format_state ─────────────────────────────────────────────────────────────

class TestFormatState:
    def _make_state(self, **overrides):
        base = {
            "hole_cards":      [card("A","S"), card("K","H")],
            "community_cards": [card("T","D"), card("J","C"), card("Q","S")],
            "pot":             150,
            "to_call":         50,
            "stack":           900,
            "street":          "flop",
        }
        base.update(overrides)
        return base

    def test_contains_all_section_labels(self):
        text = _format_state(self._make_state())
        for key in ("hole_cards", "community_cards", "pot", "to_call", "your_stack", "street", "valid_actions"):
            assert key in text, f"Missing key: {key}"

    def test_card_formatting(self):
        text = _format_state(self._make_state(hole_cards=[card("A","S")]))
        assert "AS" in text

    def test_empty_community_shows_none(self):
        text = _format_state(self._make_state(community_cards=[]))
        assert "none" in text

    def test_pot_value_present(self):
        text = _format_state(self._make_state(pot=999))
        assert "999" in text

    def test_street_value_present(self):
        text = _format_state(self._make_state(street="river"))
        assert "river" in text

    def test_valid_actions_listed(self):
        text = _format_state(self._make_state())
        assert "fold" in text
        assert "call" in text
        assert "raise" in text


# ── _parse_response ───────────────────────────────────────────────────────────

class TestParseResponse:
    def test_valid_json(self):
        text = '{"action":"raise","amount":50,"reasoning":"strong hand"}'
        result = _parse_response(text)
        assert result["action"] == "raise"
        assert result["amount"] == 50
        assert result["reasoning"] == "strong hand"

    def test_json_embedded_in_text(self):
        text = 'I think I should {"action":"fold","amount":0,"reasoning":"weak"} here.'
        result = _parse_response(text)
        assert result["action"] == "fold"

    def test_check_normalized_to_call(self):
        text = '{"action":"check","amount":0,"reasoning":"nothing to call"}'
        result = _parse_response(text)
        assert result["action"] == "call"

    def test_invalid_action_defaults_to_call(self):
        text = '{"action":"shove","amount":100,"reasoning":"yolo"}'
        result = _parse_response(text)
        assert result["action"] == "call"

    def test_no_json_returns_default_call(self):
        result = _parse_response("I have no idea what to do here.")
        assert result["action"] == "call"
        assert result["amount"] == 0

    def test_malformed_json_returns_default_call(self):
        result = _parse_response("{bad json: [}")
        assert result["action"] == "call"

    def test_amount_coerced_to_int(self):
        text = '{"action":"raise","amount":"75","reasoning":"bet"}'
        result = _parse_response(text)
        assert isinstance(result["amount"], int)
        assert result["amount"] == 75

    def test_missing_amount_defaults_to_zero(self):
        text = '{"action":"fold","reasoning":"bad hand"}'
        result = _parse_response(text)
        assert result["amount"] == 0

    def test_case_insensitive_action(self):
        text = '{"action":"FOLD","amount":0,"reasoning":"nope"}'
        result = _parse_response(text)
        assert result["action"] == "fold"

    def test_result_has_all_three_keys(self):
        text = '{"action":"call","amount":0,"reasoning":"ok"}'
        result = _parse_response(text)
        assert {"action", "amount", "reasoning"}.issubset(result.keys())


# ── GameConfig blinds ─────────────────────────────────────────────────────────

class TestGameConfig:
    def test_sb_one_percent_of_stack(self):
        cfg = make_config(starting_stack=1000)
        assert cfg.sb == 10

    def test_bb_is_double_sb(self):
        cfg = make_config(starting_stack=1000)
        assert cfg.bb == 20

    def test_sb_minimum_is_one(self):
        # 0.01 * 50 = 0.5 → rounds to 1 via max(1, round(...))
        cfg = make_config(starting_stack=50)
        assert cfg.sb == 1
        assert cfg.bb == 2

    def test_large_stack(self):
        cfg = make_config(starting_stack=10000)
        assert cfg.sb == 100
        assert cfg.bb == 200

    def test_sb_rounds_correctly(self):
        # 0.01 * 155 = 1.55 → round to 2
        cfg = make_config(starting_stack=155)
        assert cfg.sb == 2
        assert cfg.bb == 4
