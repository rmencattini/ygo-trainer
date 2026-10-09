// Pre-commit review with jev-review (tools/jev-review). It reviews everything that
// differs from HEAD: staged, unstaged and untracked files, not only what you commit.
// Never blocks the commit: findings are prompts, not proof. Each run lands in
// .metrics/reviews/<time>.json (gitignored); log each finding's fate in
// .metrics/review-verdicts.jsonl as {date, finding, verdict: "fixed"|"false-positive"|"ignored"}.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The key comes from the environment, else from macOS Keychain (service
// typesafe-api-key). It goes only to the jev-review process, never to output.
export function readKeychainKey() {
  const r = spawnSync(
    "security",
    ["find-generic-password", "-s", "typesafe-api-key", "-w"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  return r.status === 0 ? r.stdout.trim() || null : null;
}

export function reviewEnv(env, readKey = readKeychainKey) {
  if (env.TYPESAFE_API_KEY) return env;
  const key = readKey();
  return key ? { ...env, TYPESAFE_API_KEY: key } : env;
}

export function skipReason({ env, hasDeps }) {
  if (!env.TYPESAFE_API_KEY)
    return "jev-review skipped: no TYPESAFE_API_KEY in env or Keychain";
  if (!hasDeps)
    return "jev-review skipped: run `npm run tools:build` to install tools/jev-review";
  return null;
}

export function formatFindings(report) {
  const findings = [...report.findings].sort((a, b) => b.severity - a.severity);
  if (findings.length === 0) return "jev-review: no findings";
  return [
    `jev-review: ${findings.length} findings (prompts, not proof)`,
    ...findings.map(
      (f) =>
        `  ${f.file}:${f.line} [${f.dimension}, sev ${f.severity.toFixed(1)}, ${f.action}] ${f.mechanism}`,
    ),
  ].join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const tool = `${root}tools/jev-review`;
  const env = reviewEnv(process.env);
  const skip = skipReason({
    env,
    hasDeps: existsSync(`${tool}/node_modules/@typesafe-ai/sdk`),
  });
  if (skip) {
    console.error(skip);
    process.exit(0);
  }
  const out = `${root}.metrics/reviews/${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const run = spawnSync(
    process.execPath,
    [`${tool}/src/cli/save-changes.ts`, root],
    {
      env: { ...env, REVIEW_FILE: out },
      stdio: ["ignore", "inherit", "pipe"],
    },
  );
  if (run.status !== 0 || !existsSync(out)) {
    console.error(`jev-review failed (commit goes on):\n${run.stderr}`.trim());
    process.exit(0);
  }
  console.error(formatFindings(JSON.parse(readFileSync(out, "utf8"))));
}
