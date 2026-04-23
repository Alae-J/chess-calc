// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://lichess.org/" }
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionController, GAME_URL_RE, type SessionStartContext } from './lichess-session';

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
