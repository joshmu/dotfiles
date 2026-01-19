#!/usr/bin/env bun

import { spawn } from "bun";
import { existsSync, readFileSync } from "fs";
import { cp, mkdir } from "fs/promises";
import { basename, dirname, join, resolve } from "path";
import { homedir } from "os";

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

// Default patterns for file sync (when no .worktreeinclude exists)
const DEFAULT_PATTERNS = ["**/.env", "**/.env.*"];

// Determine worktree base directory based on repo location
// Default: <repo>/../worktrees/ (preserves CLAUDE.md inheritance)
// Fallback: ~/worktrees/ (when repo parent is home directory)
function getWorktreesBaseDir(repoPath: string): string {
  const repoParent = dirname(repoPath);
  const home = homedir();

  // If repo parent IS home directory, use ~/worktrees/
  // (avoid creating worktrees at parent of home)
  if (repoParent === home) {
    return join(home, "worktrees");
  }

  // Otherwise, use <repo>/../worktrees/
  return join(repoParent, "worktrees");
}

// Types for sync functionality
interface SyncOptions {
  dryRun?: boolean;
  overwrite?: boolean;
  strict?: boolean;
  json?: boolean;
}

interface SyncResult {
  copied: string[];
  skipped: string[];
  missing: string[];
  errors: Array<{ file: string; error: string }>;
}

// Execute command and return output
async function exec(cmd: string, cwd?: string): Promise<{ success: boolean; output: string; error?: string }> {
  log.cmd(cmd);

  const proc = spawn(cmd.split(" "), {
    cwd: cwd || process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = await new Response(proc.stdout).text();
  const error = await new Response(proc.stderr).text();

  const success = (await proc.exited) === 0;

  if (!success && error) {
    log.error(`Command failed: ${error}`);
  }

  return { success, output: output.trim(), error: error.trim() };
}

// Execute command quietly (no logging)
async function execQuiet(cmd: string, cwd?: string): Promise<{ success: boolean; output: string; error?: string }> {
  const proc = spawn(cmd.split(" "), {
    cwd: cwd || process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = await new Response(proc.stdout).text();
  const error = await new Response(proc.stderr).text();
  const success = (await proc.exited) === 0;

  return { success, output: output.trim(), error: error.trim() };
}

// Parse .worktreeinclude config file
function parseWorktreeInclude(repoPath: string): string[] | null {
  const configPath = join(repoPath, ".worktreeinclude");
  if (!existsSync(configPath)) return null;

  const content = readFileSync(configPath, "utf-8");
  return content
    .split("\n")
    .map((line) => line.split("#")[0].trim())
    .filter((line) => line.length > 0);
}

// Find files matching patterns using Bun's Glob
async function findIncludeFiles(repoPath: string, patterns: string[]): Promise<string[]> {
  const matches: string[] = [];

  for (const pattern of patterns) {
    const glob = new Bun.Glob(pattern);
    for await (const file of glob.scan({ cwd: repoPath, dot: true })) {
      if (!matches.includes(file)) {
        matches.push(file);
      }
    }
  }

  return matches;
}

// Detect source worktree from git worktree list
async function detectSourceWorktree(currentPath: string): Promise<string | null> {
  const { output } = await execQuiet("git worktree list --porcelain", currentPath);
  const worktrees = parseWorktreeListPorcelain(output);
  const currentAbs = resolve(currentPath);

  for (const wt of worktrees) {
    if (resolve(wt.path) !== currentAbs) {
      return wt.path;
    }
  }
  return null;
}

// Parse porcelain output from git worktree list
function parseWorktreeListPorcelain(output: string): Array<{ path: string }> {
  const worktrees: Array<{ path: string }> = [];
  const blocks = output.split("\n\n").filter((b) => b.trim());

  for (const block of blocks) {
    const lines = block.split("\n");
    const pathLine = lines.find((l) => l.startsWith("worktree "));
    if (pathLine) {
      worktrees.push({ path: pathLine.replace("worktree ", "") });
    }
  }
  return worktrees;
}

// Check if directory exists and is a git repo
function isGitRepo(path: string): boolean {
  return existsSync(join(path, ".git"));
}

// Get the main repo path (resolves worktrees to their main repo)
// Uses git rev-parse --git-common-dir which returns:
// - Main repo: ".git" (relative)
// - Worktree: "/path/to/main-repo/.git/worktrees/name" (absolute)
async function getMainRepoPath(path: string): Promise<string | null> {
  const { success, output } = await execQuiet("git rev-parse --git-common-dir", path);
  if (!success || !output) return null;

  // Resolve to absolute path, strip /worktrees/<name> suffix if present
  const gitDir = resolve(path, output);
  const mainGitDir = gitDir.replace(/\/worktrees\/[^/]+$/, "");
  return dirname(mainGitDir);
}

// Main worktree creation function
async function createWorktree(
  repoPath: string,
  repoName: string,
  purpose: string,
  branch?: string,
  existingBranch: boolean = false
): Promise<string | null> {
  const worktreesBaseDir = getWorktreesBaseDir(repoPath);
  const worktreesDir = join(worktreesBaseDir, repoName);
  const worktreePath = join(worktreesDir, purpose);

  // Check if worktree already exists
  const { output: worktreeList } = await exec("git worktree list", repoPath);
  if (worktreeList.includes(worktreePath)) {
    log.error(`Worktree already exists at: ${worktreePath}`);
    return null;
  }

  // Create worktrees directory
  await mkdir(worktreesDir, { recursive: true });

  // Determine branch name
  const branchName = branch || `feature/${purpose}`;

  // Fetch latest changes from origin
  log.step(`Fetching latest changes from origin`);
  const { success: fetchSuccess } = await exec(`git fetch origin`, repoPath);
  if (!fetchSuccess) {
    log.warn(`Failed to fetch from origin, continuing with local state`);
  }

  if (existingBranch) {
    log.step(`Creating worktree for existing branch: ${branchName}`);
    const { success } = await exec(`git worktree add ${worktreePath} ${branchName}`, repoPath);
    if (!success) return null;
  } else {
    // Get the default branch (usually master or main)
    const { output: defaultBranch } = await execQuiet(`git symbolic-ref refs/remotes/origin/HEAD`, repoPath);
    const branch = defaultBranch?.replace("refs/remotes/origin/", "") || "main";
    const baseBranch = `origin/${branch}`;

    log.step(`Creating worktree with new branch: ${branchName} from ${baseBranch}`);
    const { success } = await exec(`git worktree add -b ${branchName} ${worktreePath} ${baseBranch}`, repoPath);
    if (!success) return null;
  }

  log.success(`Worktree created at: ${worktreePath}`);
  return worktreePath;
}

// Sync files from source to destination based on patterns
async function syncFiles(sourcePath: string, destPath: string, options: SyncOptions = {}): Promise<SyncResult> {
  const result: SyncResult = { copied: [], skipped: [], missing: [], errors: [] };

  // Get patterns from config or use defaults
  const patterns = parseWorktreeInclude(sourcePath) ?? DEFAULT_PATTERNS;

  // Find matching files
  const files = await findIncludeFiles(sourcePath, patterns);

  if (files.length === 0) {
    if (options.strict) {
      throw new Error("No files matched patterns (strict mode)");
    }
    return result;
  }

  for (const file of files) {
    const srcFile = join(sourcePath, file);
    const destFile = join(destPath, file);

    // Safety: ensure within repo root
    if (!resolve(destFile).startsWith(resolve(destPath))) {
      result.errors.push({ file, error: "Path traversal detected" });
      continue;
    }

    // Check if destination exists
    if (existsSync(destFile) && !options.overwrite) {
      result.skipped.push(file);
      continue;
    }

    if (!options.dryRun) {
      await mkdir(dirname(destFile), { recursive: true });
      await cp(srcFile, destFile);
    }
    result.copied.push(file);
  }

  return result;
}

// Print sync summary
function printSyncSummary(result: SyncResult, dryRun: boolean = false): void {
  const prefix = dryRun ? "[DRY RUN] Would copy" : "Copied";

  if (result.copied.length > 0) {
    log.success(`${prefix}: ${result.copied.length}`);
    result.copied.forEach((f) => console.log(`  ${colors.green}+${colors.reset} ${f}`));
  }

  if (result.skipped.length > 0) {
    log.info(`Skipped (exists): ${result.skipped.length}`);
    result.skipped.forEach((f) => console.log(`  ${colors.yellow}~${colors.reset} ${f}`));
  }

  if (result.errors.length > 0) {
    log.error(`Errors: ${result.errors.length}`);
    result.errors.forEach((e) => console.log(`  ${colors.red}!${colors.reset} ${e.file}: ${e.error}`));
  }

  if (result.copied.length === 0 && result.skipped.length === 0 && result.errors.length === 0) {
    log.info("No files matched patterns");
  }
}

// List all worktrees using git worktree list
async function listWorktrees(): Promise<void> {
  const { success, output: repoRoot } = await execQuiet("git rev-parse --show-toplevel");
  if (!success || !repoRoot) {
    log.error("Not in a git repository");
    return;
  }

  const { output } = await execQuiet("git worktree list --porcelain", repoRoot);
  const worktrees = parseWorktreeListPorcelain(output);

  if (worktrees.length <= 1) {
    log.info("No additional worktrees found");
    return;
  }

  console.log(`\n${colors.bright}Active Worktrees:${colors.reset}\n`);
  console.log(`${colors.cyan}${basename(repoRoot)}:${colors.reset}`);

  for (const wt of worktrees) {
    if (resolve(wt.path) === resolve(repoRoot)) continue;

    const name = basename(wt.path);

    try {
      const { output: branch } = await execQuiet("git branch --show-current", wt.path);
      const { output: status } = await execQuiet("git status --porcelain", wt.path);
      const isDirty = status.length > 0;

      console.log(
        `  ${colors.green}▸${colors.reset} ${name} ${colors.yellow}(${branch})${colors.reset}${isDirty ? ` ${colors.red}*modified${colors.reset}` : ""}`
      );
      console.log(`    ${colors.bright}${wt.path}${colors.reset}`);
    } catch {
      console.log(`  ${colors.red}▸${colors.reset} ${name} ${colors.red}(error reading)${colors.reset}`);
    }
  }
  console.log();
}

// Remove worktree
async function removeWorktree(repoPath: string, repoName: string, purpose: string): Promise<boolean> {
  const worktreesBaseDir = getWorktreesBaseDir(repoPath);
  const worktreePath = join(worktreesBaseDir, repoName, purpose);

  if (!existsSync(worktreePath)) {
    log.error(`Worktree not found: ${worktreePath}`);
    return false;
  }

  log.step(`Removing worktree: ${worktreePath}`);
  const { success } = await exec(`git worktree remove ${worktreePath}`, repoPath);

  if (success) {
    log.success("Worktree removed successfully");
  } else {
    log.error("Failed to remove worktree");
  }

  return success;
}

// Show help
function showHelp(): void {
  console.log(`
${colors.bright}Worktree Automation Tool${colors.reset}

${colors.cyan}Usage:${colors.reset}
  gw [command] [options]

${colors.cyan}Commands:${colors.reset}
  ${colors.green}create${colors.reset} <purpose> [options]         Create a new worktree
  ${colors.green}sync${colors.reset} [options]                     Sync local files to current worktree
  ${colors.green}list${colors.reset}                              List all worktrees
  ${colors.green}remove${colors.reset} <purpose>                   Remove a worktree
  ${colors.green}help${colors.reset}                              Show this help

${colors.cyan}Create Options:${colors.reset}
  --branch <name>      Specify branch name (default: feature/<purpose>)
  --existing-branch    Use existing branch instead of creating new
  --no-env             Skip local file sync

${colors.cyan}Sync Options:${colors.reset}
  --source <path>      Source worktree (auto-detected if omitted)
  --dry-run            Preview without copying
  --overwrite          Overwrite existing files
  --strict             Fail if patterns match nothing
  --json               Machine-readable output

${colors.cyan}Examples:${colors.reset}
  gw create dark-mode
  gw create fix-payment --branch hotfix/payment-bug
  gw create review-pr --existing-branch
  gw sync --dry-run
  gw list
  gw remove dark-mode

${colors.cyan}File Patterns:${colors.reset}
  Uses .worktreeinclude in repo root if present.
  Default: **/.env, **/.env.* (all .env files at any depth)

${colors.cyan}Location:${colors.reset}
  - Default: <repo>/../worktrees/<repo_name>/<purpose> (preserves CLAUDE.md inheritance)
  - Fallback: ~/worktrees/<repo_name>/<purpose> (when repo is at home level)

${colors.cyan}Notes:${colors.reset}
  - Local files synced via .worktreeinclude config or defaults to .env*
  - Multi-agent safe: each worktree is isolated, searches won't cross boundaries
`);
}

// Main function
async function main(): Promise<void> {
  const args = Bun.argv.slice(2);

  if (args.length === 0 || args[0] === "help" || args[0] === "-h" || args[0] === "--help") {
    showHelp();
    process.exit(0);
  }

  const command = args[0];

  switch (command) {
    case "create": {
      if (args.length < 2) {
        log.error("Missing required argument: <purpose>");
        showHelp();
        process.exit(1);
      }

      // Support both: gw create <purpose> and gw create <repo> <purpose>
      const hasRepoArg = args.length >= 3 && !args[1].startsWith("--");
      const purpose = hasRepoArg ? args[2] : args[1];
      let repoPath = hasRepoArg && args[1] !== "." ? resolve(process.cwd(), args[1]) : process.cwd();

      // Parse options
      const options = {
        branch: args.includes("--branch") ? args[args.indexOf("--branch") + 1] : undefined,
        existingBranch: args.includes("--existing-branch"),
        noEnv: args.includes("--no-env"),
      };

      // Validate repo
      if (!existsSync(repoPath)) {
        log.error(`Repository not found: ${repoPath}`);
        process.exit(1);
      }

      if (!isGitRepo(repoPath)) {
        log.error(`Not a git repository: ${repoPath}`);
        process.exit(1);
      }

      // Resolve worktrees to main repo (prevents nested worktree creation)
      const mainRepoPath = await getMainRepoPath(repoPath);
      if (mainRepoPath && resolve(mainRepoPath) !== resolve(repoPath)) {
        log.info(`Detected worktree, using main repo: ${mainRepoPath}`);
        repoPath = mainRepoPath;
      }

      const repoName = basename(repoPath);
      console.log(`\n${colors.bright}Creating worktree for ${repoName}/${purpose}${colors.reset}\n`);

      // Create worktree
      const worktreePath = await createWorktree(repoPath, repoName, purpose, options.branch, options.existingBranch);
      if (!worktreePath) process.exit(1);

      // Sync local files
      if (!options.noEnv) {
        log.step("Syncing local files...");
        const syncResult = await syncFiles(repoPath, worktreePath, { overwrite: false });
        if (syncResult.copied.length > 0) {
          log.success(`Synced ${syncResult.copied.length} file(s): ${syncResult.copied.join(", ")}`);
        }
        if (syncResult.skipped.length > 0) {
          log.info(`Skipped ${syncResult.skipped.length} existing file(s)`);
        }
        if (syncResult.copied.length === 0 && syncResult.skipped.length === 0) {
          log.info("No local files found to sync");
        }
      }

      console.log(`\n${colors.green}${colors.bright}✨ Worktree ready!${colors.reset}\n`);
      console.log(`${colors.cyan}Next steps:${colors.reset}`);
      console.log(`  cd ${worktreePath}`);
      console.log(`  # Start coding!\n`);
      break;
    }

    case "list": {
      await listWorktrees();
      break;
    }

    case "remove": {
      if (args.length < 2) {
        log.error("Missing required argument: <purpose>");
        showHelp();
        process.exit(1);
      }

      // Support both: gw remove <purpose> and gw remove <repo> <purpose>
      const hasRepoArg = args.length >= 3 && !args[1].startsWith("--");
      const purpose = hasRepoArg ? args[2] : args[1];
      const repoPath = hasRepoArg && args[1] !== "." ? resolve(process.cwd(), args[1]) : process.cwd();

      if (!existsSync(repoPath)) {
        log.error(`Repository not found: ${repoPath}`);
        process.exit(1);
      }

      const repoName = basename(repoPath);
      const removed = await removeWorktree(repoPath, repoName, purpose);
      if (!removed) process.exit(1);
      break;
    }

    case "sync": {
      const { success: gitSuccess, output: repoRoot } = await execQuiet("git rev-parse --show-toplevel");
      if (!gitSuccess || !repoRoot) {
        log.error("Not in a git repository");
        process.exit(1);
      }

      const syncOptions: SyncOptions = {
        dryRun: args.includes("--dry-run"),
        overwrite: args.includes("--overwrite"),
        strict: args.includes("--strict"),
        json: args.includes("--json"),
      };

      let syncSourcePath = args.includes("--source")
        ? resolve(args[args.indexOf("--source") + 1])
        : await detectSourceWorktree(repoRoot);

      if (!syncSourcePath) {
        log.error("Could not detect source worktree. Use --source to specify.");
        process.exit(1);
      }

      if (resolve(syncSourcePath) === resolve(repoRoot)) {
        log.error("Source and destination are the same directory");
        process.exit(1);
      }

      if (!syncOptions.json) {
        log.info(`Source: ${syncSourcePath}`);
        log.info(`Destination: ${repoRoot}`);
        console.log();
      }

      try {
        const result = await syncFiles(syncSourcePath, repoRoot, syncOptions);

        if (syncOptions.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSyncSummary(result, syncOptions.dryRun);
        }

        if (result.errors.length > 0) process.exit(2);
        if (syncOptions.strict && result.missing.length > 0) process.exit(2);
      } catch (err) {
        if (syncOptions.json) {
          console.log(JSON.stringify({ error: (err as Error).message }));
        } else {
          log.error((err as Error).message);
        }
        process.exit(1);
      }
      break;
    }

    default: {
      log.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
    }
  }
}

await main();
