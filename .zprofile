alias cafode='caffeinate -d node'
alias fox='caffeinate -d node ~/Google\ Drive/scout/fox/index.js'
alias mod='node ~/Google\ Drive/CCC/CCC\ HELPERS/morphCSV/mod.js'
alias trk='node ~/Google\ Drive/CCC/CCC\ HELPERS/morphCSV/trk.js'
alias restartaudio='sudo killall coreaudiod'
alias mongod='mongod --dbpath /System/Volumes/Data/data/db'
alias mukill='pkill -a -i'
alias pip=/usr/local/bin/pip3
alias vim=nvim
alias nv=nvim


### YOUTUBE-DL
alias yt-playlist="youtube-dl -o '%(playlist)s/%(playlist_index)s - %(title)s.%(ext)s' -f 'bestvideo[ext=mp4]'"
alias yt-video="youtube-dl -o '%(title)s.%(ext)s' -f 'bestvideo[ext=mp4]'"
alias yt-audio="youtube-dl -o '%(title)s.%(ext)s' -f 'bestaudio[ext=m4a]'"

### CONFIG
alias vimconf="nvim ~/.vimrc"
alias hypconf="nvim ~/.hyper.js"
alias gitconf="nvim ~/.gitconfig"

### GIT
alias gadd="git add ."
alias gcom='git commit -m '
alias gcam='git commit -am '
alias gpom='git push origin master'
alias gphm='git push heroku master'
alias gphm='git push heroku master'
alias gpdm='git push dreamhost master'
alias glog='git log'
alias gitopen='open $(git config remote.origin.url)'
alias gpristine='git reset --hard && git clean -df'

### Added for Homebrew & Vim ###
# export PATH="/usr/local/bin:$PATH"
# export PATH="$HOME/.npm-packages/bin:$PATH"
# alias vi='/usr/local/bin/vim'
# alias vim='/usr/local/bin/vim'

### Added by the Heroku Toolbelt
export PATH="/usr/local/heroku/bin:$PATH"

### MYSQL
export PATH=$PATH:/usr/local/mysql/bin

### Added by Me for bash script inits
export PATH="$HOME/bin:$PATH"

[[ -s "$HOME/.rvm/scripts/rvm" ]] && source "$HOME/.rvm/scripts/rvm" # Load RVM into a shell session *as a function*
