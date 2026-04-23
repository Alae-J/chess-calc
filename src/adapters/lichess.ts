import { applySan } from '@/core/chess-utils';
import type { FEN, SAN } from '@/core/types';
import type {
  BoardAdapter,
  MoveEvent,
  ResetEvent,
  Unsubscribe,
} from './adapter';
import { LichessDomContractError } from './lichess-errors';
import type { SessionStartContext } from './lichess-session';

/** Debounce window for takeback detection (see spec §9.5). */
export const TAKEBACK_DEBOUNCE_MS = 150;

export { LichessDomContractError } from './lichess-errors';

export class LichessAdapter implements BoardAdapter {
  private currentFen: FEN;
  private readonly orientation: 'white' | 'black';
  private ply: number;
  private readonly moveSubscribers = new Set<(ev: MoveEvent) => void>();
  private readonly resetSubscribers = new Set<(ev: ResetEvent) => void>();
  private readonly ctx: SessionStartContext;
  private disposed = false;
  private initialized = false;

  constructor(ctx: SessionStartContext) {
    this.ctx = ctx;
    this.currentFen = ctx.currentFen;
    this.orientation = ctx.orientation;
    this.ply = ctx.moveHistory.length;
  }

  initialize(): void {
    if (this.initialized) return;
    // Replay move history from initialFen through chess.js.
    // Reconcile against ctx.currentFen — mismatch = DOM contract violation.
    let replayed: FEN = this.ctx.initialFen;
    for (let i = 0; i < this.ctx.moveHistory.length; i += 1) {
      const san: SAN = this.ctx.moveHistory[i]!;
      const next = applySan(replayed, san);
      if (next === null) {
        throw new LichessDomContractError(
          'moveHistory',
          `illegal move "${san}" at ply ${i} replaying from "${this.ctx.initialFen}"`,
        );
      }
      replayed = next;
    }
    if (replayed !== this.ctx.currentFen) {
      throw new LichessDomContractError(
        'currentFen',
        `replayed FEN "${replayed}" does not match observed currentFen "${this.ctx.currentFen}"`,
      );
    }
    this.initialized = true;
  }

  getCurrentFEN(): FEN {
    return this.currentFen;
  }

  getOrientation(): 'white' | 'black' {
    return this.orientation;
  }

  onMove(cb: (ev: MoveEvent) => void): Unsubscribe {
    this.moveSubscribers.add(cb);
    return () => {
      this.moveSubscribers.delete(cb);
    };
  }

  onReset(cb: (ev: ResetEvent) => void): Unsubscribe {
    this.resetSubscribers.add(cb);
    return () => {
      this.resetSubscribers.delete(cb);
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.moveSubscribers.clear();
    this.resetSubscribers.clear();
  }
}
