import { useEffect, type ReactNode } from 'react';
import { useStore } from './StoreProvider';

export type OverlayProps = {
  children: ReactNode;
};

/**
 * Phase 2: static-positioned container with a title strip. Drag / resize /
 * minimize / close affordances land in Phase 4 as a targeted replacement.
 * The ← key shortcut for navigateUp is wired here.
 */
export function Overlay({ children }: OverlayProps) {
  const navigateUp = useStore((s) => s.navigateUp);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && !e.defaultPrevented) {
        navigateUp();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigateUp]);

  return (
    <div
      className="overlay fixed top-4 right-4 w-[360px] rounded-overlay bg-surface text-text shadow-2xl flex flex-col overflow-hidden"
      role="region"
      aria-label="Chess Calc"
    >
      <header className="title-strip flex items-center justify-between px-3 py-2 bg-surface-elevated text-sm font-sans">
        <span>Chess Calc</span>
        {/* Phase 4 will add drag handle, minimize, and close affordances here. */}
      </header>
      <div className="overlay-body flex flex-col">{children}</div>
    </div>
  );
}
