import { StrictMode } from 'react';
import { Breadcrumb } from '@/ui/Breadcrumb';
import { MiniBoard } from '@/ui/MiniBoard';
import { Overlay } from '@/ui/Overlay';
import { StoreProvider } from '@/ui/StoreProvider';
import { TreeView } from '@/ui/TreeView';
import type { ChessCalcStore } from '@/state/store';

/**
 * The full overlay UI, wrapped in StoreProvider so everything below reads
 * from the supplied store. Mirrors src/dev/standalone.tsx's UI tree minus
 * the DevPanel.
 */
export function OverlayUI({ store }: { store: ChessCalcStore }) {
  return (
    <StrictMode>
      <StoreProvider store={store}>
        <Overlay>
          <MiniBoard />
          <Breadcrumb />
          <TreeView />
        </Overlay>
      </StoreProvider>
    </StrictMode>
  );
}
