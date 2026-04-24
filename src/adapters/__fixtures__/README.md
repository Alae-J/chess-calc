# LichessAdapter fixtures

Captured HTML snippets from real Lichess games, used by
`../lichess.test.ts` and `../lichess-session.test.ts` to exercise parsing
and MutationObserver logic against representative DOM shapes.

## Fixture header template

Every fixture begins with:

```html
<!--
  Captured: YYYY-MM-DD
  Lichess version: <build-string-or-commit-hash-or-"unknown">
  Source URL: https://lichess.org/<gameId>[/<color>]
  Scenario: <one-sentence description — variant, ply count, participant side, etc.>
-->
```

When tests break after a Lichess UI change, the header answers "is this
fixture stale?" in five seconds.

## Capturing a new fixture

1. Open a live Lichess game matching the target scenario.
2. Open DevTools → Elements.
3. Select the smallest ancestor containing the board + move list + both
   player blocks — usually `.round__app` or (if the fixture needs the
   chat input for participant detection) `main.round`.
4. Right-click → Copy → Copy outerHTML.
5. Paste into a new `.html` file in this directory.
6. Prepend the header template above.
7. Reduce by deleting subtrees the test doesn't care about, while keeping
   the structure that `lichess-dom.ts` constants rely on (see manifest below).

## Regenerating a stale fixture

1. Identify the failing test and which fixture it loads.
2. Read the test to find the specific selectors/attributes it depends on
   (see the manifest below).
3. Capture a fresh fixture for the same scenario (see above).
4. Before committing: confirm the new fixture contains every selector
   listed in the manifest for that fixture.
5. Run only the affected test:
   `pnpm test -- lichess.test.ts -t "<scenario>"`
6. Commit the fixture update alone with message `refresh <fixture-name> fixture`.

## Fixtures and consumers

| Fixture | Consumed by test | Required DOM elements/attributes |
|---|---|---|
| `game-standard-midgame.html` | lichess-session: participant detection, orientation, move-history replay | `.round__app.variant-standard`, `.mchat__say` (participant), `.cg-wrap.orientation-black` (user is Black in this fixture), `l4x > kwdb` ≥ 5, no `.result-wrap` |
| `game-standard-user-white.html` | lichess-session: participant detection for orientation-white | `.round__app.variant-standard`, `.mchat__say` (participant), `.cg-wrap.orientation-white`, `l4x > kwdb >= 4`, no `.result-wrap` |
| `game-standard-spectator.html` | lichess-session: spectator detection | `.round__app.variant-standard`, **no `.mchat__say`**, `.ruser-bottom` + `.ruser-top` present |
| `game-standard-gameover.html` | lichess: game-over detection | `l4x .result-wrap` present, all other structure same as midgame |
| `mutation-append-move.html` | lichess: MutationObserver emits on append | #before + #after <l4x> snippets; after has one more <kwdb> |
| `mutation-premove.html` | lichess: MutationObserver ignores premove | #before + #after; after has class-toggle only (.premove) |
| `mutation-hover.html` | lichess: MutationObserver ignores hover | #before + #after; after has class-toggle only (.hovered) |

**Note on synthesized fixtures:** `game-standard-spectator.html` and
`game-standard-user-white.html` are synthesized from the participant HTML
by removing the `.mchat__say` input and flipping the orientation class
respectively. When a real capture of each scenario is available, replace
them and this note.

Entries here are appended by the task that introduces each fixture. The
table must stay in sync with the actual files — a future task that adds
a fixture without appending here is a planning bug.
