export PS1="MU - \W: "

### Aliases
[ -f ~/.aliases_private ] && source ~/.aliases_private

### Added by the Heroku Toolbelt
export PATH="/usr/local/heroku/bin:$PATH"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

[ -f ~/.fzf.bash ] && source ~/.fzf.bash
PATH=~/.console-ninja/.bin:$PATH
. "$HOME/.cargo/env"

. "$HOME/.local/bin/env"

# Added by LM Studio CLI (lms)
export PATH="$PATH:/Users/joshmu/.lmstudio/bin"
# End of LM Studio CLI section

