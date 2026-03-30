. "$HOME/.cargo/env"

export EDITOR="nvim"
export VISUAL="nvim"

# uv
export PATH="/Users/joshmu/.local/bin:$PATH"

# fnm - basic env for non-interactive shells (Claude agents, scripts, CI)
# --use-on-cd required: v1.39.0 applies version at init time only when this flag is present
# chpwd hook is harmless in non-interactive shells (never fires)
if command -v fnm &>/dev/null; then
  eval "$(fnm env --use-on-cd --version-file-strategy=recursive --shell zsh)"
fi
