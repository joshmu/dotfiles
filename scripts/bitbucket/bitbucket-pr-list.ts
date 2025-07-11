#!/usr/bin/env bun
import { parseArgs } from 'util';
import { BitbucketAPI } from './lib/api';
import { loadConfig, getCurrentRepo } from './lib/config';
import type { BitbucketPullRequest } from './lib/types';

// Parse command line arguments
const { values, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    help: {
      type: 'boolean',
      short: 'h',
    },
    repo: {
      type: 'string',
      short: 'r',
    },
    workspace: {
      type: 'string',
      short: 'w',
    },
    state: {
      type: 'string',
      short: 's',
    },
    draft: {
      type: 'boolean',
    },
    'no-draft': {
      type: 'boolean',
    },
    limit: {
      type: 'string',
      short: 'l',
    },
    format: {
      type: 'string',
      short: 'f',
    },
    author: {
      type: 'string',
      short: 'a',
    },
    'my-prs': {
      type: 'boolean',
    },
    search: {
      type: 'string',
    },
    'sort-by': {
      type: 'string',
    },
    'sort-desc': {
      type: 'boolean',
    },
    'non-interactive': {
      type: 'boolean',
      short: 'n',
    },
  },
  strict: true,
  allowPositionals: true,
});

async function showHelp() {
  console.log(`
Bitbucket PR Lister

List pull requests in a Bitbucket repository with various filters.

Usage:
  bun bitbucket-pr-list.ts [options]

Options:
  -h, --help              Show this help message
  -r, --repo <repo>       Repository slug (defaults to current repo)
  -w, --workspace <ws>    Workspace (defaults to env or config)
  -s, --state <state>     Filter by state: OPEN, MERGED, DECLINED, SUPERSEDED (default: OPEN)
  --draft                 Show only draft PRs
  --no-draft              Show only non-draft PRs
  -l, --limit <n>         Limit number of results (default: 50)
  -f, --format <format>   Output format: table, json, simple (default: table)
  -a, --author <user>     Filter by author username
  --my-prs                Show only your own PRs
  --search <text>         Search PRs by title or description
  --sort-by <field>       Sort by: created, updated, title (default: created)
  --sort-desc             Sort in descending order
  -n, --non-interactive   Run without prompts, fail if repo not specified

Examples:
  # List all open PRs
  bun bitbucket-pr-list.ts

  # List draft PRs only
  bun bitbucket-pr-list.ts --draft

  # List merged PRs in JSON format
  bun bitbucket-pr-list.ts -s MERGED -f json

  # List PRs in a specific repo
  bun bitbucket-pr-list.ts -r my-repo

  # List your own PRs
  bun bitbucket-pr-list.ts --my-prs

  # Search PRs by text
  bun bitbucket-pr-list.ts --search "bug fix"

  # Sort by updated date descending
  bun bitbucket-pr-list.ts --sort-by updated --sort-desc

Environment Variables:
  BITBUCKET_USERNAME          Your Bitbucket username
  BITBUCKET_APP_PASSWORD      Your Bitbucket app password
  BITBUCKET_WORKSPACE         Default workspace
`);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins}m ago`;
    }
    return `${diffHours}h ago`;
  } else if (diffDays < 30) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

function formatPRTable(prs: BitbucketPullRequest[]): void {
  if (prs.length === 0) {
    console.log('No pull requests found');
    return;
  }

  // Calculate column widths
  const idWidth = Math.max(4, ...prs.map(pr => pr.id.toString().length));
  const titleWidth = Math.min(50, Math.max(5, ...prs.map(pr => pr.title.length)));
  const authorWidth = Math.min(20, Math.max(6, ...prs.map(pr => pr.author.display_name.length)));
  const sourceWidth = Math.min(30, Math.max(6, ...prs.map(pr => pr.source.branch.name.length)));
  const destWidth = Math.min(20, Math.max(4, ...prs.map(pr => pr.destination.branch.name.length)));

  // Header
  console.log('\n' + [
    'ID'.padEnd(idWidth),
    'Title'.padEnd(titleWidth),
    'Draft'.padEnd(5),
    'Author'.padEnd(authorWidth),
    'Source'.padEnd(sourceWidth),
    '→ Dest'.padEnd(destWidth + 2),
    'Created',
  ].join(' │ '));

  console.log('─'.repeat(idWidth + titleWidth + 5 + authorWidth + sourceWidth + destWidth + 2 + 12 + 30));

  // Rows
  for (const pr of prs) {
    const title = pr.title.length > titleWidth ? pr.title.substring(0, titleWidth - 3) + '...' : pr.title;
    const author = pr.author.display_name.length > authorWidth ? pr.author.display_name.substring(0, authorWidth - 3) + '...' : pr.author.display_name;
    const source = pr.source.branch.name.length > sourceWidth ? pr.source.branch.name.substring(0, sourceWidth - 3) + '...' : pr.source.branch.name;
    const dest = pr.destination.branch.name.length > destWidth ? pr.destination.branch.name.substring(0, destWidth - 3) + '...' : pr.destination.branch.name;

    console.log([
      pr.id.toString().padEnd(idWidth),
      title.padEnd(titleWidth),
      (pr.draft ? '✓' : ' ').padEnd(5),
      author.padEnd(authorWidth),
      source.padEnd(sourceWidth),
      `→ ${dest}`.padEnd(destWidth + 2),
      formatDate(pr.created_on),
    ].join(' │ '));
  }

  console.log(`\n${prs.length} pull request(s) found`);
}

function formatPRSimple(prs: BitbucketPullRequest[]): void {
  for (const pr of prs) {
    console.log(`#${pr.id} ${pr.title}${pr.draft ? ' [DRAFT]' : ''}`);
  }
}

function formatPRJson(prs: BitbucketPullRequest[]): void {
  console.log(JSON.stringify(prs, null, 2));
}

async function main() {
  if (values.help) {
    showHelp();
    process.exit(0);
  }

  try {
    const config = loadConfig();
    const api = new BitbucketAPI(config);

    // Get repository info
    const currentRepo = getCurrentRepo();
    const nonInteractive = values['non-interactive'] || false;
    const workspace = values.workspace || config.workspace;
    const repo = values.repo || currentRepo || (nonInteractive ? null : await prompt('Repository slug: '));
    
    if (!repo) {
      console.error('❌ Repository slug is required' + (nonInteractive ? ' in non-interactive mode' : ''));
      process.exit(1);
    }

    // Parse options
    const state = values.state as 'OPEN' | 'MERGED' | 'DECLINED' | 'SUPERSEDED' | undefined || 'OPEN';
    const limit = parseInt(values.limit || '50', 10);
    const format = values.format || 'table';

    if (values.draft && values['no-draft']) {
      console.error('❌ Cannot use both --draft and --no-draft');
      process.exit(1);
    }

    // Fetch PRs
    console.log(`🔍 Fetching pull requests from ${workspace}/${repo}...`);
    const response = await api.listPullRequests(workspace, repo, state);
    
    let prs = response.values;

    // Filter by draft status if requested
    if (values.draft) {
      prs = prs.filter(pr => pr.draft);
    } else if (values['no-draft']) {
      prs = prs.filter(pr => !pr.draft);
    }

    // Filter by author
    if (values.author) {
      const authorFilter = values.author.toLowerCase();
      prs = prs.filter(pr => 
        pr.author.username.toLowerCase() === authorFilter ||
        pr.author.display_name.toLowerCase().includes(authorFilter)
      );
    }

    // Filter by "my PRs" 
    if (values['my-prs']) {
      prs = prs.filter(pr => pr.author.username === config.username);
    }

    // Search filter
    if (values.search) {
      const searchTerm = values.search.toLowerCase();
      prs = prs.filter(pr => 
        pr.title.toLowerCase().includes(searchTerm) ||
        (pr.description && pr.description.toLowerCase().includes(searchTerm))
      );
    }

    // Sorting
    const sortBy = values['sort-by'] || 'created';
    const sortDesc = values['sort-desc'] || false;
    
    prs.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'created':
          comparison = new Date(a.created_on).getTime() - new Date(b.created_on).getTime();
          break;
        case 'updated':
          comparison = new Date(a.updated_on).getTime() - new Date(b.updated_on).getTime();
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
      }
      
      return sortDesc ? -comparison : comparison;
    });

    // Limit results
    prs = prs.slice(0, limit);

    // Format output
    switch (format) {
      case 'json':
        formatPRJson(prs);
        break;
      case 'simple':
        formatPRSimple(prs);
        break;
      case 'table':
      default:
        formatPRTable(prs);
        break;
    }

  } catch (error) {
    console.error('\n❌ Error listing pull requests:', error);
    process.exit(1);
  }
  
  // Ensure clean exit
  process.exit(0);
}

async function prompt(question: string, defaultValue?: string): Promise<string> {
  const defaultText = defaultValue ? ` (${defaultValue})` : '';
  process.stdout.write(`${question}${defaultText}: `);
  
  for await (const line of console) {
    const answer = line.trim();
    return answer || defaultValue || '';
  }
  
  return defaultValue || '';
}

// Run the main function
main().catch(console.error);