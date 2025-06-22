alias localserver='cd ~/../../Applications/XAMPP/htdocs/server'
alias fb='fb-messenger-cli'
alias bashreload='source ~/.bash_profile'
alias sshrpi='ssh pi@joshmu.ddns.net -p 3332'
alias mugo='caffeinate -d node'
alias restartaudio='sudo killall coreaudiod'
alias gitopen='open $(git config remote.origin.url)'
alias python='/usr/local/bin/python3'
alias pip=/usr/local/bin/pip3

if [ -f ~/.bashrc ]; then
	source ~/.bashrc
fi

### Use vim in bash terminal
set -o vi

### Added for Homebrew & Vim ###
export PATH="/usr/local/bin:$PATH"
export PATH="$HOME/.npm-packages/bin:$PATH"
alias vi='/usr/local/bin/vim'
alias vim='/usr/local/bin/vim'

### Added by the Heroku Toolbelt
export PATH="/usr/local/heroku/bin:$PATH"

### Added by Josh for bash script inits
export PATH="$HOME/bin:$PATH"

#THIS MUST BE AT THE END OF THE FILE FOR SDKMAN TO WORK!!!
export SDKMAN_DIR="/Users/joshmu/.sdkman"
[[ -s "/Users/joshmu/.sdkman/bin/sdkman-init.sh" ]] && source "/Users/joshmu/.sdkman/bin/sdkman-init.sh"

complete -C /opt/homebrew/bin/terraform terraform
. "$HOME/.cargo/env"

. "$HOME/.local/bin/env"

# Added by LM Studio CLI (lms)
export PATH="$PATH:/Users/joshmu/.lmstudio/bin"
# End of LM Studio CLI section

