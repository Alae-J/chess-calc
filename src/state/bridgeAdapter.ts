import type { BoardAdapter } from '@/adapters/adapter';
import type { ChessCalcStore } from './store';

export type Dispose = () => void;

/**
 * Wire a {@link BoardAdapter} into a {@link ChessCalcStore}.
 *
 * - One-shot push of orientation from adapter → store.
 * - Subscribes to adapter.onMove and translates each MoveEvent into
 *   store.advanceRealGame(san, fenAfter). `ply` is discarded — the tree
 *   tracks its own ply.
 * - If adapter.onReset is present (Phase 3+ adapters), subscribes and routes
 *   ResetEvent into store.resetFromFen(fenAfter). MockAdapter omits this;
 *   bridgeAdapter tolerates the absence.
 * - Returns a dispose that unsubscribes all subscriptions and calls
 *   adapter.dispose?.().
 *
 * This is the single designated cross-layer file (adapters ↔ state). UI
 * never imports this module.
 */
export function bridgeAdapter(adapter: BoardAdapter, store: ChessCalcStore): Dispose {
  store.getState().setOrientation(adapter.getOrientation());

  const unsubMove = adapter.onMove((ev) => {
    store.getState().advanceRealGame(ev.san, ev.fenAfter);
  });

  const unsubReset = adapter.onReset?.((ev) => {
    store.getState().resetFromFen(ev.fenAfter);
  });

  return () => {
    unsubMove();
    unsubReset?.();
    adapter.dispose?.();
  };
}
