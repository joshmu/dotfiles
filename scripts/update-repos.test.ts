import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  parseArgs,
  chunk,
  parseBranchOutput,
  resolveDefaultBranch,
  resolveMostActiveEnvBranch,
  previewBranchSwitch,
  discoverGitRepos,
  SKIP_DIRS,
  ENV_BRANCHES,
  DEFAULT_BRANCH_PRECEDENCE,
} from "./update-repos";

describe("parseArgs", () => {
  test("returns defaults with no args", () => {
    const opts = parseArgs([]);
    expect(opts.stash).toBe(false);
    expect(opts.dryRun).toBe(false);
    expect(opts.help).toBe(false);
    expect(opts.skipDefaultBranch).toBe(false);
    expect(opts.parallel).toBe(10);
  });

  test("parses --stash", () => {
    expect(parseArgs(["--stash"]).stash).toBe(true);
  });

  test("parses --dry-run", () => {
    expect(parseArgs(["--dry-run"]).dryRun).toBe(true);
  });

  test("parses --help", () => {
    expect(parseArgs(["--help"]).help).toBe(true);
  });

  test("parses -h", () => {
    expect(parseArgs(["-h"]).help).toBe(true);
  });

  test("parses --skip-default-branch", () => {
    expect(parseArgs(["--skip-default-branch"]).skipDefaultBranch).toBe(true);
  });

  test("parses --repair-remote-head", () => {
    expect(parseArgs(["--repair-remote-head"]).repairRemoteHead).toBe(true);
  });

  test("defaults --repair-remote-head to false", () => {
    expect(parseArgs([]).repairRemoteHead).toBe(false);
  });

  test("parses --by-activity", () => {
    expect(parseArgs(["--by-activity"]).byActivity).toBe(true);
  });

  test("defaults --by-activity to false", () => {
    expect(parseArgs([]).byActivity).toBe(false);
  });

  test("parses --parallel with value", () => {
    expect(parseArgs(["--parallel", "5"]).parallel).toBe(5);
  });

  test("caps --parallel at 20", () => {
    expect(parseArgs(["--parallel", "50"]).parallel).toBe(20);
  });

  test("ignores invalid --parallel value", () => {
    expect(parseArgs(["--parallel", "abc"]).parallel).toBe(10);
  });

  test("parses multiple flags together", () => {
    const opts = parseArgs(["--stash", "--dry-run", "--parallel", "3"]);
    expect(opts.stash).toBe(true);
    expect(opts.dryRun).toBe(true);
    expect(opts.parallel).toBe(3);
  });
});

describe("chunk", () => {
  test("splits array into equal chunks", () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  test("handles remainder in last chunk", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  test("returns single chunk when size >= array length", () => {
    expect(chunk([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });

  test("returns empty array for empty input", () => {
    expect(chunk([], 5)).toEqual([]);
  });

  test("handles chunk size of 1", () => {
    expect(chunk([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
  });
});

describe("parseBranchOutput", () => {
  test("parses simple local branches", () => {
    const output = "  main\n  develop\n* feature/foo\n";
    expect(parseBranchOutput(output)).toEqual(["main", "develop", "feature/foo"]);
  });

  test("parses remote branches and deduplicates", () => {
    const output = [
      "* main",
      "  develop",
      "  remotes/origin/main",
      "  remotes/origin/develop",
      "  remotes/origin/feature/bar",
    ].join("\n");
    expect(parseBranchOutput(output)).toEqual(["main", "develop", "feature/bar"]);
  });

  test("handles empty output", () => {
    expect(parseBranchOutput("")).toEqual([]);
  });

  test("strips whitespace-only lines", () => {
    expect(parseBranchOutput("  \n  main\n  \n")).toEqual(["main"]);
  });

  test("filters HEAD symbolic ref pointer", () => {
    const output = "* main\n  remotes/origin/HEAD -> origin/main\n  remotes/origin/main\n";
    const result = parseBranchOutput(output);
    expect(result).toEqual(["main"]);
  });
});

describe("resolveDefaultBranch", () => {
  test("returns main when only main exists", () => {
    expect(resolveDefaultBranch(["main", "develop"], null)).toBe("main");
  });

  test("returns master when only master exists", () => {
    expect(resolveDefaultBranch(["master", "develop"], null)).toBe("master");
  });

  test("prefers main over master by default precedence", () => {
    expect(resolveDefaultBranch(["main", "master"], null)).toBe("main");
  });

  test("uses remote HEAD to pick master when both exist", () => {
    expect(resolveDefaultBranch(["main", "master"], "master")).toBe("master");
  });

  test("uses remote HEAD to pick main when both exist", () => {
    expect(resolveDefaultBranch(["main", "master"], "main")).toBe("main");
  });

  test("trusts remoteHead pointing to develop when present in branches", () => {
    // Repos where remote default is develop/dev/release should be honoured —
    // not silently overridden by main/master precedence.
    expect(resolveDefaultBranch(["main", "master", "develop"], "develop")).toBe("develop");
  });

  test("ignores remoteHead pointing to a non-env-branch (e.g. release/v2)", () => {
    // Legacy repos with feature/release branches as GitHub default fall back
    // to precedence rather than silently following weird defaults.
    expect(resolveDefaultBranch(["release/v2", "develop"], "release/v2")).toBe("develop");
  });

  test("falls back to precedence when remoteHead points to a branch not in list", () => {
    // Drifted / dangling symref — defensive fallback, no surprise.
    expect(resolveDefaultBranch(["main", "master"], "gone-branch")).toBe("main");
  });

  test("falls back to precedence when remoteHead names a branch absent locally", () => {
    expect(resolveDefaultBranch(["main", "develop"], "master")).toBe("main");
  });

  test("falls through to stage when no main or master", () => {
    expect(resolveDefaultBranch(["stage", "qa", "develop"], null)).toBe("stage");
  });

  test("falls through to qa", () => {
    expect(resolveDefaultBranch(["qa", "develop", "feature/x"], null)).toBe("qa");
  });

  test("falls through to develop", () => {
    expect(resolveDefaultBranch(["develop", "feature/x"], null)).toBe("develop");
  });

  test("falls through to dev", () => {
    expect(resolveDefaultBranch(["dev", "feature/x"], null)).toBe("dev");
  });

  test("returns null when no known branch exists", () => {
    expect(resolveDefaultBranch(["feature/x", "bugfix/y"], null)).toBeNull();
  });

  test("returns null for empty branch list", () => {
    expect(resolveDefaultBranch([], null)).toBeNull();
  });

  test("respects custom precedence list", () => {
    expect(resolveDefaultBranch(["main", "develop"], null, ["develop", "main"])).toBe("develop");
  });
});

describe("resolveMostActiveEnvBranch", () => {
  test("picks most recently committed env branch", () => {
    const branches = ["main", "qa", "develop"];
    const ts = { main: 1700000000, qa: 1716000000, develop: 1710000000 };
    expect(resolveMostActiveEnvBranch(branches, ts)).toBe("qa");
  });

  test("returns only env branch when one exists", () => {
    expect(resolveMostActiveEnvBranch(["master", "feature/x"], { master: 100 })).toBe("master");
  });

  test("ignores feature branches even when more recent", () => {
    const ts = { main: 1000, "feature/hot": 2000 };
    expect(resolveMostActiveEnvBranch(["main", "feature/hot"], ts)).toBe("main");
  });

  test("returns null when no env branches present", () => {
    expect(resolveMostActiveEnvBranch(["feature/x", "bugfix/y"], {})).toBeNull();
  });

  test("returns null for empty branch list", () => {
    expect(resolveMostActiveEnvBranch([], {})).toBeNull();
  });

  test("tie-breaks on equal timestamps via precedence (qa before develop)", () => {
    // DEFAULT_BRANCH_PRECEDENCE has qa at index 3, develop at index 4 — qa wins ties.
    const ts = { develop: 500, qa: 500 };
    expect(resolveMostActiveEnvBranch(["develop", "qa"], ts)).toBe("qa");
  });

  test("skips env branches with no timestamp entry", () => {
    expect(resolveMostActiveEnvBranch(["qa", "stage"], { qa: 100 })).toBe("qa");
  });

  test("ENV_BRANCHES exports expected long-lived branches", () => {
    expect(ENV_BRANCHES).toContain("main");
    expect(ENV_BRANCHES).toContain("master");
    expect(ENV_BRANCHES).toContain("develop");
    expect(ENV_BRANCHES).toContain("development");
    expect(ENV_BRANCHES).toContain("dev");
    expect(ENV_BRANCHES).toContain("qa");
    expect(ENV_BRANCHES).toContain("uat");
    expect(ENV_BRANCHES).toContain("stage");
    expect(ENV_BRANCHES).toContain("preprod");
    expect(ENV_BRANCHES).toContain("prod");
  });
});

describe("previewBranchSwitch", () => {
  test("returns switch info when default branch differs from current", () => {
    const result = previewBranchSwitch("feature/x", ["main", "feature/x"], null);
    expect(result).toEqual({ fromBranch: "feature/x", toBranch: "main" });
  });

  test("returns null when already on default branch", () => {
    expect(previewBranchSwitch("main", ["main", "develop"], null)).toBeNull();
  });

  test("returns null when no default branch found", () => {
    expect(previewBranchSwitch("feature/x", ["feature/x", "feature/y"], null)).toBeNull();
  });

  test("uses remote HEAD to disambiguate main vs master", () => {
    const result = previewBranchSwitch("feature/x", ["main", "master", "feature/x"], "master");
    expect(result).toEqual({ fromBranch: "feature/x", toBranch: "master" });
  });

  test("returns null when current branch is the disambiguated choice", () => {
    expect(previewBranchSwitch("master", ["main", "master"], "master")).toBeNull();
  });
});

describe("parseArgs roots", () => {
  test("collects bare path args as roots", () => {
    const opts = parseArgs(["/a/b", "/c/d"]);
    expect(opts.roots).toEqual(["/a/b", "/c/d"]);
  });

  test("separates roots from flags", () => {
    const opts = parseArgs(["~/repos", "--skip-default-branch", "~/code"]);
    expect(opts.roots).toEqual(["~/repos", "~/code"]);
    expect(opts.skipDefaultBranch).toBe(true);
  });

  test("does not treat --parallel value as a root", () => {
    const opts = parseArgs(["~/repos", "--parallel", "5"]);
    expect(opts.roots).toEqual(["~/repos"]);
    expect(opts.parallel).toBe(5);
  });

  test("defaults to empty roots", () => {
    expect(parseArgs([]).roots).toEqual([]);
  });
});

describe("discoverGitRepos", () => {
  let base: string;

  // Build a fixture tree:
  //   base/repoA/.git              → discovered
  //   base/container/repoB/.git    → discovered (container walked through)
  //   base/container/repoB/nested/.git → NOT discovered (pruned at repoB)
  //   base/node_modules/pkg/.git   → NOT discovered (skip dir)
  //   base/plain/                  → no repo, nothing discovered
  //   base/singleRepo/.git         → discovered when passed as a root directly
  beforeAll(() => {
    base = mkdtempSync(join(tmpdir(), "update-repos-test-"));
    const mkrepo = (p: string) => mkdirSync(join(p, ".git"), { recursive: true });
    mkrepo(join(base, "repoA"));
    mkrepo(join(base, "container", "repoB"));
    mkrepo(join(base, "container", "repoB", "nested"));
    mkrepo(join(base, "node_modules", "pkg"));
    mkdirSync(join(base, "plain", "sub"), { recursive: true });
    mkrepo(join(base, "singleRepo"));
  });

  afterAll(() => {
    rmSync(base, { recursive: true, force: true });
  });

  test("discovers repos in a container, pruning at the repo boundary", () => {
    const repos = discoverGitRepos([join(base, "container")]);
    expect(repos).toEqual([join(base, "container", "repoB")]);
    // nested repo inside repoB must NOT appear
    expect(repos).not.toContain(join(base, "container", "repoB", "nested"));
  });

  test("walks nested containers and skips heavy/vendored dirs", () => {
    const repos = discoverGitRepos([base]);
    expect(repos).toContain(join(base, "repoA"));
    expect(repos).toContain(join(base, "container", "repoB"));
    expect(repos).toContain(join(base, "singleRepo"));
    // node_modules contents pruned
    expect(repos).not.toContain(join(base, "node_modules", "pkg"));
    // boundary prune holds even via the top-level walk
    expect(repos).not.toContain(join(base, "container", "repoB", "nested"));
  });

  test("treats a root that is itself a repo as a single repo", () => {
    expect(discoverGitRepos([join(base, "singleRepo")])).toEqual([join(base, "singleRepo")]);
  });

  test("skips missing roots without throwing", () => {
    const repos = discoverGitRepos([join(base, "does-not-exist"), join(base, "repoA")]);
    expect(repos).toEqual([join(base, "repoA")]);
  });

  test("dedupes overlapping roots", () => {
    const repos = discoverGitRepos([base, join(base, "container")]);
    const repoB = join(base, "container", "repoB");
    expect(repos.filter((r) => r === repoB)).toHaveLength(1);
  });

  test("SKIP_DIRS covers the repo-boundary marker and node_modules", () => {
    expect(SKIP_DIRS.has(".git")).toBe(true);
    expect(SKIP_DIRS.has("node_modules")).toBe(true);
  });
});
