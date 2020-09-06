# ----------------------
# ALIASES
# ----------------------
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
alias localip="ipconfig getifaddr en0"

# ----------------------
# FUNCTIONS
# ----------------------
function getportpid() { lsof -i tcp:"$1"; }

# ----------------------
# YOUTUBE-DL
# ----------------------
alias yt-playlist="youtube-dl -o '%(playlist)s/%(playlist_index)s - %(title)s.%(ext)s' -f 'bestvideo[ext=mp4]'"
alias yt-video="youtube-dl -o '%(title)s.%(ext)s' -f 'bestvideo[ext=mp4]'"
alias yt-audio="youtube-dl -o '%(title)s.%(ext)s' -f 'bestaudio[ext=m4a]'"
alias yt-mp3="youtube-dl -o '%(title)s.%(ext)s' -i --extract-audio --audio-format mp3 --audio-quality 0"

# ----------------------
# CONFIG
# ----------------------
alias vimconf="nvim ~/.vimrc"
alias hypconf="nvim ~/.hyper.js"
alias gitconf="nvim ~/.gitconfig"

# ----------------------
# GIT ALIASES
# ----------------------
alias ga='git add'
alias gaa='git add .'
alias gaaa='git add -A'
alias gc='git commit'
alias gcm='git commit -m'
alias gcam='git commit -am'
alias gd='git diff'
alias gi='git init'
alias gl='git log'
alias gph='git push'
alias gpl='git pull'
alias gss='git status -s'
alias gpom='git push origin master'
alias gphm='git push heroku master'
alias gpdm='git push dreamhost master'
alias gfh='git log --full-history --'
alias gitopen='open $(git config remote.origin.url)'
alias gpristine='git reset --hard && git clean -df'
alias glog='git log --oneline --decorate --graph'
alias gs='echo ""; echo "*********************************************"; echo -e "   DO NOT FORGET TO PULL BEFORE COMMITTING"; echo "*********************************************"; echo ""; git status'

# ----------------------
# PATHS
# ----------------------

### Added by the Heroku Toolbelt
export PATH="/usr/local/heroku/bin:$PATH"

### MYSQL
export PATH=$PATH:/usr/local/mysql/bin

### Added by Me for bash script inits
export PATH="$HOME/bin:$PATH"

[[ -s "$HOME/.rvm/scripts/rvm" ]] && source "$HOME/.rvm/scripts/rvm" # Load RVM into a shell session *as a function*
