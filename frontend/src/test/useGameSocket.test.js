import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameSocket } from '../hooks/useGameSocket';

// Mock the entire api module so openGameSocket never hits the network
vi.mock('../api', () => ({
  openGameSocket: vi.fn(),
}));

import { openGameSocket } from '../api';

// ── Mock WebSocket factory ────────────────────────────────────────────────────

function makeMockWs() {
  return {
    onmessage: null,
    onerror:   null,
    onclose:   null,
    onopen:    null,
    send:      vi.fn(),
    close:     vi.fn(),
    readyState: 1, // WebSocket.OPEN
  };
}

function dispatch(mockWs, data) {
  act(() => {
    mockWs.onmessage({ data: JSON.stringify(data) });
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Initial state ─────────────────────────────────────────────────────────────

describe('useGameSocket — initial state', () => {
  it('holeCards starts empty', () => {
    const { result } = renderHook(() => useGameSocket(vi.fn()));
    expect(result.current.holeCards).toEqual({});
  });

  it('pot starts at 0', () => {
    const { result } = renderHook(() => useGameSocket(vi.fn()));
    expect(result.current.pot).toBe(0);
  });

  it('gameRunning starts false', () => {
    const { result } = renderHook(() => useGameSocket(vi.fn()));
    expect(result.current.gameRunning).toBe(false);
  });

  it('communityCards starts empty', () => {
    const { result } = renderHook(() => useGameSocket(vi.fn()));
    expect(result.current.communityCards).toEqual([]);
  });

  it('roundComplete starts false', () => {
    const { result } = renderHook(() => useGameSocket(vi.fn()));
    expect(result.current.roundComplete).toBe(false);
  });

  it('tournamentWinner starts null', () => {
    const { result } = renderHook(() => useGameSocket(vi.fn()));
    expect(result.current.tournamentWinner).toBeNull();
  });

  it('gameLog starts empty', () => {
    const { result } = renderHook(() => useGameSocket(vi.fn()));
    expect(result.current.gameLog).toEqual([]);
  });
});

// ── Shared setup helper ───────────────────────────────────────────────────────
// connect() synchronously assigns ws.onmessage / ws.onopen etc., so we call
// connect() first and then fire onopen in the same act() to resolve the promise.

function setupConnected(onError = vi.fn()) {
  const mockWs = makeMockWs();
  openGameSocket.mockReturnValue(mockWs);
  const { result } = renderHook(() => useGameSocket(onError));
  act(() => {
    result.current.connect(1);  // sets ws.onmessage, ws.onopen, etc.
    mockWs.onopen();             // resolve the connect() promise → sets wsRef.current
  });
  return { result, mockWs };
}

// ── deal event ────────────────────────────────────────────────────────────────

describe('useGameSocket — deal event', () => {
  function setup() {
    return setupConnected();
  }

  it('sets hole cards', () => {
    const { result, mockWs } = setup();
    dispatch(mockWs, {
      type: 'deal',
      hole_cards: { Calculator: [{ rank: 'A', suit: 'S' }] },
      dealer: 'Calculator', sb: 'Shark', bb: 'Gambler', round_number: 1,
    });
    expect(result.current.holeCards).toEqual({ Calculator: [{ rank: 'A', suit: 'S' }] });
  });

  it('sets dealer name', () => {
    const { result, mockWs } = setup();
    dispatch(mockWs, { type: 'deal', hole_cards: {}, dealer: 'Shark', sb: 'Gambler', bb: 'Rock', round_number: 2 });
    expect(result.current.dealerName).toBe('Shark');
  });

  it('sets SB name', () => {
    const { result, mockWs } = setup();
    dispatch(mockWs, { type: 'deal', hole_cards: {}, dealer: 'X', sb: 'Gambler', bb: 'Y', round_number: 1 });
    expect(result.current.sbName).toBe('Gambler');
  });

  it('sets BB name', () => {
    const { result, mockWs } = setup();
    dispatch(mockWs, { type: 'deal', hole_cards: {}, dealer: 'X', sb: 'Y', bb: 'Rock', round_number: 1 });
    expect(result.current.bbName).toBe('Rock');
  });

  it('sets round number', () => {
    const { result, mockWs } = setup();
    dispatch(mockWs, { type: 'deal', hole_cards: {}, dealer: 'X', sb: 'Y', bb: 'Z', round_number: 5 });
    expect(result.current.roundNumber).toBe(5);
  });

  it('sets gameRunning to true', () => {
    const { result, mockWs } = setup();
    dispatch(mockWs, { type: 'deal', hole_cards: {}, dealer: 'X', sb: 'Y', bb: 'Z', round_number: 1 });
    expect(result.current.gameRunning).toBe(true);
  });

  it('clears gameLog on new deal', () => {
    const { result, mockWs } = setup();
    // First add an action to the log
    dispatch(mockWs, {
      type: 'action', player: 'X', street: 'preflop', action: 'fold',
      amount: 0, reasoning: '', stacks: {}, pot: 0, folded: [], all_in: [],
    });
    expect(result.current.gameLog.length).toBe(1);
    // Now deal again — should clear log
    dispatch(mockWs, { type: 'deal', hole_cards: {}, dealer: 'X', sb: 'Y', bb: 'Z', round_number: 2 });
    expect(result.current.gameLog).toEqual([]);
  });

  it('resets roundComplete to false on deal', () => {
    const { result, mockWs } = setup();
    dispatch(mockWs, { type: 'deal', hole_cards: {}, dealer: 'X', sb: 'Y', bb: 'Z', round_number: 1 });
    expect(result.current.roundComplete).toBe(false);
  });
});

// ── street event ──────────────────────────────────────────────────────────────

describe('useGameSocket — street event', () => {
  function setup() {
    return setupConnected();
  }

  it('sets community cards', () => {
    const { result, mockWs } = setup();
    const flop = [{ rank: 'T', suit: 'H' }, { rank: 'J', suit: 'D' }, { rank: 'Q', suit: 'S' }];
    dispatch(mockWs, { type: 'street', street: 'flop', community_cards: flop });
    expect(result.current.communityCards).toEqual(flop);
  });

  it('sets street name', () => {
    const { result, mockWs } = setup();
    dispatch(mockWs, { type: 'street', street: 'turn', community_cards: [] });
    expect(result.current.street).toBe('turn');
  });

  it('resets playerActions on new street', () => {
    const { result, mockWs } = setup();
    dispatch(mockWs, {
      type: 'action', player: 'Shark', street: 'preflop', action: 'raise',
      amount: 50, reasoning: '', stacks: {}, pot: 50, folded: [], all_in: [],
    });
    dispatch(mockWs, { type: 'street', street: 'flop', community_cards: [] });
    expect(result.current.playerActions).toEqual({});
  });
});

// ── thinking event ────────────────────────────────────────────────────────────

describe('useGameSocket — thinking event', () => {
  it('sets activePlayer', () => {
    const { result, mockWs } = setupConnected();
    dispatch(mockWs, { type: 'thinking', player: 'Rock' });
    expect(result.current.activePlayer).toBe('Rock');
  });
});

// ── action event ──────────────────────────────────────────────────────────────

describe('useGameSocket — action event', () => {
  function setup() {
    return setupConnected();
  }

  it('updates stacks', () => {
    const { result, mockWs } = setup();
    dispatch(mockWs, {
      type: 'action', player: 'Shark', street: 'preflop', action: 'raise',
      amount: 50, reasoning: '', stacks: { Shark: 950, Calculator: 1000 }, pot: 100,
      folded: [], all_in: [],
    });
    expect(result.current.stacks.Shark).toBe(950);
    expect(result.current.stacks.Calculator).toBe(1000);
  });

  it('updates pot', () => {
    const { result, mockWs } = setup();
    dispatch(mockWs, {
      type: 'action', player: 'X', street: 'preflop', action: 'call',
      amount: 20, reasoning: '', stacks: {}, pot: 220, folded: [], all_in: [],
    });
    expect(result.current.pot).toBe(220);
  });

  it('appends entry to gameLog', () => {
    const { result, mockWs } = setup();
    dispatch(mockWs, {
      type: 'action', player: 'Calculator', street: 'preflop', action: 'raise',
      amount: 50, reasoning: 'strong hand', stacks: {}, pot: 100, folded: [], all_in: [],
    });
    expect(result.current.gameLog.length).toBe(1);
    expect(result.current.gameLog[0].player).toBe('Calculator');
    expect(result.current.gameLog[0].action).toBe('raise');
  });

  it('tracks folded players', () => {
    const { result, mockWs } = setup();
    dispatch(mockWs, {
      type: 'action', player: 'Shark', street: 'preflop', action: 'fold',
      amount: 0, reasoning: '', stacks: {}, pot: 0, folded: ['Shark'], all_in: [],
    });
    expect(result.current.foldedPlayers.has('Shark')).toBe(true);
  });

  it('tracks all-in players', () => {
    const { result, mockWs } = setup();
    dispatch(mockWs, {
      type: 'action', player: 'Gambler', street: 'preflop', action: 'raise',
      amount: 1000, reasoning: '', stacks: { Gambler: 0 }, pot: 2000,
      folded: [], all_in: ['Gambler'],
    });
    expect(result.current.allInPlayers.has('Gambler')).toBe(true);
  });

  it('clears activePlayer on action', () => {
    const { result, mockWs } = setup();
    dispatch(mockWs, { type: 'thinking', player: 'Rock' });
    expect(result.current.activePlayer).toBe('Rock');
    dispatch(mockWs, {
      type: 'action', player: 'Rock', street: 'preflop', action: 'fold',
      amount: 0, reasoning: '', stacks: {}, pot: 0, folded: [], all_in: [],
    });
    expect(result.current.activePlayer).toBeNull();
  });
});

// ── round_end event ───────────────────────────────────────────────────────────

describe('useGameSocket — round_end event', () => {
  function setup() {
    return setupConnected();
  }

  it('sets lastWinner with name, amount, handName', () => {
    const { result, mockWs } = setup();
    dispatch(mockWs, {
      type: 'round_end', winner: 'Calculator', pot: 300, hand: 'Flush',
      stacks: {}, busted: [], hole_cards: {},
    });
    expect(result.current.lastWinner).toEqual({ name: 'Calculator', amount: 300, handName: 'Flush' });
  });

  it('sets gameRunning to false', () => {
    const { result, mockWs } = setup();
    dispatch(mockWs, { type: 'round_end', winner: 'X', pot: 0, hand: null, stacks: {}, busted: [] });
    expect(result.current.gameRunning).toBe(false);
  });

  it('sets roundComplete to true', () => {
    const { result, mockWs } = setup();
    dispatch(mockWs, { type: 'round_end', winner: 'X', pot: 0, hand: null, stacks: {}, busted: [] });
    expect(result.current.roundComplete).toBe(true);
  });

  it('resets pot to 0', () => {
    const { result, mockWs } = setup();
    dispatch(mockWs, { type: 'round_end', winner: 'X', pot: 500, hand: null, stacks: {}, busted: [] });
    expect(result.current.pot).toBe(0);
  });

  it('appends bust entries to gameLog', () => {
    const { result, mockWs } = setup();
    dispatch(mockWs, {
      type: 'round_end', winner: 'Calculator', pot: 0, hand: null,
      stacks: {}, busted: ['Maniac'],
    });
    const bustEntry = result.current.gameLog.find(e => e.player === 'Maniac');
    expect(bustEntry).toBeDefined();
    expect(bustEntry.action).toBe('bust');
  });

  it('does not append bust entry when busted array is empty', () => {
    const { result, mockWs } = setup();
    dispatch(mockWs, { type: 'round_end', winner: 'X', pot: 0, hand: null, stacks: {}, busted: [] });
    expect(result.current.gameLog.filter(e => e.action === 'bust').length).toBe(0);
  });
});

// ── game_end event ────────────────────────────────────────────────────────────

describe('useGameSocket — game_end event', () => {
  it('sets tournamentWinner', () => {
    const { result, mockWs } = setupConnected();
    dispatch(mockWs, { type: 'game_end', champion: 'Rock' });
    expect(result.current.tournamentWinner).toBe('Rock');
  });
});

// ── error event ───────────────────────────────────────────────────────────────

describe('useGameSocket — error event', () => {
  it('calls onError callback with message', () => {
    const onError = vi.fn();
    const { mockWs } = setupConnected(onError);
    dispatch(mockWs, { type: 'error', message: 'something failed' });
    expect(onError).toHaveBeenCalledWith('something failed');
  });
});

// ── resetGameState ────────────────────────────────────────────────────────────

describe('useGameSocket — resetGameState', () => {
  it('clears all state back to defaults', () => {
    const { result, mockWs } = setupConnected();

    // Set some state
    dispatch(mockWs, {
      type: 'deal', hole_cards: { X: [] }, dealer: 'X', sb: 'Y', bb: 'Z', round_number: 3,
    });
    dispatch(mockWs, { type: 'game_end', champion: 'Rock' });

    // Reset
    act(() => { result.current.resetGameState(); });

    expect(result.current.holeCards).toEqual({});
    expect(result.current.pot).toBe(0);
    expect(result.current.gameRunning).toBe(false);
    expect(result.current.roundNumber).toBe(0);
    expect(result.current.tournamentWinner).toBeNull();
    expect(result.current.gameLog).toEqual([]);
    expect(result.current.dealerName).toBeNull();
    expect(result.current.lastWinner).toBeNull();
  });
});

// ── sendStop ──────────────────────────────────────────────────────────────────

describe('useGameSocket — sendStop', () => {
  it('sends stop message when socket is OPEN', () => {
    const { result, mockWs } = setupConnected();

    act(() => {
      result.current.sendStop();
    });

    expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ type: 'stop' }));
  });

  it('does not send when socket is null', () => {
    const { result } = renderHook(() => useGameSocket(vi.fn()));
    // wsRef.current is null; no socket connected
    act(() => { result.current.sendStop(); });
    // No error thrown
  });
});
