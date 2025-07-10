#!/usr/bin/env bun

import { spawn, type Subprocess } from "bun";
import { existsSync, readdirSync, readFileSync } from "fs";
import { cp, mkdir, readFile } from "fs/promises";
import { basename, join, resolve } from "path";

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

// Execute command with streaming output
async function execStream(cmd: string, cwd?: string): Promise<boolean> {
  log.cmd(cmd);
  
  const proc = spawn(cmd.split(" "), {
    cwd: cwd || process.cwd(),
    stdout: "inherit",
    stderr: "inherit",
  });

  return (await proc.exited) === 0;
}

// Detect package manager from lock files
function detectPackageManager(repoPath: string): { manager: string; lockFile: string } | null {
  const managers = [
    { manager: "pnpm", lockFile: "pnpm-lock.yaml" },
    { manager: "yarn", lockFile: "yarn.lock" },
    { manager: "npm", lockFile: "package-lock.json" },
  ];

  for (const { manager, lockFile } of managers) {
    if (existsSync(join(repoPath, lockFile))) {
      return { manager, lockFile };
    }
  }

  return null;
}

// Find environment files
function findEnvFiles(repoPath: string): string[] {
  const files = readdirSync(repoPath);
  return files.filter(file => file.startsWith(".env"));
}

// Copy directory recursively
async function copyDir(src: string, dest: string): Promise<void> {
  await cp(src, dest, { recursive: true });
}

// Check if directory exists and is a git repo
function isGitRepo(path: string): boolean {
  return existsSync(join(path, ".git"));
}

// Parse package.json
async function getPackageJson(repoPath: string): Promise<any> {
  try {
    const content = await readFile(join(repoPath, "package.json"), "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// Main worktree creation function
async function createWorktree(
  repoPath: string,
  purpose: string,
  branch?: string,
  existingBranch: boolean = false
): Promise<boolean> {
  const repoName = basename(repoPath);
  const treesDir = join(repoPath, "..", "trees", repoName);
  const worktreePath = join(treesDir, purpose);

  // Check if worktree already exists
  const { output: worktreeList } = await exec("git worktree list", repoPath);
  if (worktreeList.includes(worktreePath)) {
    log.error(`Worktree already exists at: ${worktreePath}`);
    return false;
  }

  // Create trees directory
  await mkdir(treesDir, { recursive: true });

  // Determine branch name
  const branchName = branch || `feature/${purpose}`;
  
  // Create worktree
  if (existingBranch) {
    log.step(`Creating worktree for existing branch: ${branchName}`);
    const { success } = await exec(`git worktree add ${worktreePath} ${branchName}`, repoPath);
    if (!success) return false;
  } else {
    log.step(`Creating worktree with new branch: ${branchName}`);
    const { success } = await exec(`git worktree add -b ${branchName} ${worktreePath}`, repoPath);
    if (!success) return false;
  }

  log.success(`Worktree created at: ${worktreePath}`);
  return true;
}

// Copy environment files
async function copyEnvFiles(sourcePath: string, destPath: string): Promise<void> {
  const envFiles = findEnvFiles(sourcePath);
  
  if (envFiles.length === 0) {
    log.info("No environment files found to copy");
    return;
  }

  log.step(`Copying environment files: ${envFiles.join(", ")}`);
  
  for (const file of envFiles) {
    await cp(join(sourcePath, file), join(destPath, file));
  }
  
  log.success("Environment files copied");
}

// Handle breville-artifact setup
async function setupBrevilleArtifact(worktreePath: string): Promise<boolean> {
  const artifactPath = join(worktreePath, "breville-artifact");
  
  if (!existsSync(artifactPath)) {
    return true; // No artifact setup needed
  }

  log.step("Setting up breville-artifact for private registry access");
  
  // Check if it has a package.json
  const artifactPkgPath = join(artifactPath, "package.json");
  if (!existsSync(artifactPkgPath)) {
    log.warn("breville-artifact directory found but no package.json");
    return true;
  }

  // Install dependencies in breville-artifact
  const pkgManager = detectPackageManager(artifactPath);
  const installCmd = pkgManager?.manager || "yarn";
  
  log.info(`Installing breville-artifact dependencies with ${installCmd}`);
  const { success: artifactInstall } = await exec(installCmd, artifactPath);
  
  if (!artifactInstall) {
    log.error("Failed to install breville-artifact dependencies");
    return false;
  }

  // Run setup:artifact script
  log.info("Running artifact setup script");
  const { success: setupSuccess } = await exec(`${installCmd} run setup:artifact`, artifactPath);
  
  if (!setupSuccess) {
    log.error("Failed to run artifact setup script");
    return false;
  }

  log.success("Private registry configured");
  return true;
}

// Install dependencies
async function installDependencies(worktreePath: string): Promise<boolean> {
  const pkgManager = detectPackageManager(worktreePath);
  
  if (!pkgManager) {
    log.warn("No lock file found, defaulting to yarn");
  }

  const manager = pkgManager?.manager || "yarn";
  const pkg = await getPackageJson(worktreePath);

  // Check for preinstall or beforeInstall scripts
  const hasPreinstall = pkg?.scripts?.preinstall;
  const hasBeforeInstall = pkg?.scripts?.beforeInstall;

  if (hasPreinstall) {
    log.info("Found preinstall script - it will run automatically during install");
  } else if (hasBeforeInstall) {
    log.step("Running beforeInstall script");
    const { success } = await exec(`${manager} run beforeInstall`, worktreePath);
    if (!success) {
      log.error("beforeInstall script failed");
      return false;
    }
  }

  // Install dependencies
  log.step(`Installing dependencies with ${manager}`);
  const success = await execStream(manager, worktreePath);
  
  if (success) {
    log.success("Dependencies installed successfully");
  } else {
    log.error("Failed to install dependencies");
  }

  return success;
}

// List all worktrees
async function listWorktrees(sourcePath: string): Promise<void> {
  // Look for trees directory in multiple locations
  const possiblePaths = [
    join(sourcePath, "trees"),
    join(process.cwd(), "trees"),
    join(process.cwd(), "..", "trees"),
    "/Users/joshmu/work/breville/source/trees"
  ];
  
  let treesPath = "";
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      treesPath = path;
      break;
    }
  }
  
  if (!treesPath) {
    log.info("No worktrees directory found");
    return;
  }

  console.log(`\n${colors.bright}Active Worktrees:${colors.reset}\n`);

  const repos = readdirSync(treesPath);
  
  for (const repo of repos) {
    const repoTreesPath = join(treesPath, repo);
    if (!existsSync(repoTreesPath)) continue;
    
    const trees = readdirSync(repoTreesPath);
    if (trees.length === 0) continue;
    
    console.log(`${colors.cyan}${repo}:${colors.reset}`);
    
    for (const tree of trees) {
      const treePath = join(repoTreesPath, tree);
      
      // Get branch info
      try {
        const { output: branch } = await exec("git branch --show-current", treePath);
        const { output: status } = await exec("git status --porcelain", treePath);
        const isDirty = status.length > 0;
        
        console.log(`  ${colors.green}▸${colors.reset} ${tree} ${colors.yellow}(${branch})${colors.reset}${isDirty ? ` ${colors.red}*modified${colors.reset}` : ""}`);
      } catch {
        console.log(`  ${colors.red}▸${colors.reset} ${tree} ${colors.red}(error reading)${colors.reset}`);
      }
    }
    console.log();
  }
}

// Remove worktree
async function removeWorktree(repoPath: string, purpose: string): Promise<boolean> {
  const repoName = basename(repoPath);
  const worktreePath = join(repoPath, "..", "trees", repoName, purpose);

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
${colors.bright}Breville Worktree Automation Tool${colors.reset}

${colors.cyan}Usage:${colors.reset}
  worktree [command] [options]

${colors.cyan}Commands:${colors.reset}
  ${colors.green}create${colors.reset} <repo> <purpose> [options]  Create a new worktree
  ${colors.green}list${colors.reset}                              List all worktrees
  ${colors.green}remove${colors.reset} <repo> <purpose>           Remove a worktree
  ${colors.green}help${colors.reset}                              Show this help

${colors.cyan}Create Options:${colors.reset}
  --branch <name>      Specify branch name (default: feature/<purpose>)
  --existing-branch    Use existing branch instead of creating new
  --no-install         Skip dependency installation
  --no-env             Skip environment file copying

${colors.cyan}Examples:${colors.reset}
  worktree create xps-shell dark-mode
  worktree create cart-checkout fix-payment --branch hotfix/payment-bug
  worktree create xps-react review-pr --existing-branch
  worktree list
  worktree remove xps-shell dark-mode

${colors.cyan}Notes:${colors.reset}
  - Worktrees are created in: ../trees/<repo>/<purpose>
  - Environment files (.env*) are automatically copied
  - Dependencies are installed using detected package manager
  - Private registry access is configured automatically
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
  const sourcePath = resolve(process.cwd(), "../..");

  switch (command) {
    case "create": {
      if (args.length < 3) {
        log.error("Missing required arguments: <repo> <purpose>");
        showHelp();
        process.exit(1);
      }

      const repo = args[1];
      const purpose = args[2];
      
      // Handle "." as current directory
      const repoPath = repo === "." ? process.cwd() : resolve(sourcePath, repo);

      // Parse options
      const options = {
        branch: args.includes("--branch") ? args[args.indexOf("--branch") + 1] : undefined,
        existingBranch: args.includes("--existing-branch"),
        noInstall: args.includes("--no-install"),
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

      const repoName = repo === "." ? basename(repoPath) : repo;
      console.log(`\n${colors.bright}Creating worktree for ${repoName}/${purpose}${colors.reset}\n`);

      // Create worktree
      const created = await createWorktree(repoPath, purpose, options.branch, options.existingBranch);
      if (!created) process.exit(1);

      const worktreePath = join(repoPath, "..", "trees", repoName, purpose);

      // Copy environment files
      if (!options.noEnv) {
        await copyEnvFiles(repoPath, worktreePath);
      }

      // Copy breville-artifact if it exists
      const artifactPath = join(repoPath, "breville-artifact");
      if (existsSync(artifactPath)) {
        log.step("Copying breville-artifact directory");
        await copyDir(artifactPath, join(worktreePath, "breville-artifact"));
      }

      // Setup breville-artifact and install dependencies
      if (!options.noInstall) {
        const artifactSuccess = await setupBrevilleArtifact(worktreePath);
        if (!artifactSuccess) process.exit(1);

        const installSuccess = await installDependencies(worktreePath);
        if (!installSuccess) process.exit(1);
      }

      console.log(`\n${colors.green}${colors.bright}✨ Worktree ready!${colors.reset}\n`);
      console.log(`${colors.cyan}Next steps:${colors.reset}`);
      console.log(`  cd ${worktreePath}`);
      console.log(`  # Start coding!\n`);
      break;
    }

    case "list": {
      await listWorktrees(sourcePath);
      break;
    }

    case "remove": {
      if (args.length < 3) {
        log.error("Missing required arguments: <repo> <purpose>");
        showHelp();
        process.exit(1);
      }

      const repo = args[1];
      const purpose = args[2];
      
      // Handle "." as current directory
      const repoPath = repo === "." ? process.cwd() : resolve(sourcePath, repo);

      if (!existsSync(repoPath)) {
        log.error(`Repository not found: ${repoPath}`);
        process.exit(1);
      }

      const removed = await removeWorktree(repoPath, purpose);
      if (!removed) process.exit(1);
      break;
    }

    default: {
      log.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
    }
  }
}

// Run main function
await main();