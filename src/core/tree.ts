import { isValidFen } from './chess-utils';
import {
  type CalcNode,
  type CalculationTree,
  type FEN,
  type IdGen,
  InvalidFenError,
  type NodeId,
  defaultIdGen,
} from './types';

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
