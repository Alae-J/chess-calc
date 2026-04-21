# Chess Calc

Browser extension that externalizes chess calculation trees during live play.

## Phase 1 status

- Core tree module + MockAdapter land in `src/core/` and `src/adapters/`.
- UI, LichessAdapter, and dev harness are scheduled for Phase 2+ — see
  `docs/superpowers/specs/` for the design trail.

## Scripts

- `pnpm dev` — WXT dev server (Phase 1 stubs do nothing).
- `pnpm build` — production extension build.
- `pnpm test` — run Vitest suite.
- `pnpm test:coverage` — Vitest with coverage (90% lines / 85% branches floor on `core` and `adapters`).
- `pnpm lint` — ESLint (flat config, enforces layering boundaries).
- `pnpm typecheck` — tsc --noEmit.

## Layering

`src/core/` and `src/adapters/` are pure TS. They cannot import from
`react`, `react-dom`, `zustand`, `chessground`, `lucide-react`, `tailwindcss`,
or path aliases into `@/ui`, `@/entrypoints`, `@/state`. This is enforced by
ESLint (`no-restricted-imports` + `import/no-restricted-paths`) and was
verified during Phase 1 implementation by temporarily inserting violations
and confirming both rules fire.
