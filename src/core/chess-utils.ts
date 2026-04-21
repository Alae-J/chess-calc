import { Chess } from 'chess.js';
import type { FEN, SAN } from './types';

/**
 * Apply a SAN move to a FEN and return the resulting FEN.
 * Returns `null` if the move is illegal (chess.js throws; we convert to null).
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
