import { createContext, useContext, type ReactNode } from 'react';
import { useStore as useZustandStore } from 'zustand';
import type { ChessCalcState, ChessCalcStore } from '@/state/store';

const StoreContext = createContext<ChessCalcStore | null>(null);

export function StoreProvider({
  store,
  children,
}: {
  store: ChessCalcStore;
  children: ReactNode;
}) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

/**
 * Subscribe to a slice of the store via a selector. Throws if no
 * {@link StoreProvider} is present in the tree — this is intentional: the
 * whole UI is designed to live under a provider, and a missing one
 * indicates a mount-ordering bug rather than a soft fallback.
 */
export function useStore<T>(selector: (state: ChessCalcState) => T): T {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return useZustandStore(store, selector);
}
