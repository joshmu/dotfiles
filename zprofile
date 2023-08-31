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
#alias pip=/usr/local/bin/pip3
alias vim=nvim
alias nv=nvim
alias v=nvim
alias t=tmux
alias localip='ipconfig getifaddr en0'
alias plc='npx plop component'
alias rm=trash
#alias brew='arch -x86_64 brew'
alias hidedesktop='defaults write com.apple.finder CreateDesktop -bool false; killall Finder'
alias showdesktop='defaults write com.apple.finder CreateDesktop -bool true; killall Finder'
alias cl=clear
alias publicSshKey='pbcopy < ~/.ssh/id_rsa.pub'
alias compilekeyboard='qmk compile -kb dztech/dz60rgb_ansi/v2 -km joshmu'
alias disable-keyrepeat='defaults write -g ApplePressAndHoldEnabled -bool'
alias chrome-cors='open -a Google\ Chrome --args --disable-web-security --user-data-dir="/Users/joshmu/Library/ApplicationSupport/Google/Chrome"'
alias zen='/Users/joshmu/Desktop/code/projects/zen/src/main.js'
alias tre='tree --prune -P '
alias tree='tree -F '
# alias ls='ls -F --color=auto'
alias ls='colorls'
alias ios-runtimes='xcrun simctl list runtimes'
alias node-process='node -p "process.arch"'
alias remove-mail-logs='sudo rm /var/mail/joshmu'
alias yt='yt-dlp --merge-output-format mp4'
alias npm-default-registry='npm config set registry https://registry.npmjs.com'
alias pgpt='(cd /Users/joshmu/Desktop/code/projects/privateGPT && python privateGPT.py)'
alias dep='npx qnm match'

function notify() {
    local msg="$1"
    osascript -e "display notification \"$msg\"";
}

# grep from current file and open in vscode
function r() {
    local pattern="$1"
    rg "$1" --smart-case --vimgrep --color ansi | fzf --ansi | cut -f 1 -d ' ' | sed 's/.$//' | xargs -I '{}' code --goto '{}'
}


# ----------------------
# DEBUG
# ----------------------
alias debug-chrome="/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome  --remote-debugging-port=9222 --user-data-dir=remote-debug-profile"
alias debug-edge="/Applications/Microsoft\ Edge.app/Contents/MacOS/Microsoft\ Edge --remote-debugging-port=9222 --user-data-dir=remote-debug-profile"

function cov() {
    local pattern="$1"
    yarn test:coverage -- --collectCoverageFrom=$1
}

# ----------------------
# AEM
# ----------------------
alias aemauthor='java -jar aem-author-p4502.jar'
export COMMERCE_ENDPOINT="https://mcstaging.breville.com/graphql"
alias aem-proxy="npx local-cors-proxy --proxyUrl https://mcstaging.breville.com --port 3002 --proxyPartial ''"
alias sdserver="ssh -N augw-tunnel"

#alias python="usr/local/bin/python3"
alias python="/Library/Frameworks/Python.framework/Versions/3.11/bin/python3"

alias aem-auth-deploy="~/bin/aem-tools-macos deploy -L yes -c ${AEM_CONF} -f $*"
alias aem-quick-deploy="(cd core && mvn clean install -P fast) && (cd ui.apps && mvn clean install) && (cd all && mvn clean install) && aem-auth-deploy all/target/breville-aem-brands.all-1.0.0-SNAPSHOT.zip"

alias mvn-root="mvn clean install -PautoInstallSinglePackage"
alias mvn-child="mvn clean install -PautoInstallBundle"
alias mvn-i="mvn clean install -PautoInstallSinglePackage -f /Users/joshmu/work/breville/source/breville-aem-brands"
alias mvn-i-fe="mvn clean install -PautoInstallBundle -f /Users/joshmu/work/breville/source/breville-aem-brands/ui.frontend"
alias mvn-i-breville="mvn clean install -PautoInstallBundle -f /Users/joshmu/work/breville/source/breville-aem-brands/ui.frontend-breville"
alias mvn-i-beanz="mvn clean install -PautoInstallBundle -f /Users/joshmu/work/breville/source/breville-aem-brands/ui.frontend-beanz"

alias mvn-i-core="mvn clean install -P fast -f /Users/joshmu/work/breville/source/breville-aem-brands/core"
alias mvn-i-ui="mvn clean install -f /Users/joshmu/work/breville/source/breville-aem-brands/ui.apps"
alias mvn-i-all="mvn clean install -f /Users/joshmu/work/breville/source/breville-aem-brands/all"

# ----------------------
# DEV
# ----------------------

# alias aws='docker run --rm -it public.ecr.aws/aws-cli/aws-cli'
export AWS_DEFAULT_REGION=us-west-2
alias aws-resource-policies="aws logs describe-resource-policies"
alias aws-delete-resource-policy="aws logs delete-resource-policy --policy-name"

alias jenkins="aws ssm start-session --target i-01ed64d48bef70275 --document-name AWS-StartPortForwardingSession --parameters "localPortNumber=8080,portNumber=8080" --region us-west-2"
alias y=yarn
function ys() { yarn start:$1; }

# https://developers.cloudflare.com/cache/about/default-cache-behavior/
function cf-cache-check() {
  curl -svo /dev/null "$1" 2>&1 | grep -i 'cf-cache-status'
}

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
alias tmuxconf="nvim ~/.tmux.conf"

# ----------------------
# GIT ALIASES
# ----------------------
alias g='git'
alias lg='lazygit'
alias ga='git add'
alias gaa='git add .'
alias gaaa='git add -A'
alias gc='git commit'
alias gcm='git commit -m'
alias gcam='git commit -am'
alias gd='git diff'
alias gi='git init'
alias gl='git fzf'
alias gph='git push'
alias gpl='git pull'
alias gch='git checkout'
alias gf='git fetch'
alias gss='git status -s'
alias gpom='git push origin master'
alias gphm='git push heroku master'
alias gpdm='git push dreamhost master'
alias glo="git log --first-parent --graph --pretty=format:'%C(auto,yellow)%h%C(auto,magenta)% G? %C(auto,blue)%>(12,trunc)%ad %C(auto,green)%<(7,trunc)%aN %C(auto,reset)%s%C(auto,red)% gD% D' --abbrev-commit --date=relative"
alias gfh='git log --full-history --'
# alias gitopen='open $(git config remote.origin.url)'
# GIT OPEN Plugin
alias gitopen='git open'
alias go='git open'
alias gpristine='git reset --hard && git clean -df'
alias glog='git log --oneline --decorate --graph'
alias gldiff='git log --follow --oneline -p --'
alias gs='git status'
alias gfm='git fetch && git merge'
alias gb-current='g rev-parse --abbrev-ref HEAD'
alias gb="git for-each-ref --count=15 --sort=committerdate refs/heads/ --format='%(refname:short)' | fzf | pbcopy"
function gdelta() { 
  local main=${1:-'qa'}
  local develop=${2:-'develop'}
  git log origin/"$develop"..origin/"$main" | rg -v "Merge|fix|xps|revert|resolution|resolved|bitbucket"
}

function smart_diff() {
  # Check if there are changes in the working directory or the staging area
  if git diff --quiet && git diff --cached --quiet; then
    # If no changes, then show the diff between the last two commits
    git diff HEAD^..HEAD
  else
    # If there are changes, then show the diff including working and staged changes against the last commit
    git diff HEAD
  fi
}

# GPG SIGNING KEY
export GPG_TTY=$(tty)

