import { nanoid } from 'nanoid';

/** Standard Forsyth–Edwards Notation string. */
export type FEN = string;

/** Standard Algebraic Notation, e.g. "Nxe4", "O-O", "Qxh2#". */
export type SAN = string;

/** Branded identifier for tree nodes. Prevents accidental string mixing. */
export type NodeId = string & { readonly __brand: 'NodeId' };

/** Factory that produces a unique {@link NodeId} on each call. */
export type IdGen = () => NodeId;

/** Default id generator, backed by nanoid. */
export const defaultIdGen: IdGen = () => nanoid() as NodeId;

/** One node in the calculation tree. Root node has `parentId === null` and `move === null`. */
export interface CalcNode {
  readonly id: NodeId;
  readonly parentId: NodeId | null;
  readonly move: SAN | null;
  readonly fenAfter: FEN;
  readonly children: readonly NodeId[];
  readonly ply: number;
  readonly createdAt: number;
}

/**
 * The full calculation tree.
 *
 * TODO (post-v0, when chrome.storage persistence arrives): `idGen` is a
 * function member, which breaks JSON serializability. At that point detach
 * the generator from the tree and provide it via a module-level context.
 */
export interface CalculationTree {
  readonly rootId: NodeId;
  readonly currentId: NodeId;
  readonly nodes: Readonly<Record<NodeId, CalcNode>>;
  readonly idGen: IdGen;
}

/** Thrown by operations that require a valid FEN when given junk. */
export class InvalidFenError extends Error {
  constructor(fen: string) {
    super(`Invalid FEN: ${fen}`);
    this.name = 'InvalidFenError';
  }
}
