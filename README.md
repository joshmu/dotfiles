# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a personal dotfiles repository for macOS system configuration, shell customization, and development tooling. It uses **dotbot** for automated symlink management and installation. The repository includes shell configurations (zsh, bash), editor configs (nvim, vim), terminal emulators (kitty, ghostty, iTerm2), git tools (lazygit), and custom scripts for automation.

## Key Commands

### Installation & Setup
```bash
# Install/update all dotfiles using dotbot
./install

# Install packages via Homebrew (manages formulae, casks, and VSCode extensions)
brew bundle install --file=Brewfile

# Update Brewfile with current installed packages
brew bundle dump --force --file=Brewfile
```

### Development Tools
```bash
# Git worktree automation - create/manage worktrees interactively
gw                                    # alias for worktree.ts
~/dotfiles/scripts/worktree.ts

# Check for merge conflicts before creating PR
merge-check                           # runs check-merge-conflicts.sh

# Open PR with custom target branch (supports GitHub/Bitbucket)
open-pr-with-target <target-branch>  # e.g., open-pr-with-target develop

# Update all git repos in current directory
update-repos                          # runs update-repos.ts

# Package management - automatically detected from lock files
pnpm install                          # preferred for new repos
npm install / yarn install            # based on lock file present
```

### Custom Scripts (executable TypeScript with Bun)
All scripts in `scripts/` are TypeScript files using Bun runtime with shebang `#!/usr/bin/env bun`:
- `worktree.ts` - Interactive git worktree management
- `update-repos.ts` - Batch update git repositories
- `repo-pack.ts` - Repository packaging utility
- `yt-transcript.ts` - YouTube transcript extraction
- `open-pr-with-target.sh` - PR creation with custom target branch
- `check-merge-conflicts.sh` - Pre-PR merge conflict checker
- `notify-me` - System notification utility (used with `pbcopy` for clipboard)

## Architecture & Patterns

### Symlink Management
The repository uses **dotbot** (git submodule at `./dotbot/`) with configuration in `install.conf.yaml`. Running `./install` creates symlinks from home directory to this repo:
- Shell configs: `~/.zshrc`, `~/.aliases`, `~/.zprofile`, `~/.bashrc`
- Custom scripts: `~/dotfiles/bin/` (added to PATH in `.zshrc`)
- Editor configs: `~/.config/nvim`, `~/.vimrc`, `~/.tmux.conf`
- Git: `~/.gitconfig`, `~/Library/Application Support/lazygit/config.yml`
- Terminal: `~/.config/kitty/`, ghostty config
- Application configs: Claude Desktop, Cursor, Codex, Obsidian snippets

### Shell Configuration
- **Primary shell**: zsh with oh-my-posh prompt (config: `oh-my-mu.json`)
- **Aliases**: Defined in `.aliases` (sourced by `.zshrc`)
- **Private aliases**: Optionally loaded from `~/.aliases_private` (not in repo)
- **Package completions**: `completion-for-pnpm.zsh` for pnpm shell completions

### Lazygit Customization
Custom keybindings in `lazygit-config.yml`:
- `W` - Commit with `--no-verify` flag
- `C` - Generate commit message with Claude Code (pipes staged diff to claude CLI)
- `O` - Open PR with custom target branch (uses selected branch, not checked out branch)

### Git Workflow Tools
- **Delta** integration for diff viewing with hyperlinks
- **Worktree automation**: Interactive script manages parallel branch work in separate directories
- **PR creation**: Detects GitHub/Bitbucket from remote URL, auto-pushes branch if needed
- **Merge conflict checking**: Pre-PR validation to catch conflicts early

### Terminal & Editor
- **Neovim**: Primary editor (`nvim/` directory with Lua config, lazy.nvim plugin manager)
- **Terminal emulators**: Ghostty (primary), Kitty (configured), iTerm2 (configured)
- **Tmux**: Terminal multiplexer config at `tmux.conf`
- **nvimpager**: Configured as `$PAGER` for git and man pages

### Tool Integrations
- **Brewfile**: Declarative package management (brew formulae, casks, VSCode extensions)
- **Claude Desktop**: Config at `claude_desktop_config.json`
- **Cursor**: MCP config at `cursor/mcp.json`, rules in `cursor/rules/`
- **Obsidian**: Vim bindings and snippets symlinked to vault

## Common Patterns

### File Deletion
Use `trash` command instead of `rm` to safely delete files (moves to Trash).

### Clipboard Operations
Use `pbcopy` to pipe content to macOS clipboard:
```bash
cat file.txt | pbcopy
echo "text" | pbcopy
```

### Remote Detection
Scripts detect Git hosting platform (GitHub/Bitbucket/GitLab) via:
```bash
git remote -v  # inspect 'origin' URL
```

### Custom Aliases
Key aliases from `.aliases`:
- `g`, `lg`, `gg` → `lazygit`
- `v`, `nv` → `nvim`
- `t` → `tmux`
- `c`, `cl` → `clear`
- `cc`, `cld` → `claude`
- `gw` → git worktree automation
- `notify-me` → system notifications

### Notifications
System notifications via AppleScript wrapper in `scripts/notify-me` or shell function:
```bash
notify "message text"  # function defined in .aliases
```

### AI Integrations
- Claude Code CLI: `claude`, `claude --continue`, `claude-trace`
- AI commit messages: `C` in lazygit (uses Claude Code CLI with haiku model)
- Ollama integration: `aio`/`ai-start` to launch local LLM with web UI

## Important Notes

- **Brewfile management**: Always use `brew bundle dump` to update Brewfile after installing new packages
- **Dotbot symlinks**: Changes to files in this repo immediately affect system (files are symlinked, not copied)
- **Script execution**: TypeScript scripts use Bun runtime (require `bun` installed via Homebrew)
- **Package manager selection**: Prefer pnpm for new projects; detect from lock files otherwise
- **Cursor**: Opens files from CLI with: `cursor -g path/to/file:line[:column]`
- **Current date**: Use `date` command instead of assuming; never hardcode dates
