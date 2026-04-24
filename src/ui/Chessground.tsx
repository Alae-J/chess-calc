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
  try {
    const chess = new Chess(fen);
    for (const move of chess.moves({ verbose: true })) {
      const from: Key = move.from;
      const to: Key = move.to;
      const list = dests.get(from) ?? [];
      list.push(to);
      dests.set(from, list);
    }
  } catch {
    // Invalid FEN → no legal moves.
  }
  return dests;
}

/** Returns 'white' or 'black' based on whose turn it is in the FEN. */
function sideToMoveColor(fen: FEN): 'white' | 'black' {
  const parts = fen.split(' ');
  return parts[1] === 'b' ? 'black' : 'white';
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
    const turnColor = sideToMoveColor(fen);
    const config: ChessgroundConfig = {
      fen,
      orientation,
      turnColor,
      // Premove is for real games where you're queueing a move for when it
      // becomes your turn. On the calc-tree mini-board the user is
      // exploring node-by-node, so out-of-turn drags should be rejected
      // outright — not silently queued as a ghost move.
      premovable: { enabled: false },
      movable: {
        free: false,
        ...(movable ? { color: turnColor } : {}),
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

  // Apply fen / orientation / turnColor / movable updates together. These
  // four are COUPLED: `turnColor` is what chessground uses to decide
  // whether a drop is an immediate move or a premove, and `movable.color`
  // gates which pieces can be picked up. Both must track the side-to-move
  // in the current FEN, or chessground silently premoves when the user
  // expected a regular move. Spec §8.2: "play moves from either side"
  // means the user can explore candidate lines for either color, not skip
  // turn alternation. Keep in one effect to avoid drift.
  useEffect(() => {
    const turnColor = sideToMoveColor(fen);
    apiRef.current?.set({
      fen,
      orientation,
      turnColor,
      movable: {
        ...(movable ? { color: turnColor } : {}),
        dests: computeDests(fen),
      },
    });
  }, [fen, orientation, movable]);

  return <div ref={containerRef} className="cg-wrap" style={{ width: 280, height: 280 }} />;
}
