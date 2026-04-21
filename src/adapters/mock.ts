import { applySan, isValidFen } from '@/core/chess-utils';
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

  /**
   * Apply a SAN move, update current FEN + ply, and notify all subscribers.
   * Throws if the move is illegal from the current FEN.
   */
  emit(san: string): void {
    const after = applySan(this.currentFen, san);
    if (after === null) {
      throw new Error(
        `MockAdapter.emit: illegal move "${san}" from FEN "${this.currentFen}"`,
      );
    }
    this.currentFen = after;
    this.ply += 1;
    const ev: MoveEvent = { san, fenAfter: after, ply: this.ply };
    for (const sub of this.subscribers) {
      sub(ev);
    }
  }

  /**
   * Queue a sequence of SAN moves to be fired later via {@link play} or
   * {@link playOne}. Legality is validated at script time by replaying
   * against a COPY of the adapter's current FEN; the adapter state is NOT
   * mutated. Illegal moves throw immediately.
   */
  script(moves: readonly string[]): this {
    let fen = this.currentFen;
    for (const san of moves) {
      const after = applySan(fen, san);
      if (after === null) {
        throw new Error(
          `MockAdapter.script: illegal move "${san}" from FEN "${fen}"`,
        );
      }
      fen = after;
    }
    this.queue.push(...moves);
    return this;
  }
}
