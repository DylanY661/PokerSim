import asyncio
import json
import random
import re
from dataclasses import dataclass, field
from itertools import combinations
from typing import Callable, Awaitable, Optional
from gemini_browser import query_gemini_browser
from llm.ollama_client import generate as ollama_generate, OllamaError
from db import save_round as db_save_round

RANKS        = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']
SUITS        = ['S', 'H', 'D', 'C']
RANK_VAL     = {r: i + 2 for i, r in enumerate(RANKS)}
PLAYER_NAMES = ['Calculator', 'Shark', 'Gambler', 'Maniac', 'Rock']

#config
@dataclass
class GameConfig:
    mode:             str                    # "ollama" | "api" | "browser"
    ollama_model:     Optional[str]
    player_count:     int
    starting_stack:   int
    action_speed:     float                  # seconds between actions
    prompts:          dict                   # player_name → system prompt
    collections:      dict                   # player_name → chromadb collection
    gemini_client:    object                 = None
    browser_ready:    list                   = field(default_factory=lambda: [False])
    human_player:     Optional[str]          = None  # username of human seat, or None

    @property
    def sb(self) -> int:
        return max(1, round(self.starting_stack * 0.01))

    @property
    def bb(self) -> int:
        return self.sb * 2


# deck
def shuffled_deck() -> list[dict]:
    deck = [{'rank': r, 'suit': s} for r in RANKS for s in SUITS]
    random.shuffle(deck)
    return deck


# hand eval
def _rank_five(cards: list[dict]) -> dict:
    vals   = sorted([RANK_VAL[c['rank']] for c in cards], reverse=True)
    suits  = [c['suit'] for c in cards]
    counts: dict[int, int] = {}
    for v in vals:
        counts[v] = counts.get(v, 0) + 1
    groups   = sorted(counts.items(), key=lambda x: (x[1], x[0]), reverse=True)
    g_counts = [g[1] for g in groups]
    g_vals   = [g[0] for g in groups]
    is_flush = len(set(suits)) == 1
    uniq     = sorted(set(vals), reverse=True)

    is_straight, straight_hi = False, 0
    if len(uniq) == 5:
        if uniq[0] - uniq[4] == 4:
            is_straight, straight_hi = True, uniq[0]
        elif 14 in uniq and {2, 3, 4, 5}.issubset(set(uniq)):
            is_straight, straight_hi = True, 5

    if is_straight and is_flush:
        return {'rank': 8, 'name': 'Straight Flush',   'tb': [straight_hi]}
    if g_counts[0] == 4:
        return {'rank': 7, 'name': 'Four of a Kind',   'tb': [g_vals[0], g_vals[1] if len(g_vals) > 1 else 0]}
    if g_counts[0] == 3 and len(g_counts) > 1 and g_counts[1] >= 2:
        return {'rank': 6, 'name': 'Full House',        'tb': [g_vals[0], g_vals[1]]}
    if is_flush:
        return {'rank': 5, 'name': 'Flush',             'tb': vals[:5]}
    if is_straight:
        return {'rank': 4, 'name': 'Straight',          'tb': [straight_hi]}
    if g_counts[0] == 3:
        kickers = [v for v in vals if v != g_vals[0]][:2]
        return {'rank': 3, 'name': 'Three of a Kind',  'tb': [g_vals[0]] + kickers}
    if g_counts[0] == 2 and len(g_counts) > 1 and g_counts[1] == 2:
        kicker = next((v for v in vals if v != g_vals[0] and v != g_vals[1]), 0)
        return {'rank': 2, 'name': 'Two Pair',          'tb': [g_vals[0], g_vals[1], kicker]}
    if g_counts[0] == 2:
        kickers = [v for v in vals if v != g_vals[0]][:3]
        return {'rank': 1, 'name': 'One Pair',          'tb': [g_vals[0]] + kickers}
    return     {'rank': 0, 'name': 'High Card',         'tb': vals[:5]}


def _compare_hands(a: dict, b: dict) -> int:
    if a['rank'] != b['rank']:
        return a['rank'] - b['rank']
    for i in range(max(len(a['tb']), len(b['tb']))):
        av = a['tb'][i] if i < len(a['tb']) else 0
        bv = b['tb'][i] if i < len(b['tb']) else 0
        if av != bv:
            return av - bv
    return 0


def best_hand_of_7(cards: list[dict]) -> Optional[dict]:
    best = None
    for combo in combinations(cards, 5):
        h = _rank_five(list(combo))
        if best is None or _compare_hands(h, best) > 0:
            best = h
    return best


# AI actions
def _format_state(state: dict) -> str:
    def fmt(c): return f"{c.get('rank','?')}{c.get('suit','?')}"
    hole      = ", ".join(fmt(c) for c in state.get("hole_cards", []))
    community = ", ".join(fmt(c) for c in state.get("community_cards", [])) or "none"
    return (
        f"GAME STATE:\n"
        f"- hole_cards: {hole}\n"
        f"- community_cards: {community}\n"
        f"- pot: {state.get('pot', 0)}\n"
        f"- to_call: {state.get('to_call', 0)}\n"
        f"- your_stack: {state.get('stack', 0)}\n"
        f"- street: {state.get('street', 'preflop')}\n"
        f"- valid_actions: fold, call, raise"
    )


def _build_prompt(player: str, state: dict, config: GameConfig) -> str:
    state_text = _format_state(state)
    docs       = config.collections[player].query(query_texts=[state_text], n_results=3)
    snippets   = "\n\n".join(docs["documents"][0]) if docs["documents"][0] else ""
    return (
        f"{state_text}\n\n"
        f"Reference Material:\n{snippets}\n\n"
        'It\'s your turn. Respond in JSON: {"action": "fold|call|raise", "amount": 0, "reasoning": "..."}'
    )


def _parse_response(text: str) -> dict:
    match = re.search(r'\{[^{}]*\}', text, re.DOTALL)
    if not match:
        return {"action": "call", "amount": 0, "reasoning": "Could not parse response."}
    try:
        parsed = json.loads(match.group())
    except json.JSONDecodeError:
        return {"action": "call", "amount": 0, "reasoning": "JSON parse error."}
    action = parsed.get("action", "call").lower()
    if action == "check":
        action = "call"
    if action not in ("fold", "call", "raise"):
        action = "call"
    return {
        "action":    action,
        "amount":    int(parsed.get("amount", 0) or 0),
        "reasoning": str(parsed.get("reasoning", "")),
    }


async def get_ai_action(player: str, state: dict, config: GameConfig) -> dict:
    prompt = _build_prompt(player, state, config)

    if config.mode == "browser":
        text = await asyncio.to_thread(query_gemini_browser, prompt, player)
        return _parse_response(text)

    if config.mode == "ollama":
        def _call():
            return ollama_generate(
                prompt=prompt,
                system_prompt=config.prompts[player],
                params={"temperature": 0.0, "max_tokens": 256},
                model=config.ollama_model,
            )
        try:
            text = await asyncio.to_thread(_call)
            return _parse_response(text)
        except OllamaError as e:
            raise RuntimeError(f"Ollama error: {e}")

    # API mode
    if config.gemini_client is None:
        raise RuntimeError("GEMINI_API_KEY not set in .env")
    def _call_api():
        chat = config.gemini_client.chats.create(model="gemini-2.5-flash")
        chat.send_message(config.prompts[player])
        return chat.send_message(prompt)
    resp = await asyncio.to_thread(_call_api)
    return _parse_response(resp.text)

# Street

#Manages a street of poker round
async def _run_street(
    players:        list[str],
    stacks:         dict,
    pot:            int,
    community:      list[dict],
    street_name:    str,
    initial_to_call: int,
    hole_cards:     dict,
    config:         GameConfig,
    stop_check:     Callable[[], bool],
    emit:           Callable[[dict], Awaitable[None]],
    actions_log:    list,
    action_queue=None,
) -> dict:
    s               = dict(stacks)
    p               = pot
    folded:         set[str] = set()
    all_in:         set[str] = set()
    contributed     = {pl: 0 for pl in players}
    to_call         = initial_to_call
    last_raise_size = config.bb

    for player in players:
        if stop_check():
            break
        if s.get(player, 0) <= 0:
            continue

        need_to_call = max(0, to_call - contributed[player])
        await emit({"type": "thinking", "player": player})

        state = {
            "hole_cards":      hole_cards[player],
            "community_cards": community,
            "pot":             p,
            "to_call":         need_to_call,
            "stack":           s[player],
            "street":          street_name,
        }
        if config.human_player and player == config.human_player:
            # Wait for a human action from the WebSocket
            await emit({
                "type":         "action_required",
                "player":       player,
                "to_call":      need_to_call,
                "pot":          p,
                "stack":        s[player],
                "min_raise":    need_to_call + last_raise_size,
                "valid_actions": ["fold", "call", "raise"],
            })
            try:
                raw = await asyncio.wait_for(action_queue.get(), timeout=300)
                result = {
                    "action":    raw.get("action", "fold"),
                    "amount":    int(raw.get("amount", 0) or 0),
                    "reasoning": "Human action",
                }
            except asyncio.TimeoutError:
                result = {"action": "fold", "amount": 0, "reasoning": "Timed out — auto-folded"}
        else:
            try:
                result = await get_ai_action(player, state, config)
            except Exception as e:
                result = {"action": "call", "amount": need_to_call, "reasoning": f"Error: {e}"}
                await emit({"type": "error", "message": str(e)})

        action    = result["action"]
        amount    = result.get("amount", 0)
        reasoning = result.get("reasoning", "")

        if action == "fold":
            folded.add(player)
            emitted_amount = 0
        elif action == "raise":
            extra      = amount if amount > 0 else config.bb
            call_part  = min(need_to_call, s[player])
            raise_part = min(extra, s[player] - call_part)
            total      = call_part + raise_part
            s[player]      -= total
            p              += total
            contributed[player] += total
            to_call         = contributed[player]
            last_raise_size = max(raise_part, config.bb)
            emitted_amount  = total
        else:  # call
            call_amt = min(need_to_call, s[player])
            s[player]      -= call_amt
            p              += call_amt
            contributed[player] += call_amt
            emitted_amount  = call_amt

        if s.get(player, 0) == 0 and action != "fold":
            all_in.add(player)

        event = {
            "type":      "action",
            "player":    player,
            "street":    street_name,
            "action":    action,
            "amount":    emitted_amount,
            "reasoning": reasoning,
            "stacks":    dict(s),
            "pot":       p,
            "folded":    list(folded),
            "all_in":    list(all_in),
        }
        await emit(event)
        if action not in ("blind",):
            actions_log.append({"player": player, "street": street_name, "action": action,
                                 "amount": emitted_amount, "reasoning": reasoning})

        # End street immediately once only one player remains
        if len([pl for pl in players if pl not in folded]) <= 1:
            break

        if config.action_speed > 0:
            await asyncio.sleep(config.action_speed)

    still_active = [pl for pl in players if pl not in folded]
    return {"stacks": s, "pot": p, "still_active": still_active, "all_in": list(all_in)}


# Round

#Manages a full round of poker
async def run_round(
    game_id:        int,
    round_number:   int,
    game_stacks:    dict,   
    dealer_idx:     int,
    config:         GameConfig,
    stop_check:     Callable[[], bool],
    emit:           Callable[[dict], Awaitable[None]],
    action_queue=None,
):
    players = [p for p in game_stacks if game_stacks[p] > 0]

    # Tournament already decided
    if len(players) <= 1:
        if players:
            await emit({"type": "game_end", "champion": players[0]})
        return

    n     = len(players)
    d     = dealer_idx % n
    sb_i  = (d + 1) % n
    bb_i  = (d + 2) % n
    utg_i = (d + 3) % n

    dealer_name = players[d]
    sb_player   = players[sb_i]
    bb_player   = players[bb_i]

    # Deal
    deck          = shuffled_deck()
    hole_cards    = {p: [deck[i * 2], deck[i * 2 + 1]] for i, p in enumerate(players)}
    community_deck = deck[n * 2: n * 2 + 5]

    await emit({
        "type":         "deal",
        "players":      players,
        "hole_cards":   hole_cards,
        "dealer":       dealer_name,
        "sb":           sb_player,
        "bb":           bb_player,
        "round_number": round_number,
    })

    # Post blinds
    s       = {p: game_stacks.get(p, 0) for p in players}
    sb_amt  = min(config.sb, s[sb_player])
    bb_amt  = min(config.bb, s[bb_player])
    s[sb_player] -= sb_amt
    s[bb_player] -= bb_amt
    pot            = sb_amt + bb_amt

    all_in: set[str] = set()
    for bp, ba, label in [(sb_player, sb_amt, "small blind"), (bb_player, bb_amt, "big blind")]:
        if s[bp] == 0:
            all_in.add(bp)
        await emit({
            "type": "action", "player": bp, "street": "preflop",
            "action": "blind", "amount": ba,
            "reasoning": f"Posts {label} of ${ba}",
            "stacks": dict(s), "pot": pot,
            "folded": [], "all_in": list(all_in),
        })

    actions_log: list[dict] = []
    initial_stacks = dict(game_stacks)  # snapshot before round

    async def play_street(street_name, community, cur_stacks, cur_pot, active, init_call):
        await emit({"type": "street", "street": street_name, "community_cards": community})
        return await _run_street(
            active, cur_stacks, cur_pot, community, street_name,
            init_call, hole_cards, config, stop_check, emit, actions_log,
            action_queue=action_queue,
        )

    # PREFLOP
    preflop_order = players[utg_i:] + players[:utg_i]
    res = await play_street("preflop", [], s, pot, preflop_order, config.bb)
    if stop_check(): return
    s, pot = res["stacks"], res["pot"]
    all_in.update(res["all_in"])
    if len(res["still_active"]) <= 1:
        await _finish(res["still_active"], pot, s, hole_cards, community_deck, all_in,
                      initial_stacks, players, game_id, round_number, dealer_name,
                      sb_player, bb_player, actions_log, emit)
        game_stacks.update(s)
        if res["still_active"]:
            game_stacks[res["still_active"][0]] = game_stacks.get(res["still_active"][0], 0) + pot
        return

    # FLOP
    flop = community_deck[:3]
    res  = await play_street("flop", flop, s, pot, res["still_active"], 0)
    if stop_check(): return
    s, pot = res["stacks"], res["pot"]
    all_in.update(res["all_in"])
    if len(res["still_active"]) <= 1:
        await _finish(res["still_active"], pot, s, hole_cards, community_deck, all_in,
                      initial_stacks, players, game_id, round_number, dealer_name,
                      sb_player, bb_player, actions_log, emit)
        game_stacks.update(s)
        if res["still_active"]:
            game_stacks[res["still_active"][0]] = game_stacks.get(res["still_active"][0], 0) + pot
        return

    # TURN
    turn = community_deck[:4]
    res  = await play_street("turn", turn, s, pot, res["still_active"], 0)
    if stop_check(): return
    s, pot = res["stacks"], res["pot"]
    all_in.update(res["all_in"])
    if len(res["still_active"]) <= 1:
        await _finish(res["still_active"], pot, s, hole_cards, community_deck, all_in,
                      initial_stacks, players, game_id, round_number, dealer_name,
                      sb_player, bb_player, actions_log, emit)
        game_stacks.update(s)
        if res["still_active"]:
            game_stacks[res["still_active"][0]] = game_stacks.get(res["still_active"][0], 0) + pot
        return

    # RIVER
    river = community_deck[:5]
    res   = await play_street("river", river, s, pot, res["still_active"], 0)
    if stop_check(): return
    s, pot = res["stacks"], res["pot"]

    # SHOWDOWN
    survivors    = res["still_active"]
    best_hand    = None
    tied_winners = []
    for player in survivors:
        seven = hole_cards[player] + river
        hand  = best_hand_of_7(seven)
        if best_hand is None:
            best_hand, tied_winners = hand, [player]
        elif _compare_hands(hand, best_hand) > 0:
            best_hand, tied_winners = hand, [player]
        elif _compare_hands(hand, best_hand) == 0:
            tied_winners.append(player)

    await _finish(tied_winners, pot, s, hole_cards, community_deck, all_in,
                  initial_stacks, players, game_id, round_number, dealer_name,
                  sb_player, bb_player, actions_log, emit, best_hand)

    # Update the shared game_stacks dict so main.py sees the new balances
    game_stacks.update(s)
    if tied_winners:
        share     = pot // len(tied_winners)
        remainder = pot % len(tied_winners)
        for w in tied_winners:
            game_stacks[w] = game_stacks.get(w, 0) + share
        game_stacks[tied_winners[0]] = game_stacks.get(tied_winners[0], 0) + remainder


async def _finish(
    still_active, pot, final_stacks, hole_cards, community_deck, all_in,
    initial_stacks, players, game_id, round_number, dealer, sb, bb,
    actions_log, emit, winner_hand=None,
):
    winner    = still_active[0] if still_active else None
    hand_name = winner_hand['name'] if winner_hand else None

    # Build new stacks with pot awarded (split on tie)
    new_stacks = dict(final_stacks)
    if still_active:
        share     = pot // len(still_active)
        remainder = pot % len(still_active)
        for w in still_active:
            new_stacks[w] = new_stacks.get(w, 0) + share
        new_stacks[still_active[0]] = new_stacks.get(still_active[0], 0) + remainder

    # Bust-outs: had chips entering round, now at 0
    busted = [p for p in players
              if p not in still_active and final_stacks.get(p, 0) == 0 and initial_stacks.get(p, 0) > 0]

    await emit({
        "type":        "round_end",
        "winner":      winner,
        "tied_winners": still_active if len(still_active) > 1 else None,
        "hand":        hand_name,
        "pot":         pot,
        "stacks":      new_stacks,
        "busted":      busted,
        "hole_cards":  hole_cards,   # reveal all hands at showdown
    })

    # Check for tournament end
    # Use initial_stacks keys as the authoritative player list for this game
    all_game_players = list(initial_stacks.keys())
    remaining = [p for p in all_game_players if new_stacks.get(p, 0) > 0]
    if len(remaining) == 1:
        await emit({"type": "game_end", "champion": remaining[0]})

    # Persist to DB
    await asyncio.to_thread(db_save_round, {
        "game_id":         game_id,
        "round_number":    round_number,
        "dealer":          dealer,
        "sb":              sb,
        "bb":              bb,
        "pot":             pot,
        "community_cards": community_deck[:5],
        "winner":          winner,
        "winning_hand":    hand_name,
        "initial_stacks":  {p: initial_stacks.get(p, 0) for p in players},
        "final_stacks":    new_stacks,
        "actions":         actions_log,
    })
