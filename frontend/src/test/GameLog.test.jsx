import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GameLog from '../components/GameLog';

const makeEntry = (overrides = {}) => ({
  player: 'Shark',
  street: 'preflop',
  action: 'fold',
  amount: 0,
  reasoning: 'bad hand',
  ...overrides,
});

describe('GameLog', () => {
  // ── Empty state ────────────────────────────────────────────────────────────

  it('shows placeholder when log is empty', () => {
    render(<GameLog gameLog={[]} />);
    expect(screen.getByText(/No actions yet/i)).toBeInTheDocument();
  });

  it('does not show placeholder when log has entries', () => {
    render(<GameLog gameLog={[makeEntry()]} />);
    expect(screen.queryByText(/No actions yet/i)).not.toBeInTheDocument();
  });

  // ── Entry rendering ────────────────────────────────────────────────────────

  it('renders player name', () => {
    render(<GameLog gameLog={[makeEntry({ player: 'Rock' })]} />);
    expect(screen.getByText('Rock')).toBeInTheDocument();
  });

  it('renders action text', () => {
    render(<GameLog gameLog={[makeEntry({ action: 'fold' })]} />);
    expect(screen.getByText('fold')).toBeInTheDocument();
  });

  it('renders reasoning text', () => {
    render(<GameLog gameLog={[makeEntry({ reasoning: 'very weak hand' })]} />);
    expect(screen.getByText('very weak hand')).toBeInTheDocument();
  });

  it('renders street label', () => {
    render(<GameLog gameLog={[makeEntry({ street: 'flop' })]} />);
    expect(screen.getByText('flop')).toBeInTheDocument();
  });

  // ── Amount display ─────────────────────────────────────────────────────────

  it('shows amount for raise', () => {
    render(<GameLog gameLog={[makeEntry({ action: 'raise', amount: 100 })]} />);
    expect(screen.getByText('raise $100')).toBeInTheDocument();
  });

  it('does not show $0 for fold (amount guard: amount > 0)', () => {
    render(<GameLog gameLog={[makeEntry({ action: 'fold', amount: 0 })]} />);
    expect(screen.queryByText('fold $0')).not.toBeInTheDocument();
    expect(screen.getByText('fold')).toBeInTheDocument();
  });

  it('shows amount for call when non-zero', () => {
    render(<GameLog gameLog={[makeEntry({ action: 'call', amount: 20 })]} />);
    expect(screen.getByText('call $20')).toBeInTheDocument();
  });

  // ── Multiple entries ───────────────────────────────────────────────────────

  it('renders all entries', () => {
    const log = [
      makeEntry({ player: 'Calculator', action: 'raise', amount: 50 }),
      makeEntry({ player: 'Shark',      action: 'call',  amount: 50 }),
      makeEntry({ player: 'Gambler',    action: 'fold',  amount: 0  }),
    ];
    render(<GameLog gameLog={log} />);
    expect(screen.getByText('Calculator')).toBeInTheDocument();
    expect(screen.getByText('Shark')).toBeInTheDocument();
    expect(screen.getByText('Gambler')).toBeInTheDocument();
  });

  // ── Color classes ──────────────────────────────────────────────────────────

  it('applies fold row background class for fold action', () => {
    const { container } = render(<GameLog gameLog={[makeEntry({ action: 'fold' })]} />);
    // ACTION_ROW.fold = 'bg-red-950/40 border-red-800/40'
    const entry = container.querySelector('[class*="bg-red-950"]');
    expect(entry).not.toBeNull();
  });

  it('applies raise row background class for raise action', () => {
    const { container } = render(
      <GameLog gameLog={[makeEntry({ action: 'raise', amount: 50 })]} />
    );
    const entry = container.querySelector('[class*="bg-green-950"]');
    expect(entry).not.toBeNull();
  });

  it('applies call row background class for call action', () => {
    const { container } = render(
      <GameLog gameLog={[makeEntry({ action: 'call', amount: 0 })]} />
    );
    const entry = container.querySelector('[class*="bg-yellow-950"]');
    expect(entry).not.toBeNull();
  });

  // ── Bust entry ─────────────────────────────────────────────────────────────

  it('renders bust action entry', () => {
    const bustEntry = makeEntry({ action: 'bust', street: 'result', reasoning: 'Eliminated — out of chips.' });
    render(<GameLog gameLog={[bustEntry]} />);
    expect(screen.getByText('bust')).toBeInTheDocument();
    expect(screen.getByText('Eliminated — out of chips.')).toBeInTheDocument();
  });
});
