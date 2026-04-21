import { Chess, validateFen } from 'chess.js';
import type { FEN, SAN } from './types';

/**
 * Thin wrappers over chess.js.
 *
 * Module policy: parsing utilities return null (or `false` for `isValidFen`)
 * on invalid FEN input. They never throw. Callers that need to fail on
 * invalid input should validate first via `isValidFen`.
 */

/**
 * Apply a SAN move to a FEN and return the resulting FEN.
 * Returns `null` if the FEN is invalid or the move is illegal.
 */
export function applySan(fen: FEN, san: SAN): FEN | null {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return null;
  }
  try {
    chess.move(san);
  } catch {
    return null;
  }
  return chess.fen();
}

/** Returns true if `fen` is a well-formed, legal FEN per chess.js. */
export function isValidFen(fen: string): boolean {
  return validateFen(fen).ok;
}

/**
 * Returns 'w' or 'b' based on which side is to move in the FEN,
 * or `null` if the FEN is invalid.
 */
export function fenSideToMove(fen: FEN): 'w' | 'b' | null {
  try {
    const chess = new Chess(fen);
    return chess.turn();
  } catch {
    return null;
  }
}

/**
 * Apply a move specified by from/to squares (and optional promotion) to a
 * FEN, and return the resulting SAN string. Returns null if the FEN is
 * invalid or the move is illegal. Follows this module's policy of returning
 * null on invalid input rather than throwing.
 */
export function sanFromMove(
  fen: FEN,
  from: string,
  to: string,
  promotion?: 'q' | 'r' | 'b' | 'n',
): SAN | null {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return null;
  }
  try {
    const move = chess.move(promotion ? { from, to, promotion } : { from, to });
    return move.san;
  } catch {
    return null;
  }
}
