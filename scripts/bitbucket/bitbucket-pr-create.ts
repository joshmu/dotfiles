#!/usr/bin/env bun
import { parseArgs } from 'util';
import { BitbucketAPI } from './lib/api';
import { loadConfig, getCurrentRepo, getCurrentBranch } from './lib/config';
import type { BitbucketPullRequestCreate } from './lib/types';

// Parse command line arguments
const { values, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    help: {
      type: 'boolean',
      short: 'h',
    },
    title: {
      type: 'string',
      short: 't',
    },
    description: {
      type: 'string',
      short: 'd',
    },
    source: {
      type: 'string',
      short: 's',
    },
    destination: {
      type: 'string',
      short: 'b',
    },
    repo: {
      type: 'string',
      short: 'r',
    },
    workspace: {
      type: 'string',
      short: 'w',
    },
    'close-source-branch': {
      type: 'boolean',
    },
    draft: {
      type: 'boolean',
    },
  },
  strict: true,
  allowPositionals: true,
});

async function showHelp() {
  console.log(`
Bitbucket PR Creator

Create pull requests in Bitbucket from the command line.

Usage:
  bun bitbucket-pr-create.ts [options]

Options:
  -h, --help                  Show this help message
  -t, --title <title>         PR title (required)
  -d, --description <desc>    PR description
  -s, --source <branch>       Source branch (defaults to current branch)
  -b, --destination <branch>  Destination branch (defaults to master)
  -r, --repo <repo>           Repository slug (defaults to current repo)
  -w, --workspace <ws>        Workspace (defaults to env or config)
  --close-source-branch       Close source branch after merge
  --draft                     Create as draft PR (prepends "Draft: " to title)

Examples:
  # Interactive mode
  bun bitbucket-pr-create.ts

  # Create PR with all options
  bun bitbucket-pr-create.ts -t "Add new feature" -d "This PR adds..." -s feature/new -b develop

  # Create draft PR
  bun bitbucket-pr-create.ts -t "WIP: New feature" --draft

Environment Variables:
  BITBUCKET_USERNAME          Your Bitbucket username
  BITBUCKET_APP_PASSWORD      Your Bitbucket app password
  BITBUCKET_WORKSPACE         Default workspace
  BITBUCKET_DEFAULT_BASE_BRANCH  Default destination branch
`);
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

async function promptYesNo(question: string, defaultValue: boolean = false): Promise<boolean> {
  const defaultText = defaultValue ? 'Y/n' : 'y/N';
  const answer = await prompt(`${question} (${defaultText})`, '');
  
  if (!answer) return defaultValue;
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

async function main() {
  if (values.help) {
    showHelp();
    process.exit(0);
  }

  try {
    const config = loadConfig();
    const api = new BitbucketAPI(config);

    // Get repository and branch info
    const currentRepo = getCurrentRepo();
    const currentBranch = getCurrentBranch();

    // Collect PR details
    const workspace = values.workspace || config.workspace;
    const repo = values.repo || currentRepo || await prompt('Repository slug');
    const sourceBranch = values.source || currentBranch || await prompt('Source branch');
    const destinationBranch = values.destination || config.defaultBaseBranch;
    
    let title = values.title || await prompt('PR title');
    if (!title) {
      console.error('❌ PR title is required');
      process.exit(1);
    }

    // Handle draft PR
    if (values.draft && !title.toLowerCase().startsWith('draft:') && !title.toLowerCase().startsWith('[draft]')) {
      title = `Draft: ${title}`;
    }

    const description = values.description || await prompt('PR description (optional)', '');
    const closeSourceBranch = values['close-source-branch'] ?? await promptYesNo('Close source branch after merge?', false);

    // Validate branches exist
    console.log('\n🔍 Validating branches...');
    try {
      const branches = await api.getBranches(workspace, repo);
      const branchNames = branches.values.map(b => b.name);
      
      if (!branchNames.includes(sourceBranch)) {
        console.error(`❌ Source branch '${sourceBranch}' not found in repository`);
        console.error(`Available branches: ${branchNames.join(', ')}`);
        process.exit(1);
      }
      
      if (!branchNames.includes(destinationBranch)) {
        console.error(`❌ Destination branch '${destinationBranch}' not found in repository`);
        console.error(`Available branches: ${branchNames.join(', ')}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('⚠️  Could not validate branches:', error);
      const proceed = await promptYesNo('Continue anyway?', false);
      if (!proceed) {
        process.exit(1);
      }
    }

    // Create PR
    console.log('\n📤 Creating pull request...');
    console.log(`   Repository: ${workspace}/${repo}`);
    console.log(`   Source: ${sourceBranch}`);
    console.log(`   Destination: ${destinationBranch}`);
    console.log(`   Title: ${title}`);
    if (description) {
      console.log(`   Description: ${description.substring(0, 50)}...`);
    }

    const prData: BitbucketPullRequestCreate = {
      title,
      source: {
        branch: {
          name: sourceBranch,
        },
      },
      destination: {
        branch: {
          name: destinationBranch,
        },
      },
      close_source_branch: closeSourceBranch,
    };

    if (description) {
      prData.description = description;
    }

    const pr = await api.createPullRequest(workspace, repo, prData);

    console.log('\n✅ Pull request created successfully!');
    console.log(`   PR #${pr.id}: ${pr.title}`);
    console.log(`   URL: ${pr.links.html.href}`);
    console.log(`   State: ${pr.state}`);
    
    // Copy URL to clipboard if possible
    try {
      await Bun.write(Bun.stdout, `\n📋 URL copied to clipboard\n`);
      const proc = Bun.spawn(['pbcopy'], {
        stdin: 'pipe',
      });
      const writer = proc.stdin.getWriter();
      await writer.write(new TextEncoder().encode(pr.links.html.href));
      await writer.close();
      await proc.exited;
    } catch {
      // Clipboard copy failed, not critical
    }

  } catch (error) {
    console.error('\n❌ Error creating pull request:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(console.error);