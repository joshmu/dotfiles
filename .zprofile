# IMPORT DEV WORK
source ~/.zprofile_secret

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
# alias vim=nvim
alias nv=nvim
alias v=nvim
alias localip='ipconfig getifaddr en0'
alias plc='npx plop component'
alias rm=trash
alias brew='arch -x86_64 brew'
alias hidedesktop='defaults write com.apple.finder CreateDesktop -bool false; killall Finder'
alias showdesktop='defaults write com.apple.finder CreateDesktop -bool true; killall Finder'
alias cl=clear
alias publicSshKey='pbcopy < ~/.ssh/id_rsa.pub'
alias compilekeyboard='qmk compile -kb dztech/dz60rgb_ansi/v2 -km joshmu'
alias disable-keyrepeat='defaults write -g ApplePressAndHoldEnabled -bool'
alias chrome-cors='open -a Google\ Chrome --args --disable-web-security --user-data-dir="/Users/joshmu/Library/ApplicationSupport/Google/Chrome"'
alias zen='/Users/joshmu/Desktop/code/projects/zen/src/main.js'
alias tre='tree --prune -P '
alias ls='colorls'
alias ios-runtimes='xcrun simctl list runtimes'

function notify() {
    local msg="$1"
    osascript -e "display notification \"$msg\"";
}

# ----------------------
# DEBUG
# ----------------------
alias debug-chrome="/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome  --remote-debugging-port=9222 --user-data-dir=remote-debug-profile"
alias debug-edge="/Applications/Microsoft\ Edge.app/Contents/MacOS/Microsoft\ Edge --remote-debugging-port=9222 --user-data-dir=remote-debug-profile"
alias test-cov-mod="yarn test:coverage -- --collectCoverageFrom=**/account-details/**/*.js"

# ----------------------
# AEM
# ----------------------
alias aemauthor='java -jar aem-author-p4502.jar'
export COMMERCE_ENDPOINT="https://mcstaging.breville.com/graphql"
alias aem-proxy="npx local-cors-proxy --proxyUrl https://mcstaging.breville.com --port 3002 --proxyPartial ''"
alias sdserver="ssh -N augw-tunnel"

alias mvn-root="mvn clean install -PautoInstallSinglePackage"
alias mvn-child="mvn clean install -PautoInstallBundle"
alias mvn-i="mvn clean install -PautoInstallSinglePackage -f /Users/joshmu/work/breville/source/breville-aem-brands"
alias mvn-i-fe="mvn clean install -PautoInstallBundle -f /Users/joshmu/work/breville/source/breville-aem-brands/ui.frontend"
alias mvn-i-breville="mvn clean install -PautoInstallBundle -f /Users/joshmu/work/breville/source/breville-aem-brands/ui.frontend-breville"
alias mvn-i-beanz="mvn clean install -PautoInstallBundle -f /Users/joshmu/work/breville/source/breville-aem-brands/ui.frontend-beanz"
alias mvn-i-ui="mvn clean install -PautoInstallBundle -f /Users/joshmu/work/breville/source/breville-aem-brands/ui.apps"

# ----------------------
# DEV
# ----------------------

function ys() { yarn start:$1; }

# ----------------------
# FUNCTIONS
# ----------------------
function getportpid() { lsof -i tcp:"$1"; }
# check how to pass arg to function then convert this to func
alias killport='sudo kill -9 $(sudo lsof -t -i:4052)'
alias killjava='killall -9 java'


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
alias vconf="nvim ~/.vimrc"
alias zconf="nvim ~/.zprofile"
alias zrconf="nvim ~/.zshrc"
alias hypconf="nvim ~/.hyper.js"
alias gconf="nvim ~/.gitconfig"

# ----------------------
# GIT ALIASES
# ----------------------
alias g='git'
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
alias glo="git log --first-parent --graph --pretty=format:'%C(auto,yellow)%h%C(auto,magenta)% G? %C(auto,blue)%>(12,trunc)%ad %C(auto,green)%<(7,trunc)%aN %C(auto,reset)%s%C(auto,red)% gD% D' --abbrev-commit --date=relative"
alias gfh='git log --full-history --'
# alias gitopen='open $(git config remote.origin.url)'
# GIT OPEN Plugin
alias gitopen='git open'
alias gpristine='git reset --hard && git clean -df'
alias glog='git log --oneline --decorate --graph'
alias gs='echo ""; echo "*********************************************"; echo -e "   DO NOT FORGET TO PULL BEFORE COMMITTING"; echo "*********************************************"; echo ""; git status'
alias gfm='git fetch && git merge'
alias gh='g hs | fzf +s'

# ----------------------
# PATHS
# ----------------------

### Added by the Heroku Toolbelt
export PATH="/usr/local/heroku/bin:$PATH"

### MYSQL
export PATH=$PATH:/usr/local/mysql/bin

### Added by Me for bash script inits
export PATH="$HOME/bin:$PATH"



