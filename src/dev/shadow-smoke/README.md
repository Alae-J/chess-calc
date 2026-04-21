# Shadow-DOM smoke test

Gated check before Phase 3 commits to shadow-DOM overlay mount (spec §8.2).

## How to run

```bash
pnpm dev:ui --open /shadow-smoke/index.html
```

Or navigate to `http://localhost:5173/shadow-smoke/index.html` after `pnpm dev:ui`.

## Binary pass criteria

All four must pass. One failure = fall back to plain-DOM mount with Tailwind `cc-` prefixing (see spec §8.2 fallback clause).

- **(a) Render.** Click "(a) Render". Log shows "32 real pieces found" in green. PASS/FAIL.
- **(b) Drag e2→e4.** Click "(b) Drag e2→e4", then drag the e2 pawn to e4 with your mouse. Log shows `Drag detected: e2→e4` in green. PASS/FAIL.
- **(c) Animation ~250ms.** Click "(c) Animation ~250ms". Log shows elapsed time between 200–400ms. PASS/FAIL.
- **(d) CSS visible.** Click "(d) CSS visible". Log shows `piece-bg` containing `url(…)` in green (confirms piece sprites loaded). PASS/FAIL.

## Extra verification (informational, not a gate)

- **(e) `prefers-color-scheme` inheritance.** Click "(e)", note the logged `--bg` color. Switch OS to dark/light opposite mode. Click again. The color should change. This confirms CSS variables in `tokens.css` respond to prefers-color-scheme inside the shadow root.
