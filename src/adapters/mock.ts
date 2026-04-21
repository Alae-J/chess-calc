import { isValidFen } from '@/core/chess-utils';
import { InvalidFenError, type FEN } from '@/core/types';
import type { BoardAdapter, MoveEvent, Unsubscribe } from './adapter';

const STANDARD_START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * A scripted, synchronous in-memory {@link BoardAdapter} for tests and the
 * Phase 2 dev harness. Moves are never emitted autonomously — callers drive
 * via {@link MockAdapter.emit}, {@link MockAdapter.playOne}, or
 * {@link MockAdapter.play}.
 */
export class MockAdapter implements BoardAdapter {
  private currentFen: FEN;
  private orientation: 'white' | 'black';
  private ply = 0;
  private queue: string[] = [];
  private subscribers = new Set<(ev: MoveEvent) => void>();

  constructor(opts?: { startFen?: FEN; orientation?: 'white' | 'black' }) {
    const startFen = opts?.startFen ?? STANDARD_START_FEN;
    if (!isValidFen(startFen)) {
      throw new InvalidFenError(startFen);
    }
    this.currentFen = startFen;
    this.orientation = opts?.orientation ?? 'white';
  }

  getCurrentFEN(): FEN {
    return this.currentFen;
  }

  getOrientation(): 'white' | 'black' {
    return this.orientation;
  }

  onMove(cb: (ev: MoveEvent) => void): Unsubscribe {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }
}
