// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://lichess.org/" }
import { Chess } from 'chess.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { MoveEvent } from './adapter';
import { LichessAdapter, LichessDomContractError, TAKEBACK_DEBOUNCE_MS } from './lichess';
import { defaultReadinessCheck, STANDARD_START_FEN } from './lichess-session';

function loadFixtureDoc(name: string): Document {
  const html = readFileSync(resolve(__dirname, '__fixtures__', name), 'utf8');
  return new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${html}</body></html>`,
    'text/html',
  );
}

function ctxFromFixture(name: string) {
  const doc = loadFixtureDoc(name);
  const r = defaultReadinessCheck(doc);
  if (r.kind !== 'participant') throw new Error(`fixture ${name} not a participant scenario`);
  return r.ctx;
}

function loadBeforeAfter(name: string): { before: Element; after: Element } {
  const doc = loadFixtureDoc(name);
  const before = doc.querySelector('#before > *');
  const after = doc.querySelector('#after > *');
  if (!before || !after) throw new Error(`${name} missing #before/#after`);
  return { before, after };
}

/**
 * Build a minimal SessionStartContext for mutation-observer tests.
 *
 * LIMITATION: this helper does NOT construct the full `.round__app`
 * hierarchy that production `defaultReadinessCheck` produces. `gameContainer`
 * here is just the body; queries like `gameContainer.querySelector('.result-wrap')`
 * (Task 12's game-over detection) would return null silently. For tests that
 * need a realistic `.round__app` subtree with sibling markers (game-over,
 * status, etc.), either extend this helper or use `ctxFromFixture` with a
 * fixture that has the needed structure.
 */
function mutationCtx(beforeInnerHtml: string, beforeHistory: readonly string[]) {
  const doc = new DOMParser().parseFromString(
    '<!DOCTYPE html><html><body><l4x></l4x></body></html>',
    'text/html',
  );
  const moveListRoot = doc.querySelector('l4x')!;
  moveListRoot.innerHTML = beforeInnerHtml;
  const chess = new Chess();
  for (const san of beforeHistory) chess.move(san);
  return {
    initialFen: STANDARD_START_FEN,
    currentFen: chess.fen(),
    orientation: 'white' as const,
    moveHistory: [...beforeHistory] as readonly string[],
    gameContainer: doc.body,
    moveListRoot,
  };
}

describe('LichessAdapter.initialize', () => {
  it('TAKEBACK_DEBOUNCE_MS is pinned at 150', () => {
    expect(TAKEBACK_DEBOUNCE_MS).toBe(150);
  });

  it('passes health check and attaches observer on a well-formed midgame fixture', () => {
    const ctx = ctxFromFixture('game-standard-midgame.html');
    const adapter = new LichessAdapter(ctx);
    expect(() => adapter.initialize()).not.toThrow();
    expect(adapter.getCurrentFEN()).toBe(ctx.currentFen);
    expect(adapter.getOrientation()).toBe(ctx.orientation);
    adapter.dispose();
  });

  it('throws LichessDomContractError when replayed FEN disagrees with ctx.currentFen', () => {
    const ctx = ctxFromFixture('game-standard-midgame.html');
    // Tamper with ctx.currentFen so replay will disagree.
    const tamperedCtx = { ...ctx, currentFen: STANDARD_START_FEN };
    const adapter = new LichessAdapter(tamperedCtx);
    expect(() => adapter.initialize()).toThrow(LichessDomContractError);
  });

  it('dispose is idempotent', () => {
    const ctx = ctxFromFixture('game-standard-midgame.html');
    const adapter = new LichessAdapter(ctx);
    adapter.initialize();
    expect(() => {
      adapter.dispose();
      adapter.dispose();
      adapter.dispose();
    }).not.toThrow();
  });

  it('onMove returns an unsubscribe function', () => {
    const ctx = ctxFromFixture('game-standard-midgame.html');
    const adapter = new LichessAdapter(ctx);
    adapter.initialize();
    const unsub = adapter.onMove(() => {});
    expect(typeof unsub).toBe('function');
    expect(() => unsub()).not.toThrow();
    adapter.dispose();
  });

  it('onReset returns an unsubscribe function', () => {
    const ctx = ctxFromFixture('game-standard-midgame.html');
    const adapter = new LichessAdapter(ctx);
    adapter.initialize();
    const unsub = adapter.onReset(() => {});
    expect(typeof unsub).toBe('function');
    expect(() => unsub()).not.toThrow();
    adapter.dispose();
  });
});

describe('LichessAdapter.onMove via MutationObserver', () => {
  it('emits MoveEvent when a new move is appended', async () => {
    const { before, after } = loadBeforeAfter('mutation-append-move.html');
    const ctx = mutationCtx(before.innerHTML, ['e4', 'c5', 'Nf3']);
    const adapter = new LichessAdapter(ctx);
    adapter.initialize();
    const events: MoveEvent[] = [];
    adapter.onMove((ev) => events.push(ev));
    ctx.moveListRoot.innerHTML = after.innerHTML;
    await new Promise((r) => setTimeout(r, 20));
    expect(events).toHaveLength(1);
    expect(events[0]!.san.length).toBeGreaterThan(0);
    adapter.dispose();
  });

  it('does not emit on a premove class toggle', async () => {
    const { before, after } = loadBeforeAfter('mutation-premove.html');
    const ctx = mutationCtx(before.innerHTML, ['e4', 'c5', 'Nf3']);
    const adapter = new LichessAdapter(ctx);
    adapter.initialize();
    const events: MoveEvent[] = [];
    adapter.onMove((ev) => events.push(ev));
    ctx.moveListRoot.innerHTML = after.innerHTML;
    await new Promise((r) => setTimeout(r, 20));
    expect(events).toHaveLength(0);
    adapter.dispose();
  });

  it('does not emit on a hover class toggle', async () => {
    const { before, after } = loadBeforeAfter('mutation-hover.html');
    const ctx = mutationCtx(before.innerHTML, ['e4', 'c5']);
    const adapter = new LichessAdapter(ctx);
    adapter.initialize();
    const events: MoveEvent[] = [];
    adapter.onMove((ev) => events.push(ev));
    ctx.moveListRoot.innerHTML = after.innerHTML;
    await new Promise((r) => setTimeout(r, 20));
    expect(events).toHaveLength(0);
    adapter.dispose();
  });

  it('updates getCurrentFEN after emitted move', async () => {
    const { before, after } = loadBeforeAfter('mutation-append-move.html');
    const ctx = mutationCtx(before.innerHTML, ['e4', 'c5', 'Nf3']);
    const adapter = new LichessAdapter(ctx);
    adapter.initialize();
    const beforeFen = adapter.getCurrentFEN();
    ctx.moveListRoot.innerHTML = after.innerHTML;
    await new Promise((r) => setTimeout(r, 20));
    expect(adapter.getCurrentFEN()).not.toBe(beforeFen);
    adapter.dispose();
  });
});
