import { describe, expect, it } from 'vitest';
import {
  selectBreadcrumbEntries,
  selectCaseBVersion,
  selectChildren,
  selectCurrentFen,
  selectIsAtRoot,
  selectParentMove,
  selectPulseVersion,
  selectResetVersion,
  selectTreeIsEmpty,
} from './selectors';
import { createChessCalcStore } from './store';
import type { IdGen, NodeId } from '@/core/types';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function counterIdGen(prefix = 'n'): IdGen {
  let i = 0;
  return () => (`${prefix}${i++}` as NodeId);
}

function newStore() {
  return createChessCalcStore({
    initialFen: START_FEN,
    orientation: 'white',
    idGen: counterIdGen(),
  });
}

describe('selectors', () => {
  it('selectCurrentFen returns the FEN of the current node', () => {
    const store = newStore();
    expect(selectCurrentFen(store.getState())).toBe(START_FEN);
  });

  it('selectChildren returns children of the current node', () => {
    const store = newStore();
    expect(selectChildren(store.getState())).toEqual([]);
    store.getState().playMove('e4');
    store.getState().navigateUp();
    expect(selectChildren(store.getState())).toHaveLength(1);
  });

  it('selectParentMove returns null at root, SAN at descendants', () => {
    const store = newStore();
    expect(selectParentMove(store.getState())).toBeNull();
    store.getState().playMove('e4');
    expect(selectParentMove(store.getState())).toBe('e4');
  });

  it('selectIsAtRoot reflects currentId vs rootId', () => {
    const store = newStore();
    expect(selectIsAtRoot(store.getState())).toBe(true);
    store.getState().playMove('e4');
    expect(selectIsAtRoot(store.getState())).toBe(false);
  });

  it('selectTreeIsEmpty true only when at root AND no children', () => {
    const store = newStore();
    expect(selectTreeIsEmpty(store.getState())).toBe(true);
    store.getState().playMove('e4');
    expect(selectTreeIsEmpty(store.getState())).toBe(false);
    store.getState().navigateUp();
    // At root now, but root has one child → not empty.
    expect(selectTreeIsEmpty(store.getState())).toBe(false);
  });

  it('selectBreadcrumbEntries returns {san, nodeId} pairs root→current', () => {
    const store = newStore();
    expect(selectBreadcrumbEntries(store.getState())).toEqual([]);
    store.getState().playMove('e4');
    store.getState().playMove('e5');
    const entries = selectBreadcrumbEntries(store.getState());
    expect(entries).toHaveLength(2);
    expect(entries[0]!.san).toBe('e4');
    expect(entries[1]!.san).toBe('e5');
    expect(entries[0]!.nodeId).toBeDefined();
    expect(entries[1]!.nodeId).toBeDefined();
  });

  it('selectResetVersion, selectCaseBVersion, selectPulseVersion return counters', () => {
    const store = newStore();
    expect(selectResetVersion(store.getState())).toBe(0);
    expect(selectCaseBVersion(store.getState())).toBe(0);
    expect(selectPulseVersion(store.getState())).toBe(0);
  });
});
