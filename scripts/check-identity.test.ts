import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const script = join(__dirname, "check-identity.sh");
const identity = join(__dirname, "..", ".identity");

function run(repo: string, env: Record<string, string> = {}) {
  const base = { ...process.env };
  delete base.GIT_AUTHOR_EMAIL;
  delete base.GIT_COMMITTER_EMAIL;
  return spawnSync("sh", [join(repo, "scripts", "check-identity.sh")], {
    cwd: repo,
    env: { ...base, ...env },
    encoding: "utf8",
  });
}

describe("check-identity.sh", () => {
  let repo: string;
  const git = (...args: string[]) => execFileSync("git", args, { cwd: repo });

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), "ygo-identity-"));
    git("init", "-q");
    mkdirSync(join(repo, "scripts"));
    copyFileSync(script, join(repo, "scripts", "check-identity.sh"));
    copyFileSync(identity, join(repo, ".identity"));
    git(
      "config",
      "user.email",
      "48673773+rmencattini@users.noreply.github.com",
    );
    git(
      "remote",
      "add",
      "origin",
      "git@github.com:rmencattini/ygo-trainer.git",
    );
  });

  it("passes with the personal noreply email and remote", () => {
    expect(run(repo).status).toBe(0);
  });

  it("rejects a work email", () => {
    git("config", "user.email", "me@work.example");
    const r = run(repo);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("commit email is");
  });

  it("rejects a work email passed through env", () => {
    const r = run(repo, { GIT_AUTHOR_EMAIL: "someone@work.example" });
    expect(r.status).toBe(1);
  });

  it("rejects another remote", () => {
    git(
      "remote",
      "set-url",
      "origin",
      "git@github.com:some-org/ygo-trainer.git",
    );
    const r = run(repo);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("origin is");
  });
});
