import { describe, expect, it } from 'vitest';
import { createTree, getBreadcrumb, getCurrentChildren, getCurrentParentMove, playMove } from './tree';
import { InvalidFenError, type IdGen, type NodeId } from './types';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Deterministic id generator for tests. */
function counterIdGen(prefix = 'n'): IdGen {
  let i = 0;
  return () => (`${prefix}${i++}` as NodeId);
}

describe('createTree', () => {
  it('creates a root-only tree at the given FEN', () => {
    const tree = createTree(START_FEN, { idGen: counterIdGen() });
    expect(Object.keys(tree.nodes)).toHaveLength(1);
    expect(tree.rootId).toBe('n0');
    expect(tree.currentId).toBe(tree.rootId);

    const root = tree.nodes[tree.rootId];
    expect(root).toBeDefined();
    expect(root!.parentId).toBeNull();
    expect(root!.move).toBeNull();
    expect(root!.fenAfter).toBe(START_FEN);
    expect(root!.ply).toBe(0);
    expect(root!.children).toEqual([]);
  });

  it('throws InvalidFenError on malformed FEN', () => {
    expect(() => createTree('junk')).toThrow(InvalidFenError);
  });

  it('uses the default idGen when none is provided', () => {
    const tree = createTree(START_FEN);
    expect(tree.rootId).toMatch(/^[A-Za-z0-9_-]{10,}$/); // nanoid default length
  });
});

describe('read helpers (on a root-only tree)', () => {
  it('getCurrentParentMove returns null at the root', () => {
    const tree = createTree(START_FEN, { idGen: counterIdGen() });
    expect(getCurrentParentMove(tree)).toBeNull();
  });

  it('getCurrentChildren returns an empty array on an empty tree', () => {
    const tree = createTree(START_FEN, { idGen: counterIdGen() });
    expect(getCurrentChildren(tree)).toEqual([]);
  });

  it('getBreadcrumb returns an empty array at the root', () => {
    const tree = createTree(START_FEN, { idGen: counterIdGen() });
    expect(getBreadcrumb(tree)).toEqual([]);
  });
});

describe('playMove — new child', () => {
  it('creates a child node and moves currentId into it', () => {
    const t0 = createTree(START_FEN, { idGen: counterIdGen() });
    const t1 = playMove(t0, 'e4');

    expect(t1).not.toBe(t0);
    expect(Object.keys(t1.nodes)).toHaveLength(2);

    const root = t1.nodes[t1.rootId]!;
    expect(root.children).toHaveLength(1);

    const childId = root.children[0]!;
    const child = t1.nodes[childId]!;
    expect(t1.currentId).toBe(childId);
    expect(child.move).toBe('e4');
    expect(child.parentId).toBe(t1.rootId);
    expect(child.ply).toBe(1);
    expect(child.fenAfter).toBe(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    );
  });
});

describe('playMove — existing child', () => {
  it('navigates into the existing child instead of duplicating', () => {
    const t0 = createTree(START_FEN, { idGen: counterIdGen() });
    const t1 = playMove(t0, 'e4');
    // Go back up and play e4 again
    const t2 = { ...t1, currentId: t1.rootId };
    const t3 = playMove(t2, 'e4');

    expect(Object.keys(t3.nodes)).toHaveLength(2);
    expect(t3.nodes[t1.rootId]!.children).toHaveLength(1);
    expect(t3.currentId).toBe(t1.currentId); // back in the original e4 child
  });
});

describe('playMove — illegal SAN', () => {
  it('returns the input tree reference-identical', () => {
    const t0 = createTree(START_FEN, { idGen: counterIdGen() });
    const t1 = playMove(t0, 'Ke2'); // king can't move there from the start
    expect(t1).toBe(t0);

    const t2 = playMove(t0, 'gibberish');
    expect(t2).toBe(t0);
  });
});
