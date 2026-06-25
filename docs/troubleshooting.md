# Troubleshooting

## oh-my-posh prompt renders wrong / falls back to default theme

The prompt loads via `cached_eval` (`zsh/eval-cache.zsh`) → `~/.cache/zsh/oh-my-posh.zsh`, which
bakes a **fixed** `POSH_SESSION_ID`. oh-my-posh resolves the theme at render time from the
per-session cache `~/.cache/oh-my-posh/zsh.<id>.omp.cache` — **not** from `oh-my-mu.json`. Every
shell sourcing that cached init shares the baked id, so a throwaway non-interactive shell
(`zsh -ic …`) can overwrite the shared session cache and break the live prompt.

**Fix (run all three together):**

```sh
trash ~/.cache/zsh/oh-my-posh.zsh && oh-my-posh cache clear && exec zsh
```

Never run `oh-my-posh cache clear` alone — it drops the config and the prompt falls back to the
default theme until the init regenerates.

**Avoid** `zsh -ic` for verifying shell state; use `zsh -c 'echo $VAR'` (sources `.zshenv` only).
