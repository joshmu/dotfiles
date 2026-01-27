# zsh perf check (also run zprof at end of file)
# zmodload zsh/zprof

# HOMEBREW
eval "$(/opt/homebrew/bin/brew shellenv)"
if type brew &>/dev/null; then
   FPATH=$(brew --prefix)/share/zsh/site-functions:$FPATH

   autoload -Uz compinit
   # only update completions every 24 hours - https://medium.com/@dannysmith/little-thing-2-speeding-up-zsh-f1860390f92
   for dump in ~/.zcompdump(N.mh+24); do
     compinit
   done
   compinit -C
fi

# OH MY POSH
#eval "$(oh-my-posh init zsh)"
eval "$(oh-my-posh init zsh --config ~/.oh-my-mu.json)"

# Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.zshrc.
# Initialization code that may require console input (password prompts, [y/n]
# confirmations, etc.) must go above this block; everything else may go below.
# if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
#   source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
# fi

# If you come from bash you might have to change your $PATH.
# export PATH=$HOME/bin:/usr/local/bin:$PATH

# Path to your oh-my-zsh installation.
export ZSH="/Users/joshmu/.oh-my-zsh"

# Set name of the theme to load --- if set to "random", it will
# load a random theme each time oh-my-zsh is loaded, in which case,
# to know which specific one was loaded, run: echo $RANDOM_THEME
# See https://github.com/ohmyzsh/ohmyzsh/wiki/Themes
# ZSH_THEME="robbyrussell"
# ZSH_THEME="agnoster"
# ZSH_THEME="powerlevel10k/powerlevel10k"

# YOU-SHOULD-USE - ONLY SHOW MOST CONDENSED RESULT
export YSU_MODE=BESTMATCH

# Set list of themes to pick from when loading at random
# Setting this variable when ZSH_THEME=random will cause zsh to load
# a theme from this variable instead of looking in ~/.oh-my-zsh/themes/
# If set to an empty array, this variable will have no effect.
# ZSH_THEME_RANDOM_CANDIDATES=( "robbyrussell" "agnoster" )

# Uncomment the following line to use case-sensitive completion.
# CASE_SENSITIVE="true"

# Uncomment the following line to use hyphen-insensitive completion.
# Case-sensitive completion must be off. _ and - will be interchangeable.
# HYPHEN_INSENSITIVE="true"

# Uncomment the following line to disable bi-weekly auto-update checks.
# DISABLE_AUTO_UPDATE="true"

# Uncomment the following line to automatically update without prompting.
# DISABLE_UPDATE_PROMPT="true"

# Uncomment the following line to change how often to auto-update (in days).
# export UPDATE_ZSH_DAYS=13

# Uncomment the following line if pasting URLs and other text is messed up.
# DISABLE_MAGIC_FUNCTIONS=true

# Uncomment the following line to disable colors in ls.
# DISABLE_LS_COLORS="true"

# Uncomment the following line to disable auto-setting terminal title.
# DISABLE_AUTO_TITLE="true"

# Uncomment the following line to enable command auto-correction.
# ENABLE_CORRECTION="true"

# Uncomment the following line to display red dots whilst waiting for completion.
# COMPLETION_WAITING_DOTS="true"

# Uncomment the following line if you want to disable marking untracked files
# under VCS as dirty. This makes repository status check for large repositories
# much, much faster.
# DISABLE_UNTRACKED_FILES_DIRTY="true"

# Uncomment the following line if you want to change the command execution time
# stamp shown in the history command output.
# You can set one of the optional three formats:
# "mm/dd/yyyy"|"dd.mm.yyyy"|"yyyy-mm-dd"
# or set a custom format using the strftime function format specifications,
# see 'man strftime' for details.
# HIST_STAMPS="mm/dd/yyyy"

# Would you like to use another custom folder than $ZSH/custom?
# ZSH_CUSTOM=/path/to/new-custom-folder

# Which plugins would you like to load?
# Standard plugins can be found in ~/.oh-my-zsh/plugins/*
# Custom plugins may be added to ~/.oh-my-zsh/custom/plugins/
# Example format: plugins=(rails git textmate ruby lighthouse)
# Add wisely, as too many plugins slow down shell startup.
# plugins=(macos zsh-autosuggestions zsh-syntax-highlighting zsh-z you-should-use git-open fzf zsh-autocomplete)
plugins=(macos zsh-autosuggestions zsh-syntax-highlighting you-should-use git-open fzf zsh-autocomplete)

source $ZSH/oh-my-zsh.sh

# User configuration

# export MANPATH="/usr/local/man:$MANPATH"

# You may need to manually set your language environment
# export LANG=en_US.UTF-8

# Preferred editor for local and remote sessions
# if [[ -n $SSH_CONNECTION ]]; then
#   export EDITOR='vim'
# else
#   export EDITOR='mvim'
# fi

# Compilation flags
# export ARCHFLAGS="-arch x86_64"

# Set personal aliases, overriding those provided by oh-my-zsh libs,
# plugins, and themes. Aliases can be placed here, though oh-my-zsh
# users are encouraged to define aliases within the ZSH_CUSTOM folder.
# For a full list of active aliases, run `alias`.
#
# Example aliases
# alias zshconfig="mate ~/.zshrc"
# alias ohmyzsh="mate ~/.oh-my-zsh"


# PURE
# autoload -U promptinit; promptinit
# prompt pure

# Set default editor
export EDITOR="/opt/homebrew/bin/nvim"
export VISUAL="/opt/homebrew/bin/nvim"

# USE VIM IN ZSH CLI
bindkey -v

# ZSH AUTO SUGGESTIONS - KEY BINDING
#bindkey '^j' autosuggest-accept
bindkey '^ ' autosuggest-accept

# REMOVE COMP NAME FROM PROMPT
# removed 'promp_context()' as it is uneeded with p10k
# prompt_context() {
#  if [[ "$USER" != "$DEFAULT_USER" || -n "$SSH_CLIENT" ]]; then
#    prompt_segment black default "%(!.%{%F{yellow}%}.)$USER"
#  fi
#}

# To customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
# [[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh

# FZF (with FD)
## suppose you have installed fzf to ~/.fzf, change it to what suits you
export FZF_BASE="$HOME/.fzf"
export FZF_DEFAULT_COMMAND="fd --type file --color=always --exclude .git"
# include hidden files & follow symbolic links
# export FZF_DEFAULT_COMMAND="fd --type file --color=always --hidden --follow --exclude .git"
export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
export FZF_ALT_C_COMMAND="fd -t d . $HOME"
export FZF_DEFAULT_OPTS="--ansi"

# ----------------------
# PATHS
# ----------------------

# Dotfiles bin directory
export PATH="$HOME/dotfiles/bin:$PATH"

export PATH="$HOME/.yarn/bin:$HOME/.config/yarn/global/node_modules/.bin:$PATH"

# JAVA 8
#export JAVA_HOME="/Library/Java/JavaVirtualMachines/zulu-8.jdk/Contents/Home"
#export JAVA_HOME="/Library/Java/JavaVirtualMachines/jdk1.8.0_271.jdk/Contents/Home"

export PATH="$JAVA_HOME/bin:$PATH"

# rbenv
export PATH="$HOME/.rbenv/bin:$PATH"
eval "$(rbenv init - zsh)"

[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh

alias luamake=/Users/joshmu/Desktop/code/other/lua-language-server/3rd/luamake/luamake

### Added by the Heroku Toolbelt
#export PATH="/usr/local/heroku/bin:$PATH"

### MYSQL
export PATH=$PATH:/usr/local/mysql/bin

### Added by Me for bash script inits
export PATH="$HOME/bin:$PATH"

# Setting PATH for Python 3.11
# The original version is saved in .zprofile.pysave
#export PATH="/Library/Frameworks/Python.framework/Versions/3.11/bin:${PATH}"

# Obsidian local path
export OBSIDIAN_PATH="/Users/joshmu/Desktop/obsidian"

#source my zprofile again to guarantee all my aliases work
# ls alias for colorls is failing
# zshrc is loaded after zprofile
# todo: need to fix this mapping
source ~/.zprofile

autoload -U +X bashcompinit && bashcompinit
complete -o nospace -C /opt/homebrew/bin/terraform terraform

# pnpm
export PNPM_HOME="/Users/joshmu/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
# pnpm end

# zsh perf check
# zprof



# GH COPLOT (https://github.com/github/gh-copilot)
eval "$(gh copilot alias -- zsh)"

# Zoxide
eval "$(zoxide init zsh)"

# UV - python package manager
eval "$(uv generate-shell-completion zsh)"
eval "$(uvx --generate-shell-completion zsh)"

# nvm
export NVM_DIR="$HOME/.nvm"
[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"  # This loads nvm
[ -s "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm" ] && \. "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm"  # This loads nvm bash_completion

#THIS MUST BE AT THE END OF THE FILE FOR SDKMAN TO WORK!!!
export SDKMAN_DIR="/Users/joshmu/.sdkman"
[[ -s "/Users/joshmu/.sdkman/bin/sdkman-init.sh" ]] && source "/Users/joshmu/.sdkman/bin/sdkman-init.sh"
export PATH="$HOME/.jenv/bin:$PATH"
# eval "$(jenv init -)"

# ----------------------
# ALIASES
# ----------------------
source ~/.aliases
source ~/completion-for-pnpm.zsh

. "$HOME/.local/bin/env"
# The following lines have been added by Docker Desktop to enable Docker CLI completions.
fpath=(/Users/joshmu/.docker/completions $fpath)
autoload -Uz compinit
compinit
# End of Docker CLI completions

# AWS CLI completion
autoload -Uz bashcompinit compinit
bashcompinit
compinit
# Point completion at aws_completer (works regardless of install path)
complete -C "$(command -v aws_completer)" aws

# FX - JSON PRETTY PRINTER - fx.wtf
source <(fx --comp bash)

# Added by LM Studio CLI (lms)
export PATH="$PATH:/Users/joshmu/.lmstudio/bin"
# End of LM Studio CLI section

# Added by Windsurf
export PATH="/Users/joshmu/.codeium/windsurf/bin:$PATH"

# Added by me so that I can have a personal bin folder
export PATH="$HOME/bin:$PATH"

# Use nvim for Pager
export MANPAGER="nvim +Man!"
export PAGER="nvimpager"

# PATH=~/.console-ninja/.bin:$PATH

# python version management
export PYENV_ROOT="$HOME/.pyenv"
[[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init - zsh)"

export GPG_TTY=$(tty)
