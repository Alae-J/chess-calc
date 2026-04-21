import { describe, expect, it, vi } from 'vitest';
import { MockAdapter } from '@/adapters/mock';
import { bridgeAdapter } from './bridgeAdapter';
import { createChessCalcStore } from './store';
import type { IdGen, NodeId } from '@/core/types';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

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
});
