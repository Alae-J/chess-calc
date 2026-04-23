import type { FEN, SAN } from '@/core/types';

/** Canonical Lichess live-game URL regex. */
export const GAME_URL_RE =
  /^https:\/\/lichess\.org\/[a-zA-Z0-9]{8}(\/(white|black))?\/?$/;

/** 100ms poll interval catches sub-500ms A→B→A round-trips (spec §4.2). */
export const DEFAULT_POLL_INTERVAL_MS = 100;

/** 3000ms hard timeout for DOM-readiness wait after URL-enter. */
export const DEFAULT_READINESS_TIMEOUT_MS = 3000;

export interface SessionStartContext {
  initialFen: FEN;
  currentFen: FEN;
  orientation: 'white' | 'black';
  moveHistory: readonly SAN[];
  gameContainer: Element;
  moveListRoot: Element;
  /** Internal test-only field. Production readinessCheck omits it. */
  _gameIdForTest?: string;
}

export type ReadinessResult =
  | { kind: 'participant'; ctx: SessionStartContext }
  | { kind: 'spectator' }
  | { kind: 'not-ready' }
  | { kind: 'unsupported-variant'; name: string };

export interface SessionEvents {
  start(token: number, ctx: SessionStartContext): void;
  stop(token: number): void;
}

export interface SessionControllerConfig {
  urlMatcher: (href: string) => boolean;
  readinessCheck: (doc: Document) => ReadinessResult | Promise<ReadinessResult>;
  readinessTimeoutMs?: number;
  pollIntervalMs?: number;
}

type SessionState = 'off' | 'waiting-for-dom' | 'active' | 'refused';

export class SessionController {
  private readonly urlMatcher: (href: string) => boolean;
  private readonly readinessCheck: (doc: Document) => ReadinessResult | Promise<ReadinessResult>;
  private readonly pollIntervalMs: number;
  private readonly readinessTimeoutMs: number;

  private currentToken = 0;
  private state: SessionState = 'off';
  private lastHref: string = '';
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private readinessHandle: ReturnType<typeof setTimeout> | null = null;
  private popstateHandler: (() => void) | null = null;
  private disposed = false;

  constructor(config: SessionControllerConfig) {
    this.urlMatcher = config.urlMatcher;
    this.readinessCheck = config.readinessCheck;
    this.pollIntervalMs = config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.readinessTimeoutMs = config.readinessTimeoutMs ?? DEFAULT_READINESS_TIMEOUT_MS;
  }

  activate(events: SessionEvents): { dispose: () => void } {
    this.popstateHandler = () => this.handleUrl(events);
    window.addEventListener('popstate', this.popstateHandler);

    this.pollHandle = setInterval(() => this.handleUrl(events), this.pollIntervalMs);

    // Run once immediately so tests don't need to wait for the first tick
    // (also prevents the first allow-listed URL from being missed for 100ms).
    this.handleUrl(events);

    return {
      dispose: () => {
        if (this.disposed) return;
        this.disposed = true;
        if (this.pollHandle !== null) clearInterval(this.pollHandle);
        if (this.readinessHandle !== null) clearTimeout(this.readinessHandle);
        if (this.popstateHandler) window.removeEventListener('popstate', this.popstateHandler);
        this.pollHandle = null;
        this.readinessHandle = null;
        this.popstateHandler = null;
        if (this.state === 'active') {
          events.stop(this.currentToken);
        }
        this.state = 'off';
      },
    };
  }

  private handleUrl(events: SessionEvents): void {
    if (this.disposed) return;
    const href = window.location.href;
    if (href === this.lastHref) return;
    const wasActive = this.state === 'active';
    const wasWaiting = this.state === 'waiting-for-dom';
    const prevToken = this.currentToken;
    this.lastHref = href;

    // If previous URL had an active session, stop it.
    if (wasActive || wasWaiting) {
      if (wasActive) events.stop(prevToken);
      this.clearReadinessTimer();
      this.state = 'off';
    }

    if (!this.urlMatcher(href)) return;

    // URL-enter: new session.
    this.currentToken += 1;
    const token = this.currentToken;
    this.state = 'waiting-for-dom';
    this.startReadinessWait(token, events);
  }

  private startReadinessWait(token: number, events: SessionEvents): void {
    const deadline = Date.now() + this.readinessTimeoutMs;

    const attempt = () => {
      if (this.disposed || token !== this.currentToken) return;
      const result = this.readinessCheck(document);
      if (isPromise(result)) {
        result.then((r) => this.onReadiness(token, r, events, attempt, deadline)).catch(() => {
          if (token === this.currentToken) this.state = 'refused';
        });
      } else {
        this.onReadiness(token, result, events, attempt, deadline);
      }
    };
    attempt();
  }

  private onReadiness(
    token: number,
    result: ReadinessResult,
    events: SessionEvents,
    retry: () => void,
    deadline: number,
  ): void {
    if (this.disposed || token !== this.currentToken) return;
    if (!result) {
      // Defensive: a readinessCheck stub that returns undefined/null is treated as no-op.
      this.state = 'off';
      return;
    }
    switch (result.kind) {
      case 'participant':
        this.state = 'active';
        events.start(token, result.ctx);
        return;
      case 'spectator':
        this.state = 'off';
        return;
      case 'unsupported-variant':
        // eslint-disable-next-line no-console
        console.warn(`[chess-calc] variant not supported in Phase 3: ${result.name}`);
        this.state = 'refused';
        return;
      case 'not-ready':
        if (Date.now() >= deadline) {
          // eslint-disable-next-line no-console
          console.warn(
            `[chess-calc] DOM readiness timed out after ${this.readinessTimeoutMs}ms ` +
              `for ${window.location.href}. Session will retry on next URL-enter.`,
          );
          this.state = 'off';
          return;
        }
        this.readinessHandle = setTimeout(retry, 50);
        return;
    }
  }

  private clearReadinessTimer(): void {
    if (this.readinessHandle !== null) {
      clearTimeout(this.readinessHandle);
      this.readinessHandle = null;
    }
  }
}

function isPromise<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof (value as { then?: unknown } | undefined)?.then === 'function';
}
