import { describe, expect, it, vi } from 'vitest';
import { advanceRealGame, createTree, getBreadcrumb, getCurrentChildren, getCurrentParentMove, navigateTo, navigateUp, playMove } from './tree';
import { InvalidFenError, type IdGen, type NodeId, type CalculationTree } from './types';
import { applySan } from './chess-utils';

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

  it('getBreadcrumb returns the SAN path from root to current', () => {
    const t0 = createTree(START_FEN, { idGen: counterIdGen() });
    const t1 = playMove(t0, 'e4');
    const t2 = playMove(t1, 'e5');
    expect(getBreadcrumb(t2)).toEqual(['e4', 'e5']);
    // One level deep
    expect(getBreadcrumb(t1)).toEqual(['e4']);
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

describe('navigateTo', () => {
  it('updates currentId when the target id exists', () => {
    const t0 = createTree(START_FEN, { idGen: counterIdGen() });
    const t1 = playMove(t0, 'e4');
    const t2 = navigateTo(t1, t1.rootId);
    expect(t2).not.toBe(t1);
    expect(t2.currentId).toBe(t1.rootId);
    expect(t2.nodes).toBe(t1.nodes); // nodes object unchanged, just currentId flipped
  });

  it('returns the input tree reference-identical when id === currentId', () => {
    const t0 = createTree(START_FEN, { idGen: counterIdGen() });
    expect(navigateTo(t0, t0.currentId)).toBe(t0);
  });

  it('returns the input tree reference-identical when id is unknown', () => {
    const t0 = createTree(START_FEN, { idGen: counterIdGen() });
    expect(navigateTo(t0, 'doesnotexist' as NodeId)).toBe(t0);
  });
});

describe('navigateUp', () => {
  it('moves currentId to the parent of current', () => {
    const t0 = createTree(START_FEN, { idGen: counterIdGen() });
    const t1 = playMove(t0, 'e4');
    const t2 = navigateUp(t1);
    expect(t2.currentId).toBe(t1.rootId);
  });

  it('returns the input tree reference-identical at the root', () => {
    const t0 = createTree(START_FEN, { idGen: counterIdGen() });
    expect(navigateUp(t0)).toBe(t0);
  });
});

describe('advanceRealGame — boundary validation', () => {
  it('throws InvalidFenError when newFen is malformed', () => {
    const t0 = createTree(START_FEN, { idGen: counterIdGen() });
    expect(() => advanceRealGame(t0, 'e4', 'junk')).toThrow(InvalidFenError);
  });
});

describe('advanceRealGame — Case C (no matching child)', () => {
  it('discards the tree and creates a fresh one at newFen, preserving idGen', () => {
    const idGen = counterIdGen();
    const t0 = createTree(START_FEN, { idGen });
    const t1 = playMove(t0, 'e4');
    const t2 = playMove(t1, 'e5');

    // Real game plays 1. d4 instead — no match with existing children of root
    const fenAfterD4 = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1';
    const t3 = advanceRealGame(t2, 'd4', fenAfterD4);

    expect(Object.keys(t3.nodes)).toHaveLength(1);
    expect(t3.nodes[t3.rootId]!.fenAfter).toBe(fenAfterD4);
    expect(t3.idGen).toBe(idGen); // preserved
    expect(t3.currentId).toBe(t3.rootId);
  });
});

describe('advanceRealGame — Case A1 (currentId in surviving subtree)', () => {
  it('slides root forward and preserves currentId when it is on the played line', () => {
    const t0 = createTree(START_FEN, { idGen: counterIdGen() });
    const t1 = playMove(t0, 'e4');            // currentId = n1 (e4)
    const t2 = playMove(t1, 'e5');            // currentId = n2 (e5)
    const deepId = t2.currentId;              // save n2

    // Real game plays 1. e4 — matches child, FENs agree
    const fenAfterE4 =
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const t3 = advanceRealGame(t2, 'e4', fenAfterE4);

    // e4 child is now the root
    expect(t3.nodes[t3.rootId]!.fenAfter).toBe(fenAfterE4);
    expect(t3.nodes[t3.rootId]!.parentId).toBeNull();
    expect(t3.nodes[t3.rootId]!.move).toBeNull(); // root always has null move
    expect(t3.nodes[t3.rootId]!.ply).toBe(0);     // root always has ply 0

    // currentId (n2 / e5 subtree) survives
    expect(t3.currentId).toBe(deepId);
    expect(t3.nodes[deepId]).toBeDefined();

    // Old root (n0) is gone
    expect(t3.nodes[t0.rootId]).toBeUndefined();
  });
});

describe('advanceRealGame — Case A2 (currentId in pruned sibling subtree)', () => {
  it('resets currentId to the new root when current was on a sibling line', () => {
    const t0 = createTree(START_FEN, { idGen: counterIdGen() });
    const t1 = playMove(t0, 'e4');      // n1 child of root
    const t2 = navigateUp(t1);
    const t3 = playMove(t2, 'd4');      // n2 child of root, currentId = n2
    // Now root has two children (n1=e4, n2=d4). currentId = n2 (d4).

    // Real game plays 1. e4 — matches n1. n2 (and its subtree) gets pruned.
    const fenAfterE4 =
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const t4 = advanceRealGame(t3, 'e4', fenAfterE4);

    expect(t4.currentId).toBe(t4.rootId); // reset
    expect(Object.keys(t4.nodes)).toHaveLength(1); // only the new root survives
  });
});

describe('advanceRealGame — Case A3 (currentId was old root)', () => {
  it('resets currentId to the new root when current was the old root', () => {
    const t0 = createTree(START_FEN, { idGen: counterIdGen() });
    const t1 = playMove(t0, 'e4');
    const t2 = navigateUp(t1); // currentId = old root
    expect(t2.currentId).toBe(t0.rootId);

    const fenAfterE4 =
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const t3 = advanceRealGame(t2, 'e4', fenAfterE4);

    expect(t3.currentId).toBe(t3.rootId);
    expect(t3.nodes[t0.rootId]).toBeUndefined(); // old root removed
  });
});

describe('advanceRealGame — Case B (FEN mismatch)', () => {
  it('overwrites child.fenAfter with newFen, preserves subtree, warns to console', () => {
    const t0 = createTree(START_FEN, { idGen: counterIdGen() });
    const t1 = playMove(t0, 'e4');
    const t2 = playMove(t1, 'e5');
    const deepId = t2.currentId;

    // Adapter reports a different FEN than our stored fenAfter for e4.
    // Construct a valid but different FEN that would (in principle) also
    // follow 1. e4 — for the test, any valid FEN distinct from the expected.
    const reportedFen =
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 5 5'; // different move counters

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const t3 = advanceRealGame(t2, 'e4', reportedFen);

      // Root is the matched child, but its fenAfter was overwritten to newFen
      expect(t3.nodes[t3.rootId]!.fenAfter).toBe(reportedFen);

      // Subtree survives (deepId preserved)
      expect(t3.nodes[deepId]).toBeDefined();
      expect(t3.currentId).toBe(deepId);

      // Warning fired, includes "FEN mismatch"
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]![0]).toMatch(/FEN mismatch/);
    } finally {
      warnSpy.mockRestore();
    }
  });
});

function assertInvariants(tree: CalculationTree): void {
  // 1. Every non-root node's parentId exists in nodes.
  // 2. Every id in any children[] exists in nodes.
  // 3. rootId and currentId exist in nodes.
  // 4. child.fenAfter === applySan(parent.fenAfter, child.move)
  // 5. No orphans: every node reachable from rootId.
  expect(tree.nodes[tree.rootId]).toBeDefined();
  expect(tree.nodes[tree.currentId]).toBeDefined();

  const reachable = new Set<string>();
  const stack = [tree.rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    const n = tree.nodes[id];
    expect(n).toBeDefined();
    for (const childId of n!.children) {
      expect(tree.nodes[childId]).toBeDefined();
      stack.push(childId);
    }
  }
  // Invariant 5: the reachable set equals all nodes.
  expect(reachable.size).toBe(Object.keys(tree.nodes).length);

  for (const n of Object.values(tree.nodes)) {
    if (n.parentId !== null) {
      const parent = tree.nodes[n.parentId];
      expect(parent).toBeDefined();
      // Invariant 4:
      const expectedFen = applySan(parent!.fenAfter, n.move!);
      expect(n.fenAfter).toBe(expectedFen);
    }
  }
}

describe('tree invariants hold across op sequences', () => {
  it('holds after createTree', () => {
    assertInvariants(createTree(START_FEN, { idGen: counterIdGen() }));
  });

  it('holds after a series of playMove / navigateUp / navigateTo', () => {
    let t = createTree(START_FEN, { idGen: counterIdGen() });
    t = playMove(t, 'e4');
    t = playMove(t, 'e5');
    t = navigateUp(t);
    t = playMove(t, 'c5'); // siblings branch
    t = navigateTo(t, t.rootId);
    t = playMove(t, 'd4');
    assertInvariants(t);
  });

  it('holds after advanceRealGame Case A (slide root forward)', () => {
    let t = createTree(START_FEN, { idGen: counterIdGen() });
    t = playMove(t, 'e4');
    t = playMove(t, 'e5');
    t = advanceRealGame(
      t,
      'e4',
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    );
    assertInvariants(t);
  });

  it('holds after advanceRealGame Case C (reset)', () => {
    let t = createTree(START_FEN, { idGen: counterIdGen() });
    t = playMove(t, 'e4');
    t = advanceRealGame(
      t,
      'd4',
      'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1',
    );
    assertInvariants(t);
  });

  // Deliberate omission: no invariant check after Case B. Invariant 4
  // (child.fenAfter === applySan(parent.fenAfter, child.move)) is *by
  // design* weakened for the direct children of a node whose fenAfter was
  // overwritten by Case B. The spec's "trust the adapter" rule preserves
  // the subtree even when local FEN consistency with ancestors is lost.
  // If tighter consistency is later required, recompute descendant
  // fenAfter values via BFS from the overridden node.

  it('playMove with existing-child SAN does not duplicate (invariant 6)', () => {
    const t0 = createTree(START_FEN, { idGen: counterIdGen() });
    const t1 = playMove(t0, 'e4');
    const t2 = navigateTo(t1, t1.rootId);
    const before = Object.keys(t2.nodes).length;
    const t3 = playMove(t2, 'e4');
    expect(Object.keys(t3.nodes).length).toBe(before);
    expect(t2.nodes[t2.rootId]!.children).toHaveLength(1);
    expect(t3.nodes[t3.rootId]!.children).toHaveLength(1);
  });

  it('navigateTo(tree, tree.currentId) is reference-identical (invariant 7)', () => {
    const t = createTree(START_FEN, { idGen: counterIdGen() });
    expect(navigateTo(t, t.currentId)).toBe(t);
  });
});
