import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Breadcrumb } from './Breadcrumb';
import { createChessCalcStore, type ChessCalcStore } from '@/state/store';
import { StoreProvider } from './StoreProvider';
import type { IdGen, NodeId } from '@/core/types';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function counterIdGen(): IdGen {
  let i = 0;
  return () => (`n${i++}` as NodeId);
}

function seed(moves: string[]): ChessCalcStore {
  const store = createChessCalcStore({
    initialFen: START_FEN,
    orientation: 'white',
    idGen: counterIdGen(),
  });
  for (const m of moves) store.getState().playMove(m);
  return store;
}

function renderWithStore(store: ChessCalcStore) {
  return render(
    <StoreProvider store={store}>
      <Breadcrumb />
    </StoreProvider>,
  );
}

describe('Breadcrumb', () => {
  it('renders nothing when at root', () => {
    const store = seed([]);
    const { container } = renderWithStore(store);
    // A nav landmark renders empty-ish — no button entries.
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('renders all entries inline when ≤4 plies', () => {
    const store = seed(['e4', 'e5', 'Nf3', 'Nc6']);
    renderWithStore(store);
    expect(screen.getByText('e4')).toBeInTheDocument();
    expect(screen.getByText('e5')).toBeInTheDocument();
    expect(screen.getByText('Nf3')).toBeInTheDocument();
    expect(screen.getByText('Nc6')).toBeInTheDocument();
  });

  it('collapses to head+tail+ellipsis when >4 plies', () => {
    const store = seed(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']);
    renderWithStore(store);
    expect(screen.getByText('e4')).toBeInTheDocument();
    expect(screen.getByText('e5')).toBeInTheDocument();
    expect(screen.getByText('Bb5')).toBeInTheDocument();
    expect(screen.getByText('a6')).toBeInTheDocument();
    expect(screen.queryByText('Nf3')).not.toBeInTheDocument();
    expect(screen.queryByText('Nc6')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /…|\.\.\./ })).toBeInTheDocument();
  });

  it('clicking an entry navigates to that node', async () => {
    const store = seed(['e4', 'e5']);
    renderWithStore(store);

    const beforeCurrent = store.getState().tree.currentId;
    await userEvent.click(screen.getByText('e4'));
    const afterCurrent = store.getState().tree.currentId;
    expect(afterCurrent).not.toBe(beforeCurrent);
  });

  it('clicking ellipsis opens a popover listing hidden entries', async () => {
    const store = seed(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']);
    renderWithStore(store);
    await userEvent.click(screen.getByRole('button', { name: /…|\.\.\./ }));
    expect(screen.getByText('Nf3')).toBeInTheDocument();
    expect(screen.getByText('Nc6')).toBeInTheDocument();
  });

  it('Escape closes the popover', async () => {
    const store = seed(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']);
    renderWithStore(store);
    await userEvent.click(screen.getByRole('button', { name: /…|\.\.\./ }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText('Nf3')).not.toBeInTheDocument();
  });

  it('clicking outside the popover closes it', async () => {
    const store = seed(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']);
    renderWithStore(store);
    await userEvent.click(screen.getByRole('button', { name: /…|\.\.\./ }));
    expect(screen.getByText('Nf3')).toBeInTheDocument();
    await userEvent.click(document.body);
    expect(screen.queryByText('Nf3')).not.toBeInTheDocument();
  });
});
