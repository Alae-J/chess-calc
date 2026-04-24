import { applySan } from '@/core/chess-utils';
import type { FEN, SAN } from '@/core/types';
import type {
  BoardAdapter,
  MoveEvent,
  ResetEvent,
  Unsubscribe,
} from './adapter';
import { LichessDomContractError } from './lichess-errors';
import { parseMoveHistory, type SessionStartContext } from './lichess-session';

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
  private observer: MutationObserver | null = null;
  private observedHistory: SAN[];

  constructor(ctx: SessionStartContext) {
    this.ctx = ctx;
    this.currentFen = ctx.currentFen;
    this.orientation = ctx.orientation;
    this.ply = ctx.moveHistory.length;
    this.observedHistory = [...ctx.moveHistory];
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
    this.attachObserver();
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
    this.observer?.disconnect();
    this.observer = null;
    this.moveSubscribers.clear();
    this.resetSubscribers.clear();
  }

  private attachObserver(): void {
    this.observer = new MutationObserver(() => this.handleMutation());
    this.observer.observe(this.ctx.moveListRoot, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  private handleMutation(): void {
    if (this.disposed) return;
    const doc = this.ctx.moveListRoot.ownerDocument;
    if (!doc) return;
    const history = parseMoveHistory(doc);
    if (history.length > this.observedHistory.length) {
      const newMoves = history.slice(this.observedHistory.length);
      for (const san of newMoves) this.emitMove(san);
      return;
    }
    if (history.length < this.observedHistory.length) {
      // TODO(Task 13): takeback detection with 150ms debounce.
      return;
    }
    // Equal-length mutation (class toggle on existing cell) — ignore.
  }

  private emitMove(san: SAN): void {
    const next = applySan(this.currentFen, san);
    if (next === null) {
      // eslint-disable-next-line no-console
      console.warn(`[chess-calc] LichessAdapter: illegal appended SAN "${san}" ignored`);
      return;
    }
    this.currentFen = next;
    this.ply += 1;
    this.observedHistory.push(san);
    const ev: MoveEvent = { san, fenAfter: next, ply: this.ply };
    for (const sub of this.moveSubscribers) sub(ev);
  }
}
