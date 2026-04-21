import { describe, expect, it } from 'vitest';
import { createTree } from './tree';
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
