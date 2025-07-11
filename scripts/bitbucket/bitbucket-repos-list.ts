#!/usr/bin/env bun
import { parseArgs } from 'util';
import { BitbucketAPI } from './lib/api';
import { loadConfig } from './lib/config';

// Parse command line arguments
const { values, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    help: {
      type: 'boolean',
      short: 'h',
    },
    filter: {
      type: 'string',
      short: 'f',
    },
    workspace: {
      type: 'string',
      short: 'w',
    },
    'show-urls': {
      type: 'boolean',
      short: 'u',
    },
    'show-private': {
      type: 'boolean',
      short: 'p',
    },
    limit: {
      type: 'string',
      short: 'l',
    },
    format: {
      type: 'string',
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
Bitbucket Repository Lister

List repositories in your Bitbucket workspace.

Usage:
  bun bitbucket-repos-list.ts [options]

Options:
  -h, --help           Show this help message
  -f, --filter <text>  Filter repositories by name
  -w, --workspace <ws> Workspace (defaults to env or config)
  -u, --show-urls      Show clone URLs
  -p, --show-private   Include private status
  -l, --limit <n>      Limit number of results (default: all)
  --format <fmt>       Output format: table, json, simple (default: table)
  -n, --non-interactive   Run without prompts (for consistency with other scripts)

Examples:
  # List all repositories
  bun bitbucket-repos-list.ts

  # Filter by name
  bun bitbucket-repos-list.ts -f xps

  # Show clone URLs
  bun bitbucket-repos-list.ts -u

  # JSON output
  bun bitbucket-repos-list.ts --format json

Environment Variables:
  BITBUCKET_USERNAME          Your Bitbucket username
  BITBUCKET_APP_PASSWORD      Your Bitbucket app password
  BITBUCKET_WORKSPACE         Default workspace
`);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

async function main() {
  if (values.help) {
    showHelp();
    process.exit(0);
  }

  try {
    const config = loadConfig();
    const api = new BitbucketAPI(config);
    
    const workspace = values.workspace || config.workspace;
    const filter = values.filter;
    const showUrls = values['show-urls'];
    const showPrivate = values['show-private'];
    const limit = values.limit ? parseInt(values.limit, 10) : undefined;
    const format = values.format || 'table';

    console.log(`\n🔍 Fetching repositories from ${workspace}...`);
    if (filter) {
      console.log(`   Filter: "${filter}"`);
    }

    const response = await api.listRepositories(workspace, filter);
    let repos = response.values;

    // Apply limit if specified
    if (limit && limit > 0) {
      repos = repos.slice(0, limit);
    }

    if (repos.length === 0) {
      console.log('\n❌ No repositories found');
      process.exit(0);
    }

    console.log(`\n📦 Found ${repos.length} repositories${response.size ? ` (of ${response.size} total)` : ''}:\n`);

    // Format output based on selected format
    switch (format) {
      case 'json':
        console.log(JSON.stringify(repos, null, 2));
        break;
        
      case 'simple':
        for (const repo of repos) {
          console.log(repo.slug);
        }
        break;
        
      case 'table':
      default:
        // Calculate column widths
        const nameWidth = Math.max(20, ...repos.map(r => r.slug.length)) + 2;
        const langWidth = Math.max(10, ...repos.map(r => (r.language || 'N/A').length)) + 2;
        
        // Print header
        let header = `${'Repository'.padEnd(nameWidth)}${'Language'.padEnd(langWidth)}`;
        if (showPrivate) header += 'Private  ';
        header += 'Size       Updated';
        
        console.log(header);
        console.log('─'.repeat(header.length));
        
        // Print repositories
        for (const repo of repos) {
          let line = `${repo.slug.padEnd(nameWidth)}`;
          line += `${(repo.language || 'N/A').padEnd(langWidth)}`;
          if (showPrivate) {
            line += `${repo.is_private ? 'Yes' : 'No'}      `;
          }
          line += `${formatSize(repo.size).padEnd(10)} `;
          line += formatDate(repo.updated_on);
          
          console.log(line);
          
          if (repo.description) {
            console.log(`  └─ ${repo.description}`);
          }
          
          if (showUrls) {
            const sshUrl = repo.links.clone.find(c => c.name === 'ssh')?.href;
            const httpsUrl = repo.links.clone.find(c => c.name === 'https')?.href;
            
            if (sshUrl) {
              console.log(`  └─ SSH: ${sshUrl}`);
            }
            if (httpsUrl) {
              console.log(`  └─ HTTPS: ${httpsUrl}`);
            }
          }
        }
        
        break;
    }

    // Show pagination info
    if (response.next) {
      console.log(`\n📄 More results available. Total: ${response.size || 'unknown'}`);
      if (!limit) {
        console.log('   Use -l/--limit to see more results');
      }
    }

  } catch (error) {
    console.error('\n❌ Error listing repositories:', error);
    process.exit(1);
  }
  
  // Ensure clean exit
  process.exit(0);
}

// Run the main function
main().catch(console.error);