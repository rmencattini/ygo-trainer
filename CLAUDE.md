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
- `cargo test --manifest-path src-tauri/Cargo.toml` — Rust unit tests
- `npm run cards:locale -- fr` — build `data/locale/fr.json` (card text) from YGOProDeck; gitignored
- `npm run decks:refresh` — pull recent tournament lists into `data/decks/presets/*.ydk` (review the diff before committing)
- `npm run cards:export` — write `apps/ui/public/cards/*.json` for the UI (runs before `dev` and `build`)

## Layout

- `apps/ui/` — React app (Vite). `src/duel/`: board, prompts (one component per select message), duel screen.
  `vite-plugin-scripts.ts` serves `data/scripts` at `/scripts` in dev and copies them into `dist` on build
- `packages/` — `engine`, `cards` (card lookup, languages, image cache), `ai`, `coach` (pure TS, testable in Node)
- `data/` — `scripts/` (ProjectIgnis/CardScripts) and `cdb/` (ProjectIgnis/BabelCDB) as shallow submodules;
  `decks/` holds `.ydk` files; `strings.conf` (EDOPro system strings, AGPL)
- `src-tauri/` — Rust shell: file access and OS secret store only, no game logic
- `scripts/` — repo guards (identity, commit hours), Jev tool checks and their tests
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
- **Jev tooling (trial until Fri 30 Oct 2026):** the session-start line says which tool is not ready;
  fix it or tell the user before other work. For coverage use `npm run test:cov`, not bare `npm test`.
  Run `/supercov:quality` on every new package. The pre-commit hook runs `npm run review:jev`; for each
  finding it prints, append `{date, finding, verdict}` (verdict `fixed`, `false-positive` or `ignored`)
  to `.metrics/review-verdicts.jsonl` before the next commit or `gh pr create`.
- **Golden duels:** engine/AI behaviour is tested by replaying a fixed seed + decks + responses and
  asserting the board. Add one for every combo line and handtrap rule. They live in
  `packages/*/test/*.golden.test.ts`; see `packages/engine/test/normal-summon.golden.test.ts`.
