// Claude Code PreToolUse hook: before any Bash call that commits, pushes or uses gh,
// run the identity check. Exit code 2 blocks the call and shows stderr to Claude.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const command = input?.tool_input?.command ?? "";

const pushOrCommit = /\bgit\b[^|;&]*\b(commit|push)\b/.test(command);
const usesGh = /(^|[\s;&|(])gh\s/.test(command);
if (!pushOrCommit && !usesGh) process.exit(0);

const args = ["scripts/check-identity.sh"];
if (usesGh || /\bpush\b/.test(command)) args.push("--gh");
const r = spawnSync("sh", args, {
  cwd: input.cwd ?? process.cwd(),
  encoding: "utf8",
});
if (r.status !== 0) {
  process.stderr.write(
    `${r.stderr}Blocked: identity check failed. Tell the user; do not work around it.\n`,
  );
  process.exit(2);
}
