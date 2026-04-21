import type { FEN, SAN } from '@/core/types';

export type MoveEvent = {
  readonly san: SAN;
  readonly fenAfter: FEN;
  readonly ply: number;
};

/**
 * Emitted by adapters when the real game's position jumps backward — e.g.
 * a takeback on Lichess that cannot be expressed as a forward SAN move.
 * bridgeAdapter routes this to store.resetFromFen(fen).
 */
export type ResetEvent = {
  readonly fenAfter: FEN;
};

export type Unsubscribe = () => void;

/**
 * Abstraction over a chess board in some host environment.
 *
 * Implementations: {@link MockAdapter} (Phase 1, no onReset), LichessAdapter
 * (Phase 3, implements onReset for takeback handling), Chess.com / CV
 * adapters (post-v0).
 */
export interface BoardAdapter {
  /** FEN of the current position on the host board. */
  getCurrentFEN(): FEN;

  /** 'white' = player is playing white (board oriented white-at-bottom). */
  getOrientation(): 'white' | 'black';

  /** Subscribe to move events from the host board. Returns an unsubscribe fn. */
  onMove(cb: (ev: MoveEvent) => void): Unsubscribe;

  /**
   * Subscribe to reset events (e.g. takeback). Optional — adapters that
   * cannot observe backward-jumps (like MockAdapter) omit this.
   * bridgeAdapter feature-detects via `if (adapter.onReset)`.
   */
  onReset?(cb: (ev: ResetEvent) => void): Unsubscribe;

  /** Optional: release resources, stop observers. */
  dispose?(): void;
}
