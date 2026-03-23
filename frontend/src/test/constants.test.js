import { describe, it, expect } from 'vitest';
import { calcBlinds, parseErrorMsg } from '../constants';

// ── calcBlinds ────────────────────────────────────────────────────────────────

describe('calcBlinds', () => {
  it('returns SB=10 and BB=20 for stack of 1000', () => {
    expect(calcBlinds(1000)).toEqual({ SB: 10, BB: 20 });
  });

  it('returns SB=1 and BB=2 for stack of 100', () => {
    expect(calcBlinds(100)).toEqual({ SB: 1, BB: 2 });
  });

  it('minimum SB is 1 even for very small stack', () => {
    // 0.01 * 50 = 0.5 → round → 1; max(1, 1) = 1
    const result = calcBlinds(50);
    expect(result.SB).toBe(1);
    expect(result.BB).toBe(2);
  });

  it('minimum SB is 1 for stack of 1', () => {
    const result = calcBlinds(1);
    expect(result.SB).toBe(1);
    expect(result.BB).toBe(2);
  });

  it('returns SB=100 and BB=200 for stack of 10000', () => {
    expect(calcBlinds(10000)).toEqual({ SB: 100, BB: 200 });
  });

  it('BB is always exactly 2x SB', () => {
    [50, 100, 333, 1000, 5000].forEach(stack => {
      const { SB, BB } = calcBlinds(stack);
      expect(BB).toBe(SB * 2);
    });
  });

  it('rounds SB correctly for 155 stack (0.01*155=1.55 → 2)', () => {
    expect(calcBlinds(155).SB).toBe(2);
  });
});

// ── parseErrorMsg ─────────────────────────────────────────────────────────────

describe('parseErrorMsg', () => {
  it('returns cannot reach backend for connection refused', () => {
    const result = parseErrorMsg({ message: 'connection refused' });
    expect(result).toBe('Cannot reach backend — is it running?');
  });

  it('returns cannot reach backend for ECONNREFUSED (uppercase)', () => {
    const result = parseErrorMsg({ message: 'ECONNREFUSED 127.0.0.1:8000' });
    expect(result).toBe('Cannot reach backend — is it running?');
  });

  it('returns cannot reach backend for failed to fetch', () => {
    const result = parseErrorMsg({ message: 'Failed to fetch' });
    expect(result).toBe('Cannot reach backend — is it running?');
  });

  it('returns ollama not reachable for ollama connection error', () => {
    const result = parseErrorMsg({ message: 'Ollama connect error' });
    expect(result).toBe('Ollama not reachable — is it running?');
  });

  it('returns ollama not reachable for ollama refused', () => {
    // Use a message that has 'Ollama' + 'error' but NOT 'connection refused',
    // so it doesn't match the first (backend-down) check.
    const result = parseErrorMsg({ message: 'Ollama error: could not reach server' });
    expect(result).toBe('Ollama not reachable — is it running?');
  });

  it('returns gemini api key message for api_key in detail', () => {
    const result = parseErrorMsg({
      response: { data: { detail: 'GEMINI_API_KEY not set in .env' } }
    });
    expect(result).toBe('Gemini API key missing or invalid.');
  });

  it('returns gemini api key message for api.key match', () => {
    const result = parseErrorMsg({ message: 'Invalid api key provided' });
    expect(result).toBe('Gemini API key missing or invalid.');
  });

  it('returns browser not initialized message', () => {
    const result = parseErrorMsg({ message: 'browser not initialized' });
    expect(result).toBe('Browser not initialized — click Init Browser first.');
  });

  it('returns rate limit message for rate limit text', () => {
    const result = parseErrorMsg({ message: 'rate limit exceeded' });
    expect(result).toBe('Rate limit hit — try a slower action speed.');
  });

  it('returns rate limit message for 429 status code text', () => {
    const result = parseErrorMsg({ message: '429 Too Many Requests' });
    expect(result).toBe('Rate limit hit — try a slower action speed.');
  });

  it('returns raw message for unknown errors', () => {
    const result = parseErrorMsg({ message: 'some unexpected error' });
    expect(result).toBe('some unexpected error');
  });

  it('prefers response.data.detail over message', () => {
    const result = parseErrorMsg({
      response: { data: { detail: 'specific backend error' } },
      message: 'generic axios error',
    });
    expect(result).toBe('specific backend error');
  });

  it('falls back to message when no response.data.detail', () => {
    const result = parseErrorMsg({ message: 'something unexpected happened' });
    expect(result).toBe('something unexpected happened');
  });

  it('returns Request failed when no message and no detail', () => {
    const result = parseErrorMsg({});
    expect(result).toBe('Request failed');
  });
});
