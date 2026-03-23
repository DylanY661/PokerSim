import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSettings } from '../hooks/useSettings';

// Always start with a clean localStorage so tests don't bleed into each other
beforeEach(() => {
  localStorage.clear();
});

describe('useSettings', () => {
  // ── Default values (nothing in localStorage) ───────────────────────────────

  it('defaults mode to ollama', () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.mode).toBe('ollama');
  });

  it('defaults ollamaModel to llama3.2:latest', () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.ollamaModel).toBe('llama3.2:latest');
  });

  it('defaults playerCount to 3', () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.playerCount).toBe(3);
  });

  it('defaults startingStack to 1000', () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.startingStack).toBe(1000);
  });

  it('defaults actionSpeed to 1000', () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.actionSpeed).toBe(1000);
  });

  it('defaults showHands to false', () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.showHands).toBe(false);
  });

  // ── Reading from localStorage (must set BEFORE renderHook) ────────────────

  it('reads mode from localStorage', () => {
    localStorage.setItem('pk_mode', 'api');
    const { result } = renderHook(() => useSettings());
    expect(result.current.mode).toBe('api');
  });

  it('reads ollamaModel from localStorage', () => {
    localStorage.setItem('pk_ollama_model', 'qwen3.5:latest');
    const { result } = renderHook(() => useSettings());
    expect(result.current.ollamaModel).toBe('qwen3.5:latest');
  });

  it('reads playerCount from localStorage as int', () => {
    localStorage.setItem('pk_players', '5');
    const { result } = renderHook(() => useSettings());
    expect(result.current.playerCount).toBe(5);
  });

  it('reads startingStack from localStorage as int', () => {
    localStorage.setItem('pk_stack', '2000');
    const { result } = renderHook(() => useSettings());
    expect(result.current.startingStack).toBe(2000);
  });

  it('reads actionSpeed from localStorage as int', () => {
    localStorage.setItem('pk_speed', '500');
    const { result } = renderHook(() => useSettings());
    expect(result.current.actionSpeed).toBe(500);
  });

  it('reads showHands=true from localStorage', () => {
    localStorage.setItem('pk_showHands', 'true');
    const { result } = renderHook(() => useSettings());
    expect(result.current.showHands).toBe(true);
  });

  it('showHands is false when localStorage has "false" string', () => {
    localStorage.setItem('pk_showHands', 'false');
    const { result } = renderHook(() => useSettings());
    expect(result.current.showHands).toBe(false);
  });

  // ── Writing to localStorage on state change ────────────────────────────────

  it('writes mode to localStorage when changed', () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.setMode('browser'));
    expect(localStorage.getItem('pk_mode')).toBe('browser');
  });

  it('writes ollamaModel to localStorage when changed', () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.setOllamaModel('qwen3.5:latest'));
    expect(localStorage.getItem('pk_ollama_model')).toBe('qwen3.5:latest');
  });

  it('writes playerCount to localStorage when changed', () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.setPlayerCount(5));
    expect(localStorage.getItem('pk_players')).toBe('5');
  });

  it('writes startingStack to localStorage when changed', () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.setStartingStack(500));
    expect(localStorage.getItem('pk_stack')).toBe('500');
  });

  it('writes actionSpeed to localStorage when changed', () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.setActionSpeed(2000));
    expect(localStorage.getItem('pk_speed')).toBe('2000');
  });

  it('writes showHands to localStorage when changed', () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.setShowHands(true));
    expect(localStorage.getItem('pk_showHands')).toBe('true');
  });

  // ── Setter updates state ───────────────────────────────────────────────────

  it('setMode updates state value', () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.setMode('api'));
    expect(result.current.mode).toBe('api');
  });

  it('setPlayerCount updates state value', () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.setPlayerCount(4));
    expect(result.current.playerCount).toBe(4);
  });
});
