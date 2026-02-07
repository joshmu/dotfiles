#!/usr/bin/env zsh

# cached_eval "name" "command args..."
# Caches eval output to ~/.cache/zsh/<name>.zsh
# Regenerates when the tool binary is newer than cache
cached_eval() {
  local name="$1" cmd="$2"
  local cache_dir="$HOME/.cache/zsh"
  local cache="$cache_dir/${name}.zsh"
  local bin=$(command -v ${${=cmd}[1]} 2>/dev/null)

  if [[ ! -f "$cache" ]] || [[ -n "$bin" && "$bin" -nt "$cache" ]]; then
    mkdir -p "$cache_dir"
    eval "$cmd" > "$cache" 2>/dev/null
  fi

  source "$cache"
}
