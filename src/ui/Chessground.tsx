import { useEffect, useRef } from 'react';
import { Chessground as ChessgroundFactory } from 'chessground';
import type { Api as ChessgroundApi } from 'chessground/api';
import type { Config as ChessgroundConfig } from 'chessground/config';
import type { Key } from 'chessground/types';
import { Chess } from 'chess.js';
import type { FEN } from '@/core/types';

// chessground CSS themes are imported once via tokens.css.

export type ChessgroundProps = {
  fen: FEN;
  orientation: 'white' | 'black';
  movable?: boolean;
  onMove: (orig: string, dest: string, promotion?: 'q' | 'r' | 'b' | 'n') => void;
};

function computeDests(fen: FEN): Map<Key, Key[]> {
  const dests = new Map<Key, Key[]>();
  const addMovesFrom = (f: FEN) => {
    try {
      const chess = new Chess(f);
      for (const move of chess.moves({ verbose: true })) {
        const from: Key = move.from;
        const to: Key = move.to;
        const list = dests.get(from) ?? [];
        list.push(to);
        dests.set(from, list);
      }
    } catch {
      // Invalid FEN — ignore.
    }
  };
  addMovesFrom(fen);
  // Also generate moves for the non-to-move side so the user can play
  // candidate moves from either color. We mutate the FEN's side-to-move
  // field (and clear en-passant, which depends on it) to let chess.js
  // enumerate the other side's pseudo-legal moves. The resulting dests
  // remain legal one-ply-at-a-time moves; chess-calc's tree logic handles
  // the turn-alternation semantics downstream.
  const flipped = flipSideToMove(fen);
  if (flipped !== null) addMovesFrom(flipped);
  return dests;
}

function flipSideToMove(fen: FEN): FEN | null {
  const parts = fen.split(' ');
  if (parts.length !== 6) return null;
  const cur = parts[1];
  if (cur !== 'w' && cur !== 'b') return null;
  parts[1] = cur === 'w' ? 'b' : 'w';
  parts[3] = '-'; // en-passant target depends on side-to-move; clear it.
  return parts.join(' ');
}

/**
 * Thin React wrapper around Lichess's chessground. Manages the imperative
 * lifecycle (init, updates, cleanup) so consumers can use it declaratively.
 */
export function Chessground({
  fen,
  orientation,
  movable = true,
  onMove,
}: ChessgroundProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<ChessgroundApi | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  // Init / teardown.
  useEffect(() => {
    if (!containerRef.current) return;
    const config: ChessgroundConfig = {
      fen,
      orientation,
      movable: {
        free: false,
        ...(movable ? { color: 'both' as const } : {}),
        dests: computeDests(fen),
        events: {
          after: (orig, dest) => {
            // chessground metadata.promotion is not in default type defs for all versions;
            // default to queen. The picker shortcut (Shift+drop) is spec'd post-v0.
            onMoveRef.current(orig, dest, 'q');
          },
        },
      },
    };
    const api = ChessgroundFactory(containerRef.current, config);
    apiRef.current = api;
    return () => {
      api.destroy();
      apiRef.current = null;
    };
    // Intentionally empty deps — we want this to run once. Prop updates are handled below.
  }, []);

  // Apply fen / orientation / movable updates together. `movable.dests`
  // tracks the current fen (computed for BOTH sides so the user can play
  // candidate moves from either color per spec §8.2). Keep these props in
  // one effect to avoid the past drift bug where splitting them let
  // chessground's init-only config bake in a stale color.
  useEffect(() => {
    apiRef.current?.set({
      fen,
      orientation,
      movable: {
        ...(movable ? { color: 'both' as const } : {}),
        dests: computeDests(fen),
      },
    });
  }, [fen, orientation, movable]);

  return <div ref={containerRef} className="cg-wrap" style={{ width: 280, height: 280 }} />;
}
