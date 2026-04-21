import { useEffect, useRef, useState } from 'react';
import {
  selectChildren,
  selectIsAtRoot,
  selectParentMove,
  selectPulseVersion,
  selectResetVersion,
  selectTreeIsEmpty,
} from '@/state/selectors';
import type { NodeId } from '@/core/types';
import { MoveCard } from './MoveCard';
import { useStore } from './StoreProvider';

const TOAST_VISIBLE_MS = 3000;
const PULSE_VISIBLE_MS = 120;

export function TreeView() {
  const isAtRoot = useStore(selectIsAtRoot);
  const treeIsEmpty = useStore(selectTreeIsEmpty);
  const parentMove = useStore(selectParentMove);
  const children = useStore(selectChildren);
  const resetVersion = useStore(selectResetVersion);
  const pulseVersion = useStore(selectPulseVersion);
  const currentId = useStore((s) => s.tree.currentId);
  const navigateUp = useStore((s) => s.navigateUp);
  const navigateTo = useStore((s) => s.navigateTo);

  // Toast visibility tied to resetVersion bumps.
  const [toastVisible, setToastVisible] = useState(false);
  const prevResetVersion = useRef(resetVersion);
  useEffect(() => {
    if (resetVersion !== prevResetVersion.current) {
      prevResetVersion.current = resetVersion;
      setToastVisible(true);
      const handle = setTimeout(() => setToastVisible(false), TOAST_VISIBLE_MS);
      return () => clearTimeout(handle);
    }
    return undefined;
  }, [resetVersion]);

  // Focus pulse tied to pulseVersion bumps. When playMove matches an existing
  // child, the store bumps pulseVersion and currentId is already set to the
  // matched child's id — pulse that card briefly.
  const [pulsingId, setPulsingId] = useState<NodeId | null>(null);
  const prevPulseVersion = useRef(pulseVersion);
  useEffect(() => {
    if (pulseVersion !== prevPulseVersion.current) {
      prevPulseVersion.current = pulseVersion;
      setPulsingId(currentId);
      const handle = setTimeout(() => setPulsingId(null), PULSE_VISIBLE_MS);
      return () => clearTimeout(handle);
    }
    return undefined;
  }, [pulseVersion, currentId]);

  return (
    <section className="tree-view relative flex flex-col gap-3 p-3">
      {!isAtRoot && parentMove && (
        <MoveCard
          san={parentMove}
          variant="parent"
          onClick={navigateUp}
        />
      )}

      {children.length > 0 && (
        <>
          <h2 className="text-sm text-text-muted font-sans">Candidate replies:</h2>
          <div className="grid grid-cols-2 gap-2">
            {children.map((child) => (
              <MoveCard
                key={child.id}
                san={child.move ?? ''}
                variant="child"
                onClick={() => navigateTo(child.id)}
                isEntering
                isFocusPulse={pulsingId === child.id}
              />
            ))}
          </div>
        </>
      )}

      {treeIsEmpty && (
        <p className="text-center text-sm text-text-muted py-6">
          Play a move on the board to start calculating.
        </p>
      )}

      {toastVisible && (
        <div
          role="status"
          className="absolute left-1/2 -translate-x-1/2 bottom-2 rounded-card bg-surface-elevated px-3 py-2 text-sm text-text shadow-lg"
          style={{
            animation: `fade-in var(--duration-toast-fade) var(--ease)`,
          }}
        >
          New position — tree reset
        </div>
      )}
    </section>
  );
}
