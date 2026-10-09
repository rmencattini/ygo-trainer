// SessionStart hook: says which Jev tool is not ready, one line each, so a
// session never runs the trial half-set-up. Never prints the key, only whether
// one exists (env var or Keychain item). Always exits 0.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PLUGINS = ["supercov@supercov", "save-token-jev@ygo-tools"];
const ROUTER = "http://127.0.0.1:4000/healthz";

export function report(state) {
  const lines = [];
  if (!state.saveTokenBuilt)
    lines.push(
      "jev tools: save-token-jev not built; run `npm run tools:build`",
    );
  if (!state.jevReviewInstalled)
    lines.push(
      "jev tools: jev-review not installed; run `npm run tools:build`",
    );
  for (const p of PLUGINS)
    if (!state.enabledPlugins[p])
      lines.push(`jev tools: plugin ${p} not enabled in .claude/settings.json`);
  if (!state.routerUp)
    lines.push(
      `jev tools: router not answering at ${ROUTER}; check its launchd service`,
    );
  if (!state.keyFound)
    lines.push(
      "jev tools: no TYPESAFE_API_KEY in env and no Keychain item typesafe-api-key",
    );
  return lines.length ? lines : ["jev tools: all green"];
}

async function routerUp() {
  try {
    const res = await fetch(ROUTER, { signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch {
    return false;
  }
}

// Without -w, `security` checks the item exists and never prints the secret.
function keyFound() {
  if (process.env.TYPESAFE_API_KEY) return true;
  const r = spawnSync(
    "security",
    ["find-generic-password", "-s", "typesafe-api-key"],
    { stdio: "ignore" },
  );
  return r.status === 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  let enabledPlugins = {};
  try {
    enabledPlugins =
      JSON.parse(readFileSync(`${root}.claude/settings.json`, "utf8"))
        .enabledPlugins ?? {};
  } catch {
    // missing or broken settings: every plugin shows as not enabled
  }
  const lines = report({
    saveTokenBuilt: existsSync(
      `${root}tools/save-token-jev/plugins/claude-save-token-jev/dist`,
    ),
    jevReviewInstalled: existsSync(
      `${root}tools/jev-review/node_modules/@typesafe-ai/sdk`,
    ),
    enabledPlugins,
    routerUp: await routerUp(),
    keyFound: keyFound(),
  });
  console.log(lines.join("\n"));
}
