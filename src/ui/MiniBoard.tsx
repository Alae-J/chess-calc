import { useEffect, useRef, useState } from 'react';
import { sanFromMove } from '@/core/chess-utils';
import {
  selectCaseBVersion,
  selectCurrentFen,
} from '@/state/selectors';
import { Chessground } from './Chessground';
import { useStore } from './StoreProvider';

const CASEB_PULSE_MS = 800;

export function MiniBoard() {
  const fen = useStore(selectCurrentFen);
  const orientation = useStore((s) => s.orientation);
  const playMove = useStore((s) => s.playMove);
  const caseBVersion = useStore(selectCaseBVersion);

  // Toggle the caseB-pulse class for a short duration on version bump.
  const [pulseActive, setPulseActive] = useState(false);
  const prevVersion = useRef(caseBVersion);
  useEffect(() => {
    if (caseBVersion !== prevVersion.current) {
      prevVersion.current = caseBVersion;
      setPulseActive(true);
      const handle = setTimeout(() => setPulseActive(false), CASEB_PULSE_MS);
      return () => clearTimeout(handle);
    }
    return undefined;
  }, [caseBVersion]);

  const handleMove = (orig: string, dest: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
    const san = sanFromMove(fen, orig, dest, promotion);
    if (san !== null) playMove(san);
  };

  return (
    <div className={`miniboard rounded-overlay p-1 ${pulseActive ? 'caseb-pulse' : ''}`}>
      <Chessground fen={fen} orientation={orientation} onMove={handleMove} />
    </div>
  );
}
