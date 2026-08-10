# DOTFILES — Agent Guide

Operating rules for AI agents working in this repo. For the full human-facing
overview — architecture, install/setup, and command & script reference — see
**[README.md](README.md)**.

## Working in this repo

- **Symlinks are live.** dotbot symlinks these files into `$HOME` (see
  `install.conf.yaml`). Editing a file here changes the running system
  immediately — there is no build/copy step. Treat every edit as production.
- **Read the latest upstream docs before changing tooling.** For any package,
  plugin, tool, or runtime, check the current official docs/README (and
  `npm view <pkg>@latest version`) before suggesting or making a change — APIs,
  defaults, and supported-version policies drift. Fix forward; **never** downgrade
  a runtime or dependency as the fix.
- **Deletion:** use `trash`, never `rm`.
- **Dates:** get the real date with `date`; never assume or hardcode.

## Conventions

- **Packages:** prefer pnpm for new repos; otherwise detect from the lock file.
- **Scripts:** everything in `scripts/` is executable TypeScript run by Bun
  (`#!/usr/bin/env bun`).
- **Commits:** commitlint convention `type(scope): description` (e.g.
  `fix(nvim): …`). Don't mention test counts.
- **Open a file:** `cursor -g path/to/file:line[:column]`.
- **Clipboard:** pipe to `pbcopy`.
- **Detect git host:** `git remote -v` (GitHub / Bitbucket / GitLab).
- **Per-machine paths:** prefer the env vars over hardcoded paths — `$PERSONAL_VAULT`,
  `$BRG_WORKSPACE`, `$AGENT_OBSERVABILITY_PATH` (defined in `.zshenv` with a `~/.zshenv.local`
  override; see `.zshenv.local.example` and README step 5). Shell + TS (`process.env.*`) read
  them; JSON/YAML/launchd configs can't and keep literal absolute paths.

## Brewfile

- Edit **`Brewfile`** (the full superset, union across all machines) by hand.
  **Never** `brew bundle dump` over it — any one machine has only a subset, so a
  dump deletes every package not installed locally.
- `brew bundle dump --force --file=Brewfile.minimal` only ever targets the
  per-machine minimal snapshot.

## Gotchas

- **oh-my-posh init must run fresh every shell:** `.zshrc` runs the
  upstream-documented `eval "$(oh-my-posh init zsh --config ~/.oh-my-mu.json)"`
  (~70ms). Each `init` writes the config path into a per-shell session cache
  (`POSH_SESSION_ID`); `print primary` resolves the theme from there — **not**
  from `POSH_THEME`, which is informational only. Never wrap this init in
  `cached_eval`: a cached init freezes one session id across all shells and
  skips the config-priming side effect, so a dropped cache entry makes every
  prompt silently fall back to the default theme permanently (this happened;
  fixed Aug 2026). Theme edits to `oh-my-mu.json` apply on the next shell.
- **nvim-treesitter is on the `main` branch** (the Neovim 0.12+ rewrite), not
  `master`, and needs `tree-sitter-cli` (brew). Parsers are declared in
  `nvim/lua/core/plugins/treesitter.lua` via `install{}`; highlighting and indent
  are enabled per-buffer in a `FileType` autocmd (no `ensure_installed` /
  `highlight.enable` modules).
