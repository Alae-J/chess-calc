// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://lichess.org/" }
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Chess } from 'chess.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SessionController,
  GAME_URL_RE,
  defaultReadinessCheck,
  parseOrientation,
  parseParticipant,
  parseMoveHistory,
  parseStartingFen,
  parseVariant,
  isSupportedVariant,
  STANDARD_START_FEN,
  type SessionStartContext,
} from './lichess-session';
import { LichessDomContractError } from './lichess-errors';

function loadFixture(name: string): Document {
  const path = resolve(__dirname, '__fixtures__', name);
  const html = readFileSync(path, 'utf8');
  const parser = new DOMParser();
  return parser.parseFromString(`<!DOCTYPE html><html><body>${html}</body></html>`, 'text/html');
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const mkCtx = (gameId: string): SessionStartContext => ({
  initialFen: START_FEN,
  currentFen: START_FEN,
  orientation: 'white',
  moveHistory: [],
  gameContainer: document.createElement('div'),
  moveListRoot: document.createElement('div'),
  _gameIdForTest: gameId,
});

describe('GAME_URL_RE', () => {
  it.each([
    ['https://lichess.org/abc12345', true],
    ['https://lichess.org/abc12345/white', true],
    ['https://lichess.org/abc12345/black', true],
    ['https://lichess.org/abc12345/', true],
    ['https://lichess.org/abc12345/white/', true],
    ['https://lichess.org/ABCdef12', true],
    ['https://lichess.org/5qTGsc8K3y8H', true],       // 12-char live-game ID
    ['https://lichess.org/5qTGsc8K3y8H/white', true], // 12-char with color
    ['https://lichess.org/5qTGsc8K3y8H/black', true], // 12-char with color
    ['https://lichess.org/5qTGsc8K3y8H/', true],      // 12-char with trailing slash
  ])('matches %s = %s', (url, expected) => {
    expect(GAME_URL_RE.test(url)).toBe(expected);
  });

  it.each([
    ['https://lichess.org/', false],
    ['https://lichess.org/tv', false],
    ['https://lichess.org/abc1234', false],            // 7 chars
    ['https://lichess.org/abc123456', false],          // 9 chars
    ['https://lichess.org/abc12345/extra', false],
    ['https://lichess.org/abc12345/white/extra', false],
    ['https://lichess.org/training/abc12345', false],
    ['https://lichess.org/broadcast/abc12345', false],
    ['https://lichess.org/study/abc12345', false],
    ['https://lichess.org/tournament/abc12345', false],
    ['http://lichess.org/abc12345', false],             // http not https
    ['https://lichess.org/abc12345?foo=1', false],      // query string
    ['https://lichess.org/abc12345#frag', false],
    ['https://lichess.org/abcdefghij', false],    // 10 chars (between 8 and 12)
    ['https://lichess.org/abc', false],           // 3 chars
    ['https://lichess.org/abcdefghijklm', false], // 13 chars
  ])('rejects %s', (url, expected) => {
    expect(GAME_URL_RE.test(url)).toBe(expected);
  });
});

describe('SessionController', () => {
  let events: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> };
  let readinessCheck: ReturnType<typeof vi.fn>;
  let ctrl: SessionController;
  let disposable: { dispose: () => void } | null;
  const originalLocation = window.location.href;

  beforeEach(() => {
    events = { start: vi.fn(), stop: vi.fn() };
    readinessCheck = vi.fn();
    disposable = null;
    vi.useFakeTimers();
    // jsdom's location is read-only; use history.replaceState to simulate URLs in tests.
    history.replaceState(null, '', '/');
  });

  afterEach(() => {
    disposable?.dispose();
    vi.useRealTimers();
    history.replaceState(null, '', originalLocation);
  });

  const setUrl = (path: string) => {
    history.replaceState(null, '', path);
  };

  it('on URL-enter to an allow-listed URL, increments token and calls readinessCheck', () => {
    readinessCheck.mockReturnValue({ kind: 'participant', ctx: mkCtx('abc12345') });
    ctrl = new SessionController({
      urlMatcher: (href) => GAME_URL_RE.test(href),
      readinessCheck,
    });

    setUrl('/abc12345');
    disposable = ctrl.activate(events);
    vi.advanceTimersByTime(150); // trigger first poll

    expect(readinessCheck).toHaveBeenCalled();
    expect(events.start).toHaveBeenCalledWith(1, expect.objectContaining({ _gameIdForTest: 'abc12345' }));
  });

  it('does not start on non-allow-listed URL', () => {
    ctrl = new SessionController({
      urlMatcher: (href) => GAME_URL_RE.test(href),
      readinessCheck,
    });
    setUrl('/tv');
    disposable = ctrl.activate(events);
    vi.advanceTimersByTime(150);
    expect(events.start).not.toHaveBeenCalled();
  });

  it('stale-token async readiness result does not emit start', async () => {
    let resolveFirst: ((result: unknown) => void) | null = null;
    readinessCheck.mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }));
    readinessCheck.mockReturnValue({ kind: 'participant', ctx: mkCtx('xyz98765') });

    ctrl = new SessionController({
      urlMatcher: (href) => GAME_URL_RE.test(href),
      readinessCheck,
    });
    setUrl('/abc12345');
    disposable = ctrl.activate(events);
    vi.advanceTimersByTime(150);
    // Now navigate away before the first readinessCheck resolves.
    setUrl('/xyz98765');
    vi.advanceTimersByTime(150);
    // Resolve the FIRST readinessCheck (stale).
    resolveFirst!({ kind: 'participant', ctx: mkCtx('abc12345') });
    await Promise.resolve(); // flush microtasks

    // start should have been called for xyz98765 (token 2) but NOT for abc12345 (stale token 1).
    const gameIds = events.start.mock.calls.map((c) => (c[1] as { _gameIdForTest: string })._gameIdForTest);
    expect(gameIds).not.toContain('abc12345');
    expect(gameIds).toContain('xyz98765');
  });

  it('spectator result does not emit start', () => {
    readinessCheck.mockReturnValue({ kind: 'spectator' });
    ctrl = new SessionController({
      urlMatcher: (href) => GAME_URL_RE.test(href),
      readinessCheck,
    });
    setUrl('/abc12345');
    disposable = ctrl.activate(events);
    vi.advanceTimersByTime(150);
    expect(events.start).not.toHaveBeenCalled();
  });

  it('unsupported-variant result does not emit start and logs a warning', () => {
    readinessCheck.mockReturnValue({ kind: 'unsupported-variant', name: 'crazyhouse' });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    ctrl = new SessionController({
      urlMatcher: (href) => GAME_URL_RE.test(href),
      readinessCheck,
    });
    setUrl('/abc12345');
    disposable = ctrl.activate(events);
    vi.advanceTimersByTime(150);
    expect(events.start).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toMatch(/crazyhouse/);
    warnSpy.mockRestore();
  });

  it('URL change to a different game stops the old session and starts the new', () => {
    readinessCheck.mockImplementation(() => {
      const path = window.location.pathname;
      const id = path.split('/').filter(Boolean)[0] ?? 'unknown';
      return { kind: 'participant', ctx: mkCtx(id) };
    });
    ctrl = new SessionController({
      urlMatcher: (href) => GAME_URL_RE.test(href),
      readinessCheck,
    });
    setUrl('/abc12345');
    disposable = ctrl.activate(events);
    vi.advanceTimersByTime(150);
    expect(events.start).toHaveBeenCalledWith(1, expect.objectContaining({ _gameIdForTest: 'abc12345' }));

    setUrl('/xyz98765');
    vi.advanceTimersByTime(150);
    expect(events.stop).toHaveBeenCalledWith(1);
    expect(events.start).toHaveBeenCalledWith(2, expect.objectContaining({ _gameIdForTest: 'xyz98765' }));
  });

  it('dispose is idempotent', () => {
    readinessCheck.mockReturnValue({ kind: 'not-ready' });
    ctrl = new SessionController({
      urlMatcher: (href) => GAME_URL_RE.test(href),
      readinessCheck,
    });
    setUrl('/abc12345');
    const d = ctrl.activate(events);
    expect(() => {
      d.dispose();
      d.dispose();
      d.dispose();
    }).not.toThrow();
  });
});

describe('parseParticipant', () => {
  it('returns "black" for a game where the user plays Black', () => {
    const doc = loadFixture('game-standard-midgame.html');
    expect(parseParticipant(doc)).toBe('black');
  });

  it('returns "white" for a game where the user plays White', () => {
    const doc = loadFixture('game-standard-user-white.html');
    expect(parseParticipant(doc)).toBe('white');
  });

  it('returns "spectator" for a game where the chat input is absent', () => {
    const doc = loadFixture('game-standard-spectator.html');
    expect(parseParticipant(doc)).toBe('spectator');
  });

  it('returns "spectator" when the orientation host is missing but chat input is present', () => {
    // Synthesized edge case: chat input without a .cg-wrap element.
    const doc = new DOMParser().parseFromString(
      `<!DOCTYPE html><html><body><input class="mchat__say"></body></html>`,
      'text/html',
    );
    expect(parseParticipant(doc)).toBe('spectator');
  });
});

describe('parseOrientation', () => {
  it('returns "black" for orientation-black', () => {
    const doc = loadFixture('game-standard-midgame.html');
    expect(parseOrientation(doc)).toBe('black');
  });

  it('returns "white" for orientation-white', () => {
    const doc = loadFixture('game-standard-user-white.html');
    expect(parseOrientation(doc)).toBe('white');
  });

  it('returns null when no orientation host is present', () => {
    const emptyDoc = new DOMParser().parseFromString('<html><body></body></html>', 'text/html');
    expect(parseOrientation(emptyDoc)).toBeNull();
  });

  it('returns null when the host has neither orientation class', () => {
    const doc = new DOMParser().parseFromString(
      '<!DOCTYPE html><html><body><div class="cg-wrap manipulable"></div></body></html>',
      'text/html',
    );
    expect(parseOrientation(doc)).toBeNull();
  });
});

describe('parseMoveHistory', () => {
  it('returns [] when the move list is empty', () => {
    const doc = new DOMParser().parseFromString(
      '<!DOCTYPE html><html><body><div class="round__app"><rm6><l4x></l4x></rm6></div></body></html>',
      'text/html',
    );
    expect(parseMoveHistory(doc)).toEqual([]);
  });

  it('returns [] when the move list is missing entirely', () => {
    const doc = new DOMParser().parseFromString(
      '<!DOCTYPE html><html><body></body></html>',
      'text/html',
    );
    expect(parseMoveHistory(doc)).toEqual([]);
  });

  it('returns the ordered SAN sequence from a midgame fixture', () => {
    const doc = loadFixture('game-standard-midgame.html');
    const history = parseMoveHistory(doc);
    // Midgame fixture has 10 plies: 1. e4 c5 2. Bc4 e6 3. Bb3 Nf6 4. d3 d6 5. Nf3 g6
    expect(history).toEqual(['e4', 'c5', 'Bc4', 'e6', 'Bb3', 'Nf6', 'd3', 'd6', 'Nf3', 'g6']);
  });

  it('ignores <i5z> move-number cells when extracting SAN', () => {
    const doc = new DOMParser().parseFromString(
      '<!DOCTYPE html><html><body><div class="round__app"><rm6><l4x>' +
        '<i5z>1</i5z><kwdb>e4</kwdb><kwdb>e5</kwdb>' +
        '<i5z>2</i5z><kwdb>Nf3</kwdb>' +
      '</l4x></rm6></div></body></html>',
      'text/html',
    );
    expect(parseMoveHistory(doc)).toEqual(['e4', 'e5', 'Nf3']);
  });
});

describe('parseVariant', () => {
  it('returns "standard" for a standard-variant game', () => {
    const doc = loadFixture('game-standard-midgame.html');
    expect(parseVariant(doc)).toBe('standard');
  });

  it('returns "chess960" when .round__app has the variant-chess960 class', () => {
    const doc = new DOMParser().parseFromString(
      '<!DOCTYPE html><html><body><div class="round__app variant-chess960"></div></body></html>',
      'text/html',
    );
    expect(parseVariant(doc)).toBe('chess960');
  });

  it('returns "crazyhouse" when .round__app has the variant-crazyhouse class', () => {
    const doc = new DOMParser().parseFromString(
      '<!DOCTYPE html><html><body><div class="round__app variant-crazyhouse"></div></body></html>',
      'text/html',
    );
    expect(parseVariant(doc)).toBe('crazyhouse');
  });

  it('defaults to "standard" when no variant class is present on .round__app', () => {
    const doc = new DOMParser().parseFromString(
      '<!DOCTYPE html><html><body><div class="round__app"></div></body></html>',
      'text/html',
    );
    expect(parseVariant(doc)).toBe('standard');
  });

  it('defaults to "standard" when .round__app is missing entirely', () => {
    const doc = new DOMParser().parseFromString(
      '<!DOCTYPE html><html><body></body></html>',
      'text/html',
    );
    expect(parseVariant(doc)).toBe('standard');
  });
});

describe('parseStartingFen', () => {
  it('returns STANDARD_START_FEN on a standard-variant game', () => {
    const doc = loadFixture('game-standard-midgame.html');
    expect(parseStartingFen(doc)).toBe(STANDARD_START_FEN);
  });

  it('returns null on a Chess960 game (limitation — no data-fen observed)', () => {
    const doc = new DOMParser().parseFromString(
      '<!DOCTYPE html><html><body><div class="round__app variant-chess960"></div></body></html>',
      'text/html',
    );
    expect(parseStartingFen(doc)).toBeNull();
  });

  it('returns null when .round__app is missing', () => {
    const doc = new DOMParser().parseFromString(
      '<!DOCTYPE html><html><body></body></html>',
      'text/html',
    );
    expect(parseStartingFen(doc)).toBeNull();
  });
});

describe('isSupportedVariant', () => {
  it('returns true for standard, chess960, fromPosition', () => {
    expect(isSupportedVariant('standard')).toBe(true);
    expect(isSupportedVariant('chess960')).toBe(true);
    expect(isSupportedVariant('fromPosition')).toBe(true);
  });

  it('returns false for unsupported variants', () => {
    expect(isSupportedVariant('crazyhouse')).toBe(false);
    expect(isSupportedVariant('horde')).toBe(false);
    expect(isSupportedVariant('')).toBe(false);
  });
});

describe('defaultReadinessCheck', () => {
  it('returns { kind: "participant" } with replay-derived currentFen for a midgame fixture', () => {
    const doc = loadFixture('game-standard-midgame.html');
    const result = defaultReadinessCheck(doc);
    expect(result.kind).toBe('participant');
    if (result.kind !== 'participant') return;
    expect(result.ctx.initialFen).toBe(STANDARD_START_FEN);
    // Replay history to reconstruct expected FEN — should match ctx.currentFen.
    const chess = new Chess(result.ctx.initialFen);
    for (const san of result.ctx.moveHistory) chess.move(san);
    expect(result.ctx.currentFen).toBe(chess.fen());
    expect(result.ctx.orientation).toBe('black');
    expect(result.ctx.moveHistory).toEqual(['e4', 'c5', 'Bc4', 'e6', 'Bb3', 'Nf6', 'd3', 'd6', 'Nf3', 'g6']);
  });

  it('returns { kind: "spectator" } for a spectator fixture', () => {
    const doc = loadFixture('game-standard-spectator.html');
    const result = defaultReadinessCheck(doc);
    expect(result.kind).toBe('spectator');
  });

  it('returns { kind: "unsupported-variant" } for a Crazyhouse game (synthesized)', () => {
    const doc = new DOMParser().parseFromString(
      '<!DOCTYPE html><html><body>' +
        '<div class="round__app variant-crazyhouse">' +
          '<div class="cg-wrap orientation-white"></div>' +
          '<rm6><l4x></l4x></rm6>' +
        '</div>' +
        '<input class="mchat__say">' +
      '</body></html>',
      'text/html',
    );
    const result = defaultReadinessCheck(doc);
    expect(result.kind).toBe('unsupported-variant');
    if (result.kind !== 'unsupported-variant') return;
    expect(result.name).toBe('crazyhouse');
  });

  it('returns { kind: "not-ready" } when the game container is missing', () => {
    const doc = new DOMParser().parseFromString(
      '<!DOCTYPE html><html><body></body></html>',
      'text/html',
    );
    const result = defaultReadinessCheck(doc);
    expect(result.kind).toBe('not-ready');
  });

  it('returns { kind: "not-ready" } for a Chess960 game (starting FEN not implemented in Phase 3)', () => {
    // parseStartingFen returns null for non-standard variants; defaultReadinessCheck falls through to not-ready.
    const doc = new DOMParser().parseFromString(
      '<!DOCTYPE html><html><body><div class="round__app variant-chess960"><rm6><l4x></l4x></rm6><div class="cg-wrap orientation-white"></div><input class="mchat__say"></div></body></html>',
      'text/html',
    );
    const result = defaultReadinessCheck(doc);
    expect(result.kind).toBe('not-ready');
  });

  it('returns participant context for the user-white fixture', () => {
    const doc = loadFixture('game-standard-user-white.html');
    const result = defaultReadinessCheck(doc);
    expect(result.kind).toBe('participant');
    if (result.kind !== 'participant') return;
    expect(result.ctx.orientation).toBe('white');
    expect(result.ctx.moveHistory).toEqual(['e4', 'c5', 'Nf3', 'd6']);
  });

  it('throws LichessDomContractError when the move list contains an unapplicable SAN', () => {
    // Synthesize a DOM that passes all checks except replay: standard variant,
    // participant, orientation, standard start FEN, but <kwdb> contains a bogus SAN
    // that chess.js rejects.
    const doc = new DOMParser().parseFromString(
      '<!DOCTYPE html><html><body>' +
      '<div class="round__app variant-standard">' +
        '<div class="cg-wrap orientation-white"></div>' +
        '<rm6><l4x><i5z>1</i5z><kwdb>Xxe4</kwdb></l4x></rm6>' +
      '</div>' +
      '<input class="mchat__say">' +
      '</body></html>',
      'text/html',
    );
    expect(() => defaultReadinessCheck(doc)).toThrow(LichessDomContractError);
  });
});

describe('SessionController integration with defaultReadinessCheck', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    history.replaceState(null, '', '/');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('DOM-readiness timeout transitions to off and does not emit start', () => {
    const events = { start: vi.fn(), stop: vi.fn() };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctrl = new SessionController({
      urlMatcher: (href) => GAME_URL_RE.test(href),
      readinessCheck: () => ({ kind: 'not-ready' }),
      readinessTimeoutMs: 300,
      pollIntervalMs: 100,
    });
    history.replaceState(null, '', '/abc12345');
    const d = ctrl.activate(events);
    vi.advanceTimersByTime(500);
    expect(events.start).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
    d.dispose();
  });
});
