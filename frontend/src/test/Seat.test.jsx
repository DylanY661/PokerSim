import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Seat from '../components/Seat';

// Minimal default props — only name and stack are required
const defaults = { name: 'Calculator', stack: 1000 };

describe('Seat', () => {
  // ── Basic rendering ────────────────────────────────────────────────────────

  it('renders player name', () => {
    render(<Seat {...defaults} />);
    expect(screen.getByText('Calculator')).toBeInTheDocument();
  });

  it('renders stack with dollar prefix', () => {
    render(<Seat {...defaults} stack={850} />);
    expect(screen.getByText('$850')).toBeInTheDocument();
  });

  it('renders $0 for zero stack', () => {
    render(<Seat {...defaults} stack={0} />);
    expect(screen.getByText('$0')).toBeInTheDocument();
  });

  // ── Badges: dealer / SB / BB ───────────────────────────────────────────────

  it('shows D badge when isDealer', () => {
    render(<Seat {...defaults} isDealer={true} />);
    expect(screen.getByText('D')).toBeInTheDocument();
  });

  it('shows SB badge when isSmallBlind and not dealer', () => {
    render(<Seat {...defaults} isSmallBlind={true} />);
    expect(screen.getByText('SB')).toBeInTheDocument();
  });

  it('shows BB badge when isBigBlind and not dealer and not SB', () => {
    render(<Seat {...defaults} isBigBlind={true} />);
    expect(screen.getByText('BB')).toBeInTheDocument();
  });

  it('dealer badge takes priority over SB badge', () => {
    render(<Seat {...defaults} isDealer={true} isSmallBlind={true} />);
    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.queryByText('SB')).not.toBeInTheDocument();
  });

  it('SB badge takes priority over BB badge', () => {
    render(<Seat {...defaults} isSmallBlind={true} isBigBlind={true} />);
    expect(screen.getByText('SB')).toBeInTheDocument();
    expect(screen.queryByText('BB')).not.toBeInTheDocument();
  });

  it('no badge when no position prop', () => {
    render(<Seat {...defaults} />);
    expect(screen.queryByText('D')).not.toBeInTheDocument();
    expect(screen.queryByText('SB')).not.toBeInTheDocument();
    expect(screen.queryByText('BB')).not.toBeInTheDocument();
  });

  // ── Folded state ───────────────────────────────────────────────────────────

  it('shows Folded text when isFolded', () => {
    render(<Seat {...defaults} isFolded={true} />);
    expect(screen.getByText('Folded')).toBeInTheDocument();
  });

  it('applies opacity-40 class when isFolded', () => {
    const { container } = render(<Seat {...defaults} isFolded={true} />);
    expect(container.firstChild).toHaveClass('opacity-40');
  });

  it('does not show Folded text when not folded', () => {
    render(<Seat {...defaults} isFolded={false} />);
    expect(screen.queryByText('Folded')).not.toBeInTheDocument();
  });

  // ── Thinking ───────────────────────────────────────────────────────────────

  it('shows thinking text when isThinking', () => {
    render(<Seat {...defaults} isThinking={true} />);
    expect(screen.getByText('thinking…')).toBeInTheDocument();
  });

  it('does not show thinking when not thinking', () => {
    render(<Seat {...defaults} isThinking={false} />);
    expect(screen.queryByText('thinking…')).not.toBeInTheDocument();
  });

  // ── All-in ─────────────────────────────────────────────────────────────────

  it('shows All In badge when isAllIn and not folded', () => {
    render(<Seat {...defaults} isAllIn={true} isFolded={false} />);
    expect(screen.getByText('All In')).toBeInTheDocument();
  });

  it('does not show All In badge when folded', () => {
    render(<Seat {...defaults} isAllIn={true} isFolded={true} />);
    expect(screen.queryByText('All In')).not.toBeInTheDocument();
  });

  // ── Last action badge ──────────────────────────────────────────────────────

  it('shows raise action with amount', () => {
    render(<Seat {...defaults} lastAction={{ action: 'raise', amount: 50 }} />);
    expect(screen.getByText('raise $50')).toBeInTheDocument();
  });

  it('shows call action without amount when amount is 0', () => {
    render(<Seat {...defaults} lastAction={{ action: 'call', amount: 0 }} />);
    expect(screen.getByText('call')).toBeInTheDocument();
  });

  it('shows fold action', () => {
    render(<Seat {...defaults} lastAction={{ action: 'fold', amount: 0 }} />);
    expect(screen.getByText('fold')).toBeInTheDocument();
  });

  it('does not show action badge for blind actions', () => {
    render(<Seat {...defaults} lastAction={{ action: 'blind', amount: 10 }} />);
    // The blind action is explicitly filtered out (action !== 'blind' guard)
    expect(screen.queryByText(/blind/i)).not.toBeInTheDocument();
  });

  it('does not show action badge when folded', () => {
    render(<Seat {...defaults} isFolded={true} lastAction={{ action: 'raise', amount: 50 }} />);
    expect(screen.queryByText('raise $50')).not.toBeInTheDocument();
  });

  it('does not show action badge when thinking', () => {
    render(<Seat {...defaults} isThinking={true} lastAction={{ action: 'call', amount: 0 }} />);
    expect(screen.queryByText('call')).not.toBeInTheDocument();
  });

  it('does not show action badge when all-in', () => {
    render(<Seat {...defaults} isAllIn={true} lastAction={{ action: 'raise', amount: 100 }} />);
    expect(screen.queryByText('raise $100')).not.toBeInTheDocument();
  });

  // ── Cards ──────────────────────────────────────────────────────────────────

  it('renders card symbols when cards prop is provided', () => {
    render(<Seat {...defaults} cards={[{ rank: 'A', suit: 'S' }, { rank: 'K', suit: 'H' }]} />);
    expect(screen.getByText('♠')).toBeInTheDocument();
    expect(screen.getByText('♥')).toBeInTheDocument();
  });

  it('renders nothing for cards when prop is empty', () => {
    render(<Seat {...defaults} cards={[]} />);
    expect(screen.queryByText('♠')).not.toBeInTheDocument();
  });

  // ── Active styling ─────────────────────────────────────────────────────────

  it('applies active ring class when isActive', () => {
    const { container } = render(<Seat {...defaults} isActive={true} />);
    expect(container.firstChild).toHaveClass('ring-amber-400');
  });

  it('does not apply active ring when not active', () => {
    const { container } = render(<Seat {...defaults} isActive={false} />);
    expect(container.firstChild).not.toHaveClass('ring-amber-400');
  });
});
