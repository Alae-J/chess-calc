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

describe('MockAdapter.emit', () => {
  it('fires legal move to all subscribers, updates FEN and ply', () => {
    const a = new MockAdapter();
    const seen: string[] = [];
    a.onMove((ev) => seen.push(`${ev.san}@${ev.ply}`));
    a.onMove((ev) => seen.push(`B:${ev.san}`));

    a.emit('e4');
    expect(seen).toEqual(['e4@1', 'B:e4']);
    expect(a.getCurrentFEN()).toBe(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    );
  });

  it('emits increment ply monotonically', () => {
    const a = new MockAdapter();
    const plies: number[] = [];
    a.onMove((ev) => plies.push(ev.ply));
    a.emit('e4');
    a.emit('e5');
    a.emit('Nf3');
    expect(plies).toEqual([1, 2, 3]);
  });

  it('throws on illegal emit', () => {
    const a = new MockAdapter();
    expect(() => a.emit('Ke2')).toThrow();
  });

  it('does not notify an unsubscribed subscriber', () => {
    const a = new MockAdapter();
    const seen: string[] = [];
    const unsub = a.onMove((ev) => seen.push(ev.san));
    unsub();
    a.emit('e4');
    expect(seen).toEqual([]);
  });
});

describe('MockAdapter.script', () => {
  it('validates every move at script time against a copy of current FEN', () => {
    const a = new MockAdapter();
    expect(() => a.script(['e4', 'e5', 'Nf3', 'Nc6'])).not.toThrow();
  });

  it('throws immediately on an illegal move in the script', () => {
    const a = new MockAdapter();
    expect(() => a.script(['e4', 'Ke2'])).toThrow(/illegal/i);
  });

  it('does not mutate current FEN on script() — only on emit/play', () => {
    const a = new MockAdapter();
    a.script(['e4', 'e5']);
    expect(a.getCurrentFEN()).toBe(START_FEN);
  });

  it('returns `this` for chaining', () => {
    const a = new MockAdapter();
    expect(a.script(['e4'])).toBe(a);
  });
});

describe('MockAdapter.play / playOne', () => {
  it('play() fires all queued moves in order and clears the queue', () => {
    const a = new MockAdapter();
    const seen: string[] = [];
    a.onMove((ev) => seen.push(ev.san));

    a.script(['e4', 'e5', 'Nf3']);
    a.play();

    expect(seen).toEqual(['e4', 'e5', 'Nf3']);
    // Queue is empty: a second play should fire nothing.
    a.play();
    expect(seen).toEqual(['e4', 'e5', 'Nf3']);
  });

  it('playOne() fires only the next queued move', () => {
    const a = new MockAdapter();
    const seen: string[] = [];
    a.onMove((ev) => seen.push(ev.san));

    a.script(['e4', 'e5']);
    a.playOne();
    expect(seen).toEqual(['e4']);
    a.playOne();
    expect(seen).toEqual(['e4', 'e5']);
    // Queue empty — playOne is a no-op.
    a.playOne();
    expect(seen).toEqual(['e4', 'e5']);
  });
});

describe('MockAdapter.reset', () => {
  it('updates current FEN, resets ply, clears queue, does not fire subscribers', () => {
    const a = new MockAdapter();
    const seen: string[] = [];
    a.onMove((ev) => seen.push(ev.san));

    a.script(['e4', 'e5']);
    a.emit('d4'); // ply = 1, not from the queue
    const differentFen =
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    a.reset(differentFen);

    expect(a.getCurrentFEN()).toBe(differentFen);
    // Subsequent emit should produce ply=1 (reset cleared ply)
    seen.length = 0;
    a.emit('e4');
    const last = seen[seen.length - 1];
    expect(last).toBe('e4');
    // Play the cleared queue — nothing should fire.
    seen.length = 0;
    a.play();
    expect(seen).toEqual([]);
  });

  it('throws InvalidFenError on malformed newFen', () => {
    const a = new MockAdapter();
    expect(() => a.reset('junk')).toThrow();
  });

  it('does not notify subscribers during reset', () => {
    const a = new MockAdapter();
    let called = 0;
    a.onMove(() => (called += 1));
    a.reset('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(called).toBe(0);
  });
});
