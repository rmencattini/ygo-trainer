# YGO Trainer

Practice Yu-Gi-Oh! TCG turn-1 combos and handtrap situations against an AI opponent.

- Pick going first (combo through handtraps) or second (break the board).
- Pick your deck and the opponent's from current meta lists.
- A Claude coach explains where your line broke.

Status: early development. See [docs/PLAN.md](docs/PLAN.md).

## Develop

```bash
git submodule update --init
npm install
npm run tauri dev
```

Needs Node 24+ and Rust (stable). Linux also needs the
[Tauri system dependencies](https://tauri.app/start/prerequisites/).

## License

AGPL-3.0-or-later, same as the [EDOPro core](https://github.com/edo9300/ygopro-core) this app runs on.
