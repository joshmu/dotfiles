# zsh-autocomplete: arrow-key navigation of the completion list

## Symptom

Typing shows the live completion list below the prompt, but pressing the
**Down arrow** rings the terminal bell instead of stepping into the list.
(Seen after a machine migration; the older machine navigated fine.)

## Cause

Not Ghostty, not Karabiner, not a macOS setting — it's a **zsh-autocomplete
major-version difference**.

- Old (`d00142d`, 2022): arrows walk straight into the live list.
- Current (`20f6c34`, 2026+): the rewrite reassigned the arrows to
  history-search. Down now hunts history and rings the bell at the boundary;
  the list is meant to be entered with **Tab**.

The fresh-machine prereqs (`CLAUDE.md`) clone the plugin at `master`, so any new
setup gets the current version and this behavior.

## Fix

Lives in `.zshrc`, after `source $ZSH/oh-my-zsh.sh` loads the plugin. A guard
widget restores the old feel without downgrading:

- **Down on a partial command** → enters the live menu (`menu-select`).
- **Down on an empty line** → history (unchanged).
- **Up** → history (matches old behavior).
- In-menu arrows navigate the selection.

```sh
_mu-down-or-menu() {
  if [[ -n $BUFFER ]]; then zle menu-select; else zle down-line-or-history; fi
}
zle -N _mu-down-or-menu
bindkey '^[[B' _mu-down-or-menu '^[OB' _mu-down-or-menu
bindkey -M menuselect '^[[A' up-line-or-history   '^[OA' up-line-or-history
bindkey -M menuselect '^[[B' down-line-or-history '^[OB' down-line-or-history
```

Reload with `exec zsh`. Arrows driven via the Karabiner space-modifier emit
plain arrow sequences, so they hit these binds too.

The plugin ships alternate recipes (Tab-to-enter, etc.) under "Reassign keys"
in its README if a different feel is wanted.
