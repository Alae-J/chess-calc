import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { TreeView } from './TreeView';
import { StoreProvider } from './StoreProvider';
import { createChessCalcStore, type ChessCalcStore } from '@/state/store';
import type { IdGen, NodeId } from '@/core/types';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FEN_AFTER_D4 =
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1';

function counterIdGen(): IdGen {
  let i = 0;
  return () => (`n${i++}` as NodeId);
}

function freshStore(): ChessCalcStore {
  return createChessCalcStore({
    initialFen: START_FEN,
    orientation: 'white',
    idGen: counterIdGen(),
  });
}

function renderWith(store: ChessCalcStore) {
  return render(
    <StoreProvider store={store}>
      <TreeView />
    </StoreProvider>,
  );
}

describe('TreeView', () => {
  it('renders first-use empty state when tree is empty at root', () => {
    const store = freshStore();
    renderWith(store);
    expect(
      screen.getByText(/play a move on the board to start calculating/i),
    ).toBeInTheDocument();
  });

  it('renders children in order when tree has them', () => {
    const store = freshStore();
    store.getState().playMove('e4');
    store.getState().navigateUp();
    store.getState().playMove('d4');
    store.getState().navigateUp();
    renderWith(store);
    expect(screen.getByText('e4')).toBeInTheDocument();
    expect(screen.getByText('d4')).toBeInTheDocument();
  });

  it('renders parent card when not at root', () => {
    const store = freshStore();
    store.getState().playMove('e4');
    renderWith(store);
    // The parent card should show the move that led to current (e4).
    // It's the only MoveCard with the up-arrow icon.
    const buttons = screen.getAllByRole('button');
    const parentButton = buttons.find((b) => b.querySelector('svg'));
    expect(parentButton).toBeDefined();
    expect(parentButton?.textContent).toContain('e4');
  });

  it('leaf empty state is silent (no hint, no header)', () => {
    const store = freshStore();
    store.getState().playMove('e4');
    renderWith(store);
    expect(
      screen.queryByText(/play a move on the board/i),
    ).not.toBeInTheDocument();
  });

  describe('Case C reset toast', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('appears on resetVersion bump and auto-dismisses after 3s', () => {
      const store = freshStore();
      store.getState().playMove('e4');
      renderWith(store);

      expect(screen.queryByText(/tree reset/i)).not.toBeInTheDocument();

      act(() => {
        store.getState().advanceRealGame('d4', FEN_AFTER_D4);
      });
      expect(screen.getByText(/tree reset/i)).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(3200);
      });
      expect(screen.queryByText(/tree reset/i)).not.toBeInTheDocument();
    });
  });
});
