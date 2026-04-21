import { describe, expect, it } from 'vitest';
import { createChessCalcStore } from './store';
import type { IdGen, NodeId } from '@/core/types';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function counterIdGen(prefix = 'n'): IdGen {
  let i = 0;
  return () => (`${prefix}${i++}` as NodeId);
}

describe('createChessCalcStore', () => {
  it('initializes with a root-only tree at the given FEN', () => {
    const store = createChessCalcStore({
      initialFen: START_FEN,
      orientation: 'white',
      idGen: counterIdGen(),
    });
    const state = store.getState();
    expect(state.tree.rootId).toBe('n0');
    expect(state.tree.currentId).toBe('n0');
    expect(state.orientation).toBe('white');
    expect(state.resetVersion).toBe(0);
    expect(state.caseBVersion).toBe(0);
    expect(state.pulseVersion).toBe(0);
  });
});

describe('store.playMove', () => {
  it('delegates to core/tree.playMove and updates the tree', () => {
    const store = createChessCalcStore({
      initialFen: START_FEN,
      orientation: 'white',
      idGen: counterIdGen(),
    });
    const before = store.getState().tree;
    store.getState().playMove('e4');
    const after = store.getState().tree;
    expect(after).not.toBe(before);
    expect(Object.keys(after.nodes)).toHaveLength(2);
  });

  it('preserves reference identity on illegal SAN (no state update)', () => {
    const store = createChessCalcStore({
      initialFen: START_FEN,
      orientation: 'white',
      idGen: counterIdGen(),
    });
    const before = store.getState().tree;
    store.getState().playMove('Ke2');
    const after = store.getState().tree;
    expect(after).toBe(before);
  });

  it('bumps pulseVersion when SAN matches an existing child (no new node created)', () => {
    const store = createChessCalcStore({
      initialFen: START_FEN,
      orientation: 'white',
      idGen: counterIdGen(),
    });
    store.getState().playMove('e4');                      // creates child
    const rootId = store.getState().tree.rootId;
    store.getState().navigateTo(rootId);
    const beforePulse = store.getState().pulseVersion;

    store.getState().playMove('e4');                      // re-matches existing child

    expect(store.getState().pulseVersion).toBe(beforePulse + 1);
    expect(Object.keys(store.getState().tree.nodes)).toHaveLength(2);
  });

  it('does not bump pulseVersion when creating a new child', () => {
    const store = createChessCalcStore({
      initialFen: START_FEN,
      orientation: 'white',
      idGen: counterIdGen(),
    });
    const before = store.getState().pulseVersion;
    store.getState().playMove('e4');
    expect(store.getState().pulseVersion).toBe(before);
  });
});

describe('store.navigateTo', () => {
  it('updates currentId when target exists', () => {
    const store = createChessCalcStore({
      initialFen: START_FEN,
      orientation: 'white',
      idGen: counterIdGen(),
    });
    store.getState().playMove('e4');
    const rootId = store.getState().tree.rootId;
    store.getState().navigateTo(rootId);
    expect(store.getState().tree.currentId).toBe(rootId);
  });

  it('preserves reference identity for unknown id', () => {
    const store = createChessCalcStore({
      initialFen: START_FEN,
      orientation: 'white',
      idGen: counterIdGen(),
    });
    const before = store.getState().tree;
    store.getState().navigateTo('doesnotexist' as NodeId);
    expect(store.getState().tree).toBe(before);
  });
});

describe('store.navigateUp', () => {
  it('moves currentId to parent', () => {
    const store = createChessCalcStore({
      initialFen: START_FEN,
      orientation: 'white',
      idGen: counterIdGen(),
    });
    store.getState().playMove('e4');
    const rootId = store.getState().tree.rootId;
    store.getState().navigateUp();
    expect(store.getState().tree.currentId).toBe(rootId);
  });

  it('preserves reference identity at root', () => {
    const store = createChessCalcStore({
      initialFen: START_FEN,
      orientation: 'white',
      idGen: counterIdGen(),
    });
    const before = store.getState().tree;
    store.getState().navigateUp();
    expect(store.getState().tree).toBe(before);
  });
});
