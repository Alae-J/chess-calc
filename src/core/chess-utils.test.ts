import { describe, expect, it } from 'vitest';
import { applySan } from './chess-utils';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('applySan', () => {
  it('applies a legal move and returns the resulting FEN', () => {
    const after = applySan(START_FEN, 'e4');
    expect(after).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
  });

  it('returns null for an illegal move', () => {
    expect(applySan(START_FEN, 'Ke2')).toBeNull();
    expect(applySan(START_FEN, 'gibberish')).toBeNull();
  });

  it('handles castling', () => {
    const fenReadyToCastle = 'r3k2r/pppqbppp/2np1n2/4p1b1/4P1b1/2NP1N2/PPPQBPPP/R3K2R w KQkq - 0 1';
    const after = applySan(fenReadyToCastle, 'O-O');
    expect(after).not.toBeNull();
    expect(after).toContain('R4RK1'); // kingside castled king on g1, rook on f1
  });
});
