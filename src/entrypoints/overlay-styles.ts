/**
 * Shadow-root CSS injection string. Imported by content.ts and passed to
 * createShadowRootUi({ css: OVERLAY_STYLES }).
 *
 * Order (spec §8.3): chessground first, then tokens, then Tailwind output.
 * Tailwind last so utility classes can override upstream rules if needed.
 */
import chessgroundBase from 'chessground/assets/chessground.base.css?inline';
import chessgroundBrown from 'chessground/assets/chessground.brown.css?inline';
import chessgroundCburnett from 'chessground/assets/chessground.cburnett.css?inline';
import tokens from '@/styles/tokens.css?inline';
import tailwind from './tailwind.css?inline';

export const OVERLAY_STYLES: string = [
  chessgroundBase,
  chessgroundBrown,
  chessgroundCburnett,
  tokens,
  tailwind,
].join('\n');
