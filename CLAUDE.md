# YGO Trainer

Desktop app (Tauri 2 + React + TypeScript) to practice Yu-Gi-Oh! TCG turn-1 play against an AI.
Rules engine: EDOPro `ocgcore` (WASM). Full plan: `docs/PLAN.md`.

## Commands

- `git submodule update --init` — fetch card scripts and card DB (needed by golden duels)
- `npm test` — unit + integration (Vitest, projects `node` and `ui`)
- `npm run test:e2e` — Playwright against the Vite dev server (port 1420)
- `npm run lint` / `npm run typecheck` / `npx prettier --check .`
- `npm run tauri dev` — native app with hot reload
- `npx tauri build --debug --no-bundle` — native build check

## Layout

- `apps/ui/` — React app (Vite)
- `packages/` — `engine`, `ai`, `coach` (pure TS, testable in Node)
- `data/` — `scripts/` (ProjectIgnis/CardScripts) and `cdb/` (ProjectIgnis/BabelCDB) as shallow submodules;
  `decks/` holds `.ydk` files
- `src-tauri/` — Rust shell: file access and OS secret store only, no game logic
- `scripts/` — repo guards (identity, commit hours) and their tests
- `tests/e2e/` — Playwright specs; screenshots land in `tests/e2e/artifacts/`

## Rules

- **Identity:** commits, pushes and `gh` calls only as `rmencattini` with the noreply email in `.identity`.
  Run `npm run check:identity` before any push or `gh` call. If it fails, stop and tell the user. Never
  change `.identity`, the hooks or `user.email` to make it pass. Use `npm run gh -- …` instead of bare `gh`.
- **Commit hours:** commits are blocked Mon–Fri 08:00–18:00 Europe/Zurich (Husky). Never fake commit
  dates (`GIT_AUTHOR_DATE` / `GIT_COMMITTER_DATE`) and never use `--no-verify`.
- **Commits:** Conventional Commits (`feat(ai): …`, `fix(engine): …`), small, each one green.
- **Milestones:** write the acceptance tests first, then code until green. Never call a milestone done
  with red tests. One branch + PR per milestone (`m<N>-<slug>`); the user merges.
- **Golden duels:** engine/AI behaviour is tested by replaying a fixed seed + decks + responses and
  asserting the board. Add one for every combo line and handtrap rule. They live in
  `packages/*/test/*.golden.test.ts`; see `packages/engine/test/normal-summon.golden.test.ts`.
