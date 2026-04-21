import { useCallback, useEffect, useRef, useState } from 'react';
import {
  selectBreadcrumbEntries,
} from '@/state/selectors';
import type { NodeId, SAN } from '@/core/types';
import { useStore } from './StoreProvider';

const COLLAPSE_THRESHOLD = 4;
const HEAD_TAIL_COUNT = 2;

type Entry = { san: SAN; nodeId: NodeId };

export function Breadcrumb() {
  const entries = useStore(selectBreadcrumbEntries);
  const navigateTo = useStore((s) => s.navigateTo);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const handleNavigate = useCallback(
    (id: NodeId) => {
      navigateTo(id);
      setPopoverOpen(false);
    },
    [navigateTo],
  );

  // Close popover on Escape or outside click.
  useEffect(() => {
    if (!popoverOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopoverOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [popoverOpen]);

  if (entries.length === 0) {
    return <nav className="breadcrumb" aria-label="Calculation path" />;
  }

  const collapsed = entries.length > COLLAPSE_THRESHOLD;
  const head = collapsed ? entries.slice(0, HEAD_TAIL_COUNT) : entries;
  const hidden = collapsed
    ? entries.slice(HEAD_TAIL_COUNT, entries.length - HEAD_TAIL_COUNT)
    : [];
  const tail = collapsed ? entries.slice(-HEAD_TAIL_COUNT) : [];

  const renderEntry = (e: Entry) => (
    <button
      key={e.nodeId}
      type="button"
      onClick={() => handleNavigate(e.nodeId)}
      className="text-text-muted hover:text-text font-mono text-sm px-1 transition"
    >
      {e.san}
    </button>
  );

  return (
    <nav
      className="breadcrumb flex flex-wrap items-center gap-1 px-2 py-1"
      aria-label="Calculation path"
    >
      {head.map(renderEntry)}
      {collapsed && (
        <div className="relative" ref={popoverRef}>
          <button
            type="button"
            onClick={() => setPopoverOpen((v) => !v)}
            className="text-text-muted hover:text-text font-mono text-sm px-1 transition"
            aria-expanded={popoverOpen}
          >
            …
          </button>
          {popoverOpen && (
            <div
              role="menu"
              className="absolute top-full left-0 mt-1 flex flex-col gap-1 rounded-card bg-surface-elevated p-2 shadow-lg z-10"
              style={{
                animation: `fade-in var(--duration-popover) var(--ease)`,
              }}
            >
              {hidden.map(renderEntry)}
            </div>
          )}
        </div>
      )}
      {collapsed && tail.map(renderEntry)}
    </nav>
  );
}
