/**
 * Thrown when the Lichess DOM doesn't match our observed selectors or
 * contracts — e.g. a health-check failure, a move-list replay that can't
 * be applied through chess.js, or a reconciliation mismatch between the
 * replayed FEN and the observed currentFen.
 *
 * Lives in its own module to avoid a value-level circular dependency
 * between `lichess.ts` (which throws this) and `lichess-session.ts`
 * (which also throws this from `defaultReadinessCheck` on replay failure).
 */
export class LichessDomContractError extends Error {
  constructor(public readonly selector: string, message?: string) {
    super(message ?? `Lichess DOM contract violation at selector: ${selector}`);
    this.name = 'LichessDomContractError';
  }
}
