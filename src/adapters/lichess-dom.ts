/**
 * Observed DOM selectors for Lichess game pages.
 *
 * Locked in on 2026-04-21 from DevTools observations on a live game at
 * https://lichess.org/wpt3lW1j/black (participant view, user plays Black,
 * game ended in checkmate). Backed by fixtures in `./__fixtures__/` and
 * exercised by parsing tests in `./lichess-session.test.ts` and
 * `./lichess.test.ts`.
 *
 * When Lichess ships a UI change that breaks these selectors, update here,
 * update the fixtures (see __fixtures__/README.md), and update the tests.
 * The health check in LichessAdapter.initialize() ensures stale selectors
 * fail loud rather than producing wrong results.
 */

/** Ancestor element that holds the in-game board + move list + player blocks. */
export const GAME_CONTAINER_SEL = '.round__app';

/** Root of the move list (a Lichess custom tag). */
export const MOVE_LIST_SEL = 'l4x';

/**
 * Individual move cells — direct `<kwdb>` children of `<l4x>`.
 * `<i5z>` siblings are move numbers we ignore.
 */
export const MOVE_CELL_SEL = 'l4x > kwdb';

/** Bottom player block — always the "you" side when the viewer is a participant. */
export const PLAYER_BOTTOM_SEL = '.ruser-bottom';

/** Top player block — always the opponent when participating. */
export const PLAYER_TOP_SEL = '.ruser-top';

/**
 * Presence of this element signals the viewer is a participant. Lichess
 * renders the chat input (.mchat__say) only for participants; spectators
 * see a read-only spectator room instead. Scoped broadly (not to
 * .round__app) because .mchat__say lives in .round__side, a sibling of
 * .round__app under main.round.
 */
export const PARTICIPANT_MARKER_SEL = '.mchat__say';

/** Host element whose class list carries the orientation class. */
export const ORIENTATION_HOST_SEL = '.cg-wrap';
export const ORIENTATION_WHITE_CLASS = 'orientation-white';
export const ORIENTATION_BLACK_CLASS = 'orientation-black';

/**
 * Lichess encodes the variant as a class on .round__app — e.g.
 * "variant-standard", "variant-chess960", "variant-fromPosition",
 * "variant-crazyhouse". Parse by scanning the classList for this prefix.
 */
export const VARIANT_CLASS_PREFIX = 'variant-';

/** Variants we support in Phase 3. */
export const SUPPORTED_VARIANTS = ['standard', 'chess960', 'fromPosition'] as const;

/**
 * Appended inside <l4x> when the game ends. Presence signals game over
 * (checkmate, resign, draw, abort). Contains a `.result` and a `.status`
 * child describing the outcome.
 */
export const GAME_OVER_SEL = 'l4x .result-wrap';
