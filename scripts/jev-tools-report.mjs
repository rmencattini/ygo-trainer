// "Was it worth it" report for the Jev tooling trial. Compares the baseline window
// (.metrics/baseline/, taken before any install) with the trial window (baseline end
// to now) and writes .metrics/jev-tools-report.html with a keep / drop / wait verdict
// per tool. Numbers no tool exposes (TypeSafe spend, lost-context incidents, router
// overrides, coverage gaps closed) come from .metrics/manual.json; when run in a
// terminal it asks for the missing ones and saves them there.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const CCUSAGE = "ccusage@20.0.26";
const ROUTER = "@ediri/jev-router@1.6.0";
const ROUTER_LOG = `${homedir()}/.local/state/jev-router/router.log`;

export const MANUAL = [
  ["typesafeUsd", "TypeSafe spend in USD for the trial (console.typesafe.ai)"],
  ["lostContext", "Sessions that lost needed context after a compaction"],
  ["routerOverrides", "Times you had to override the router's tier"],
  ["gapsClosed", "Tests added from supercov gaps"],
];

const pct = (x) => (x == null ? "–" : `${(x * 100).toFixed(1)} %`);
const usd = (x) => (x == null ? "–" : `$${x.toFixed(2)}`);
const ratio = (a, b) => (b ? a / b : null);

// sessions: [{ cost, day }] → total cost, active days, cost per day and per commit
export function costStats(sessions, commits) {
  const cost = sessions.reduce((s, x) => s + x.cost, 0);
  const days = new Set(sessions.map((x) => x.day)).size;
  return {
    cost,
    days,
    commits,
    perDay: ratio(cost, days),
    perCommit: ratio(cost, commits),
  };
}

// markers: [{ preTokens, postTokens }] from compact_boundary transcript lines
export function compactionStats(markers) {
  const saved = markers.reduce(
    (s, m) => s + Math.max(0, m.preTokens - (m.postTokens ?? m.preTokens)),
    0,
  );
  return { count: markers.length, tokensSaved: saved };
}

export function reviewStats(verdicts) {
  const fixed = verdicts.filter((v) => v.verdict === "fixed").length;
  return {
    total: verdicts.length,
    fixed,
    precision: ratio(fixed, verdicts.length),
  };
}

// Each verdict is "keep", "drop" or "wait" (not enough data or input missing).
export function verdicts(m) {
  const { manual } = m;
  const out = {};

  const net =
    manual.typesafeUsd == null ? null : m.trial.cost + manual.typesafeUsd;
  const drop = (base, now) => (base && now != null ? 1 - now / base : null);
  const dayDrop = drop(m.baseline.perDay, net && ratio(net, m.trial.days));
  const commitDrop = drop(
    m.baseline.perCommit,
    net && ratio(net, m.trial.commits),
  );
  out.all =
    dayDrop == null || commitDrop == null
      ? { verdict: "wait", why: "needs TypeSafe spend and trial activity" }
      : dayDrop >= 0.15 && commitDrop >= 0.15
        ? {
            verdict: "keep",
            why: `down ${pct(dayDrop)} / day, ${pct(commitDrop)} / commit`,
          }
        : {
            verdict: "drop",
            why: `down ${pct(dayDrop)} / day, ${pct(commitDrop)} / commit; needs ≥ 15 %`,
          };
  out.all.dayDrop = dayDrop;
  out.all.commitDrop = commitDrop;

  const r = m.router;
  const savings = r && ratio(r.saved_usd, r.baseline_usd);
  out.router =
    !r || !r.requests || manual.routerOverrides == null
      ? {
          verdict: "wait",
          why: r?.requests ? "needs override count" : "no routed requests yet",
        }
      : savings >= 0.2 && manual.routerOverrides <= 3
        ? { verdict: "keep", why: `saved ${pct(savings)}` }
        : {
            verdict: "drop",
            why: `saved ${pct(savings)}, ${manual.routerOverrides} overrides`,
          };
  out.router.savings = savings;

  const c = m.compaction;
  out.compaction =
    !c.count || manual.lostContext == null
      ? {
          verdict: "wait",
          why: c.count ? "needs lost-context count" : "no compaction yet",
        }
      : manual.lostContext === 0
        ? { verdict: "keep", why: `${c.count} compactions, no lost context` }
        : {
            verdict: "drop",
            why: `${manual.lostContext} sessions lost context`,
          };

  const cov = m.coverage;
  const up = cov.first && cov.last ? cov.last.lines - cov.first.lines : null;
  out.coverage =
    up == null || cov.first.id === cov.last.id || manual.gapsClosed == null
      ? { verdict: "wait", why: "needs a second run and gaps-closed count" }
      : up > 0 && manual.gapsClosed >= 1
        ? {
            verdict: "keep",
            why: `lines +${up.toFixed(2)} pp, ${manual.gapsClosed} gaps closed`,
          }
        : {
            verdict: "drop",
            why: `lines ${up >= 0 ? "+" : ""}${up.toFixed(2)} pp, ${manual.gapsClosed} gaps closed`,
          };

  const rv = m.review;
  out.review = !rv.total
    ? { verdict: "wait", why: "no logged verdicts yet" }
    : rv.precision >= 0.3 && rv.fixed >= 1
      ? { verdict: "keep", why: `${rv.fixed} of ${rv.total} fixed` }
      : {
          verdict: "drop",
          why: `${rv.fixed} of ${rv.total} fixed; needs ≥ 30 %`,
        };

  return out;
}

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot" }[c]};`,
  );

export function renderHtml(m, v) {
  const r = m.router ?? {};
  const cov = m.coverage;
  const covText = (x) =>
    x
      ? `${x.lines.toFixed(2)} % lines, ${x.branches.toFixed(2)} % branches`
      : "–";
  const rows = [
    [
      "All",
      "Claude cost / active day",
      usd(m.baseline.perDay),
      usd(ratio(m.trial.cost, m.trial.days)),
      "down ≥ 15 %, net of TypeSafe spend",
      v.all,
    ],
    [
      "",
      "Claude cost / commit",
      usd(m.baseline.perCommit),
      usd(ratio(m.trial.cost, m.trial.commits)),
      "",
      null,
    ],
    ["", "TypeSafe spend", "–", usd(m.manual.typesafeUsd), "", null],
    [
      "Router",
      "savings vs baseline model",
      "–",
      `${pct(v.router.savings)} (${usd(r.saved_usd)} of ${usd(r.baseline_usd)}, ${r.requests ?? 0} requests)`,
      "≥ 20 %, ≤ 3 overrides",
      v.router,
    ],
    [
      "",
      "Jev fallback rate, p95",
      "–",
      `${pct(r.jev?.fallback_rate)}, ${r.jev?.p95_ms ?? "–"} ms`,
      "",
      null,
    ],
    [
      "save-token-jev",
      "compactions, tokens saved",
      "–",
      `${m.compaction.count}, ${m.compaction.tokensSaved.toLocaleString("en")}`,
      "0 lost-context sessions",
      v.compaction,
    ],
    [
      "supercov",
      "coverage",
      covText(cov.first),
      covText(cov.last),
      "up, ≥ 1 gap closed",
      v.coverage,
    ],
    [
      "jev-review",
      "fixed / all findings",
      "–",
      `${m.review.fixed} / ${m.review.total}`,
      "≥ 30 % and ≥ 1 fixed",
      v.review,
    ],
  ];
  const cell = (x) =>
    x
      ? `<td class="${x.verdict}"><b>${x.verdict}</b><br>${esc(x.why)}</td>`
      : "<td></td>";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Jev tooling report</title>
<style>
:root { --bg: #fff; --fg: #1d1d1f; --line: #ddd; --keep: #1a7f37; --drop: #c62828; --wait: #8a6d00; }
@media (prefers-color-scheme: dark) {
  :root { --bg: #161618; --fg: #e8e8ea; --line: #3a3a3e; --keep: #4cc26a; --drop: #ff6b6b; --wait: #e0b84a; }
}
body { background: var(--bg); color: var(--fg); font: 15px/1.45 system-ui, sans-serif; margin: 24px 16px; }
table { border-collapse: collapse; width: 100%; max-width: 1100px; }
th, td { border-bottom: 1px solid var(--line); padding: 8px; text-align: left; vertical-align: top; }
.keep b { color: var(--keep); } .drop b { color: var(--drop); } .wait b { color: var(--wait); }
.note { max-width: 1100px; opacity: .8; }
</style></head><body>
<h1>Jev tooling: worth it?</h1>
<p>Baseline ${esc(m.baseline.from)} → ${esc(m.baseline.to)} · trial ${esc(m.trial.from)} → ${esc(m.trial.to)} · checkpoints Fri 16 Oct and Fri 30 Oct 2026, 18:00</p>
<table><tr><th>Tool</th><th>Metric</th><th>Baseline</th><th>Trial</th><th>Keep if</th><th>Verdict</th></tr>
${rows.map(([t, k, b, n, rule, x]) => `<tr><td>${esc(t)}</td><td>${esc(k)}</td><td>${esc(b)}</td><td>${esc(n)}</td><td>${esc(rule)}</td>${cell(x)}</tr>`).join("\n")}
</table>
<ul class="note">
<li>Claude cost comes from ccusage per session, dated by last activity; commits count those on <code>main</code>.</li>
<li>Compactions count every compact_boundary in this project's transcripts, Jev or built-in.</li>
<li>Manual numbers live in <code>.metrics/manual.json</code>.</li>
</ul>
</body></html>
`;
}

// --- data collection (not unit tested: shells out and reads ~/.claude) ---

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", maxBuffer: 1 << 28 });
  return r.status === 0 ? r.stdout : null;
}

function transcriptFiles(mainRoot) {
  const base = `${homedir()}/.claude/projects`;
  const prefix = mainRoot.replace(/[^A-Za-z0-9]/g, "-");
  return readdirSync(base)
    .filter((d) => d === prefix || d.startsWith(`${prefix}-`))
    .flatMap((d) =>
      readdirSync(`${base}/${d}`)
        .filter((f) => f.endsWith(".jsonl"))
        .map((f) => `${base}/${d}/${f}`),
    );
}

function markersFrom(file, from) {
  const lines = readFileSync(file, "utf8").split("\n");
  const out = [];
  let open = null;
  for (const line of lines) {
    if (!line) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (e.subtype === "compact_boundary" && e.timestamp >= from) {
      open = { preTokens: e.compactMetadata?.preTokens ?? 0 };
      out.push(open);
    } else if (open && e.type === "assistant" && e.message?.usage) {
      const u = e.message.usage;
      open.postTokens =
        (u.input_tokens ?? 0) +
        (u.cache_read_input_tokens ?? 0) +
        (u.cache_creation_input_tokens ?? 0);
      open = null;
    }
  }
  return out;
}

function supercovRun(root, id) {
  const out = run("npx", ["supercov", "runs", id, "--json"], root);
  if (!out) return null;
  const c = JSON.parse(out).data.coverage;
  return { id, lines: c.lines.percentage, branches: c.branches.percentage };
}

async function askMissing(manual, path) {
  const missing = MANUAL.filter(([k]) => manual[k] == null);
  if (!missing.length || !process.stdin.isTTY) return manual;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  for (const [k, q] of missing) {
    const a = (await rl.question(`${q} (blank to skip): `)).trim();
    if (a !== "" && !Number.isNaN(Number(a))) manual[k] = Number(a);
  }
  rl.close();
  writeFileSync(path, `${JSON.stringify(manual, null, 2)}\n`);
  return manual;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const metrics = `${root}.metrics`;
  const commonDir = run(
    "git",
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    root,
  ).trim();
  const mainRoot = commonDir.replace(/\/\.git$/, "");

  const base = JSON.parse(
    readFileSync(`${metrics}/baseline/claude-usage.json`, "utf8"),
  );
  const baseCommits = Number(
    readFileSync(`${metrics}/baseline/commits.txt`, "utf8").match(
      /(\d+)\s*$/,
    )[1],
  );
  const from = base.window.to;
  const to = new Date().toISOString();

  const files = transcriptFiles(mainRoot);
  const ids = new Set(
    files.map((f) =>
      f
        .split("/")
        .pop()
        .replace(/\.jsonl$/, ""),
    ),
  );
  const usage = JSON.parse(
    run("npx", ["-y", CCUSAGE, "session", "--json", "--offline"], root) ??
      '{"session":[]}',
  );
  const trialSessions = usage.session
    .filter((s) => ids.has(s.period) && s.metadata.lastActivity >= from)
    .map((s) => ({
      cost: s.totalCost,
      day: s.metadata.lastActivity.slice(0, 10),
    }));
  const trialCommits = Number(
    run("git", ["rev-list", "--count", `--since=${from}`, "main"], root) ?? 0,
  );

  const routerOut = existsSync(ROUTER_LOG)
    ? run("npx", ["-y", ROUTER, "report", ROUTER_LOG], root)
    : null;

  const runsDir = `${root}.supercov/runs`;
  const runs = existsSync(runsDir)
    ? readdirSync(runsDir)
        .filter((d) => existsSync(`${runsDir}/${d}/run.json`))
        .map((d) =>
          JSON.parse(readFileSync(`${runsDir}/${d}/run.json`, "utf8")),
        )
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    : [];

  const verdictsFile = `${metrics}/review-verdicts.jsonl`;
  const logged = existsSync(verdictsFile)
    ? readFileSync(verdictsFile, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : [];

  const manualFile = `${metrics}/manual.json`;
  const manual = await askMissing(
    existsSync(manualFile) ? JSON.parse(readFileSync(manualFile, "utf8")) : {},
    manualFile,
  );

  const m = {
    baseline: {
      from: base.window.from,
      to: from,
      ...costStats(
        Object.entries(base.costByDay).map(([day, cost]) => ({ day, cost })),
        baseCommits,
      ),
    },
    trial: { from, to, ...costStats(trialSessions, trialCommits) },
    router: routerOut ? JSON.parse(routerOut) : null,
    compaction: compactionStats(files.flatMap((f) => markersFrom(f, from))),
    coverage: {
      first: runs.length ? supercovRun(root, runs[0].id) : null,
      last: runs.length ? supercovRun(root, runs.at(-1).id) : null,
    },
    review: reviewStats(logged),
    manual,
  };
  const v = verdicts(m);
  const out = `${metrics}/jev-tools-report.html`;
  writeFileSync(out, renderHtml(m, v));
  for (const [tool, x] of Object.entries(v))
    console.log(`${tool}: ${x.verdict} (${x.why})`);
  console.log(out);
  if (process.platform === "darwin" && !process.argv.includes("--no-open"))
    spawnSync("open", ["-a", "Firefox", out]);
}
