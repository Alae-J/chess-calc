// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://lichess.org/" }
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
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
