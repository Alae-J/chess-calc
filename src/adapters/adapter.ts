import type { FEN, SAN } from '@/core/types';

export type MoveEvent = {
  readonly san: SAN;
  readonly fenAfter: FEN;
  readonly ply: number;
};

export type Unsubscribe = () => void;

/**
 * Abstraction over a chess board in some host environment.
 *
 * Implementations: {@link MockAdapter} (Phase 1), LichessAdapter (Phase 3),
 * Chess.com / CV adapters (post-v0).
 */
export interface BoardAdapter {
  /** FEN of the current position on the host board. */
  getCurrentFEN(): FEN;

  /** 'white' = player is playing white (board oriented white-at-bottom). */
  getOrientation(): 'white' | 'black';

  /** Subscribe to move events from the host board. Returns an unsubscribe fn. */
  onMove(cb: (ev: MoveEvent) => void): Unsubscribe;

  /** Optional: release resources, stop observers. */
  dispose?(): void;
}
