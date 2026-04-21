import { create, type StoreApi, type UseBoundStore } from 'zustand';
import {
  createTree,
  navigateTo as navigateToTree,
  navigateUp as navigateUpTree,
  playMove as playMoveTree,
} from '@/core/tree';
import type {
  CalculationTree,
  FEN,
  IdGen,
  NodeId,
  SAN,
} from '@/core/types';

export interface ChessCalcState {
  tree: CalculationTree;
  orientation: 'white' | 'black';
  resetVersion: number;   // bumps on Case C — drives toast
  caseBVersion: number;   // bumps on Case B — drives board-border pulse
  pulseVersion: number;   // bumps on playMove matching existing child — drives focus pulse on that card

  // Actions — chess primitives only. No adapter types.
  playMove: (san: SAN) => void;
  navigateTo: (id: NodeId) => void;
  navigateUp: () => void;
  advanceRealGame: (playedSan: SAN, newFen: FEN) => void;
  setOrientation: (o: 'white' | 'black') => void;
}

export interface CreateStoreOptions {
  initialFen: FEN;
  orientation: 'white' | 'black';
  idGen?: IdGen;
}

export type ChessCalcStore = UseBoundStore<StoreApi<ChessCalcState>>;

/**
 * Adapter-agnostic Zustand store. Construction takes primitives, not an
 * adapter — bridging to a BoardAdapter is the job of bridgeAdapter(...).
 *
 * All no-op actions preserve reference identity of `tree` (the core tree
 * ops return `===` on no-op per Phase 1's contract; we propagate that by
 * not calling set() when the result matches the input).
 */
export function createChessCalcStore(opts: CreateStoreOptions): ChessCalcStore {
  return create<ChessCalcState>()((set, get) => ({
    tree: createTree(opts.initialFen, opts.idGen ? { idGen: opts.idGen } : undefined),
    orientation: opts.orientation,
    resetVersion: 0,
    caseBVersion: 0,
    pulseVersion: 0,

    playMove: (san) => {
      const current = get().tree;
      const next = playMoveTree(current, san);
      if (next === current) return;

      // If node count is unchanged, playMove matched an existing child (navigated into it)
      // rather than creating a new one. That's the "focus pulse" case per design §5.1.
      const matchedExisting =
        Object.keys(next.nodes).length === Object.keys(current.nodes).length;

      set(
        matchedExisting
          ? { tree: next, pulseVersion: get().pulseVersion + 1 }
          : { tree: next },
      );
    },

    navigateTo: (id) => {
      const current = get().tree;
      const next = navigateToTree(current, id);
      if (next !== current) set({ tree: next });
    },

    navigateUp: () => {
      const current = get().tree;
      const next = navigateUpTree(current);
      if (next !== current) set({ tree: next });
    },

    // Implemented in Task 10:
    advanceRealGame: () => {
      throw new Error('not implemented');
    },
    setOrientation: () => {
      throw new Error('not implemented');
    },
  }));
}
