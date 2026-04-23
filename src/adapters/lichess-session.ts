import { applySan } from '@/core/chess-utils';
import type { FEN, SAN } from '@/core/types';
import {
  GAME_CONTAINER_SEL,
  MOVE_CELL_SEL,
  MOVE_LIST_SEL,
  ORIENTATION_BLACK_CLASS,
  ORIENTATION_HOST_SEL,
  ORIENTATION_WHITE_CLASS,
  PARTICIPANT_MARKER_SEL,
  SUPPORTED_VARIANTS,
  VARIANT_CLASS_PREFIX,
} from './lichess-dom';

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
        result.then((r) => this.onReadiness(token, r, events, attempt, deadline)).catch((err: unknown) => {
          if (token !== this.currentToken) return;
          this.state = 'refused';
          // eslint-disable-next-line no-console
          console.warn(
            `[chess-calc] SessionController: readinessCheck rejected for ${window.location.href}`,
            err,
          );
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

/**
 * Detect whether the viewer is a participant in the current game, and if
 * so which color. Returns 'spectator' when the chat input is absent (the
 * participant marker; see lichess-dom.ts for rationale) or when the board
 * orientation cannot be read.
 *
 * Implementation: on Lichess the user is always the bottom player in
 * their own games, and the .cg-wrap element carries an orientation class
 * reflecting board orientation — which matches the user's color.
 *
 * **Known limitation:** Lichess's flip-board button swaps the orientation
 * class on `.cg-wrap` without changing the user's actual color, so after
 * a flip this helper reports the flipped color. Deferred to post-v0; a
 * correct fix requires a second signal (e.g. matching the bottom player's
 * username against the session user's username, or parsing the "Playing
 * as White" indicator when available).
 */
export function parseParticipant(doc: Document): 'white' | 'black' | 'spectator' {
  if (!doc.querySelector(PARTICIPANT_MARKER_SEL)) return 'spectator';
  const orientation = parseOrientation(doc);
  if (orientation === null) return 'spectator';
  return orientation;
}

/** Read orientation from the observed host element's class list. */
export function parseOrientation(doc: Document): 'white' | 'black' | null {
  const host = doc.querySelector(ORIENTATION_HOST_SEL);
  if (!host) return null;
  if (host.classList.contains(ORIENTATION_WHITE_CLASS)) return 'white';
  if (host.classList.contains(ORIENTATION_BLACK_CLASS)) return 'black';
  return null;
}

/** Standard chess starting position in FEN. */
export const STANDARD_START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Extract move history from the move-list DOM in ply order.
 * Each `<kwdb>` cell contributes one SAN string; interleaved `<i5z>` move
 * numbers are ignored by the selector. Empty-text cells are filtered.
 */
export function parseMoveHistory(doc: Document): readonly SAN[] {
  const cells = Array.from(doc.querySelectorAll(MOVE_CELL_SEL));
  return cells
    .map((cell) => cell.textContent?.trim() ?? '')
    .filter((san) => san.length > 0);
}

/**
 * Read the variant name from `.round__app`'s classList. Lichess encodes the
 * variant as a `variant-<name>` class (e.g. `variant-standard`,
 * `variant-chess960`). Defaults to `"standard"` when the container is
 * missing or no `variant-*` class is present.
 */
export function parseVariant(doc: Document): string {
  const container = doc.querySelector(GAME_CONTAINER_SEL);
  if (!container) return 'standard';
  for (const cls of container.classList) {
    if (cls.startsWith(VARIANT_CLASS_PREFIX)) {
      return cls.slice(VARIANT_CLASS_PREFIX.length);
    }
  }
  return 'standard';
}

/**
 * Read the starting FEN for the game.
 *
 * Phase 3 limitation: Lichess does not expose an observed `data-fen`-style
 * attribute on the pages we have captured, so we can only return the
 * standard start FEN for standard-variant games. For Chess960 and
 * From-Position games, we'd need a real capture with the starting FEN
 * exposed before we can populate this. Returns `null` for non-standard
 * variants; the adapter's reconciliation step will fail loud on such games,
 * which is acceptable until variant captures are available.
 */
export function parseStartingFen(doc: Document): FEN | null {
  const container = doc.querySelector(GAME_CONTAINER_SEL);
  if (!container) return null;
  const variant = parseVariant(doc);
  if (variant === 'standard') return STANDARD_START_FEN;
  return null;
}

/** Checks whether the variant is in `SUPPORTED_VARIANTS`. */
export function isSupportedVariant(variant: string): boolean {
  return (SUPPORTED_VARIANTS as readonly string[]).includes(variant);
}

export function defaultReadinessCheck(doc: Document): ReadinessResult {
  const container = doc.querySelector(GAME_CONTAINER_SEL);
  if (!container) return { kind: 'not-ready' };

  // Order matters: variant before participant so spectator-on-unsupported-variant reports as unsupported.
  const variant = parseVariant(doc);
  if (!isSupportedVariant(variant)) {
    return { kind: 'unsupported-variant', name: variant };
  }

  const participant = parseParticipant(doc);
  if (participant === 'spectator') return { kind: 'spectator' };

  const orientation = parseOrientation(doc);
  if (orientation === null) return { kind: 'not-ready' };

  const initialFen = parseStartingFen(doc);
  if (initialFen === null) return { kind: 'not-ready' };

  const moveHistory = parseMoveHistory(doc);
  const currentFen = replayMoves(initialFen, moveHistory);
  if (currentFen === null) {
    // TODO(Task 10): when LichessDomContractError lands, throw it here instead.
    // A failed replay means the DOM's move list contains an unrecognized SAN — the issue
    // is unrecoverable, retrying cannot fix it, and 60 retry-every-50ms cycles before a
    // silent warn is bad UX for a contract violation.
    return { kind: 'not-ready' };
  }

  const moveListRoot = doc.querySelector(MOVE_LIST_SEL);
  if (!moveListRoot) return { kind: 'not-ready' };

  return {
    kind: 'participant',
    ctx: {
      initialFen,
      currentFen,
      orientation,
      moveHistory,
      gameContainer: container,
      moveListRoot,
    },
  };
}

function replayMoves(initialFen: FEN, history: readonly SAN[]): FEN | null {
  let fen = initialFen;
  for (const san of history) {
    const next = applySan(fen, san);
    if (next === null) return null;
    fen = next;
  }
  return fen;
}
