# DOTFILES

## Repository Overview

This is a personal dotfiles repository for macOS system configuration, shell customization, and development tooling. It uses **dotbot** for automated symlink management and installation. The repository includes shell configurations (zsh, bash), editor configs (nvim, vim), terminal emulators (kitty, ghostty, iTerm2), git tools (lazygit), and custom scripts for automation.

## Key Commands

### Installation & Setup
```bash
# Install/update all dotfiles using dotbot
./install

# Install git hooks (pre-commit, commit-msg) after cloning
bash scripts/install-hooks.sh

# Install packages via Homebrew (full superset — union across all machines)
brew bundle install --file=Brewfile

# Lean machine instead: install only the minimal subset (this machine's snapshot)
brew bundle install --file=Brewfile.minimal

# Refresh the per-machine minimal snapshot (safe; never clobbers the superset)
brew bundle dump --force --file=Brewfile.minimal
```

### Fresh-machine prerequisites

These are required for a clean setup on a new machine (not handled by `./install`):

```bash
# 1. oh-my-zsh + the custom plugins referenced in .zshrc, or the shell errors on startup
RUNZSH=no CHSH=no KEEP_ZSHRC=yes sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
ZSH_CUSTOM="$HOME/.oh-my-zsh/custom"
git clone https://github.com/zsh-users/zsh-autosuggestions      "$ZSH_CUSTOM/plugins/zsh-autosuggestions"
git clone https://github.com/zsh-users/zsh-syntax-highlighting  "$ZSH_CUSTOM/plugins/zsh-syntax-highlighting"
git clone https://github.com/MichaelAquilina/zsh-you-should-use "$ZSH_CUSTOM/plugins/you-should-use"
git clone https://github.com/paulirish/git-open                 "$ZSH_CUSTOM/plugins/git-open"
git clone https://github.com/marlonrichert/zsh-autocomplete     "$ZSH_CUSTOM/plugins/zsh-autocomplete"

# 2. Per-machine git signing key (NOT tracked — varies per machine)
cp gitconfig.local.example ~/.gitconfig.local
#   then edit ~/.gitconfig.local so user.signingkey points at THIS machine's
#   public signing key (e.g. ~/.ssh/<signing-key>.pub), and register that key on
#   GitHub as a Signing key. The shared `gitconfig` includes ~/.gitconfig.local.

# 3. Local allowed signers (for `git log --show-signature`; not tracked)
#   ~/.config/git/allowed_signers — one line per identity, e.g.:
#   you@example.com namespaces="git" ssh-ed25519 AAAA... <comment>

# 4. Curated macOS defaults (key-repeat / press-and-hold, Finder, Dock, trackpad)
bash scripts/macos-defaults.sh
```

> **Note:** `HOMEBREW_NO_ANALYTICS=1` is exported in `.zshenv`, so Homebrew analytics
> are disabled on every machine automatically.

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

# Inspect a GitHub token's privileges (read-only: scopes, expiration, capabilities)
check-gh-token <token>                # also reads $GH_TOKEN, $GITHUB_TOKEN, or `gh auth token`
echo "$TOKEN" | check-gh-token --stdin

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
- `check-gh-token.sh` - Inspect GitHub token scopes/permissions/expiration (read-only, exposed via `bin/check-gh-token`)
- `notify-me` - System notification utility
- `bitbucket/` - Bitbucket CLI tools (`bb-repos`, `bb-pr-create`, `bb-pr-update`)
- `sonar/` - SonarCloud tools (`sonar-verify`, `sonar-scan`, `sonar-compare`)
- `claude-monitor/` - Claude session monitoring (`cm` alias)
- `gen-img/gen-img.ts` - AI image generation via Replicate (`gen-img` alias)
- `telegram/` - Telegram notifications

## Architecture & Patterns

### Symlink Management
The repository uses **dotbot** (git submodule at `./dotbot/`) with configuration in `install.conf.yaml`. Running `./install` creates symlinks from home directory to this repo:
- Shell configs: `~/.zshrc`, `~/.aliases`, `~/.zprofile`, `~/.bashrc`
- Custom scripts: `~/dotfiles/bin/` (added to PATH in `.zshrc`)
- Editor configs: `~/.config/nvim`, `~/.vimrc`, `~/.tmux.conf`
- Git: `~/.gitconfig`, `~/Library/Application Support/lazygit/config.yml`
- Terminal: `~/.config/kitty/`, ghostty config
- Application configs: Claude Desktop, Cursor, Obsidian snippets

### Shell Configuration
- **Primary shell**: zsh with oh-my-posh prompt (config: `oh-my-mu.json`)
- **Aliases**: Defined in `.aliases` (sourced by `.zshrc`)
- **Private aliases**: Optionally loaded from `~/.aliases_private` (not in repo)
- **Package completions**: `completion-for-pnpm.zsh` for pnpm shell completions
- **Per-user whoami colour**: `scripts/user-hash-color.sh` hashes `whoami` (cksum) into a stable colour from a dark palette deliberately distinct from Dracula's bright segments, so each account (e.g. work `Josh.Mu` vs personal `joshmu`) gets its own identity badge. Consumed in two places: the oh-my-posh username segment reads `POSH_USER_COLOR` (exported from `.zshenv`), and the tmux left block is recoloured by `scripts/tmux-user-block.sh` (run via `run-shell` after tpm in `tmux.conf`, overriding Dracula's hardcoded green).
- **oh-my-posh cache gotcha**: the prompt loads through `cached_eval` (`zsh/eval-cache.zsh`), which caches `oh-my-posh init`. The cached init bakes a **fixed `POSH_SESSION_ID`**, and `print primary` resolves the theme from the per-session config cache (NOT from `POSH_THEME` at render time — that's ignored). So editing `oh-my-mu.json` does nothing until the init regenerates (new session id → fresh cache). `cached_eval` takes an optional watch-file and the oh-my-posh call passes `~/.oh-my-mu.json`, so theme edits auto-apply on the next shell. Do NOT run `oh-my-posh cache clear` alone — it drops the config and the prompt falls back to the default theme until the init is regenerated. Manual full reset: `trash ~/.cache/zsh/oh-my-posh.zsh && oh-my-posh cache clear && exec zsh`.

### Lazygit Customization
Custom keybindings in `lazygit-config.yml`:
- `W` - Commit with `--no-verify` flag
- `C` - Generate commit message with Claude Code (haiku model, pipes staged diff)
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
- **Brewfile**: Declarative package management (brew formulae, casks, VSCode extensions). Two files:
  - `Brewfile` — full **superset** (union across all machines), hand-curated. Add packages here manually; do **not** `brew bundle dump` over it (any single machine has only a subset, so a dump would delete everything not installed locally).
  - `Brewfile.minimal` — lean **subset** snapshot of a single machine (CLI dev toolchain incl. `shellcheck`, `fnm`, `bun`, `gitleaks`, etc.). Regenerate with `brew bundle dump --force --file=Brewfile.minimal`.
- **Claude Desktop**: Config at `claude_desktop_config.json`
- **Cursor**: MCP config at `cursor/mcp.json`
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
- `y`, `yz` → yazi file explorer (changes cwd on exit)
- `awsp` → AWS profile switcher (fzf-based)
- `cm` → claude-monitor session dashboard
- `gen-img` → AI image generation
- `bb-*` → Bitbucket CLI tools
- `sonar-*` → SonarCloud tools
- `check-gh-token` → GitHub token privilege inspector (read-only)

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

- **Brewfile management**: Edit the full `Brewfile` (superset) by hand. Never `brew bundle dump` over it — a single machine holds only a subset, so a dump would drop everything not installed locally. `brew bundle dump --force --file=Brewfile.minimal` only ever targets the per-machine minimal snapshot.
- **Dotbot symlinks**: Changes to files in this repo immediately affect system (files are symlinked, not copied)
- **Script execution**: TypeScript scripts use Bun runtime (require `bun` installed via Homebrew)
- **Package manager selection**: Prefer pnpm for new projects; detect from lock files otherwise
- **Cursor**: Opens files from CLI with: `cursor -g path/to/file:line[:column]`
- **Current date**: Use `date` command instead of assuming; never hardcode dates
