import { createRoot, type Root } from 'react-dom/client';
import { LichessAdapter } from '@/adapters/lichess';
import { LichessDomContractError } from '@/adapters/lichess-errors';
import {
  defaultReadinessCheck,
  GAME_URL_RE,
  SessionController,
  type SessionStartContext,
} from '@/adapters/lichess-session';
import { bridgeAdapter, type Dispose } from '@/state/bridgeAdapter';
import { createChessCalcStore, type ChessCalcStore } from '@/state/store';
import { OverlayUI } from './overlay-ui';
import { OVERLAY_STYLES } from './overlay-styles';

interface SessionRecord {
  token: number;
  store: ChessCalcStore;
  adapter: LichessAdapter;
  disposeBridge: Dispose;
  uiHandle: { remove: () => void };
}

export default defineContentScript({
  matches: ['https://lichess.org/*'],
  cssInjectionMode: 'ui',
  runAt: 'document_idle',
  main(ctx) {
    const sessions = new Map<number, SessionRecord>();

    const controller = new SessionController({
      urlMatcher: (href) => GAME_URL_RE.test(href),
      readinessCheck: defaultReadinessCheck,
    });

    const startSession = async (token: number, sessionCtx: SessionStartContext) => {
      try {
        const store = createChessCalcStore({
          initialFen: sessionCtx.currentFen,
          orientation: sessionCtx.orientation,
        });

        const adapter = new LichessAdapter(sessionCtx);
        try {
          adapter.initialize();
        } catch (err) {
          if (err instanceof LichessDomContractError) {
            // eslint-disable-next-line no-console
            console.error(
              `[chess-calc] LichessDomContractError at ${err.selector} — ` +
                `see src/adapters/__fixtures__/README.md for fixture refresh workflow`,
              err,
            );
            return;
          }
          throw err;
        }

        const disposeBridge = bridgeAdapter(adapter, store);

        const ui = await createShadowRootUi(ctx, {
          name: 'chess-calc-overlay',
          position: 'inline',
          anchor: 'body',
          css: OVERLAY_STYLES,
          onMount: (container: HTMLElement): Root => {
            const root = createRoot(container);
            root.render(<OverlayUI store={store} />);
            return root;
          },
          onRemove: (root: Root | undefined) => {
            root?.unmount();
          },
        });
        ui.mount();

        sessions.set(token, {
          token,
          store,
          adapter,
          disposeBridge,
          uiHandle: ui,
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[chess-calc] session start failed', err);
      }
    };

    const handleStart = (token: number, sessionCtx: SessionStartContext): void => {
      void startSession(token, sessionCtx);
    };

    const handleStop = (token: number) => {
      const record = sessions.get(token);
      if (!record) return;
      sessions.delete(token);
      record.uiHandle.remove();
      record.disposeBridge();
      // disposeBridge calls adapter.dispose?.() — no double-dispose needed.
    };

    controller.activate({
      start: handleStart,
      stop: handleStop,
    });
  },
});
