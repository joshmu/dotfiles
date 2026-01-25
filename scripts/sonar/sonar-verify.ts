#!/usr/bin/env bun

/**
 * SonarCloud Issue Verification Script
 *
 * Verifies if a specific SonarCloud issue has been resolved on a branch.
 * Designed for AI agent integration to deterministically verify fixes.
 *
 * Usage:
 *   # List open issues
 *   SONAR_TOKEN=xxx sonar-verify <projectKey> [branch]
 *
 *   # Verify specific issue
 *   SONAR_TOKEN=xxx sonar-verify <projectKey> <branch> <issueKey>
 *
 *   # Compare before/after (baseline mode)
 *   SONAR_TOKEN=xxx sonar-verify <projectKey> <branch> --baseline
 *   # ... make changes and run sonar scan ...
 *   SONAR_TOKEN=xxx sonar-verify <projectKey> <branch> --verify <issueKey>
 *
 * Examples:
 *   sonar-verify brevilledigital_xps-utils main
 *   sonar-verify brevilledigital_xps-utils feature/fix AYxAbC123
 */

// Types
interface SonarIssue {
  key: string;
  rule: string;
  severity: string;
  component: string;
  project: string;
  line?: number;
  message: string;
  type: 'BUG' | 'VULNERABILITY' | 'CODE_SMELL' | 'SECURITY_HOTSPOT';
  status: string;
  textRange?: {
    startLine: number;
    endLine: number;
    startOffset: number;
    endOffset: number;
  };
  tags?: string[];
  effort?: string;
}

interface SonarResponse {
  total: number;
  p: number;
  ps: number;
  paging: { pageIndex: number; pageSize: number; total: number };
  issues: SonarIssue[];
}

interface AnalysisTask {
  task: {
    id: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' | 'CANCELED';
    analysisId?: string;
    errorMessage?: string;
  };
}

interface IssueDiff {
  resolved: SonarIssue[];
  stillOpen: SonarIssue[];
  newlyIntroduced: SonarIssue[];
  targetIssueResolved: boolean;
}

// Config
const SONAR_BASE_URL = 'https://sonarcloud.io';
const DEFAULT_STATUSES = 'OPEN,REOPENED,CONFIRMED';
const PAGE_SIZE = 500;
const RATE_LIMIT_DELAY = 100;

// Sleep helper (works with Bun and Node)
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helpers
function fingerprint(issue: SonarIssue): string {
  const line = issue.line ?? issue.textRange?.startLine ?? '';
  return `${issue.rule}::${issue.component}::${line}::${issue.message}`;
}

function getFilePath(component: string, projectKey: string): string {
  return component.replace(`${projectKey}:`, '');
}

function formatSeverity(severity: string): string {
  const colors: Record<string, string> = {
    BLOCKER: '\x1b[31m', // red
    CRITICAL: '\x1b[31m', // red
    MAJOR: '\x1b[33m', // yellow
    MINOR: '\x1b[36m', // cyan
    INFO: '\x1b[37m', // white
  };
  const reset = '\x1b[0m';
  return `${colors[severity] || ''}${severity}${reset}`;
}

// API Functions
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

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SonarCloud API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

interface FetchIssuesOptions {
  token: string;
  projectKey: string;
  branch?: string;
  types?: string[];
  statuses?: string;
  author?: string; // SCM account (git email)
}

async function fetchOpenIssues(options: FetchIssuesOptions): Promise<SonarIssue[]> {
  const { token, projectKey, branch, types, statuses = DEFAULT_STATUSES, author } = options;
  const allIssues: SonarIssue[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const data = await sonarFetch<SonarResponse>(token, 'issues/search', {
      componentKeys: projectKey,
      branch,
      statuses,
      types: types?.join(','),
      author,
      ps: PAGE_SIZE,
      p: page,
    });

    allIssues.push(...data.issues);
    hasMore = data.paging.pageIndex * data.paging.pageSize < data.paging.total;
    page++;

    if (hasMore) {
      await sleep(RATE_LIMIT_DELAY);
    }
  }

  return allIssues;
}

// Get long-lived branches from project
async function getLongLivedBranches(
  token: string,
  projectKey: string
): Promise<Array<{ name: string; type: string; isMain: boolean }>> {
  const data = await sonarFetch<{ branches: Array<{ name: string; type: string; isMain: boolean }> }>(
    token,
    'project_branches/list',
    { project: projectKey }
  );
  return data.branches.filter((b) => b.type === 'LONG');
}

// Smart branch detection - returns the baseline branch to use
async function getBaselineBranch(token: string, projectKey: string): Promise<string | null> {
  const longLived = await getLongLivedBranches(token, projectKey);

  if (longLived.length === 0) {
    return null;
  }

  if (longLived.length === 1) {
    return longLived[0].name;
  }

  // Multiple long-lived branches - prefer develop first (most common baseline)
  const preferred = ['develop', 'main', 'master'];
  for (const name of preferred) {
    const found = longLived.find((b) => b.name === name);
    if (found) return found.name;
  }

  // Return the main branch if marked
  const main = longLived.find((b) => b.isMain);
  if (main) return main.name;

  // Can't auto-detect - return null to signal user should choose
  return null;
}

async function waitForAnalysis(
  token: string,
  ceTaskId: string,
  timeoutMs = 300000,
  pollIntervalMs = 5000
): Promise<string> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const data = await sonarFetch<AnalysisTask>(token, 'ce/task', { id: ceTaskId });

    if (data.task.status === 'SUCCESS') {
      return data.task.analysisId!;
    }
    if (data.task.status === 'FAILED' || data.task.status === 'CANCELED') {
      throw new Error(`Analysis ${data.task.status}: ${data.task.errorMessage || 'unknown error'}`);
    }

    console.log(`  Analysis status: ${data.task.status}...`);
    await sleep(pollIntervalMs);
  }

  throw new Error('Analysis timeout');
}

function diffIssues(
  before: SonarIssue[],
  after: SonarIssue[],
  targetIssueKey?: string
): IssueDiff {
  const beforeByKey = new Map(before.map((i) => [i.key, i]));
  const afterByKey = new Map(after.map((i) => [i.key, i]));

  const resolved = before.filter((i) => !afterByKey.has(i.key));
  const stillOpen = before.filter((i) => afterByKey.has(i.key));
  const newlyIntroduced = after.filter((i) => !beforeByKey.has(i.key));

  // Also check by fingerprint (handles code moves/refactors)
  const afterFP = new Set(after.map(fingerprint));
  const targetIssue = targetIssueKey ? beforeByKey.get(targetIssueKey) : undefined;
  const targetResolvedByFP = targetIssue ? !afterFP.has(fingerprint(targetIssue)) : false;

  return {
    resolved,
    stillOpen,
    newlyIntroduced,
    targetIssueResolved: targetIssueKey
      ? !afterByKey.has(targetIssueKey) || targetResolvedByFP
      : false,
  };
}

// Exported functions for programmatic use
export async function verifyIssueResolved(options: {
  token: string;
  projectKey: string;
  branch: string;
  targetIssueKey: string;
  baselineIssues?: SonarIssue[];
  ceTaskId?: string;
}): Promise<{ resolved: boolean; diff: IssueDiff }> {
  const { token, projectKey, branch, targetIssueKey, ceTaskId } = options;

  // Get baseline if not provided
  const baseline = options.baselineIssues ?? (await fetchOpenIssues({ token, projectKey, branch }));

  // Wait for analysis if ceTaskId provided
  if (ceTaskId) {
    console.log(`Waiting for analysis ${ceTaskId}...`);
    await waitForAnalysis(token, ceTaskId);
  }

  // Fetch current issues
  const current = await fetchOpenIssues({ token, projectKey, branch });

  // Diff
  const diff = diffIssues(baseline, current, targetIssueKey);

  return {
    resolved: diff.targetIssueResolved,
    diff,
  };
}

export { fetchOpenIssues, diffIssues, waitForAnalysis, getFilePath, fingerprint, getLongLivedBranches };
export type { SonarIssue, IssueDiff };

// CLI
async function main() {
  const token = process.env.SONAR_TOKEN;
  const args = process.argv.slice(2);

  if (!token) {
    console.error('Error: SONAR_TOKEN environment variable required');
    console.error('\nGenerate at: https://sonarcloud.io → My Account → Security → Tokens');
    process.exit(1);
  }

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
SonarCloud Issue Verification

Usage:
  sonar-verify <projectKey> [branch]              List open issues
  sonar-verify <projectKey> <branch> <issueKey>   Verify issue resolved
  sonar-verify <projectKey> <branch> --json       Output issues as JSON
  sonar-verify <projectKey> --branches            List all branches
  sonar-verify <projectKey> --delete <branch>     Delete branch from SonarCloud
  sonar-verify <projectKey> --baseline            Show detected baseline branch

Filtering Options:
  --types=BUG,VULNERABILITY,CODE_SMELL   Filter by issue types
  --author=<email>                       Filter by git author (issues you caused)
  --count                                Just show issue count (quick check)

Output Options:
  --json                      Output as JSON (for scripting)
  --branches                  List all branches and their types
  --baseline                  Show detected baseline branch for project

Admin Options:
  --delete <branch>           Delete branch from SonarCloud (release-* only)
  --help, -h                  Show this help

Examples:
  sonar-verify brevilledigital_xps-utils
  sonar-verify brevilledigital_xps-utils main
  sonar-verify brevilledigital_xps-utils feature/fix AYxAbC123
  sonar-verify brevilledigital_xps-utils main --types=BUG --json
  sonar-verify brevilledigital_xps-utils --branches
  sonar-verify brevilledigital_xps-utils --delete release-old-fix

  # Issues I caused (by git author)
  sonar-verify brevilledigital_xps-utils develop --author=jmu@solutiondigital.biz
  sonar-verify brevilledigital_xps-utils develop --author=jmu@solutiondigital.biz --count

Project Key Format:
  brevilledigital_<repo-name>  (found in sonar-project.properties)
`);
    process.exit(0);
  }

  const projectKey = args[0];
  const branch = args[1] && !args[1].startsWith('--') ? args[1] : undefined;
  const issueKey = args[2] && !args[2].startsWith('--') ? args[2] : undefined;
  const jsonOutput = args.includes('--json');
  const countOnly = args.includes('--count');
  const typesArg = args.find((a) => a.startsWith('--types='));
  const types = typesArg?.split('=')[1]?.split(',');
  const listBranches = args.includes('--branches');
  const showBaseline = args.includes('--baseline');
  const deleteArg = args.find((a) => a.startsWith('--delete'));
  const branchToDelete = deleteArg ? args[args.indexOf(deleteArg) + 1] : undefined;

  // User filtering options
  const authorArg = args.find((a) => a.startsWith('--author='));
  const author = authorArg?.split('=')[1];

  try {
    // Show baseline branch
    if (showBaseline) {
      console.log(`\n🔍 Detecting baseline branch for ${projectKey}...\n`);
      const longLived = await getLongLivedBranches(token, projectKey);

      if (longLived.length === 0) {
        console.log('❌ No long-lived branches found');
        process.exit(1);
      }

      const baseline = await getBaselineBranch(token, projectKey);

      console.log('Long-lived branches:');
      for (const b of longLived) {
        const marker = b.name === baseline ? ' ← baseline' : '';
        const mainTag = b.isMain ? ' (main)' : '';
        console.log(`  \x1b[32m${b.name}\x1b[0m${mainTag}${marker}`);
      }

      if (baseline) {
        console.log(`\n✅ Auto-detected baseline: ${baseline}`);
      } else {
        console.log('\n⚠️  Multiple long-lived branches - specify branch manually');
      }
      return;
    }

    // List branches
    if (listBranches) {
      console.log(`\n📋 Branches for ${projectKey}:\n`);
      const data = await sonarFetch<{ branches: Array<{ name: string; type: string; isMain: boolean }> }>(
        token,
        'project_branches/list',
        { project: projectKey }
      );

      for (const b of data.branches) {
        const mainTag = b.isMain ? ' (main)' : '';
        const typeColor = b.type === 'LONG' ? '\x1b[32m' : '\x1b[33m';
        console.log(`  ${typeColor}${b.type.padEnd(6)}\x1b[0m ${b.name}${mainTag}`);
      }
      console.log();
      return;
    }

    // Delete branch (safety: only release-* branches)
    if (branchToDelete) {
      // Safety check: only allow deletion of release-* branches
      if (!branchToDelete.startsWith('release-')) {
        console.error(`\n❌ Safety check failed: Can only delete branches starting with "release-"`);
        console.error(`   Attempted to delete: "${branchToDelete}"`);
        console.error(`\n   This restriction prevents accidental deletion of important branches.`);
        console.error(`   If you need to delete this branch, use the SonarCloud web UI.\n`);
        process.exit(1);
      }

      console.log(`\n🗑️  Deleting branch "${branchToDelete}" from SonarCloud...`);
      const response = await fetch(
        `${SONAR_BASE_URL}/api/project_branches/delete?project=${projectKey}&branch=${encodeURIComponent(branchToDelete)}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to delete branch: ${response.status} ${text}`);
      }

      console.log(`✅ Branch "${branchToDelete}" deleted from SonarCloud\n`);
      return;
    }

    // Auto-detect branch if not provided
    let targetBranch = branch;
    if (!targetBranch) {
      const baseline = await getBaselineBranch(token, projectKey);
      if (baseline) {
        targetBranch = baseline;
        console.log(`\n🎯 Auto-detected baseline: ${targetBranch}`);
      } else {
        console.error('\n❌ No branch specified and could not auto-detect baseline');
        console.error('   Use --branches to list available branches');
        process.exit(1);
      }
    }

    // Build filter description for output
    const filters: string[] = [];
    if (types?.length) filters.push(`types=${types.join(',')}`);
    if (author) filters.push(`author=${author}`);
    const filterDesc = filters.length > 0 ? ` (${filters.join(', ')})` : '';

    if (issueKey) {
      // Verify specific issue
      console.log(`\n🔍 Checking if ${issueKey} is resolved on ${targetBranch}...\n`);

      const issues = await fetchOpenIssues({ token, projectKey, branch: targetBranch, types, author });
      const targetIssue = issues.find((i) => i.key === issueKey);

      if (!targetIssue) {
        if (jsonOutput) {
          console.log(JSON.stringify({ resolved: true, issueKey, branch: targetBranch }));
        } else {
          console.log(`✅ Issue ${issueKey} is RESOLVED (not found in open issues)`);
        }
        process.exit(0);
      } else {
        if (jsonOutput) {
          console.log(JSON.stringify({ resolved: false, issueKey, branch: targetBranch, issue: targetIssue }));
        } else {
          console.log(`❌ Issue ${issueKey} is still OPEN`);
          console.log(`   ${getFilePath(targetIssue.component, projectKey)}:${targetIssue.line || '?'}`);
          console.log(`   ${targetIssue.message}`);
        }
        process.exit(1);
      }
    } else {
      // List all open issues
      if (!countOnly) {
        console.log(`\n📋 Fetching issues for ${projectKey} on ${targetBranch}${filterDesc}...\n`);
      }

      const issues = await fetchOpenIssues({ token, projectKey, branch: targetBranch, types, author });

      // Count only mode - quick check
      if (countOnly) {
        if (jsonOutput) {
          console.log(JSON.stringify({ count: issues.length, branch: targetBranch, filters }));
        } else {
          const emoji = issues.length === 0 ? '✅' : '⚠️';
          console.log(`${emoji} ${issues.length} issues on ${targetBranch}${filterDesc}`);
        }
        process.exit(issues.length > 0 ? 1 : 0);
      }

      if (jsonOutput) {
        console.log(JSON.stringify(issues, null, 2));
        return;
      }

      if (issues.length === 0) {
        console.log('No open issues found! 🎉');
        return;
      }

      console.log(`Found ${issues.length} open issues:\n`);

      // Group by type
      const byType = issues.reduce(
        (acc, i) => {
          acc[i.type] = acc[i.type] || [];
          acc[i.type].push(i);
          return acc;
        },
        {} as Record<string, SonarIssue[]>
      );

      for (const [type, typeIssues] of Object.entries(byType)) {
        console.log(`\n${type} (${typeIssues.length}):`);
        console.log('─'.repeat(50));

        for (const issue of typeIssues.slice(0, 20)) {
          // Limit display
          const file = getFilePath(issue.component, projectKey);
          console.log(`  [${formatSeverity(issue.severity)}] ${issue.key}`);
          console.log(`    ${file}:${issue.line || '?'}`);
          console.log(`    ${issue.message.slice(0, 80)}${issue.message.length > 80 ? '...' : ''}\n`);
        }

        if (typeIssues.length > 20) {
          console.log(`  ... and ${typeIssues.length - 20} more ${type} issues`);
        }
      }
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Only run if this is the main module (not when imported)
if (import.meta.main) {
  main();
}
