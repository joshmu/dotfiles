# Bitbucket CLI Tools

Bun-based command-line tools for interacting with Bitbucket repositories, pull requests, and more.

## 🚀 Quick Start

1. **Setup credentials**:
   ```bash
   cp config.json.example config.json
   # Edit config.json with your Bitbucket credentials
   ```

2. **Create an app password**:
   - Go to [Bitbucket App Passwords](https://bitbucket.org/account/settings/app-passwords/)
   - Create a new app password with these permissions:
     - Repositories: Read, Write
     - Pull requests: Read, Write

3. **Run a script**:
   ```bash
   bun bitbucket-pr-create.ts --help
   ```

## 📚 Available Scripts

### 1. Create Pull Request (`bitbucket-pr-create.ts`)

Create new pull requests interactively or with command-line arguments.

```bash
# Interactive mode (prompts for missing info)
bun bitbucket-pr-create.ts

# Full command-line mode
bun bitbucket-pr-create.ts \
  -t "Add new feature" \
  -d "This PR adds the new feature X" \
  -s feature/new-feature \
  -b develop

# Create a draft PR
bun bitbucket-pr-create.ts -t "WIP: New feature" --draft
```

**Options:**
- `-t, --title` - PR title (required)
- `-d, --description` - PR description
- `-s, --source` - Source branch (defaults to current branch)
- `-b, --destination` - Destination branch (defaults to master)
- `-r, --repo` - Repository slug (defaults to current repo)
- `-w, --workspace` - Workspace (defaults to env config)
- `--close-source-branch` - Close source branch after merge
- `--draft` - Create as draft PR

### 2. Update Pull Request (`bitbucket-pr-update.ts`)

Update existing pull requests.

```bash
# Update PR title
bun bitbucket-pr-update.ts -p 123 -t "Updated: Add new feature"

# Update multiple fields
bun bitbucket-pr-update.ts -p 123 -t "New title" -d "New description" -b develop

# Interactive mode for PR #123
bun bitbucket-pr-update.ts -p 123
```

**Options:**
- `-p, --pr` - PR ID to update (required)
- `-t, --title` - New PR title
- `-d, --description` - New PR description
- `-b, --destination` - New destination branch
- `-r, --repo` - Repository slug
- `-w, --workspace` - Workspace

### 3. List Repositories (`bitbucket-repos-list.ts`)

List repositories in your workspace with various display options.

```bash
# List all repositories
bun bitbucket-repos-list.ts

# Filter by name
bun bitbucket-repos-list.ts -f xps

# Show clone URLs
bun bitbucket-repos-list.ts -u

# JSON output for scripting
bun bitbucket-repos-list.ts --format json

# Simple list (just names)
bun bitbucket-repos-list.ts --format simple
```

**Options:**
- `-f, --filter` - Filter repositories by name
- `-u, --show-urls` - Show clone URLs
- `-p, --show-private` - Include private status
- `-l, --limit` - Limit number of results
- `-w, --workspace` - Workspace
- `--format` - Output format: table, json, simple

## 🔧 Configuration

### Configuration

Create a `config.json` file in this directory:

```json
{
  "username": "your-username",
  "appPassword": "your-app-password",
  "workspace": "brevilledigital",
  "defaultBaseBranch": "master"
}
```

### Auto-detection

The scripts automatically detect:
- Current git repository name
- Current git branch
- Workspace from environment

## 🏗️ Architecture

```
bitbucket/
├── bitbucket-pr-create.ts      # Create PRs
├── bitbucket-pr-update.ts      # Update PRs
├── bitbucket-repos-list.ts     # List repos
├── lib/
│   ├── api.ts                  # Bitbucket API client
│   ├── config.ts               # Configuration loader
│   └── types.ts                # TypeScript types
├── config.json.example         # Example configuration
└── README.md                   # This file
```

## 🛠️ Development

### Adding New Scripts

1. Create a new TypeScript file in the root directory
2. Import shared utilities from `lib/`
3. Make it executable: `chmod +x your-script.ts`
4. Add shebang: `#!/usr/bin/env bun`

### API Client Usage

```typescript
import { BitbucketAPI } from './lib/api';
import { loadConfig } from './lib/config';

const config = loadConfig();
const api = new BitbucketAPI(config);

// Create a PR
const pr = await api.createPullRequest(workspace, repo, {
  title: 'My PR',
  source: { branch: { name: 'feature' } },
});
```

## 🐛 Troubleshooting

### Authentication Issues
- Ensure your app password has the correct permissions
- Check that your username is correct (not email)
- App passwords are different from your account password

### Rate Limiting
Bitbucket has API rate limits. If you hit them:
- Wait a few minutes before retrying
- Use pagination and limits for large operations

### Branch Not Found
- Ensure the branch exists in the remote repository
- Push your local branch before creating a PR

## 📝 Examples

### Typical Workflow

```bash
# 1. Start work on a feature
git checkout -b feature/my-feature

# 2. Make changes and commit
git add .
git commit -m "Add my feature"
git push -u origin feature/my-feature

# 3. Create PR
bun bitbucket-pr-create.ts -t "Add my feature" -d "This implements..."

# 4. Update PR after review
bun bitbucket-pr-update.ts -p 123 -t "Updated: Add my feature"
```

### Batch Operations

```bash
# List all xps repos as JSON
bun bitbucket-repos-list.ts -f xps --format json > xps-repos.json

# Create PRs from a script
cat repos.txt | while read repo; do
  bun bitbucket-pr-create.ts -r "$repo" -t "Update dependencies" -s renovate/deps
done
```

## 🔒 Security

- Never commit your `config.json` file
- Use app passwords, not your account password
- Limit app password permissions to only what's needed
- Credentials are only stored locally in your `config.json` file