#!/usr/bin/env zsh

# cached_eval "name" "command args..." ["watch-file"]
# Caches eval output to ~/.cache/zsh/<name>.zsh
# Regenerates when the tool binary is newer than the cache, or when an optional
# watch-file (e.g. a config the command reads) is newer than the cache. The
# watch-file follows symlinks, so pointing it at a dotbot-symlinked config tracks
# the real repo file's mtime.
cached_eval() {
  local name="$1" cmd="$2" watch="${3:-}"
  local cache_dir="$HOME/.cache/zsh"
  local cache="$cache_dir/${name}.zsh"
  local bin=$(command -v ${${=cmd}[1]} 2>/dev/null)

  if [[ ! -f "$cache" ]] \
     || [[ -n "$bin" && "$bin" -nt "$cache" ]] \
     || [[ -n "$watch" && "$watch" -nt "$cache" ]]; then
    mkdir -p "$cache_dir"
    eval "$cmd" > "$cache" 2>/dev/null
  fi

  source "$cache"
}
