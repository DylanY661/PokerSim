import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Card from '../components/Card';

describe('Card', () => {
  // ── Suit symbols ───────────────────────────────────────────────────────────

  it('renders spade symbol for suit S', () => {
    render(<Card rank="A" suit="S" />);
    expect(screen.getByText('♠')).toBeInTheDocument();
  });

  it('renders heart symbol for suit H', () => {
    render(<Card rank="K" suit="H" />);
    expect(screen.getByText('♥')).toBeInTheDocument();
  });

  it('renders diamond symbol for suit D', () => {
    render(<Card rank="Q" suit="D" />);
    expect(screen.getByText('♦')).toBeInTheDocument();
  });

  it('renders club symbol for suit C', () => {
    render(<Card rank="J" suit="C" />);
    expect(screen.getByText('♣')).toBeInTheDocument();
  });

  // ── Rank display ───────────────────────────────────────────────────────────

  it('renders the rank text', () => {
    render(<Card rank="A" suit="S" />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders numeric rank', () => {
    render(<Card rank="7" suit="H" />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('renders T for ten', () => {
    render(<Card rank="T" suit="D" />);
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  // ── Color logic ────────────────────────────────────────────────────────────

  it('applies red color class for hearts', () => {
    const { container } = render(<Card rank="2" suit="H" />);
    expect(container.firstChild).toHaveClass('text-red-600');
  });

  it('applies red color class for diamonds', () => {
    const { container } = render(<Card rank="2" suit="D" />);
    expect(container.firstChild).toHaveClass('text-red-600');
  });

  it('applies dark color class for spades (not red)', () => {
    const { container } = render(<Card rank="2" suit="S" />);
    expect(container.firstChild).toHaveClass('text-slate-800');
    expect(container.firstChild).not.toHaveClass('text-red-600');
  });

  it('applies dark color class for clubs (not red)', () => {
    const { container } = render(<Card rank="2" suit="C" />);
    expect(container.firstChild).toHaveClass('text-slate-800');
    expect(container.firstChild).not.toHaveClass('text-red-600');
  });

  // ── Face-down ──────────────────────────────────────────────────────────────

  it('shows question mark when faceDown is true', () => {
    render(<Card rank="A" suit="S" faceDown={true} />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('hides rank when faceDown is true', () => {
    render(<Card rank="A" suit="S" faceDown={true} />);
    expect(screen.queryByText('A')).not.toBeInTheDocument();
  });

  it('hides suit symbol when faceDown is true', () => {
    render(<Card rank="A" suit="H" faceDown={true} />);
    expect(screen.queryByText('♥')).not.toBeInTheDocument();
  });

  it('face-down card has slate-700 background', () => {
    const { container } = render(<Card rank="A" suit="S" faceDown={true} />);
    expect(container.firstChild).toHaveClass('bg-slate-700');
  });

  it('face-up card has white background', () => {
    const { container } = render(<Card rank="A" suit="S" faceDown={false} />);
    expect(container.firstChild).toHaveClass('bg-white');
  });
});
