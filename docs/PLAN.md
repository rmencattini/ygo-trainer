# YGO Turn-1 Trainer — full proposal

## Context

You're new to Yu-Gi-Oh! TCG and want to practice turn-1 play:

- **Going first:** play your combo through the opponent's handtraps (Ash Blossom, Maxx "C", Nibiru…).
- **Going second:** get past or break the board the opponent built on turn 1.

Xyz, Link and Synchro lines are hard to learn from videos. The goal is a desktop app where you pick a side, your deck and the opponent's deck, then play a real duel against an AI. A Claude coach then explains what went wrong.

It's also a test bed for agentic coding. Each milestone ships with tests the agent writes and runs itself, so it can check its own work without you.

New project: `~/git/ygo-trainer`. Nothing local to reuse.

---

## 1. Decisions taken

| Topic            | Choice                                                                                             | Why                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Rules engine     | **Reuse `ocgcore`** (Project Ignis / EDOPro core, C++ + Lua, AGPL-3.0)                             | Every card and every chain/timing rule already works. Writing our own would take years.                               |
| Engine packaging | **`@n1xx1/ocgcore-wasm`** (JSR, an Emscripten build of the EDOPro core; runs in Node and browsers) | Same engine in the app and in Node tests. If it's stale, we build it ourselves with Emscripten.                       |
| App shell        | **Tauri 2**: native app on **macOS, Linux and Windows**                                            | Your pick. Smaller and faster than Electron. One codebase, three builds via CI.                                       |
| License          | **AGPL-3.0** (same as ocgcore)                                                                     | Matches the engine; no conflict.                                                                                      |
| UI               | **React + TypeScript + Vite**, **Zustand** for state                                               | See "Why React" below.                                                                                                |
| Card scripts     | `ProjectIgnis/CardScripts` (git submodule)                                                         | One Lua file per card, the source the engine expects.                                                                 |
| Card data        | `ProjectIgnis/BabelCDB` `cards.cdb` (SQLite, EN) + localized CDBs from Project Ignis               | GUI stays EN; card _text_ can switch language. The YGOProDeck API has no language option, so it only supplies images. |
| Format           | TCG, current Project Ignis `LFLists` banlist                                                       | You play TCG.                                                                                                         |

### Why React

- **Agentic coding reason (the main one):** React + TS is the stack models have seen most, so the agent writes it with the fewest mistakes. That matters for a vibe-coded project.
- The UI is mostly "show state, react to clicks". The engine sends a message, the store updates, and React redraws the board. Zustand keeps that to one small store.
- Tooling everyone knows: Vitest, Testing Library, Playwright.
- Fair alternatives: **Svelte** or **Solid** are lighter and just as good for this. The cost is a bit more agent error. Switching is easy before milestone 3 and costly after.

---

## 2. Architecture

```
ygo-trainer/
  src-tauri/            Rust: file access only (DB, scripts, image cache, API key via `keyring` crate:
                        macOS Keychain / Windows Credential Manager / Linux Secret Service)
  packages/engine/      TS wrapper over ocgcore-wasm: start duel, send response, typed messages
  packages/ai/          opponent AI (pure TS, no UI) — runs in Node tests and in app
  packages/coach/       Claude coach: duel log -> prompt -> explanation
  apps/ui/              React app (board, setup screen, prompts, log, coach panel)
  data/decks/           preset .ydk files + combo lines (.json)
  data/scenarios/       fixed training scenarios (hand, field, who goes first)
  tests/                integration + e2e
```

**Core loop:** `engine.process()` → typed message (e.g. `SELECT_CARD`, `SELECT_CHAIN`) → whose turn is it to answer?

- **You:** the UI shows a prompt and your click becomes the response.
- **The AI:** `ai.respond(state, message)` returns the response.

Every message and response goes into a **duel log**. The log drives replay, undo, the plain-English chain log and the coach.

**Determinism:** fixed seed + fixed deck order + recorded responses = the same duel every time. Tests and replays both depend on this.

---

## 3. Opponent AI (layers)

1. **Handtrap rules (going second):** the AI holds handtraps and fires them by readable rules. Examples: "Ash on the first search", "Maxx C on the first Special Summon", "Nibiru after the 5th summon", "Imperm on the first monster effect on field". Rules live in data, so you can tune difficulty.
2. **Combo replay (going first):** each preset deck has 1–3 recorded combo lines. If a step can't be played (drew differently, got interrupted), it falls back to the heuristic.
3. **Heuristic fallback:** a scored list of legal actions (summon > activate > set > pass), plus "always chain a negate when able".
4. **Combo recorder:** play a line yourself in the app, then save it as a combo line. That's how presets get their lines without hand-writing JSON.

## 4. Claude coach (a full feature, not optional)

- After a duel or on demand, it sends the plain-English duel log, the end board and your hand to Claude.
- It answers three questions: what was the choke point, which handtrap timing hurt you, and what line would have worked.
- Model: `claude-sonnet-5-5` by default (cheap and fast); a setting switches to `claude-opus-5-5` for deep reviews. Not in the game loop, so it never slows play.
- You add the API key in Settings; it's stored in the OS secret store (Keychain / Credential Manager / Secret Service).

## 5. Deck presets

- 4–6 current TCG meta decks from public tournament lists (YGOProDeck top decks). Stored as `.ydk` in the repo.
- A script `npm run decks:refresh` pulls new lists. It needs a manual review before commit, because lists go out of date.
- You can import any `.ydk` file or YGOProDeck deck URL.

---

## 6. Testing strategy

The agent must be able to prove each milestone works without you clicking. The layers:

| Layer                    | Tool                                                                       | What it covers                                                                                                                                                                         | Runs                      |
| ------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| **Unit**                 | Vitest                                                                     | YDK parser, message decoding, AI rules ("given this chain, fire Ash?"), log → English text, coach prompt builder                                                                       | every change, < 5 s       |
| **Integration (engine)** | Vitest in Node + real ocgcore-wasm + real card scripts                     | **Golden duels**: seed + decks + responses → assert board. One test per preset combo line ("Snake-Eye line ends with X, Y, Z on field"). Handtrap tests ("AI fires Ash on my search"). | every change, < 1 min     |
| **Component**            | Vitest + Testing Library                                                   | Each prompt type (select card, chain yes/no, position, zone) renders and sends the right response                                                                                      | every change              |
| **E2E**                  | Playwright on the Vite dev server in Chromium                              | Setup → start duel → Normal Summon → card on field. Full scripted combo by clicks. Screenshots saved as evidence.                                                                      | per milestone, ~2 min     |
| **Native E2E**           | WebdriverIO + `tauri-driver` on Linux + Windows CI runners                 | The real Tauri app: window opens, files load, one duel starts                                                                                                                          | per PR, ~5 min            |
| **App smoke (macOS)**    | `tauri build` + manual 2-minute checklist                                  | Same as native E2E, on your Mac                                                                                                                                                        | per release               |
| **Coach**                | Unit with recorded Claude replies (no network) + 1 opt-in live eval script | Prompt shape, parsing, fallback when offline                                                                                                                                           | unit always, live by hand |

Notes:

- **Why most E2E runs in the browser:** Tauri's WebDriver (`tauri-driver`) supports Linux and Windows, not macOS. Playwright on the dev server runs everywhere and fast. The UI reaches Tauri file APIs through a small adapter; tests swap in a browser version that serves files from `public/`. The real-app E2E runs only in Linux/Windows CI.
- **Golden duels are the backbone.** When the engine, card scripts or banlist update, they show which combos broke. They also give the agent fast, exact feedback.
- **Test-first per milestone:** the agent writes the acceptance tests for a milestone first, then codes until they pass.
- CI details in section 7.

---

## 7. Agentic workflow

- **`CLAUDE.md` in the repo:** commands (`npm test`, `npm run test:e2e`, `npm run tauri dev`), folder map, the "golden duel" pattern, and the rule "never mark a milestone done with red tests".
- **One milestone per session.** Start with `/clear`, run the milestone, finish with `/code-review` and a commit. Then pause for your go.
- **Parallel subagents where work is independent** (each in its own git worktree). Example in M3: UI board on one side, AI handtrap rules on the other. Both build on the engine wrapper from M1.
- **Evidence in each report:** test counts and Playwright screenshots, so you can see progress without running anything.

### GitHub

- **Personal account only (enforced, see "Identity guard" below).**
- **Repo:** **public** repo on your personal GitHub account. **You create it yourself** (empty: no README, license or .gitignore) and send the SSH URL. Public because: (a) people can only download Releases from a repo they can see; (b) Actions minutes are free and unlimited on public repos; (c) AGPL wants the source open anyway.
- **Branch + PR per milestone:** `m3-board-ui` → PR with the milestone's "done when" as a checklist, test counts and screenshots in the body. I watch CI through the app's PR tools and fix red checks. You merge (no auto-merge).
- **Issues:** one issue per milestone, linked from its PR. Risks from section 9 become issues too.
- **Commits:** Conventional Commits (`feat(ai): fire Ash on first search`), small and green: one commit per passing step.
- **Husky hooks** (installed by `npm install`, so every clone gets them):
  - `commit-msg` → **commitlint** with `@commitlint/config-conventional`. Rejects `fix stuff`; accepts `fix(engine): handle empty chain`.
  - `pre-commit` → **lint-staged** (ESLint + Prettier on changed files only) + the Swiss-hours check below.
  - `pre-push` → `npm test` (unit + integration, < 1 min).
  - CI runs commitlint on PR commits too, since hooks can be skipped with `--no-verify`.

### Identity guard (personal identity only)

Goal: no commit, push, PR or `gh` call from this repo can ever go out under a work email. Layers:

1. **Repo-local git identity** (project-local, no ask needed): `git config user.name` + `user.email` set to your personal **GitHub noreply** address (`<id>+<user>@users.noreply.github.com`), so your real personal email never lands in public commits.
2. **Remote pinned** to `git@github.com:rmencattini/ygo-trainer.git` in `.identity`.
3. **`scripts/check-identity.sh`** compares the repo's `user.email`, the remote host/owner and `gh api user --jq .login` against `.identity` (committed: expected login + noreply email). It fails loudly on any mismatch.
   - Runs in Husky `pre-commit` and `pre-push`.
   - Runs before every `gh` command through `npm run gh -- …`. That wrapper sets `GH_TOKEN` from `gh auth token --user <personal>`, so it never uses whichever account `gh` has active.
4. **`CLAUDE.md` rule:** "Run `scripts/check-identity.sh` before any git push or gh call; stop and tell the user if it fails." Plus a Claude Code `PreToolUse` hook in the project's `.claude/settings.json` that runs the same check on `git push` / `gh` Bash calls, so the agent can't skip it.
5. **CI check:** a job fails the PR if any commit's author/committer email isn't the noreply address. Allow-listed: Dependabot and `github-actions[bot]`. Plus GitHub's own setting "Block command line pushes that expose my email" on your personal account (you turn it on).

M0 starts by checking this: if the identity check doesn't pass, nothing gets created or pushed.

### Versioning

- **SemVer**, one version for the whole app. Source of truth: root `package.json`. `tauri.conf.json` reads it (`"version": "../package.json"`), and a small script syncs `Cargo.toml`.
- The next version comes from the commit types: `fix` → patch, `feat` → minor, `feat!` / `BREAKING CHANGE` → major. Before 1.0, breaking bumps the minor.
- Tool: **semantic-release** (with `@semantic-release/exec` for the Cargo sync). It writes `CHANGELOG.md`, bumps, tags `vX.Y.Z` and creates the GitHub Release. It only runs when you trigger the publish workflow.
- The app shows its version in Settings → About.

### Publish (only when you trigger it)

- `publish.yml` with **`workflow_dispatch` only**: no tag or push trigger. You start it from the Actions tab (or `gh workflow run publish.yml`). Optional input: `dry-run` to see the next version without publishing.
- Steps: run all tests → semantic-release picks the version and tags → `tauri-apps/tauri-action` builds on macOS (Apple Silicon + Intel), Windows and Ubuntu → uploads `.dmg`, `.msi`/`.exe`, `.AppImage`/`.deb` to the GitHub Release → release goes public.
- People download from the repo's **Releases** page.
- **Unsigned builds:** macOS shows "unidentified developer" (right-click → Open), Windows shows SmartScreen ("More info → Run anyway"). Signing costs money: Apple Developer ID 99 USD/year; a Windows code-signing certificate costs about 100–400 USD/year. Skip it for v0.x and document the workaround in the README.
- Later: `tauri-plugin-updater` can read the latest GitHub Release, so installed apps update themselves.

### CI (GitHub Actions)

| Workflow      | Trigger                               | Jobs                                                                                  |
| ------------- | ------------------------------------- | ------------------------------------------------------------------------------------- |
| `ci.yml`      | push + PR                             | lint + typecheck, unit, integration (golden duels), Playwright E2E — Ubuntu           |
| `native.yml`  | PR                                    | `tauri build` + `tauri-driver` E2E on Ubuntu and Windows; `tauri build` only on macOS |
| `publish.yml` | **manual only** (`workflow_dispatch`) | tests → semantic-release → 3-OS build → public GitHub Release (see above)             |
| `decks.yml`   | weekly cron                           | runs `decks:refresh`, opens a PR if lists changed (golden duels show what broke)      |
| Dependabot    | weekly                                | npm, cargo, GitHub Actions; CardScripts submodule bump                                |

Runner cost: on a **public** repo, standard runners (Ubuntu, Windows, macOS) are free, so there's no limit to worry about. On a private repo the free plan gives 2,000 minutes/month, and a Windows minute counts as 2, a macOS minute as 10. A 10-minute macOS build would use 100 of the 2,000. That's the only reason to keep heavy jobs on Ubuntu.

### Commit times outside Swiss working hours

Commit timestamps are always real; the hook only decides when a commit may happen.

- A check in the Husky `pre-commit` hook that blocks commits Mon–Fri 08:00–18:00 Europe/Zurich and on Swiss public holidays.
- The agent then only commits and pushes in the evening or at weekends.

---

## 8. Milestones (one at a time, pause after each)

Agent time estimates, assuming no blocker on the WASM engine.

| #   | Milestone                                                                                                                                                                                                                  | Done when                                                                                                             | Est.                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 0   | **Setup:** identity guard, Tauri + React + Vitest + Playwright scaffold, `CLAUDE.md`, AGPL `LICENSE`, `ci.yml` + `native.yml`, Husky + commitlint + lint-staged, commit-hours check. Card script/DB submodules move to M1. | `npm test` green; window opens; bad commit message rejected; wrong email rejected; CI green on all 3 OS               | 3 h                      |
| 1   | **Engine spike:** wrap ocgcore-wasm, load scripts + DB, start a duel with two fixed decks.                                                                                                                                 | Integration test: Normal Summon resolves, monster on field                                                            | 2–4 h (risk: WASM build) |
| 2   | **Card DB + images + language:** card lookup, text language switch, image cache.                                                                                                                                           | Unit tests on lookup; the same card shows in EN and FR                                                                | 2 h                      |
| 3   | **Board UI + all prompts:** zones, hover text, every select message clickable, chain log in English.                                                                                                                       | Component tests per prompt; E2E plays a Normal Summon by clicks                                                       | 1 day                    |
| 4   | **Setup screen + presets:** first/second, my deck, opponent deck, YDK import.                                                                                                                                              | E2E: setup → duel starts with chosen decks                                                                            | 3 h                      |
| 5   | **AI v1:** handtrap rules + heuristic fallback.                                                                                                                                                                            | Integration: AI fires Ash on first search; AI passes cleanly with no plays                                            | 4 h                      |
| 6   | **Combo recorder + replay:** record your line, the AI replays it.                                                                                                                                                          | Golden duel per preset combo passes                                                                                   | 4 h                      |
| 7   | **Training tools:** fixed opening hand, scenarios, reset turn, undo.                                                                                                                                                       | E2E: load scenario, undo a summon, board restored                                                                     | 4 h                      |
| 8   | **Claude coach:** panel, Keychain key, Sonnet/Opus switch.                                                                                                                                                                 | Unit with recorded replies; one live run by hand                                                                      | 3 h                      |
| 9   | **Publish:** `publish.yml` + semantic-release + README download notes.                                                                                                                                                     | Dry run shows `v0.1.0`; real run (you trigger it) publishes `.dmg`, `.msi`, `.AppImage`; macOS smoke checklist passes | 2–3 h                    |

## 9. Risks

- **ocgcore-wasm stale or broken** → build with Emscripten from the EDOPro core (adds about half a day to M1).
- **Linux WebKitGTK quirks** → WASM + threads can behave differently from Safari/WebView2; native E2E on Ubuntu catches this per PR.
- **Card art copyright** → images only cached locally, never bundled in the repo.
- **Meta lists go stale** → the refresh script plus golden tests show what broke.

## 10. Verification (end to end)

1. `npm test` → all unit, component and integration tests green, including one golden duel per preset.
2. `npm run test:e2e` → Playwright plays: setup (go first, deck A vs deck B) → open combo by clicks → AI fires a handtrap → end turn. Screenshots in `tests/e2e/artifacts/`.
3. `npm run tauri dev` → play a duel by hand, ask the coach, get an explanation.
