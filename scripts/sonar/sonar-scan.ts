#!/usr/bin/env bun

/**
 * SonarCloud Scanner Wrapper
 *
 * Wraps sonar-scanner with:
 * - Auto branch detection
 * - Wait for analysis completion
 * - API propagation delay
 *
 * Usage:
 *   SONAR_TOKEN=xxx sonar-scan                    # Scan current branch
 *   SONAR_TOKEN=xxx sonar-scan --branch=my-fix   # Scan specific branch
 *   SONAR_TOKEN=xxx sonar-scan --wait=90         # Custom wait time (seconds)
 *   SONAR_TOKEN=xxx sonar-scan --no-wait         # Skip propagation wait
 *
 * Requirements:
 *   - sonar-project.properties in repo root
 *   - SONAR_TOKEN environment variable
 *   - npx sonarqube-scanner available
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SONAR_BASE_URL = 'https://sonarcloud.io';
const DEFAULT_WAIT_SECONDS = 45;

// Parse args
const args = process.argv.slice(2);
const branchArg = args.find((a) => a.startsWith('--branch='));
const waitArg = args.find((a) => a.startsWith('--wait='));
const noWait = args.includes('--no-wait');
const help = args.includes('--help') || args.includes('-h');

if (help) {
  console.log(`
SonarCloud Scanner Wrapper

Usage:
  sonar-scan                     Scan current git branch
  sonar-scan --branch=<name>     Scan specific branch
  sonar-scan --wait=<seconds>    Custom propagation wait (default: ${DEFAULT_WAIT_SECONDS}s)
  sonar-scan --no-wait           Skip propagation wait

Environment:
  SONAR_TOKEN                    Required - SonarCloud token

Notes:
  - Requires sonar-project.properties in repo root
  - Uses npx sonarqube-scanner under the hood
  - Waits for API propagation after scan (configurable)
`);
  process.exit(0);
}

// Validate token
const token = process.env.SONAR_TOKEN;
if (!token) {
  console.error('Error: SONAR_TOKEN environment variable required');
  console.error('\nGenerate at: https://sonarcloud.io → My Account → Security → Tokens');
  process.exit(1);
}

// Get branch name
async function getCurrentBranch(): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', ['branch', '--show-current']);
    let output = '';
    proc.stdout.on('data', (data) => (output += data.toString()));
    proc.on('close', (code) => {
      if (code === 0) resolve(output.trim());
      else reject(new Error('Failed to get current branch'));
    });
  });
}

// Check sonar-project.properties exists
function checkSonarConfig(): { projectKey: string; organization: string } | null {
  const configPath = join(process.cwd(), 'sonar-project.properties');
  if (!existsSync(configPath)) {
    return null;
  }

  const content = readFileSync(configPath, 'utf-8');
  const projectKey = content.match(/sonar\.projectKey=(.+)/)?.[1]?.trim();
  const organization = content.match(/sonar\.organization=(.+)/)?.[1]?.trim();

  if (!projectKey || !organization) {
    return null;
  }

  return { projectKey, organization };
}

// Run sonar-scanner
async function runScanner(branch: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    console.log(`\n🔍 Running SonarCloud scan on branch: ${branch}\n`);

    const proc = spawn('npx', ['sonarqube-scanner', `-Dsonar.branch.name=${branch}`], {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env, SONAR_TOKEN: token },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      const str = data.toString();
      stdout += str;
      process.stdout.write(str);
    });

    proc.stderr?.on('data', (data) => {
      const str = data.toString();
      stderr += str;
      process.stderr.write(str);
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Scanner exited with code ${code}`));
        return;
      }

      // Extract ceTaskId from output
      const taskMatch = stdout.match(/ce\/task\?id=([A-Za-z0-9_-]+)/);
      resolve(taskMatch?.[1] || null);
    });
  });
}

// Wait for analysis task
async function waitForAnalysis(ceTaskId: string, timeoutMs = 300000): Promise<void> {
  console.log(`\n⏳ Waiting for analysis task ${ceTaskId}...`);
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const response = await fetch(`${SONAR_BASE_URL}/api/ce/task?id=${ceTaskId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to check task status: ${response.status}`);
    }

    const data = (await response.json()) as { task: { status: string; errorMessage?: string } };

    if (data.task.status === 'SUCCESS') {
      console.log('✅ Analysis complete');
      return;
    }
    if (data.task.status === 'FAILED' || data.task.status === 'CANCELED') {
      throw new Error(`Analysis ${data.task.status}: ${data.task.errorMessage || 'unknown'}`);
    }

    console.log(`   Status: ${data.task.status}...`);
    await new Promise((r) => setTimeout(r, 5000));
  }

  throw new Error('Analysis timeout');
}

// Main
async function main() {
  // Check config
  const config = checkSonarConfig();
  if (!config) {
    console.error('Error: sonar-project.properties not found or missing required fields');
    console.error('Required: sonar.projectKey and sonar.organization');
    process.exit(1);
  }

  console.log(`📦 Project: ${config.projectKey}`);
  console.log(`🏢 Organization: ${config.organization}`);

  // Get branch
  const branch = branchArg?.split('=')[1] || (await getCurrentBranch());
  if (!branch) {
    console.error('Error: Could not determine branch name');
    process.exit(1);
  }

  // Warn if short-lived branch
  const isLongLived = /^(main|master|develop|release-|branch-)/.test(branch);
  if (!isLongLived) {
    console.warn(`\n⚠️  Warning: Branch "${branch}" is SHORT-LIVED`);
    console.warn('   Only NEW issues will be visible (not inherited issues)');
    console.warn('   Consider using release-* prefix for full issue visibility\n');
  }

  try {
    // Run scanner
    const ceTaskId = await runScanner(branch);

    // Wait for analysis task if we got a task ID
    if (ceTaskId) {
      await waitForAnalysis(ceTaskId);
    }

    // Wait for API propagation
    if (!noWait) {
      const waitSeconds = waitArg ? parseInt(waitArg.split('=')[1], 10) : DEFAULT_WAIT_SECONDS;
      console.log(`\n⏳ Waiting ${waitSeconds}s for API propagation...`);
      await new Promise((r) => setTimeout(r, waitSeconds * 1000));
    }

    console.log(`\n✅ Scan complete for ${branch}`);
    console.log(`\n📊 View results: https://sonarcloud.io/dashboard?id=${config.projectKey}&branch=${encodeURIComponent(branch)}`);
    console.log(`\n💡 Verify issues with: sonar-verify ${config.projectKey} ${branch} --types=BUG`);
  } catch (error) {
    console.error('\n❌ Scan failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
