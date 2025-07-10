#!/usr/bin/env bun
import { parseArgs } from 'util';
import { BitbucketAPI } from './lib/api';
import { loadConfig, getCurrentRepo } from './lib/config';
import type { BitbucketPullRequestUpdate } from './lib/types';

// Parse command line arguments
const { values, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    help: {
      type: 'boolean',
      short: 'h',
    },
    pr: {
      type: 'string',
      short: 'p',
    },
    title: {
      type: 'string',
      short: 't',
    },
    description: {
      type: 'string',
      short: 'd',
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
  },
  strict: true,
  allowPositionals: true,
});

async function showHelp() {
  console.log(`
Bitbucket PR Updater

Update existing pull requests in Bitbucket from the command line.

Usage:
  bun bitbucket-pr-update.ts [options]

Options:
  -h, --help                  Show this help message
  -p, --pr <id>               PR ID to update (required)
  -t, --title <title>         New PR title
  -d, --description <desc>    New PR description
  -b, --destination <branch>  New destination branch
  -r, --repo <repo>           Repository slug (defaults to current repo)
  -w, --workspace <ws>        Workspace (defaults to env or config)

Examples:
  # Update PR title
  bun bitbucket-pr-update.ts -p 123 -t "Updated: Add new feature"

  # Update PR description and destination
  bun bitbucket-pr-update.ts -p 123 -d "New description" -b develop

  # Interactive mode
  bun bitbucket-pr-update.ts -p 123

Environment Variables:
  BITBUCKET_USERNAME          Your Bitbucket username
  BITBUCKET_APP_PASSWORD      Your Bitbucket app password
  BITBUCKET_WORKSPACE         Default workspace
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
    const workspace = values.workspace || config.workspace;
    const repo = values.repo || currentRepo || await prompt('Repository slug');
    
    const prId = values.pr || await prompt('PR ID to update');
    if (!prId) {
      console.error('❌ PR ID is required');
      process.exit(1);
    }

    const prIdNum = parseInt(prId, 10);
    if (isNaN(prIdNum)) {
      console.error('❌ PR ID must be a number');
      process.exit(1);
    }

    // Fetch current PR details
    console.log('\n🔍 Fetching PR details...');
    const currentPR = await api.getPullRequest(workspace, repo, prIdNum);
    
    console.log(`\n📋 Current PR #${currentPR.id}:`);
    console.log(`   Title: ${currentPR.title}`);
    console.log(`   State: ${currentPR.state}`);
    console.log(`   Source: ${currentPR.source.branch.name}`);
    console.log(`   Destination: ${currentPR.destination.branch.name}`);
    console.log(`   Author: ${currentPR.author.display_name}`);
    if (currentPR.description) {
      console.log(`   Description: ${currentPR.description.substring(0, 50)}...`);
    }

    // Check if PR is still open
    if (currentPR.state !== 'OPEN') {
      console.error(`\n❌ Cannot update PR in ${currentPR.state} state`);
      process.exit(1);
    }

    // Collect update details
    const updateData: BitbucketPullRequestUpdate = {};
    let hasUpdates = false;

    // Title
    if (values.title !== undefined) {
      updateData.title = values.title;
      hasUpdates = true;
    } else {
      const newTitle = await prompt('\nNew title (leave empty to keep current)', '');
      if (newTitle) {
        updateData.title = newTitle;
        hasUpdates = true;
      }
    }

    // Description
    if (values.description !== undefined) {
      updateData.description = values.description;
      hasUpdates = true;
    } else {
      const newDescription = await prompt('New description (leave empty to keep current)', '');
      if (newDescription) {
        updateData.description = newDescription;
        hasUpdates = true;
      }
    }

    // Destination branch
    if (values.destination !== undefined) {
      updateData.destination = {
        branch: {
          name: values.destination,
        },
      };
      hasUpdates = true;
    } else {
      const newDestination = await prompt('New destination branch (leave empty to keep current)', '');
      if (newDestination) {
        // Validate branch exists
        try {
          const branches = await api.getBranches(workspace, repo);
          const branchNames = branches.values.map(b => b.name);
          
          if (!branchNames.includes(newDestination)) {
            console.error(`\n❌ Destination branch '${newDestination}' not found in repository`);
            console.error(`Available branches: ${branchNames.join(', ')}`);
            process.exit(1);
          }
        } catch (error) {
          console.error('⚠️  Could not validate branch:', error);
        }
        
        updateData.destination = {
          branch: {
            name: newDestination,
          },
        };
        hasUpdates = true;
      }
    }

    if (!hasUpdates) {
      console.log('\n✨ No updates specified');
      process.exit(0);
    }

    // Update PR
    console.log('\n📤 Updating pull request...');
    const updatedPR = await api.updatePullRequest(workspace, repo, prIdNum, updateData);

    console.log('\n✅ Pull request updated successfully!');
    console.log(`   PR #${updatedPR.id}: ${updatedPR.title}`);
    console.log(`   URL: ${updatedPR.links.html.href}`);
    
    // Show what changed
    console.log('\n📝 Changes:');
    if (updateData.title && updateData.title !== currentPR.title) {
      console.log(`   Title: "${currentPR.title}" → "${updateData.title}"`);
    }
    if (updateData.description !== undefined && updateData.description !== currentPR.description) {
      console.log(`   Description: Updated`);
    }
    if (updateData.destination && updateData.destination.branch.name !== currentPR.destination.branch.name) {
      console.log(`   Destination: ${currentPR.destination.branch.name} → ${updateData.destination.branch.name}`);
    }

  } catch (error) {
    console.error('\n❌ Error updating pull request:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(console.error);