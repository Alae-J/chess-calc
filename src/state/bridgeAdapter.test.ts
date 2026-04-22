import { describe, expect, it, vi } from 'vitest';
import { MockAdapter } from '@/adapters/mock';
import { bridgeAdapter } from './bridgeAdapter';
import { createChessCalcStore } from './store';
import type { IdGen, NodeId } from '@/core/types';

function counterIdGen(prefix = 'n'): IdGen {
  let i = 0;
  return () => (`${prefix}${i++}` as NodeId);
}

describe('bridgeAdapter', () => {
  it('pushes adapter orientation to the store on bind', () => {
    const adapter = new MockAdapter({ orientation: 'black' });
    const store = createChessCalcStore({
      initialFen: adapter.getCurrentFEN(),
      orientation: 'white',
      idGen: counterIdGen(),
    });
    bridgeAdapter(adapter, store);
    expect(store.getState().orientation).toBe('black');
  });

  it('translates adapter moves into store.advanceRealGame (san + fenAfter only)', () => {
    const adapter = new MockAdapter();
    const store = createChessCalcStore({
      initialFen: adapter.getCurrentFEN(),
      orientation: adapter.getOrientation(),
      idGen: counterIdGen(),
    });
    // Pre-seed a child so e4 matches Case A.
    store.getState().playMove('e4');
    const rootId = store.getState().tree.rootId;
    store.getState().navigateTo(rootId);

    bridgeAdapter(adapter, store);
    adapter.emit('e4');

    // Tree should have advanced (root now the e4 child).
    expect(store.getState().tree.nodes[store.getState().tree.rootId]!.fenAfter).toBe(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    );
  });

  it('dispose unsubscribes and calls adapter.dispose?', () => {
    const adapter = new MockAdapter();
    const disposeSpy = vi.spyOn(adapter, 'dispose');
    const store = createChessCalcStore({
      initialFen: adapter.getCurrentFEN(),
      orientation: adapter.getOrientation(),
      idGen: counterIdGen(),
    });
    const dispose = bridgeAdapter(adapter, store);

    dispose();
    expect(disposeSpy).toHaveBeenCalledTimes(1);

    // After dispose, adapter events should no longer reach the store.
    const beforeTree = store.getState().tree;
    adapter.emit('e4');
    expect(store.getState().tree).toBe(beforeTree);
  });

  it('subscribes to onReset when the adapter provides it and routes to resetFromFen', () => {
    const RESET_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    let resetCb: ((ev: { fenAfter: string }) => void) | null = null;
    const adapter = {
      getCurrentFEN: () => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      getOrientation: () => 'white' as const,
      onMove: () => () => {},
      onReset: (cb: (ev: { fenAfter: string }) => void) => {
        resetCb = cb;
        return () => { resetCb = null; };
      },
    };
    const store = createChessCalcStore({
      initialFen: adapter.getCurrentFEN(),
      orientation: adapter.getOrientation(),
      idGen: counterIdGen(),
    });
    store.getState().playMove('e4');
    const beforeReset = store.getState().resetVersion;

    bridgeAdapter(adapter, store);
    expect(resetCb).not.toBeNull();
    resetCb!({ fenAfter: RESET_FEN });

    expect(store.getState().resetVersion).toBe(beforeReset + 1);
    expect(store.getState().tree.nodes[store.getState().tree.rootId]!.fenAfter).toBe(RESET_FEN);
    expect(Object.keys(store.getState().tree.nodes)).toHaveLength(1);
  });

  it('bridging an adapter without onReset still works normally for onMove', () => {
    const adapter = new MockAdapter();
    const store = createChessCalcStore({
      initialFen: adapter.getCurrentFEN(),
      orientation: adapter.getOrientation(),
      idGen: counterIdGen(),
    });
    expect(() => bridgeAdapter(adapter, store)).not.toThrow();
    adapter.emit('e4');
    expect(store.getState().tree.nodes[store.getState().tree.rootId]!.fenAfter).toBe(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    );
  });

  it('dispose unsubscribes the onReset callback when present', () => {
    let resetCb: ((ev: { fenAfter: string }) => void) | null = null;
    let unsubCalled = false;
    const adapter = {
      getCurrentFEN: () => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      getOrientation: () => 'white' as const,
      onMove: () => () => {},
      onReset: (cb: (ev: { fenAfter: string }) => void) => {
        resetCb = cb;
        return () => { unsubCalled = true; resetCb = null; };
      },
    };
    const store = createChessCalcStore({
      initialFen: adapter.getCurrentFEN(),
      orientation: adapter.getOrientation(),
      idGen: counterIdGen(),
    });
    const dispose = bridgeAdapter(adapter, store);
    dispose();
    expect(unsubCalled).toBe(true);
    expect(resetCb).toBeNull();
  });
});
