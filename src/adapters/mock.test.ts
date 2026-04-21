import { describe, expect, it } from 'vitest';
import { MockAdapter } from './mock';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('MockAdapter construction', () => {
  it('defaults to the standard starting position and white orientation', () => {
    const a = new MockAdapter();
    expect(a.getCurrentFEN()).toBe(START_FEN);
    expect(a.getOrientation()).toBe('white');
  });

  it('respects provided startFen and orientation', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const a = new MockAdapter({ startFen: fen, orientation: 'black' });
    expect(a.getCurrentFEN()).toBe(fen);
    expect(a.getOrientation()).toBe('black');
  });

  it('throws InvalidFenError on malformed startFen', () => {
    expect(() => new MockAdapter({ startFen: 'junk' })).toThrowError();
  });
});

describe('MockAdapter subscriptions', () => {
  it('accepts multiple subscribers and returns an unsubscribe fn', () => {
    const a = new MockAdapter();
    const unsub = a.onMove(() => {});
    expect(typeof unsub).toBe('function');
    // Calling unsubscribe is idempotent:
    unsub();
    expect(() => unsub()).not.toThrow();
  });
});
