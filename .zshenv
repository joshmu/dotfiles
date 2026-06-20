[ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"

# Disable Homebrew analytics on all machines
export HOMEBREW_NO_ANALYTICS=1

# gws (Google Workspace CLI): force file-backed credential storage. The default
# macOS keychain backend needs an interactive UI to unlock, so it fails with
# "User interaction is not allowed" from non-interactive shells (Claude agents,
# cron-spawned sentinel) — and on that failure gws DELETES the encrypted creds.
# File backend stores creds under ~/.config/gws so headless automation can read them.
export GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND=file

export EDITOR="nvim"
export VISUAL="nvim"

export PERSONAL_VAULT="$HOME/vault"

# agent-observability hook path — the ~/.claude settings.json hooks reference it as
# ${AGENT_OBSERVABILITY_PATH}/hooks/*.ts, so if this is empty those hooks resolve to
# /hooks/*.ts and fail. Resolution order:
#   1. ~/.zshenv.local — optional per-machine override. Gitignored and NOT in this
#      repo, so it never syncs; each machine writes its own. Needed only when the repo
#      sits off the default path, e.g.:
#        export AGENT_OBSERVABILITY_PATH="$HOME/code/agent-observability"
#   2. the :- default below ($HOME/Desktop/code/agent-observability).
# Resolved at SHELL LAUNCH — a long-lived process (e.g. Claude's shared cc-daemon that
# spawns agents-view background agents) started before this was wired keeps a stale or
# empty value and only picks up the correct one after a full relaunch.
[ -f "$HOME/.zshenv.local" ] && source "$HOME/.zshenv.local"
export AGENT_OBSERVABILITY_PATH="${AGENT_OBSERVABILITY_PATH:-$HOME/Desktop/code/agent-observability}"

# oh-my-posh: pin the theme directly so the prompt never depends on the session->config cache
# in ~/.cache/oh-my-posh (which silently falls back to the default theme if the cached init was
# generated before the ~/.oh-my-mu.json symlink existed, or if that cache is cleared).
export POSH_THEME="$HOME/.oh-my-mu.json"

# Per-user prompt colour: hash `whoami` to a stable colour (shared with the tmux
# left block via the same script) for the oh-my-posh username segment. Set here
# next to POSH_THEME so it's present whenever the prompt renders, not dependent on
# .zshrc ordering. Interactive-only — the prompt never renders in scripts, so skip
# the subprocess cost there.
if [[ -o interactive ]]; then
  export POSH_USER_COLOR="$(~/dotfiles/scripts/user-hash-color.sh)"
fi

# uv
export PATH="$HOME/.local/bin:$PATH"

# fnm - basic env for non-interactive shells (Claude agents, scripts, CI)
# --use-on-cd required: v1.39.0 applies version at init time only when this flag is present
# chpwd hook is harmless in non-interactive shells (never fires)
if command -v fnm &>/dev/null; then
  eval "$(fnm env --use-on-cd --version-file-strategy=recursive --log-level=quiet --shell zsh)"
fi
