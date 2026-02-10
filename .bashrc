export PS1="MU - \W: "

### Aliases
[ -f ~/.aliases_private ] && source ~/.aliases_private

### Added by the Heroku Toolbelt
export PATH="/usr/local/heroku/bin:$PATH"

# fnm - Fast Node Manager (auto-switches on cd, reads .nvmrc files)
eval "$(fnm env --use-on-cd --version-file-strategy=recursive --log-level=quiet --shell bash)"

[ -f ~/.fzf.bash ] && source ~/.fzf.bash

. "$HOME/.cargo/env"

. "$HOME/.local/bin/env"

# Added by LM Studio CLI (lms)
export PATH="$PATH:/Users/joshmu/.lmstudio/bin"
# End of LM Studio CLI section

