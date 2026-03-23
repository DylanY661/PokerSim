import axios from 'axios';

const API_BASE = '/api';

export async function healthCheck() {
  const { data } = await axios.get(`${API_BASE}/`);
  return data;
}

export async function getBrowserStatus() {
  const { data } = await axios.get(`${API_BASE}/browser/status`);
  return data;
}

export async function initBrowser(players, signal) {
  const payload = players && players.length > 0 ? { players } : {};
  const { data } = await axios.post(`${API_BASE}/browser/init`, payload, { timeout: 600_000, signal });
  return data;
}

export async function shutdownBrowser() {
  const { data } = await axios.post(`${API_BASE}/browser/shutdown`);
  return data;
}

export async function getSessionStatus() {
  const { data } = await axios.get(`${API_BASE}/browser/session-status`);
  return data;
}

export async function clearSession() {
  const { data } = await axios.delete(`${API_BASE}/browser/session`);
  return data;
}

export async function startLogin() {
  const { data } = await axios.post(`${API_BASE}/browser/login`);
  return data;
}

export async function confirmLogin() {
  const { data } = await axios.post(`${API_BASE}/browser/login-confirm`, {}, { timeout: 30_000 });
  return data;
}

// ── Auth API ──────────────────────────────────────────────────────────────────

export async function registerUser(username, password) {
  const { data } = await axios.post(`${API_BASE}/auth/register`, { username, password });
  return data;  // { token, username }
}

export async function loginUser(username, password) {
  const { data } = await axios.post(`${API_BASE}/auth/login`, { username, password });
  return data;  // { token, username }
}

export async function getMe(token) {
  const { data } = await axios.get(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;  // { id, username }
}

// ── Game API ──────────────────────────────────────────────────────────────────

export async function createGame({ playerCount, startingStack, aiMode, ollamaModel, actionSpeed, humanPlayer, token }) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const { data } = await axios.post(`${API_BASE}/games`, {
    player_count:   playerCount,
    starting_stack: startingStack,
    ai_mode:        aiMode,
    ollama_model:   ollamaModel || null,
    action_speed:   actionSpeed / 1000,   // ms → seconds
    human_player:   humanPlayer || null,
  }, { headers });
  return data;   // { game_id }
}

export async function startNextRound(gameId) {
  const { data } = await axios.post(`${API_BASE}/games/${gameId}/rounds/next`);
  return data;
}

export async function stopGame(gameId) {
  const { data } = await axios.post(`${API_BASE}/games/${gameId}/stop`);
  return data;
}

export async function listGames(token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const { data } = await axios.get(`${API_BASE}/games`, { headers });
  return data;
}

export async function getGame(gameId) {
  const { data } = await axios.get(`${API_BASE}/games/${gameId}`);
  return data;
}

export function openGameSocket(gameId) {
  // Uses the same /api prefix — Vite proxies WS upgrades to ws://127.0.0.1:8000
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return new WebSocket(`${proto}//${window.location.host}/api/games/${gameId}/ws`);
}
