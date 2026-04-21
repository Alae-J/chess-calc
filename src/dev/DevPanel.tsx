import { useEffect, useState } from 'react';
import type { MockAdapter } from '@/adapters/mock';
import type { ChessCalcStore } from '@/state/store';

const STANDARD_START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function DevPanel({
  adapter,
  store,
}: {
  adapter: MockAdapter;
  store: ChessCalcStore;
}) {
  const [sanInput, setSanInput] = useState('');
  const [scriptInput, setScriptInput] = useState('');
  const [tick, setTick] = useState(0);

  // Re-render on adapter state changes so the status line stays current.
  useEffect(() => {
    const unsub = adapter.onMove(() => setTick((t) => t + 1));
    return unsub;
  }, [adapter]);

  const handleEmit = () => {
    if (!sanInput.trim()) return;
    try {
      adapter.emit(sanInput.trim());
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
    setSanInput('');
  };

  const handlePlay = (one: boolean) => {
    const moves = scriptInput
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (moves.length === 0) return;
    try {
      adapter.script(moves);
      if (one) adapter.playOne();
      else adapter.play();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  };

  const handleReset = () => {
    adapter.reset(STANDARD_START_FEN);
    setTick((t) => t + 1);
  };

  const toggleOrientation = () => {
    const cur = store.getState().orientation;
    store.getState().setOrientation(cur === 'white' ? 'black' : 'white');
  };

  return (
    <aside className="dev-panel fixed bottom-4 left-4 w-[360px] rounded-overlay bg-surface-elevated text-text p-3 flex flex-col gap-2 text-sm font-mono">
      <div className="status">
        <strong>Adapter FEN:</strong> <code className="break-all">{adapter.getCurrentFEN()}</code>
        <br />
        <span className="text-text-muted">tick: {tick}</span>
      </div>

      <div className="flex gap-2">
        <input
          value={sanInput}
          onChange={(e) => setSanInput(e.target.value)}
          placeholder="SAN (e.g. e4)"
          className="flex-1 rounded-card bg-surface px-2 py-1"
        />
        <button
          type="button"
          onClick={handleEmit}
          className="rounded-card bg-accent text-bg px-3 py-1"
        >
          Emit
        </button>
      </div>

      <textarea
        value={scriptInput}
        onChange={(e) => setScriptInput(e.target.value)}
        placeholder="Script (space or newline separated SAN, e.g. e4 e5 Nf3)"
        className="rounded-card bg-surface p-2 h-24"
      />
      <div className="flex gap-2">
        <button type="button" onClick={() => handlePlay(false)} className="rounded-card bg-accent text-bg px-3 py-1">
          Script & Play All
        </button>
        <button type="button" onClick={() => handlePlay(true)} className="rounded-card bg-accent text-bg px-3 py-1">
          Script & Play One
        </button>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={handleReset} className="rounded-card bg-surface px-3 py-1">
          Reset to start
        </button>
        <button type="button" onClick={toggleOrientation} className="rounded-card bg-surface px-3 py-1">
          Toggle orientation
        </button>
      </div>
    </aside>
  );
}
