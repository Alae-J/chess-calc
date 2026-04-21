import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MockAdapter } from '@/adapters/mock';
import { Breadcrumb } from '@/ui/Breadcrumb';
import { MiniBoard } from '@/ui/MiniBoard';
import { Overlay } from '@/ui/Overlay';
import { StoreProvider } from '@/ui/StoreProvider';
import { TreeView } from '@/ui/TreeView';
import { bridgeAdapter } from '@/state/bridgeAdapter';
import { createChessCalcStore } from '@/state/store';
import '@/styles/tokens.css';
import { DevPanel } from './DevPanel';

const adapter = new MockAdapter();
const store = createChessCalcStore({
  initialFen: adapter.getCurrentFEN(),
  orientation: adapter.getOrientation(),
});
bridgeAdapter(adapter, store);

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root element not found in index.html');

createRoot(rootEl).render(
  <StrictMode>
    <StoreProvider store={store}>
      <Overlay>
        <MiniBoard />
        <Breadcrumb />
        <TreeView />
      </Overlay>
      <DevPanel adapter={adapter} store={store} />
    </StoreProvider>
  </StrictMode>,
);
