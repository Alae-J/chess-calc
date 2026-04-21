import { applySan, isValidFen } from './chess-utils';
import {
  type CalcNode,
  type CalculationTree,
  type FEN,
  type IdGen,
  InvalidFenError,
  type NodeId,
  defaultIdGen,
} from './types';
import type { SAN } from './types';

/**
 * No-op / invalid-input policy for this module:
 *
 * - Invalid or no-op operations (e.g. playMove with illegal SAN, navigateUp
 *   at root, navigateTo with an unknown id) return the INPUT tree
 *   reference-identical. Callers MAY use `result === input` to detect that
 *   nothing happened.
 * - The only place this module throws is `createTree` on malformed FEN and
 *   `advanceRealGame` on malformed `newFen` — both throw InvalidFenError.
 *
 * Individual functions restate this contract in their JSDoc.
 */

/**
 * Create a new calculation tree rooted at `rootFen`.
 *
 * @throws {InvalidFenError} if `rootFen` fails FEN validation.
 */
export function createTree(
  rootFen: FEN,
  opts?: { idGen?: IdGen },
): CalculationTree {
  if (!isValidFen(rootFen)) {
    throw new InvalidFenError(rootFen);
  }
  const idGen = opts?.idGen ?? defaultIdGen;
  const rootId = idGen();
  const root: CalcNode = {
    id: rootId,
    parentId: null,
    move: null,
    fenAfter: rootFen,
    children: [],
    ply: 0,
    createdAt: Date.now(),
  };
  return {
    rootId,
    currentId: rootId,
    nodes: { [rootId]: root },
    idGen,
  };
}

/** Returns the move that led to the current node, or null if current is root. */
export function getCurrentParentMove(tree: CalculationTree): SAN | null {
  const current = tree.nodes[tree.currentId];
  if (!current) return null;
  return current.move;
}

/** Returns the child nodes of the current node, in insertion order. */
export function getCurrentChildren(tree: CalculationTree): CalcNode[] {
  const current = tree.nodes[tree.currentId];
  if (!current) return [];
  return current.children
    .map((id) => tree.nodes[id])
    .filter((n): n is CalcNode => n !== undefined);
}

/** Returns the SAN path from root to the current node, excluding the root's null move. */
export function getBreadcrumb(tree: CalculationTree): SAN[] {
  const path: SAN[] = [];
  let cursor: CalcNode | undefined = tree.nodes[tree.currentId];
  while (cursor && cursor.move !== null) {
    path.unshift(cursor.move);
    cursor = cursor.parentId ? tree.nodes[cursor.parentId] : undefined;
  }
  return path;
}

/**
 * Play `san` from the current node.
 *
 * - If `san` matches an existing child's move: navigate to that child,
 *   return a new tree with updated `currentId`. No duplicate created.
 * - If `san` is legal but matches no child: create a new child, navigate
 *   into it.
 * - If `san` is illegal from the current node's FEN: return `tree`
 *   reference-identical. Callers MAY use `result === tree` to detect
 *   rejection.
 */
export function playMove(tree: CalculationTree, san: SAN): CalculationTree {
  const current = tree.nodes[tree.currentId];
  if (!current) return tree;

  // Does an existing child already cover this SAN?
  for (const childId of current.children) {
    const child = tree.nodes[childId];
    if (child && child.move === san) {
      if (childId === tree.currentId) return tree;
      return { ...tree, currentId: childId };
    }
  }

  // Try to apply the move. Illegal → return input tree unchanged.
  const fenAfter = applySan(current.fenAfter, san);
  if (fenAfter === null) return tree;

  const newId = tree.idGen();
  const newChild: CalcNode = {
    id: newId,
    parentId: current.id,
    move: san,
    fenAfter,
    children: [],
    ply: current.ply + 1,
    createdAt: Date.now(),
  };
  const updatedParent: CalcNode = {
    ...current,
    children: [...current.children, newId],
  };
  return {
    ...tree,
    currentId: newId,
    nodes: {
      ...tree.nodes,
      [current.id]: updatedParent,
      [newId]: newChild,
    },
  };
}

/**
 * Navigate to the node with the given id.
 *
 * - If `id === tree.currentId`: returns `tree` reference-identical.
 * - If `id` is not in `tree.nodes`: returns `tree` reference-identical.
 * - Otherwise: returns a new tree with `currentId` updated.
 */
export function navigateTo(tree: CalculationTree, id: NodeId): CalculationTree {
  if (id === tree.currentId) return tree;
  if (!(id in tree.nodes)) return tree;
  return { ...tree, currentId: id };
}

/**
 * Navigate to the parent of the current node.
 *
 * - At root (currentId === rootId, or current.parentId === null): returns
 *   `tree` reference-identical.
 * - Otherwise: returns a new tree with `currentId` set to the parent.
 */
export function navigateUp(tree: CalculationTree): CalculationTree {
  const current = tree.nodes[tree.currentId];
  if (!current || current.parentId === null) return tree;
  return { ...tree, currentId: current.parentId };
}

/**
 * Called when the real game's position advances on the host board.
 *
 * Before any dispatch, validates `newFen` via `isValidFen` — throws
 * InvalidFenError on junk. Consistent with the module-wide rule that bad
 * FEN input always throws.
 *
 * Case dispatch:
 * - A: playedSan matches a child of rootId, newFen === child.fenAfter.
 *      Slide root forward; prune old root and siblings.
 * - B: playedSan matches a child, newFen !== child.fenAfter.
 *      Trust the adapter. Overwrite child.fenAfter. console.warn.
 * - C: playedSan matches no child. Discard tree entirely; fresh tree at
 *      newFen (idGen preserved).
 *
 * For currentId after Cases A and B:
 * - A1: currentId was the played child or a descendant → preserved.
 * - A2: currentId was in a pruned sibling subtree → reset to new root.
 * - A3: currentId was the old root → reset to new root.
 *
 * @throws {InvalidFenError} on malformed `newFen`.
 */
export function advanceRealGame(
  tree: CalculationTree,
  playedSan: SAN,
  newFen: FEN,
): CalculationTree {
  if (!isValidFen(newFen)) {
    throw new InvalidFenError(newFen);
  }

  const root = tree.nodes[tree.rootId];
  if (!root) {
    // Defensive: shouldn't happen given invariants, but be safe.
    return createTree(newFen, { idGen: tree.idGen });
  }

  const matchedChildId = root.children.find((id) => tree.nodes[id]?.move === playedSan);

  if (matchedChildId === undefined) {
    // Case C: no match — discard tree.
    return createTree(newFen, { idGen: tree.idGen });
  }

  // Cases A and B are implemented in subsequent tasks.
  // For now, fall through to Case C so the boundary-validation test passes.
  return createTree(newFen, { idGen: tree.idGen });
}
