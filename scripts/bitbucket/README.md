# Bitbucket CLI Tools

Bun-based command-line tools for interacting with Bitbucket repositories, pull requests, and more.

## ✨ Features

- **Native Draft PR Support**: Create and manage draft pull requests using Bitbucket's native draft feature
- **Markdown Descriptions**: Full support for markdown-formatted PR descriptions
- **PR Templates**: Automatically load and use PR templates from standard locations
- **Enhanced Error Handling**: Automatic retry logic for rate limits and transient failures
- **Advanced PR Filtering**: Filter by state, draft status, author, search text, and more
- **Flexible Sorting**: Sort PRs by creation date, update date, or title
- **Interactive & CLI Modes**: Use interactively or with command-line arguments
- **Non-Interactive Mode**: Use `--non-interactive` flag for automation and CI/CD
- **Git Integration**: Automatically detects current repository and branch

## Docs

- [atlassian - api docs](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-group-pullrequests)

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

Create new pull requests interactively or with command-line arguments. Now with **native draft PR support** and **markdown descriptions**!

```bash
# Interactive mode (prompts for missing info)
bun bitbucket-pr-create.ts

# Full command-line mode
bun bitbucket-pr-create.ts \
  -t "Add new feature" \
  -d "This PR adds the new feature X" \
  -s feature/new-feature \
  -b develop

# Create a draft PR (uses native Bitbucket draft feature)
bun bitbucket-pr-create.ts -t "WIP: New feature" --draft

# Create PR with markdown description
bun bitbucket-pr-create.ts -t "Feature" -d "## Changes\n- Added new API\n- Fixed bug" --markdown

# Create PR using template
bun bitbucket-pr-create.ts -t "Add feature" --template

# Create PR without template
bun bitbucket-pr-create.ts -t "Quick fix" --no-template
```

**Options:**
- `-t, --title` - PR title (required)
- `-d, --description` - PR description
- `-s, --source` - Source branch (defaults to current branch)
- `-b, --destination` - Destination branch (defaults to master)
- `-r, --repo` - Repository slug (defaults to current repo)
- `-w, --workspace` - Workspace (defaults to env config)
- `--close-source-branch` - Close source branch after merge
- `--draft` - Create as draft PR (native Bitbucket feature)
- `--markdown` - Enable markdown formatting for description
- `--template` - Use PR template if available (default: true)
- `--no-template` - Don't use PR template
- `-n, --non-interactive` - Run without prompts, use defaults

### 2. Update Pull Request (`bitbucket-pr-update.ts`)

Update existing pull requests with support for **draft status changes** and **markdown descriptions**.

```bash
# Update PR title
bun bitbucket-pr-update.ts -p 123 -t "Updated: Add new feature"

# Update multiple fields
bun bitbucket-pr-update.ts -p 123 -t "New title" -d "New description" -b develop

# Convert PR to draft
bun bitbucket-pr-update.ts -p 123 --convert-to-draft

# Mark draft PR as ready for review
bun bitbucket-pr-update.ts -p 123 --ready-for-review

# Update with markdown description
bun bitbucket-pr-update.ts -p 123 -d "## Updated\n- Fixed issues" --markdown

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
- `--convert-to-draft` - Convert PR to draft
- `--ready-for-review` - Mark draft PR as ready for review
- `--markdown` - Enable markdown formatting for description
- `-n, --non-interactive` - Run without prompts, skip optional fields

### 3. List Pull Requests (`bitbucket-pr-list.ts`)

List pull requests with **advanced filtering** and **sorting capabilities**.

```bash
# List all open PRs
bun bitbucket-pr-list.ts

# List only draft PRs
bun bitbucket-pr-list.ts --draft

# List only non-draft PRs
bun bitbucket-pr-list.ts --no-draft

# List merged PRs in JSON format
bun bitbucket-pr-list.ts -s MERGED -f json

# List PRs with custom limit
bun bitbucket-pr-list.ts -l 20

# List your own PRs
bun bitbucket-pr-list.ts --my-prs

# Filter by author
bun bitbucket-pr-list.ts -a username

# Search PRs by text
bun bitbucket-pr-list.ts --search "bug fix"

# Sort by updated date descending
bun bitbucket-pr-list.ts --sort-by updated --sort-desc
```

**Options:**
- `-r, --repo` - Repository slug (defaults to current repo)
- `-w, --workspace` - Workspace
- `-s, --state` - Filter by state: OPEN, MERGED, DECLINED, SUPERSEDED (default: OPEN)
- `--draft` - Show only draft PRs
- `--no-draft` - Show only non-draft PRs
- `-l, --limit` - Limit number of results (default: 50)
- `-f, --format` - Output format: table, json, simple (default: table)
- `-a, --author` - Filter by author username
- `--my-prs` - Show only your own PRs
- `--search` - Search PRs by title or description
- `--sort-by` - Sort by: created, updated, title (default: created)
- `--sort-desc` - Sort in descending order
- `-n, --non-interactive` - Run without prompts, fail if repo not specified

### 4. List Repositories (`bitbucket-repos-list.ts`)

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
├── bitbucket-pr-create.ts      # Create PRs (with draft & markdown support)
├── bitbucket-pr-update.ts      # Update PRs (with draft & markdown support)
├── bitbucket-pr-list.ts        # List PRs with advanced filtering
├── bitbucket-repos-list.ts     # List repos
├── lib/
│   ├── api.ts                  # Bitbucket API client (with retry logic)
│   ├── config.ts               # Configuration loader
│   ├── types.ts                # TypeScript types (enhanced)
│   └── template.ts             # PR template handling
├── config.json.example         # Example configuration
├── open-api.json               # Bitbucket API specification
└── README.md                   # This file
```

## 📝 PR Templates

The scripts support PR templates from these locations (in order of precedence):
- `.bitbucket/pull_request_template.md`
- `.github/pull_request_template.md`
- `pull_request_template.md`
- `.bitbucket/PULL_REQUEST_TEMPLATE.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `PULL_REQUEST_TEMPLATE.md`

### Template Variables

Templates can use these variables:
- `{{branch}}` or `${branch}` - Source branch name
- `{{sourceBranch}}` - Source branch name
- `{{destinationBranch}}` - Target branch name
- `{{author}}` - PR author username
- `{{date}}` - Current date (YYYY-MM-DD)
- `{{ticketNumber}}` - Extracted from branch name (e.g., JIRA-123)
- `{{title}}` - PR title

### Example Template

```markdown
## Summary
{{title}}

## Ticket
{{ticketNumber}}

## Changes
- [ ] TODO: Describe changes

## Testing
- [ ] Unit tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added where needed
```

## 🤖 Non-Interactive Mode

All scripts support a `--non-interactive` (or `-n`) flag that disables all prompts and uses defaults for unspecified values. This is essential for:
- CI/CD pipelines
- Automation scripts
- Using from Claude Code or other tools
- Batch operations

### Examples

```bash
# Create PR without any prompts
bitbucket-pr-create.ts \
  -t "Add feature" \
  -d "Description" \
  -s feature/branch \
  -r repo-name \
  --non-interactive

# Update PR without prompts
bitbucket-pr-update.ts \
  -p 123 \
  -t "New title" \
  -r repo-name \
  --non-interactive

# List PRs (fails if repo not detected)
bitbucket-pr-list.ts --non-interactive
```

### Non-Interactive Defaults
- `closeSourceBranch`: false
- `isDraft`: false (unless --draft specified)
- `useMarkdown`: true (when description provided)
- `useTemplate`: true (unless --no-template)

### Required Fields
In non-interactive mode, these fields must be provided or detected:
- Repository slug (via `-r` or git detection)
- PR title (for create)
- PR ID (for update)
- Source branch (for create, via `-s` or git detection)

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
Bitbucket has API rate limits. The scripts now include automatic retry logic:
- Automatic exponential backoff for 429 errors
- Maximum 3 retries with increasing delays
- If you still hit limits, wait a few minutes before retrying

### Branch Not Found
- Ensure the branch exists in the remote repository
- Push your local branch before creating a PR

### Draft PR Issues
- Draft PRs are a native Bitbucket feature (not just title prefixes)
- Ensure your Bitbucket instance supports draft PRs
- Check PR state with `bun bitbucket-pr-list.ts --draft`

### Markdown Formatting
- Use the `--markdown` flag when creating/updating PRs
- Bitbucket supports standard GitHub-flavored markdown
- Preview your markdown locally before submitting

## 📝 Examples

### Typical Workflow

```bash
# 1. Start work on a feature
git checkout -b feature/my-feature

# 2. Make changes and commit
git add .
git commit -m "Add my feature"
git push -u origin feature/my-feature

# 3. Create draft PR with markdown
bun bitbucket-pr-create.ts -t "Add my feature" \
  -d "## Changes\n- Added new API endpoint\n- Updated tests\n\n## TODO\n- [ ] Documentation" \
  --draft --markdown

# 4. Update PR after review and mark ready
bun bitbucket-pr-update.ts -p 123 --ready-for-review

# 5. Check PR status
bun bitbucket-pr-list.ts --draft
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
