#!/usr/bin/env bun

/**
 * SonarCloud Branch Comparison Script
 *
 * Compares SonarCloud metrics between a base branch and feature branch.
 * Creates temporary release-* branch for full issue visibility if needed.
 *
 * Usage:
 *   sonar-compare                          # develop vs current branch
 *   sonar-compare --base=main              # main vs current branch
 *   sonar-compare --feature=chore/fix      # develop vs specific branch
 *   sonar-compare --no-cleanup             # keep temp branch
 *   sonar-compare --json                   # JSON output
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fetchOpenIssues, getLongLivedBranches } from './sonar-verify';

// Config
const SONAR_BASE_URL = 'https://sonarcloud.io';

// Metrics to fetch
const METRIC_KEYS = [
  'coverage',
  'bugs',
  'vulnerabilities',
  'code_smells',
  'duplicated_lines_density',
  'cognitive_complexity',
  'ncloc',
];

// Types
interface Measure {
  metric: string;
  value: string;
}

interface MeasuresResponse {
  component: {
    key: string;
    measures: Measure[];
  };
}

interface BranchMetrics {
  measures: Map<string, string>;
  issues: {
    BUG: number;
    VULNERABILITY: number;
    CODE_SMELL: number;
  };
}

interface ComparisonResult {
  base: { branch: string; metrics: BranchMetrics };
  feature: { branch: string; scanBranch: string; metrics: BranchMetrics };
  cleanup: boolean;
}

// Helpers
function parseArgs(): {
  baseBranch: string;
  featureBranch: string | null;
  projectKey: string | null;
  noCleanup: boolean;
  jsonOutput: boolean;
  help: boolean;
} {
  const args = process.argv.slice(2);

  const baseArg = args.find((a) => a.startsWith('--base='));
  const featureArg = args.find((a) => a.startsWith('--feature='));
  const projectArg = args.find((a) => a.startsWith('--project='));

  return {
    baseBranch: baseArg?.split('=')[1] || 'develop',
    featureBranch: featureArg?.split('=')[1] || null,
    projectKey: projectArg?.split('=')[1] || null,
    noCleanup: args.includes('--no-cleanup'),
    jsonOutput: args.includes('--json'),
    help: args.includes('--help') || args.includes('-h'),
  };
}

function readProjectKey(): string | null {
  const configPath = join(process.cwd(), 'sonar-project.properties');
  if (!existsSync(configPath)) {
    return null;
  }

  const content = readFileSync(configPath, 'utf-8');
  return content.match(/sonar\.projectKey=(.+)/)?.[1]?.trim() || null;
}

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

// API Functions - Use Basic Auth (not Bearer)
async function sonarFetch<T>(
  token: string,
  path: string,
  params: Record<string, string | number | undefined>
): Promise<T> {
  const url = new URL(`${SONAR_BASE_URL}/api/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  // Basic auth: token as username, empty password
  const auth = Buffer.from(`${token}:`).toString('base64');
  const response = await fetch(url.toString(), {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SonarCloud API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

async function fetchMeasures(
  token: string,
  projectKey: string,
  branch: string
): Promise<Map<string, string>> {
  const data = await sonarFetch<MeasuresResponse>(token, 'measures/component', {
    component: projectKey,
    branch,
    metricKeys: METRIC_KEYS.join(','),
  });

  const measures = new Map<string, string>();
  for (const m of data.component.measures) {
    measures.set(m.metric, m.value);
  }
  return measures;
}

async function fetchIssueCounts(
  token: string,
  projectKey: string,
  branch: string
): Promise<{ BUG: number; VULNERABILITY: number; CODE_SMELL: number }> {
  const issues = await fetchOpenIssues({ token, projectKey, branch });

  const counts = { BUG: 0, VULNERABILITY: 0, CODE_SMELL: 0 };
  for (const issue of issues) {
    if (issue.type in counts) {
      counts[issue.type as keyof typeof counts]++;
    }
  }
  return counts;
}

async function fetchBranchMetrics(
  token: string,
  projectKey: string,
  branch: string
): Promise<BranchMetrics> {
  const [measures, issues] = await Promise.all([
    fetchMeasures(token, projectKey, branch),
    fetchIssueCounts(token, projectKey, branch),
  ]);

  return { measures, issues };
}

// Script paths (same directory as this script)
const SCRIPT_DIR = new URL('.', import.meta.url).pathname;
const SONAR_SCAN_PATH = join(SCRIPT_DIR, 'sonar-scan.ts');
const SONAR_VERIFY_PATH = join(SCRIPT_DIR, 'sonar-verify.ts');

// Run sonar-scan with --no-wait
async function runSonarScan(branch: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n  Running scan for branch: ${branch}...`);

    const proc = spawn('bun', [SONAR_SCAN_PATH, '--branch=' + branch, '--no-wait'], {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: process.env,
    });

    let stderr = '';
    proc.stdout?.on('data', (data) => process.stdout.write(data));
    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Scan failed with code ${code}: ${stderr}`));
      } else {
        resolve();
      }
    });
  });
}

// Delete branch via sonar-verify --delete
async function deleteSonarBranch(projectKey: string, branch: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n  Cleaning up temporary branch: ${branch}...`);

    const proc = spawn('bun', [SONAR_VERIFY_PATH, projectKey, '--delete', branch], {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: process.env,
    });

    proc.stdout?.on('data', (data) => process.stdout.write(data));
    proc.stderr?.on('data', (data) => process.stderr.write(data));

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Failed to delete branch: ${branch}`));
      } else {
        resolve();
      }
    });
  });
}

// Table formatting
function formatValue(metric: string, value: string): string {
  if (metric === 'coverage' || metric === 'duplicated_lines_density') {
    return `${parseFloat(value).toFixed(1)}%`;
  }
  if (metric === 'ncloc' || metric === 'cognitive_complexity') {
    return parseInt(value, 10).toLocaleString();
  }
  return value;
}

function formatDelta(metric: string, base: string, feature: string): string {
  const baseNum = parseFloat(base) || 0;
  const featureNum = parseFloat(feature) || 0;
  const delta = featureNum - baseNum;

  if (delta === 0) return '0';

  const sign = delta > 0 ? '+' : '';
  let formatted: string;

  if (metric === 'coverage' || metric === 'duplicated_lines_density') {
    formatted = `${sign}${delta.toFixed(1)}%`;
  } else if (metric === 'ncloc' || metric === 'cognitive_complexity') {
    formatted = `${sign}${Math.round(delta).toLocaleString()}`;
  } else {
    formatted = `${sign}${Math.round(delta)}`;
  }

  // Add direction indicator - better/worse depends on metric
  const isBetterWhenLower = ['bugs', 'vulnerabilities', 'code_smells', 'duplicated_lines_density', 'cognitive_complexity'].includes(metric);
  const isNeutral = metric === 'ncloc';

  if (isNeutral) {
    return formatted;
  }

  if (isBetterWhenLower) {
    return delta < 0 ? `${formatted} \u2193` : delta > 0 ? `${formatted} \u2191` : formatted;
  } else {
    return delta > 0 ? `${formatted} \u2191` : delta < 0 ? `${formatted} \u2193` : formatted;
  }
}

function getMetricLabel(metric: string): string {
  const labels: Record<string, string> = {
    coverage: 'Coverage',
    bugs: 'Bugs',
    vulnerabilities: 'Vulnerabilities',
    code_smells: 'Code Smells',
    duplicated_lines_density: 'Duplicated Lines',
    cognitive_complexity: 'Cognitive Complexity',
    ncloc: 'Lines of Code',
  };
  return labels[metric] || metric;
}

function printTable(result: ComparisonResult): void {
  const metrics = METRIC_KEYS;
  const baseLabel = result.base.branch;
  const featureLabel = result.feature.branch;

  // Calculate column widths
  const metricWidth = Math.max(20, ...metrics.map((m) => getMetricLabel(m).length));
  const baseWidth = Math.max(baseLabel.length, 12);
  const featureWidth = Math.max(featureLabel.length, 12);
  const deltaWidth = 12;

  const hr = (char: string) =>
    char +
    char.repeat(metricWidth + 2) +
    char +
    char.repeat(baseWidth + 2) +
    char +
    char.repeat(featureWidth + 2) +
    char +
    char.repeat(deltaWidth + 2) +
    char;

  const row = (cells: string[]) => {
    const [metric, base, feature, delta] = cells;
    return (
      '\u2502 ' +
      metric.padEnd(metricWidth) +
      ' \u2502 ' +
      base.padStart(baseWidth) +
      ' \u2502 ' +
      feature.padStart(featureWidth) +
      ' \u2502 ' +
      delta.padStart(deltaWidth) +
      ' \u2502'
    );
  };

  console.log('\n' + hr('\u250c').replace(/\u250c/g, '\u2500').replace(/^./, '\u250c').replace(/.$/, '\u2510'));
  console.log(row(['Metric', baseLabel, featureLabel, 'Delta']));
  console.log(hr('\u251c').replace(/\u251c/g, '\u2500').replace(/^./, '\u251c').replace(/.$/, '\u2524'));

  for (const metric of metrics) {
    const baseVal = result.base.metrics.measures.get(metric) || '0';
    const featureVal = result.feature.metrics.measures.get(metric) || '0';
    console.log(
      row([
        getMetricLabel(metric),
        formatValue(metric, baseVal),
        formatValue(metric, featureVal),
        formatDelta(metric, baseVal, featureVal),
      ])
    );
  }

  console.log(hr('\u2514').replace(/\u2514/g, '\u2500').replace(/^./, '\u2514').replace(/.$/, '\u2518'));
}

function printJson(result: ComparisonResult): void {
  const output = {
    base: {
      branch: result.base.branch,
      metrics: Object.fromEntries(result.base.metrics.measures),
      issues: result.base.metrics.issues,
    },
    feature: {
      branch: result.feature.branch,
      scanBranch: result.feature.scanBranch,
      metrics: Object.fromEntries(result.feature.metrics.measures),
      issues: result.feature.metrics.issues,
    },
  };
  console.log(JSON.stringify(output, null, 2));
}

// Main
async function main() {
  const opts = parseArgs();

  if (opts.help) {
    console.log(`
SonarCloud Branch Comparison

Usage:
  sonar-compare                          Compare develop vs current branch
  sonar-compare --base=main              Use main as base branch
  sonar-compare --feature=chore/fix      Compare against specific feature branch
  sonar-compare --no-cleanup             Keep temporary release branch
  sonar-compare --json                   Output as JSON
  sonar-compare --project=<key>          Override project key

Options:
  --base=<branch>      Base branch (default: develop)
  --feature=<branch>   Feature branch (default: current git branch)
  --project=<key>      Project key (default: from sonar-project.properties)
  --no-cleanup         Don't delete temporary release-* branch
  --json               Output comparison as JSON
  --help, -h           Show this help

Examples:
  sonar-compare
  sonar-compare --base=main
  sonar-compare --feature=chore/coverage --json
`);
    process.exit(0);
  }

  // Validate token
  const token = process.env.SONAR_TOKEN;
  if (!token) {
    console.error('Error: SONAR_TOKEN environment variable required');
    console.error('\nGenerate at: https://sonarcloud.io -> My Account -> Security -> Tokens');
    process.exit(1);
  }

  // Get project key
  const projectKey = opts.projectKey || readProjectKey();
  if (!projectKey) {
    console.error('Error: Could not find sonar.projectKey');
    console.error('  Either create sonar-project.properties or use --project=<key>');
    process.exit(1);
  }

  // Get feature branch
  const featureBranch = opts.featureBranch || (await getCurrentBranch());
  if (!featureBranch) {
    console.error('Error: Could not determine feature branch');
    console.error('  Use --feature=<branch> to specify');
    process.exit(1);
  }

  console.log(`\nSonarCloud Branch Comparison`);
  console.log(`  Project: ${projectKey}`);
  console.log(`  Base: ${opts.baseBranch}`);
  console.log(`  Feature: ${featureBranch}`);

  // Validate base branch exists
  const longLived = await getLongLivedBranches(token, projectKey);
  const baseBranchExists = longLived.some((b) => b.name === opts.baseBranch);

  if (!baseBranchExists) {
    console.error(`\nError: Branch '${opts.baseBranch}' not found in SonarCloud.`);
    console.error('Available long-lived branches:');
    for (const b of longLived) {
      console.error(`  - ${b.name}${b.isMain ? ' (main)' : ''}`);
    }
    console.error(`\nUse --base=<branch> to specify.`);
    process.exit(1);
  }

  // Determine scan branch name for feature
  const isReleaseBranch = featureBranch.startsWith('release-');
  const scanBranch = isReleaseBranch ? featureBranch : `release-${featureBranch}`;
  const needsCleanup = !isReleaseBranch && !opts.noCleanup;

  if (!isReleaseBranch) {
    console.log(`  Scan branch: ${scanBranch} (for full issue visibility)`);
  }

  try {
    // Run scan for feature branch
    console.log(`\n[1/3] Scanning feature branch...`);
    await runSonarScan(scanBranch);

    // Wait a bit for API propagation
    console.log(`\n[2/3] Fetching metrics...`);
    await new Promise((r) => setTimeout(r, 5000));

    // Fetch metrics for both branches
    const [baseMetrics, featureMetrics] = await Promise.all([
      fetchBranchMetrics(token, projectKey, opts.baseBranch),
      fetchBranchMetrics(token, projectKey, scanBranch),
    ]);

    const result: ComparisonResult = {
      base: { branch: opts.baseBranch, metrics: baseMetrics },
      feature: { branch: featureBranch, scanBranch, metrics: featureMetrics },
      cleanup: needsCleanup,
    };

    // Output results
    console.log(`\n[3/3] Comparison complete`);

    if (opts.jsonOutput) {
      printJson(result);
    } else {
      printTable(result);
    }

    // Cleanup if needed
    if (needsCleanup) {
      await deleteSonarBranch(projectKey, scanBranch);
      console.log(`  Temporary branch ${scanBranch} cleaned up`);
    }

    console.log(`\nView full details:`);
    console.log(`  Base: https://sonarcloud.io/dashboard?id=${projectKey}&branch=${encodeURIComponent(opts.baseBranch)}`);
    console.log(`  Feature: https://sonarcloud.io/dashboard?id=${projectKey}&branch=${encodeURIComponent(scanBranch)}`);
  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
