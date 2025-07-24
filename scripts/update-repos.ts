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
import { join, resolve, basename } from "path";

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
  parallel: number;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    stash: false,
    dryRun: false,
    help: false,
    skipDefaultBranch: false,
    parallel: 10, // Default to 10 parallel operations
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
        } else {
          log.warn(`Unknown option: ${arg}`);
        }
    }
  }

  return options;
}

function showHelp() {
  console.log(`
${colors.bright}Repository Updater${colors.reset}

Updates all git repositories found in the current directory.

${colors.bright}Usage:${colors.reset}
  update-repos [options]

${colors.bright}Options:${colors.reset}
  --stash                Stash uncommitted changes before pulling
                         (changes remain stashed - run 'git stash pop' to restore)
  --skip-default-branch  Don't switch to default branch before updating
  --parallel <n>         Number of repos to update concurrently (default: 10, max: 20)
  --dry-run              Show what would be done without making changes
  -h, --help             Show this help message

${colors.bright}Examples:${colors.reset}
  update-repos                          # Update 10 repos at a time, switch to default branch
  update-repos --parallel 5             # Update 5 repos concurrently
  update-repos --skip-default-branch    # Update without switching branches
  update-repos --stash --parallel 15    # Stash changes and update 15 repos at a time
  update-repos --dry-run                # Preview what would happen

${colors.bright}Default behavior:${colors.reset}
  - Skips repositories with uncommitted changes for safety
  - Switches to default branch before updating (master/main/stage/qa/develop/dev)
  - Shows branch switches with arrow notation (e.g., feature → develop)
  - Processes 10 repositories in parallel for faster updates
`);
}

// Execute git command and return result
async function runGitCommand(
  repoPath: string,
  args: string[]
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

// Check if a directory is a git repository
function isGitRepo(path: string): boolean {
  return existsSync(join(path, ".git"));
}

// Find all git repositories in current directory
function findGitRepos(basePath: string): string[] {
  const repos: string[] = [];
  
  try {
    const entries = readdirSync(basePath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = join(basePath, entry.name);
        if (isGitRepo(fullPath)) {
          repos.push(fullPath);
        }
      }
    }
  } catch (error) {
    log.error(`Failed to read directory: ${error}`);
  }
  
  return repos.sort();
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

// Get all branches (local and remote)
async function getAllBranches(repoPath: string): Promise<string[]> {
  const { success, output } = await runGitCommand(repoPath, ["branch", "-a"]);
  if (!success) return [];
  
  return output
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      // Remove prefix markers like * and remotes/origin/
      return line.replace(/^\*?\s*/, "").replace(/^remotes\/origin\//, "");
    })
    .filter((branch, index, arr) => arr.indexOf(branch) === index); // Remove duplicates
}

// Find the default branch based on precedence
async function findDefaultBranch(repoPath: string): Promise<string | null> {
  const branches = await getAllBranches(repoPath);
  const precedence = ["master", "main", "stage", "qa", "develop", "dev"];
  
  for (const preferredBranch of precedence) {
    if (branches.includes(preferredBranch)) {
      return preferredBranch;
    }
  }
  
  return null;
}

// Switch to default branch if needed
async function switchToDefaultBranch(
  repoPath: string,
  currentBranch: string
): Promise<{ switched: boolean; fromBranch: string; toBranch: string }> {
  const defaultBranch = await findDefaultBranch(repoPath);
  
  if (!defaultBranch || currentBranch === defaultBranch) {
    return { switched: false, fromBranch: currentBranch, toBranch: currentBranch };
  }
  
  // Fetch to ensure we have the latest remote branches
  await runGitCommand(repoPath, ["fetch", "--quiet"]);
  
  // Try to checkout the default branch
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
  options: Options
): Promise<{ status: "updated" | "skipped" | "stashed" | "failed"; message: string }> {
  const repoName = basename(repoPath);
  let branch = await getCurrentBranch(repoPath);
  
  // Check for uncommitted changes
  const isDirty = await hasUncommittedChanges(repoPath);
  
  if (isDirty && !options.stash) {
    return {
      status: "skipped",
      message: `${repoName} [${branch}] (uncommitted changes)`,
    };
  }
  
  // Switch to default branch if needed (and not skipped)
  let branchSwitchInfo = "";
  if (!options.skipDefaultBranch && !isDirty) {
    const switchResult = await switchToDefaultBranch(repoPath, branch);
    if (switchResult.switched) {
      branchSwitchInfo = `${switchResult.fromBranch} → ${switchResult.toBranch}`;
      branch = switchResult.toBranch;
      if (!options.dryRun) {
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
    const stashResult = await runGitCommand(repoPath, ["stash", "push", "-m", "update-repos auto-stash"]);
    if (!stashResult.success) {
      return {
        status: "failed",
        message: `${repoName} [${branch}]: Failed to stash changes`,
      };
    }
  }
  
  // Pull latest changes
  const pullResult = await runGitCommand(repoPath, ["pull"]);
  
  if (!pullResult.success) {
    return {
      status: "failed",
      message: `${repoName} [${branch}]: ${pullResult.output.split("\n")[0]}`,
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
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Main function
async function main() {
  const options = parseArgs();
  
  if (options.help) {
    showHelp();
    process.exit(0);
  }
  
  const currentDir = process.cwd();
  log.info(`Scanning for git repositories in: ${currentDir}`);
  
  const repos = findGitRepos(currentDir);
  
  if (repos.length === 0) {
    log.warn("No git repositories found in current directory");
    process.exit(0);
  }
  
  log.info(`Found ${repos.length} git repositories`);
  
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
    const batchResults = await Promise.all(
      batch.map(repo => updateRepo(repo, options))
    );
    
    // Display results in order
    batchResults.forEach(result => {
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

// Run the script
main().catch((error) => {
  log.error(`Unexpected error: ${error}`);
  process.exit(1);
});