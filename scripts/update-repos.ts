#!/usr/bin/env bun

/*
 * Repository updater script
 * Updates all git repositories found in the current directory
 * Safely handles repos with uncommitted changes
 *
 * Usage: update-repos [options]
 * Run from any directory containing git repositories
 */

import { spawn } from "bun";
import { existsSync, readdirSync } from "fs";
import { join, basename } from "path";

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

// Helper functions for colored output
const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset}  ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset}  ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset}  ${msg}`),
  error: (msg: string) => console.error(`${colors.red}✗${colors.reset}  ${msg}`),
  step: (msg: string) => console.log(`${colors.cyan}➤${colors.reset}  ${msg}`),
  cmd: (msg: string) => console.log(`${colors.magenta}$${colors.reset}  ${msg}`),
};

// Parse command line arguments
interface Options {
  stash: boolean;
  dryRun: boolean;
  help: boolean;
  skipDefaultBranch: boolean;
  repairRemoteHead: boolean;
  byActivity: boolean;
  parallel: number;
  // Explicit root directories to discover repos under. Each root is walked
  // recursively, pruning at the first repo boundary (a dir containing .git),
  // so containers (many repos), nested containers, and single repos are all
  // handled uniformly. Empty → fall back to scanning the current directory.
  roots: string[];
}

export function parseArgs(argv?: string[]): Options {
  const args = argv ?? process.argv.slice(2);
  const options: Options = {
    stash: false,
    dryRun: false,
    help: false,
    skipDefaultBranch: false,
    repairRemoteHead: false,
    byActivity: false,
    parallel: 10, // Default to 10 parallel operations
    roots: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--stash":
        options.stash = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--skip-default-branch":
        options.skipDefaultBranch = true;
        break;
      case "--repair-remote-head":
        options.repairRemoteHead = true;
        break;
      case "--by-activity":
        options.byActivity = true;
        break;
      case "--parallel":
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith("--")) {
          const num = parseInt(nextArg, 10);
          if (!isNaN(num) && num > 0) {
            options.parallel = Math.min(num, 20); // Cap at 20
            i++; // Skip the next argument
          } else {
            log.warn(`Invalid parallel value: ${nextArg}`);
          }
        } else {
          log.warn(`--parallel requires a number`);
        }
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        if (!arg.startsWith("--") && i > 0 && args[i - 1] === "--parallel") {
          // This is handled in the --parallel case
        } else if (arg.startsWith("--")) {
          log.warn(`Unknown option: ${arg}`);
        } else {
          // Bare argument → treat as a root directory to scan.
          options.roots.push(arg);
        }
    }
  }

  return options;
}

function showHelp() {
  console.log(`
${colors.bright}Repository Updater${colors.reset}

Updates git repositories discovered under one or more root directories.
With no root given, scans the current directory. Each root is walked
recursively and pruned at the first repo boundary, so containers, nested
containers, and single repos are all handled. Missing roots are skipped.

${colors.bright}Usage:${colors.reset}
  update-repos [roots...] [options]

${colors.bright}Options:${colors.reset}
  --stash                Stash uncommitted changes before pulling
                         (changes remain stashed - run 'git stash pop' to restore)
  --skip-default-branch  Don't switch to default branch before updating
  --repair-remote-head   Refresh stale origin/HEAD symrefs (set-head --auto) and exit
  --by-activity          Pick most-recently-committed env branch per repo
                         (main/master/develop/dev/qa/uat/stage/preprod/prod);
                         fast-forwards all env branches before switching
  --parallel <n>         Number of repos to update concurrently (default: 10, max: 20)
  --dry-run              Show what would be done without making changes
  -h, --help             Show this help message

${colors.bright}Examples:${colors.reset}
  update-repos                          # Scan current directory
  update-repos ~/work/brg/repos ~/Desktop/code ~/.claude ~/dotfiles
                                        # Scan multiple curated roots (missing ones skipped)
  update-repos --parallel 5             # Update 5 repos concurrently
  update-repos --skip-default-branch    # Update without switching branches
  update-repos --stash --parallel 15    # Stash changes and update 15 repos at a time
  update-repos --dry-run                # Preview what would happen

${colors.bright}Default behavior:${colors.reset}
  - Skips repositories with uncommitted changes for safety
  - Switches to default branch before updating (main/master/stage/qa/develop/dev)
  - Shows branch switches with arrow notation (e.g., feature → develop)
  - Processes 10 repositories in parallel for faster updates
`);
}

// Execute git command and return result
async function runGitCommand(
  repoPath: string,
  args: string[],
): Promise<{ success: boolean; output: string }> {
  try {
    const proc = spawn({
      cmd: ["git", ...args],
      cwd: repoPath,
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const error = await new Response(proc.stderr).text();

    await proc.exited;

    return {
      success: proc.exitCode === 0,
      output: output + error,
    };
  } catch (error) {
    return {
      success: false,
      output: error instanceof Error ? error.message : String(error),
    };
  }
}

// Execute a shell command (for piped git operations like patch-id)
async function runShell(
  repoPath: string,
  cmd: string,
): Promise<{ success: boolean; output: string }> {
  try {
    const proc = spawn({
      cmd: ["bash", "-c", cmd],
      cwd: repoPath,
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    const error = await new Response(proc.stderr).text();
    await proc.exited;
    return { success: proc.exitCode === 0, output: output + error };
  } catch (error) {
    return {
      success: false,
      output: error instanceof Error ? error.message : String(error),
    };
  }
}

// Attempt to auto-resolve a divergent branch state without losing work.
//
// Strategy 1 (safe reset): if every local-only commit has a content-identical
// counterpart on the remote (matching `git patch-id`), the local commits are
// already represented upstream — likely they were rebased remotely. A hard
// reset to @{u} loses no content.
//
// Strategy 2 (safe rebase): if the local and remote commits touch disjoint
// file sets, a rebase cannot produce a content conflict. We rebase local
// commits on top of remote.
//
// If neither applies, returns { resolved: false } and the caller skips the
// repo for manual resolution.
async function tryAutoResolveDivergent(
  repoPath: string,
): Promise<{ resolved: true; method: "reset" | "rebase" } | { resolved: false }> {
  const patchIdsCmd = (range: string) =>
    `git rev-list ${range} | while read sha; do git show "$sha" | git patch-id --stable; done | awk '{print $1}'`;

  const [localIds, remoteIds] = await Promise.all([
    runShell(repoPath, patchIdsCmd("@{u}..HEAD")),
    runShell(repoPath, patchIdsCmd("HEAD..@{u}")),
  ]);

  if (!localIds.success || !remoteIds.success) return { resolved: false };

  const localSet = new Set(localIds.output.trim().split("\n").filter(Boolean));
  const remoteSet = new Set(remoteIds.output.trim().split("\n").filter(Boolean));

  // #1: every local commit is already on remote → reset is safe
  if (localSet.size > 0 && [...localSet].every((id) => remoteSet.has(id))) {
    const reset = await runGitCommand(repoPath, ["reset", "--hard", "@{u}"]);
    if (reset.success) return { resolved: true, method: "reset" };
    return { resolved: false };
  }

  // #2: disjoint file sets → rebase cannot conflict.
  //
  // Use `git log --name-only` (files touched by commits in the range) rather
  // than `git diff --name-only` (cumulative tree delta), because diff includes
  // files that differ for any reason — including unrelated changes that
  // already existed on the divergent base — which produces false overlap.
  const [localFiles, remoteFiles] = await Promise.all([
    runGitCommand(repoPath, ["log", "@{u}..HEAD", "--name-only", "--pretty=format:"]),
    runGitCommand(repoPath, ["log", "HEAD..@{u}", "--name-only", "--pretty=format:"]),
  ]);
  if (!localFiles.success || !remoteFiles.success) return { resolved: false };

  const localFileSet = new Set(localFiles.output.trim().split("\n").filter(Boolean));
  const remoteFileSet = new Set(remoteFiles.output.trim().split("\n").filter(Boolean));
  const overlap = [...localFileSet].some((f) => remoteFileSet.has(f));

  if (!overlap && localFileSet.size > 0 && remoteFileSet.size > 0) {
    const rebase = await runGitCommand(repoPath, ["rebase", "@{u}"]);
    if (rebase.success) return { resolved: true, method: "rebase" };
    // Rebase started but conflicted unexpectedly — abort cleanly
    await runGitCommand(repoPath, ["rebase", "--abort"]);
    return { resolved: false };
  }

  return { resolved: false };
}

// Check if a directory is a git repository
function isGitRepo(path: string): boolean {
  return existsSync(join(path, ".git"));
}

// Directories we never descend into while discovering repos. `.git` is the
// repo-boundary marker (handled by pruning), the rest are heavy/irrelevant
// trees that would only slow the walk or surface vendored repos we don't own.
export const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "out",
  "vendor",
  ".cache",
  ".turbo",
  "coverage",
  ".venv",
  "venv",
  "__pycache__",
  ".pnpm",
  ".yarn",
]);

// Recursively discover git repos under one or more root directories.
//
// Walk semantics: each directory is checked first — if it is itself a repo
// (contains .git) it is recorded and we STOP descending (prune at the repo
// boundary). This means nested worktrees, submodules, and vendored repos
// inside a discovered repo are never touched. Non-repo containers are walked
// further, so a container-of-containers (e.g. code/ → open-source/ → repo)
// resolves to its leaf repos. A root that is itself a single repo (dotfiles,
// .claude) resolves to just that repo.
//
// Missing roots are skipped with a warning rather than failing — this is what
// makes a single root list portable across machines (a machine simply skips
// the roots it doesn't have).
export function discoverGitRepos(roots: string[], maxDepth = 5): string[] {
  const found = new Set<string>();

  const walk = (dir: string, depth: number) => {
    if (depth > maxDepth) return;

    // Repo boundary: record and do not descend.
    if (isGitRepo(dir)) {
      found.add(dir);
      return;
    }

    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // unreadable dir — skip quietly
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(join(dir, entry.name), depth + 1);
    }
  };

  for (const root of roots) {
    if (!existsSync(root)) {
      log.warn(`Root not found, skipping: ${root}`);
      continue;
    }
    walk(root, 0);
  }

  return [...found].sort();
}

// Check if repo has uncommitted changes
async function hasUncommittedChanges(repoPath: string): Promise<boolean> {
  const { success, output } = await runGitCommand(repoPath, ["status", "--porcelain"]);
  return success && output.trim().length > 0;
}

// Get current branch name
async function getCurrentBranch(repoPath: string): Promise<string> {
  const { success, output } = await runGitCommand(repoPath, ["branch", "--show-current"]);
  return success ? output.trim() : "unknown";
}

// Parse raw `git branch -a` output into a deduplicated list of branch names
export function parseBranchOutput(output: string): string[] {
  const branches = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.includes("->"))
    .map((line) => line.replace(/^\*?\s*/, "").replace(/^remotes\/origin\//, ""));
  return [...new Set(branches)];
}

// Get all branches (local and remote)
async function getAllBranches(repoPath: string): Promise<string[]> {
  const { success, output } = await runGitCommand(repoPath, ["branch", "-a"]);
  if (!success) return [];
  return parseBranchOutput(output);
}

// Read committer Unix timestamp of the tip of an origin ref.
// Returns null when the ref doesn't exist locally (call after fetch).
async function getBranchCommitTimestamp(repoPath: string, branch: string): Promise<number | null> {
  const { success, output } = await runGitCommand(repoPath, [
    "log",
    "-1",
    "--format=%ct",
    `origin/${branch}`,
  ]);
  if (!success) return null;
  const ts = parseInt(output.trim(), 10);
  return isNaN(ts) ? null : ts;
}

// Fast-forward a local branch to its remote counterpart without checking it
// out. Uses `git fetch origin <br>:<br>` which is safe (refuses on non-FF).
// On non-FF returns false; caller decides whether to warn.
async function fastForwardLocalBranch(repoPath: string, branch: string): Promise<boolean> {
  const { success } = await runGitCommand(repoPath, ["fetch", "origin", `${branch}:${branch}`]);
  return success;
}

// Compute the most-active env branch for a repo. Fetches origin once, reads
// commit timestamps for env branches that exist on the remote, and runs the
// pure resolver. Fast-forwards matching local refs (no checkout). Returns
// null when no env branches exist on origin.
async function findMostActiveEnvBranch(
  repoPath: string,
): Promise<{ branch: string; timestamp: number } | null> {
  await runGitCommand(repoPath, ["fetch", "origin", "--prune", "--quiet"]);

  // Read all remote branches via for-each-ref (faster than git branch -a)
  const refs = await runGitCommand(repoPath, [
    "for-each-ref",
    "--format=%(refname:short)",
    "refs/remotes/origin/",
  ]);
  if (!refs.success) return null;

  const remoteBranches = refs.output
    .split("\n")
    .map((l) => l.trim().replace(/^origin\//, ""))
    .filter((b) => b && b !== "HEAD" && ENV_BRANCHES.includes(b));

  if (remoteBranches.length === 0) return null;

  // Collect timestamps in parallel
  const timestamps: Record<string, number> = {};
  const tsResults = await Promise.all(
    remoteBranches.map(async (b) => [b, await getBranchCommitTimestamp(repoPath, b)] as const),
  );
  for (const [b, t] of tsResults) {
    if (t !== null) timestamps[b] = t;
  }

  // Fast-forward matching local branches in parallel — pure ref-update,
  // no checkout, no merge. Non-FF silently skipped (caller can re-run).
  const localList = await getAllBranches(repoPath);
  await Promise.all(
    remoteBranches
      .filter((b) => localList.includes(b))
      .map((b) => fastForwardLocalBranch(repoPath, b)),
  );

  const winner = resolveMostActiveEnvBranch(remoteBranches, timestamps);
  if (!winner) return null;
  const timestamp = timestamps[winner];
  if (timestamp === undefined) return null;
  return { branch: winner, timestamp };
}

// Switch to the most-active env branch if not already there. Caller computes
// the target via findMostActiveEnvBranch first; this just performs the
// checkout (so dry-run can skip the mutation).
async function switchToMostActiveEnvBranch(
  repoPath: string,
  currentBranch: string,
  target: string,
): Promise<{ switched: boolean; fromBranch: string; toBranch: string }> {
  if (target === currentBranch) {
    return { switched: false, fromBranch: currentBranch, toBranch: currentBranch };
  }
  const checkoutResult = await runGitCommand(repoPath, ["checkout", target]);
  if (checkoutResult.success) {
    return { switched: true, fromBranch: currentBranch, toBranch: target };
  }
  return { switched: false, fromBranch: currentBranch, toBranch: currentBranch };
}

// Read the remote HEAD from local refs (no network — call after git fetch).
// Local symref can be stale: `git fetch` does NOT refresh it; only
// `git remote set-head origin --auto` does. Caller should prefer
// getAuthoritativeRemoteHead for fresh truth.
async function getLocalRemoteHead(repoPath: string): Promise<string | null> {
  const { success, output } = await runGitCommand(repoPath, [
    "symbolic-ref",
    "refs/remotes/origin/HEAD",
  ]);
  if (success) {
    // e.g. "refs/remotes/origin/main" → "main"
    return output.trim().replace("refs/remotes/origin/", "");
  }
  return null;
}

// Read remote HEAD authoritatively via `git ls-remote --symref origin HEAD`.
// One network round-trip (bytes only). Falls back to local symref when offline.
async function getAuthoritativeRemoteHead(repoPath: string): Promise<string | null> {
  const lsRemote = await runGitCommand(repoPath, ["ls-remote", "--symref", "origin", "HEAD"]);
  if (lsRemote.success) {
    const m = lsRemote.output.match(/^ref:\s+refs\/heads\/(\S+)\s+HEAD/m);
    if (m) return m[1];
  }
  return getLocalRemoteHead(repoPath);
}

// Allowlist of long-lived environment branches. Used by both the default
// resolver (gate "trust remoteHead" on known env branches) and the activity
// mode. Repos with feature/release branches as their GitHub default fall back
// to precedence rather than silently following weird defaults.
export const ENV_BRANCHES = [
  "main",
  "master",
  "develop",
  "development",
  "dev",
  "qa",
  "uat",
  "stage",
  "preprod",
  "prod",
];

// Pure branch resolution logic — picks the best branch from a list,
// honouring remote HEAD only when it's a known long-lived env branch.
export const DEFAULT_BRANCH_PRECEDENCE = ["main", "master", "stage", "qa", "develop", "dev"];

// Pick the env branch with the most recent commit timestamp. Used by
// --by-activity to reflect "where the action actually is" per repo.
// Ties broken by tiebreakerPrecedence order (deterministic).
export function resolveMostActiveEnvBranch(
  branches: string[],
  commitTimestamps: Record<string, number>,
  allowedEnvBranches: string[] = ENV_BRANCHES,
  tiebreakerPrecedence: string[] = DEFAULT_BRANCH_PRECEDENCE,
): string | null {
  const candidates = branches.filter(
    (b) => allowedEnvBranches.includes(b) && commitTimestamps[b] !== undefined,
  );
  if (candidates.length === 0) return null;

  let winner = candidates[0];
  let winnerTs = commitTimestamps[winner];
  for (const c of candidates.slice(1)) {
    const ts = commitTimestamps[c];
    if (ts > winnerTs) {
      winner = c;
      winnerTs = ts;
    } else if (ts === winnerTs) {
      // Tie-break: pick the one earlier in tiebreakerPrecedence (or current
      // winner if neither is in the list).
      const winnerRank = tiebreakerPrecedence.indexOf(winner);
      const candRank = tiebreakerPrecedence.indexOf(c);
      const norm = (r: number) => (r === -1 ? Infinity : r);
      if (norm(candRank) < norm(winnerRank)) {
        winner = c;
        winnerTs = ts;
      }
    }
  }
  return winner;
}

export function resolveDefaultBranch(
  branches: string[],
  remoteHead: string | null,
  precedence: string[] = DEFAULT_BRANCH_PRECEDENCE,
): string | null {
  // Authoritative signal: if the remote tells us its HEAD AND it's a known
  // long-lived env branch AND it exists locally, honour it — regardless of
  // precedence rank. Gating on ENV_BRANCHES protects legacy repos whose
  // GitHub default points at a feature/release branch.
  if (remoteHead && branches.includes(remoteHead) && ENV_BRANCHES.includes(remoteHead)) {
    return remoteHead;
  }

  // Fallback precedence — for offline runs or drifted symrefs.
  for (const preferredBranch of precedence) {
    if (branches.includes(preferredBranch)) {
      return preferredBranch;
    }
  }

  return null;
}

export function previewBranchSwitch(
  currentBranch: string,
  branches: string[],
  remoteHead: string | null,
): { fromBranch: string; toBranch: string } | null {
  const defaultBranch = resolveDefaultBranch(branches, remoteHead);
  if (!defaultBranch || defaultBranch === currentBranch) return null;
  return { fromBranch: currentBranch, toBranch: defaultBranch };
}

// Find the default branch using local refs (call after git fetch for accuracy)
async function findDefaultBranch(repoPath: string): Promise<string | null> {
  const [branches, remoteHead] = await Promise.all([
    getAllBranches(repoPath),
    getAuthoritativeRemoteHead(repoPath),
  ]);
  return resolveDefaultBranch(branches, remoteHead);
}

// Switch to default branch if needed.
// Logs a drift warning when the authoritative remote HEAD differs from the
// local symref — surfaces stale .git/refs/remotes/origin/HEAD in cron output
// so you can run `--repair-remote-head` to flush them.
async function switchToDefaultBranch(
  repoPath: string,
  currentBranch: string,
): Promise<{ switched: boolean; fromBranch: string; toBranch: string }> {
  // Fetch first so branch list and remote HEAD ref are fresh
  await runGitCommand(repoPath, ["fetch", "--quiet"]);

  const defaultBranch = await findDefaultBranch(repoPath);

  if (!defaultBranch || currentBranch === defaultBranch) {
    return { switched: false, fromBranch: currentBranch, toBranch: currentBranch };
  }

  // Drift audit: compare authoritative pick vs what local symref alone would say
  const localOnly = await getLocalRemoteHead(repoPath);
  if (localOnly && localOnly !== defaultBranch) {
    const repoName = basename(repoPath);
    log.warn(
      `${repoName}: local symref drifted (says ${localOnly}, remote says ${defaultBranch}) — run --repair-remote-head`,
    );
  }

  const checkoutResult = await runGitCommand(repoPath, ["checkout", defaultBranch]);

  if (checkoutResult.success) {
    return { switched: true, fromBranch: currentBranch, toBranch: defaultBranch };
  }

  // If checkout failed, stay on current branch
  return { switched: false, fromBranch: currentBranch, toBranch: currentBranch };
}

// Main update logic for a single repo
async function updateRepo(
  repoPath: string,
  options: Options,
): Promise<{ status: "updated" | "skipped" | "stashed" | "failed"; message: string }> {
  const repoName = basename(repoPath);
  let branch = await getCurrentBranch(repoPath);

  // Skip repos with no remote configured
  const remoteResult = await runGitCommand(repoPath, ["remote"]);
  if (!remoteResult.success || remoteResult.output.trim().length === 0) {
    return {
      status: "skipped",
      message: `${repoName} [${branch}] (no remote)`,
    };
  }

  // Check for uncommitted changes
  const isDirty = await hasUncommittedChanges(repoPath);

  if (isDirty && !options.stash) {
    return {
      status: "skipped",
      message: `${repoName} [${branch}] (uncommitted changes)`,
    };
  }

  // Resolve target branch — dry-run previews only, real run switches.
  // --by-activity picks the most-recently-committed env branch; otherwise
  // we use the precedence + authoritative-remote-HEAD logic.
  let branchSwitchInfo = "";
  if (!options.skipDefaultBranch && !isDirty) {
    if (options.byActivity) {
      const target = await findMostActiveEnvBranch(repoPath);
      if (target && target.branch !== branch) {
        const dateStr = new Date(target.timestamp * 1000).toISOString().slice(0, 10);
        branchSwitchInfo = `${branch} → ${target.branch}`;
        if (options.dryRun) {
          branchSwitchInfo += ` (most recent ${dateStr})`;
          branch = target.branch;
        } else {
          const switchResult = await switchToMostActiveEnvBranch(repoPath, branch, target.branch);
          if (switchResult.switched) {
            branch = switchResult.toBranch;
            log.step(`${repoName} [${branchSwitchInfo}] (most recent ${dateStr})`);
          } else {
            branchSwitchInfo = "";
          }
        }
      }
    } else if (options.dryRun) {
      const [branches, remoteHead] = await Promise.all([
        getAllBranches(repoPath),
        getLocalRemoteHead(repoPath),
      ]);
      const preview = previewBranchSwitch(branch, branches, remoteHead);
      if (preview) {
        branchSwitchInfo = `${preview.fromBranch} → ${preview.toBranch}`;
        branch = preview.toBranch;
      }
    } else {
      const switchResult = await switchToDefaultBranch(repoPath, branch);
      if (switchResult.switched) {
        branchSwitchInfo = `${switchResult.fromBranch} → ${switchResult.toBranch}`;
        branch = switchResult.toBranch;
        log.step(`${repoName} [${branchSwitchInfo}]`);
      }
    }
  }

  if (options.dryRun) {
    const branchDisplay = branchSwitchInfo || branch;
    if (isDirty && options.stash) {
      return {
        status: "stashed",
        message: `${repoName} [${branchDisplay}] (would stash and update)`,
      };
    } else if (!isDirty) {
      return {
        status: "updated",
        message: `${repoName} [${branchDisplay}] (would update)`,
      };
    }
    return {
      status: "skipped",
      message: `${repoName} [${branchDisplay}] (uncommitted changes)`,
    };
  }

  // Stash if needed
  if (isDirty && options.stash) {
    const stashResult = await runGitCommand(repoPath, [
      "stash",
      "push",
      "-m",
      "update-repos auto-stash",
    ]);
    if (!stashResult.success) {
      return {
        status: "failed",
        message: `${repoName} [${branch}]: Failed to stash changes`,
      };
    }
  }

  // Pull latest changes — fast-forward only so divergent branches don't fail
  // the whole daily auto-update.
  const pullResult = await runGitCommand(repoPath, ["pull", "--ff-only"]);

  if (!pullResult.success) {
    const out = pullResult.output;
    const divergent = /divergent branches|Not possible to fast-forward|non-fast-forward/i.test(out);
    if (divergent) {
      // Try safe auto-resolution before giving up.
      const resolution = await tryAutoResolveDivergent(repoPath);
      if (resolution.resolved) {
        return {
          status: "updated",
          message: `${repoName} [${branch}] (auto-resolved via ${resolution.method})`,
        };
      }
      return {
        status: "skipped",
        message: `${repoName} [${branch}] (divergent — manual merge/rebase needed)`,
      };
    }
    return {
      status: "failed",
      message: `${repoName} [${branch}]: ${out.split("\n")[0]}`,
    };
  }

  if (isDirty && options.stash) {
    return {
      status: "stashed",
      message: `${repoName} [${branch}] (changes stashed - run 'git stash pop' to restore)`,
    };
  }

  return {
    status: "updated",
    message: `${repoName} [${branch}]`,
  };
}

// Utility function to chunk array into batches
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Sweep all repos and refresh stale origin/HEAD symrefs.
// `git remote set-head origin --auto` is idempotent and harmless;
// it queries the remote and rewrites .git/refs/remotes/origin/HEAD.
async function runRepairRemoteHead(repos: string[]): Promise<void> {
  log.info("Repairing origin/HEAD symrefs across all repos");
  let changed = 0;
  let skipped = 0;
  for (const repoPath of repos) {
    const repoName = basename(repoPath);
    const before = await runGitCommand(repoPath, ["symbolic-ref", "refs/remotes/origin/HEAD"]);
    const set = await runGitCommand(repoPath, ["remote", "set-head", "origin", "--auto"]);
    if (!set.success) {
      log.warn(`${repoName}: ${set.output.split("\n")[0]}`);
      skipped++;
      continue;
    }
    const after = await runGitCommand(repoPath, ["symbolic-ref", "refs/remotes/origin/HEAD"]);
    const beforeRef = before.success ? before.output.trim() : "(unset)";
    const afterRef = after.success ? after.output.trim() : "(unset)";
    if (beforeRef !== afterRef) {
      log.step(
        `${repoName}: ${beforeRef.replace("refs/remotes/origin/", "")} → ${afterRef.replace("refs/remotes/origin/", "")}`,
      );
      changed++;
    }
  }
  log.info(`Summary: ${changed} symref(s) updated, ${skipped} skipped`);
}

// Main function
async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  const roots = options.roots.length > 0 ? options.roots : [process.cwd()];

  if (options.roots.length > 0) {
    log.info(`Scanning roots: ${roots.join(", ")}`);
  } else {
    log.info(`Scanning for git repositories in: ${process.cwd()}`);
  }

  const repos = discoverGitRepos(roots);

  if (repos.length === 0) {
    log.warn("No git repositories found");
    process.exit(0);
  }

  log.info(`Found ${repos.length} git repositories`);

  if (options.repairRemoteHead) {
    await runRepairRemoteHead(repos);
    process.exit(0);
  }

  if (options.dryRun) {
    log.info("Running in dry-run mode (no changes will be made)");
  }

  if (options.parallel > 1) {
    log.info(`Processing ${options.parallel} repositories in parallel`);
  }

  console.log(); // Empty line for readability

  // Track results
  const results = {
    updated: [] as string[],
    skipped: [] as string[],
    stashed: [] as string[],
    failed: [] as string[],
  };

  // Process repositories in parallel batches
  const batches = chunk(repos, options.parallel);

  for (const batch of batches) {
    // Process all repos in this batch in parallel
    const batchResults = await Promise.all(batch.map((repo) => updateRepo(repo, options)));

    // Display results in order
    batchResults.forEach((result) => {
      switch (result.status) {
        case "updated":
          log.success(result.message);
          results.updated.push(result.message);
          break;
        case "skipped":
          log.warn(result.message);
          results.skipped.push(result.message);
          break;
        case "stashed":
          log.warn(result.message);
          results.stashed.push(result.message);
          break;
        case "failed":
          log.error(result.message);
          results.failed.push(result.message);
          break;
      }
    });
  }

  // Summary
  console.log(); // Empty line
  log.info("Summary:");

  if (results.updated.length > 0) {
    console.log(`  ${colors.green}Updated:${colors.reset} ${results.updated.length} repositories`);
  }
  if (results.stashed.length > 0) {
    console.log(`  ${colors.yellow}Stashed:${colors.reset} ${results.stashed.length} repositories`);
  }
  if (results.skipped.length > 0) {
    console.log(`  ${colors.yellow}Skipped:${colors.reset} ${results.skipped.length} repositories`);
  }
  if (results.failed.length > 0) {
    console.log(`  ${colors.red}Failed:${colors.reset} ${results.failed.length} repositories`);
  }

  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run the script (only when executed directly, not when imported for testing)
if (import.meta.main) {
  main().catch((error) => {
    log.error(`Unexpected error: ${error}`);
    process.exit(1);
  });
}
