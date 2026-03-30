import { describe, test, expect } from "bun:test";
import { parseArgs, chunk, parseBranchOutput, resolveDefaultBranch } from "./update-repos";

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

  test("ignores remote HEAD when it is not main or master", () => {
    expect(resolveDefaultBranch(["main", "master", "develop"], "develop")).toBe("main");
  });

  test("ignores remote HEAD when only one of main/master exists", () => {
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
