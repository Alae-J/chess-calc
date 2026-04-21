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
 * - Returns a dispose that unsubscribes and calls adapter.dispose?.().
 *
 * This is the single designated cross-layer file (adapters ↔ state). UI
 * never imports this module.
 */
export function bridgeAdapter(adapter: BoardAdapter, store: ChessCalcStore): Dispose {
  store.getState().setOrientation(adapter.getOrientation());

  const unsub = adapter.onMove((ev) => {
    store.getState().advanceRealGame(ev.san, ev.fenAfter);
  });

  return () => {
    unsub();
    adapter.dispose?.();
  };
}
