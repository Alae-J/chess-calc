import { getCurrentChildren, getCurrentParentMove } from '@/core/tree';
import type { CalcNode, FEN, NodeId, SAN } from '@/core/types';
import type { ChessCalcState } from './store';

export function selectCurrentFen(state: ChessCalcState): FEN {
  return state.tree.nodes[state.tree.currentId]!.fenAfter;
}

export function selectChildren(state: ChessCalcState): CalcNode[] {
  return getCurrentChildren(state.tree);
}

export function selectParentMove(state: ChessCalcState): SAN | null {
  return getCurrentParentMove(state.tree);
}

export function selectIsAtRoot(state: ChessCalcState): boolean {
  return state.tree.currentId === state.tree.rootId;
}

export function selectTreeIsEmpty(state: ChessCalcState): boolean {
  const root = state.tree.nodes[state.tree.rootId];
  return (
    state.tree.currentId === state.tree.rootId &&
    (root?.children.length ?? 0) === 0
  );
}

/**
 * Walk from the current node back to the root, producing SAN + nodeId pairs
 * in root→current order. Breadcrumb UI uses nodeId for click-to-navigate.
 */
export function selectBreadcrumbEntries(
  state: ChessCalcState,
): Array<{ san: SAN; nodeId: NodeId }> {
  const entries: Array<{ san: SAN; nodeId: NodeId }> = [];
  let cursor: CalcNode | undefined = state.tree.nodes[state.tree.currentId];
  while (cursor && cursor.move !== null) {
    entries.unshift({ san: cursor.move, nodeId: cursor.id });
    cursor = cursor.parentId ? state.tree.nodes[cursor.parentId] : undefined;
  }
  return entries;
}

export function selectResetVersion(state: ChessCalcState): number {
  return state.resetVersion;
}

export function selectCaseBVersion(state: ChessCalcState): number {
  return state.caseBVersion;
}

export function selectPulseVersion(state: ChessCalcState): number {
  return state.pulseVersion;
}
