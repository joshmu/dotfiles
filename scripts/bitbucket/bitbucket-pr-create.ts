#!/usr/bin/env bun
import { parseArgs } from 'util';
import { BitbucketAPI } from './lib/api';
import { loadConfig, getCurrentRepo, getCurrentBranch } from './lib/config';
import type { BitbucketPullRequestCreate, BitbucketMarkupContent } from './lib/types';
import { loadPRTemplate, processTemplate, generateTemplateVariables } from './lib/template';

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
    template: {
      type: 'boolean',
    },
    'no-template': {
      type: 'boolean',
    },
    reviewers: {
      type: 'string',
      multiple: true,
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
  --reviewers <id>            Add reviewers by account ID (can be used multiple times)
  --close-source-branch       Close source branch after merge
  --draft                     Create as draft PR
  --template                  Use PR template if available (default: true)
  --no-template               Don't use PR template
  -n, --non-interactive       Run without prompts, use defaults for missing values

Examples:
  # Interactive mode
  bun bitbucket-pr-create.ts

  # Create PR with all options
  bun bitbucket-pr-create.ts -t "Add new feature" -d "This PR adds..." -s feature/new -b develop

  # Create draft PR
  bun bitbucket-pr-create.ts -t "WIP: New feature" --draft

  # Create PR with markdown description (markdown is always enabled)
  bun bitbucket-pr-create.ts -t "Feature" -d "## Changes\n- Added feature"

  # Create PR with reviewers
  bun bitbucket-pr-create.ts -t "Feature" --reviewers 5e0ae3863ebba10e937ecff0 --reviewers 60905f0ec87b550069a88204

  # Non-interactive mode (no prompts)
  bun bitbucket-pr-create.ts -t "Feature" -d "Description" -s feature/branch --non-interactive

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
    const nonInteractive = values['non-interactive'] || false;

    // Collect PR details
    const workspace = values.workspace || config.workspace;
    const repo = values.repo || currentRepo || (nonInteractive ? null : await prompt('Repository slug'));
    const sourceBranch = values.source || currentBranch || (nonInteractive ? null : await prompt('Source branch'));
    const destinationBranch = values.destination || config.defaultBaseBranch;
    
    // Check required fields in non-interactive mode
    if (nonInteractive) {
      if (!repo) {
        console.error('❌ Repository slug is required in non-interactive mode (use -r or ensure git repo)');
        process.exit(1);
      }
      if (!sourceBranch) {
        console.error('❌ Source branch is required in non-interactive mode (use -s or ensure git branch)');
        process.exit(1);
      }
    }
    
    const title = values.title || (nonInteractive ? null : await prompt('PR title'));
    if (!title) {
      console.error('❌ PR title is required');
      process.exit(1);
    }

    // Handle PR template
    let description = values.description || '';
    const useTemplate = values.template ?? (values['no-template'] ? false : true);
    
    if (!description && useTemplate) {
      const template = loadPRTemplate();
      if (template) {
        const variables = generateTemplateVariables(
          sourceBranch,
          destinationBranch,
          title,
          config.username
        );
        description = processTemplate(template, variables);
        console.log('📝 Using PR template');
        
        if (!nonInteractive) {
          // Show template preview and ask for confirmation
          console.log('\n--- Template Preview ---');
          console.log(description.split('\n').slice(0, 10).join('\n'));
          if (description.split('\n').length > 10) {
            console.log('... (truncated)');
          }
          console.log('--- End Preview ---\n');
        }
        
        const useTemplateContent = nonInteractive ? true : await promptYesNo('Use this template?', true);
        if (!useTemplateContent) {
          description = '';
        }
      }
    }
    
    if (!description && !nonInteractive) {
      description = await prompt('PR description (optional)', '');
    }
    
    const isDraft = values.draft ?? (nonInteractive ? false : await promptYesNo('Create as draft PR?', false));
    const closeSourceBranch = values['close-source-branch'] ?? (nonInteractive ? false : await promptYesNo('Close source branch after merge?', false));

    // Validate branches exist
    console.log('\n🔍 Validating branches...');
    try {
      // Check source branch
      const sourceExists = await api.checkBranchExists(workspace, repo, sourceBranch);
      if (!sourceExists) {
        console.error(`❌ Source branch '${sourceBranch}' not found in repository`);
        if (nonInteractive) {
          console.log('⚠️  Continuing in non-interactive mode...');
        } else {
          const proceed = await promptYesNo('Continue anyway?', false);
          if (!proceed) {
            process.exit(1);
          }
        }
      }
      
      // Check destination branch
      const destExists = await api.checkBranchExists(workspace, repo, destinationBranch);
      if (!destExists) {
        console.error(`❌ Destination branch '${destinationBranch}' not found in repository`);
        if (nonInteractive) {
          console.log('⚠️  Continuing in non-interactive mode...');
        } else {
          const proceed = await promptYesNo('Continue anyway?', false);
          if (!proceed) {
            process.exit(1);
          }
        }
      }
      
      if (sourceExists && destExists) {
        console.log('✅ Both branches validated successfully');
      }
    } catch (error) {
      console.error('⚠️  Could not validate branches:', error);
      if (!nonInteractive) {
        const proceed = await promptYesNo('Continue anyway?', false);
        if (!proceed) {
          process.exit(1);
        }
      }
    }

    // Create PR
    console.log('\n📤 Creating pull request...');
    console.log(`   Repository: ${workspace}/${repo}`);
    console.log(`   Source: ${sourceBranch}`);
    console.log(`   Destination: ${destinationBranch}`);
    console.log(`   Title: ${title}`);
    if (isDraft) {
      console.log(`   Status: Draft`);
    }
    if (description) {
      console.log(`   Description: ${description.substring(0, 50)}...`);
      console.log(`   Format: Markdown`);
    }
    
    // Handle reviewers
    const reviewerIds = values.reviewers as string[] | undefined;
    if (reviewerIds && reviewerIds.length > 0) {
      console.log(`   Reviewers: ${reviewerIds.length} reviewer(s) added`);
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
      draft: isDraft,
    };

    if (description) {
      // Send raw markdown string - Bitbucket auto-detects markdown
      prData.description = description;
    }
    
    // Add reviewers if provided
    if (reviewerIds && reviewerIds.length > 0) {
      // Try using account_id format
      prData.reviewers = reviewerIds.map(id => ({ account_id: id } as any));
    }

    const pr = await api.createPullRequest(workspace, repo, prData);

    console.log('\n✅ Pull request created successfully!');
    console.log(`   PR #${pr.id}: ${pr.title}`);
    console.log(`   URL: ${pr.links.html.href}`);
    console.log(`   State: ${pr.state}`);
    if (pr.draft) {
      console.log(`   Draft: Yes`);
    }
    
    // Copy URL to clipboard if possible (skip in non-interactive mode)
    if (!nonInteractive) {
      try {
        const proc = Bun.spawn(['pbcopy'], {
          stdin: 'pipe',
        });
        const writer = proc.stdin.getWriter();
        await writer.write(new TextEncoder().encode(pr.links.html.href));
        await writer.close();
        
        // Add timeout to prevent hanging
        const timeout = setTimeout(() => {
          proc.kill();
        }, 1000);
        
        await proc.exited;
        clearTimeout(timeout);
        
        console.log('\n📋 URL copied to clipboard');
      } catch {
        // Clipboard copy failed, not critical
      }
    }

  } catch (error) {
    console.error('\n❌ Error creating pull request:', error);
    process.exit(1);
  }
  
  // Ensure clean exit
  process.exit(0);
}

// Run the main function
main().catch(console.error);