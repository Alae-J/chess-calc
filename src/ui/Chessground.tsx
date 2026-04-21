import { useEffect, useRef } from 'react';
import { Chessground as ChessgroundFactory } from 'chessground';
import type { Api as ChessgroundApi } from 'chessground/api';
import type { Config as ChessgroundConfig } from 'chessground/config';
import type { Key } from 'chessground/types';
import { Chess } from 'chess.js';
import type { FEN, SAN } from '@/core/types';

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
      const list = dests.get(move.from as Key) ?? [];
      list.push(move.to as Key);
      dests.set(move.from as Key, list);
    }
  } catch {
    // Invalid FEN → no legal moves.
  }
  return dests;
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
        ...(movable ? { color: orientation === 'white' ? 'white' : 'black' } : {}),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply fen updates.
  useEffect(() => {
    apiRef.current?.set({ fen, movable: { dests: computeDests(fen) } });
  }, [fen]);

  // Apply orientation updates.
  useEffect(() => {
    apiRef.current?.set({ orientation });
  }, [orientation]);

  return <div ref={containerRef} className="cg-wrap" style={{ width: 280, height: 280 }} />;
}
