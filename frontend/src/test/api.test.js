import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock axios before importing api.js
vi.mock('axios', () => ({
  default: {
    get:    vi.fn(),
    post:   vi.fn(),
    delete: vi.fn(),
  },
}));

import axios from 'axios';
import {
  healthCheck,
  getBrowserStatus,
  createGame,
  startNextRound,
  stopGame,
  listGames,
  getGame,
  openGameSocket,
} from '../api';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── healthCheck ───────────────────────────────────────────────────────────────

describe('healthCheck', () => {
  it('calls GET /api/', async () => {
    axios.get.mockResolvedValue({ data: { message: 'Poker Backend Running' } });
    const result = await healthCheck();
    expect(axios.get).toHaveBeenCalledWith('/api/');
    expect(result).toEqual({ message: 'Poker Backend Running' });
  });
});

// ── getBrowserStatus ──────────────────────────────────────────────────────────

describe('getBrowserStatus', () => {
  it('calls GET /api/browser/status', async () => {
    axios.get.mockResolvedValue({ data: { ready: false } });
    const result = await getBrowserStatus();
    expect(axios.get).toHaveBeenCalledWith('/api/browser/status');
    expect(result).toEqual({ ready: false });
  });
});

// ── createGame ────────────────────────────────────────────────────────────────

describe('createGame', () => {
  it('converts actionSpeed from ms to seconds', async () => {
    axios.post.mockResolvedValue({ data: { game_id: 1 } });
    await createGame({
      playerCount: 3, startingStack: 1000, aiMode: 'ollama',
      ollamaModel: 'llama3.2:latest', actionSpeed: 2000,
    });
    const sentPayload = axios.post.mock.calls[0][1];
    expect(sentPayload.action_speed).toBeCloseTo(2.0);
  });

  it('sends action_speed=1 for 1000ms', async () => {
    axios.post.mockResolvedValue({ data: { game_id: 1 } });
    await createGame({ playerCount: 3, startingStack: 1000, aiMode: 'ollama', ollamaModel: null, actionSpeed: 1000 });
    const sentPayload = axios.post.mock.calls[0][1];
    expect(sentPayload.action_speed).toBeCloseTo(1.0);
  });

  it('sends null ollama_model when ollamaModel is empty string', async () => {
    axios.post.mockResolvedValue({ data: { game_id: 1 } });
    await createGame({ playerCount: 3, startingStack: 1000, aiMode: 'ollama', ollamaModel: '', actionSpeed: 1000 });
    const sentPayload = axios.post.mock.calls[0][1];
    expect(sentPayload.ollama_model).toBeNull();
  });

  it('sends null ollama_model when ollamaModel is null', async () => {
    axios.post.mockResolvedValue({ data: { game_id: 1 } });
    await createGame({ playerCount: 3, startingStack: 1000, aiMode: 'ollama', ollamaModel: null, actionSpeed: 1000 });
    const sentPayload = axios.post.mock.calls[0][1];
    expect(sentPayload.ollama_model).toBeNull();
  });

  it('sends the model name when ollamaModel is set', async () => {
    axios.post.mockResolvedValue({ data: { game_id: 1 } });
    await createGame({ playerCount: 3, startingStack: 1000, aiMode: 'ollama', ollamaModel: 'llama3.2:latest', actionSpeed: 1000 });
    const sentPayload = axios.post.mock.calls[0][1];
    expect(sentPayload.ollama_model).toBe('llama3.2:latest');
  });

  it('posts to /api/games', async () => {
    axios.post.mockResolvedValue({ data: { game_id: 1 } });
    await createGame({ playerCount: 3, startingStack: 1000, aiMode: 'ollama', ollamaModel: null, actionSpeed: 1000 });
    expect(axios.post.mock.calls[0][0]).toBe('/api/games');
  });

  it('returns the game_id from response', async () => {
    axios.post.mockResolvedValue({ data: { game_id: 42 } });
    const result = await createGame({ playerCount: 3, startingStack: 1000, aiMode: 'ollama', ollamaModel: null, actionSpeed: 1000 });
    expect(result).toEqual({ game_id: 42 });
  });

  it('maps playerCount → player_count', async () => {
    axios.post.mockResolvedValue({ data: { game_id: 1 } });
    await createGame({ playerCount: 5, startingStack: 500, aiMode: 'api', ollamaModel: null, actionSpeed: 1000 });
    const sentPayload = axios.post.mock.calls[0][1];
    expect(sentPayload.player_count).toBe(5);
    expect(sentPayload.starting_stack).toBe(500);
    expect(sentPayload.ai_mode).toBe('api');
  });
});

// ── startNextRound ────────────────────────────────────────────────────────────

describe('startNextRound', () => {
  it('posts to correct URL with game id', async () => {
    axios.post.mockResolvedValue({ data: { status: 'started' } });
    await startNextRound(5);
    expect(axios.post).toHaveBeenCalledWith('/api/games/5/rounds/next');
  });

  it('returns response data', async () => {
    axios.post.mockResolvedValue({ data: { status: 'started', round_number: 1 } });
    const result = await startNextRound(5);
    expect(result).toEqual({ status: 'started', round_number: 1 });
  });
});

// ── stopGame ──────────────────────────────────────────────────────────────────

describe('stopGame', () => {
  it('posts to correct URL with game id', async () => {
    axios.post.mockResolvedValue({ data: { status: 'stop_requested' } });
    await stopGame(7);
    expect(axios.post).toHaveBeenCalledWith('/api/games/7/stop');
  });
});

// ── listGames ─────────────────────────────────────────────────────────────────

describe('listGames', () => {
  it('calls GET /api/games without token', async () => {
    axios.get.mockResolvedValue({ data: [] });
    await listGames();
    expect(axios.get).toHaveBeenCalledWith('/api/games', { headers: {} });
  });

  it('calls GET /api/games with auth header when token provided', async () => {
    axios.get.mockResolvedValue({ data: [] });
    await listGames('mytoken');
    expect(axios.get).toHaveBeenCalledWith('/api/games', {
      headers: { Authorization: 'Bearer mytoken' },
    });
  });
});

// ── getGame ───────────────────────────────────────────────────────────────────

describe('getGame', () => {
  it('calls GET /api/games/:id', async () => {
    axios.get.mockResolvedValue({ data: { id: 3 } });
    await getGame(3);
    expect(axios.get).toHaveBeenCalledWith('/api/games/3');
  });
});

// ── openGameSocket ────────────────────────────────────────────────────────────

describe('openGameSocket', () => {
  it('uses ws: protocol when window is http:', () => {
    // jsdom sets window.location.protocol to 'http:' by default
    const MockWS = vi.fn();
    vi.stubGlobal('WebSocket', MockWS);

    openGameSocket(42);

    const url = MockWS.mock.calls[0][0];
    expect(url).toMatch(/^ws:/);
    expect(url).toContain('/api/games/42/ws');

    vi.unstubAllGlobals();
  });

  it('uses wss: protocol when window is https:', () => {
    Object.defineProperty(window, 'location', {
      value: { protocol: 'https:', host: 'example.com' },
      writable: true,
    });

    const MockWS = vi.fn();
    vi.stubGlobal('WebSocket', MockWS);

    openGameSocket(99);

    const url = MockWS.mock.calls[0][0];
    expect(url).toMatch(/^wss:/);
    expect(url).toContain('/api/games/99/ws');

    // Restore
    Object.defineProperty(window, 'location', {
      value: { protocol: 'http:', host: 'localhost:5173' },
      writable: true,
    });
    vi.unstubAllGlobals();
  });
});
