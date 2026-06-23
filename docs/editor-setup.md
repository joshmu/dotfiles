# Editor setup — Cursor & VSCode (fresh machine)

How to reproduce the Cursor / VSCode configuration on a new machine. Both editors
are configured the same way; only the app name (`Cursor` vs `Code`) and CLI
(`cursor` vs `code`) differ.

## What's tracked here vs per-machine

| Item | Tracked in dotfiles? | Why |
|------|----------------------|-----|
| `keybindings.json` | ✅ symlinked via dotbot | path-clean, identical across machines |
| `extensions.txt` | ✅ manifest (install list) | reproducible install |
| `settings.json` | ❌ per-machine copy | contains absolute `/Users/<user>` paths that can't be templated in JSONC |
| Workbench layout (`state.vscdb`) | ❌ not portable | large, session/workspace/path state — rebuild via settings + UI |
| Snippets (`User/snippets/`) | ❌ copy across | not currently tracked |

Paths below:
- Cursor user dir: `~/Library/Application Support/Cursor/User/`
- VSCode user dir: `~/Library/Application Support/Code/User/`

## 1. CLI availability

- `cursor` CLI ships on PATH with the app.
- VSCode `code` CLI: in VSCode run **Cmd-Shift-P → "Shell Command: Install 'code' command in PATH"**, or call the bundled binary directly:
  `/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code`

## 2. Keybindings (automatic via dotbot)

`./install` symlinks both editors' keybindings from this repo (declared in `install.conf.yaml`):

```
~/Library/Application Support/Cursor/User/keybindings.json -> cursor/keybindings.json
~/Library/Application Support/Code/User/keybindings.json   -> vscode/keybindings.json
```

No manual step beyond `./install`.

## 3. Extensions

Manifests: `cursor/extensions.txt`, `vscode/extensions.txt` (one extension id per line).

Install all into a fresh editor:

```bash
# Cursor
xargs -I{} cursor --install-extension {} --force < cursor/extensions.txt
# VSCode (use the code CLI or the bundled binary path)
xargs -I{} code --install-extension {} --force < vscode/extensions.txt
```

Refresh a manifest after curating:

```bash
cursor --list-extensions | sort > cursor/extensions.txt
code   --list-extensions | sort > vscode/extensions.txt
```

**Cursor ↔ VSCode marketplace differences.** Cursor resolves from Open VSX and ships
proprietary forks under the `anysphere.*` / `cursor.*` namespaces that do **not** exist
on the VSCode (Microsoft) marketplace. When seeding VSCode from a Cursor list, map them
to the Microsoft originals:

| Cursor (`anysphere.*`) | VSCode equivalent |
|------------------------|-------------------|
| `anysphere.remote-ssh` | `ms-vscode-remote.remote-ssh` |
| `anysphere.remote-containers` | `ms-vscode-remote.remote-containers` |
| `anysphere.cursorpyright` | `ms-python.vscode-pylance` (Pylance — licensed only inside official MS products, which is why Cursor forks it) |

Installing remote/python extensions auto-pulls a few dependency extensions
(`remote-ssh-edit`, `remote-explorer`, `vscode-python-envs`, `jupyter-keymap`) — expected.

## 4. settings.json (per-machine copy + path fix-up)

Not symlinked — JSONC can't expand `${userHome}` for the absolute paths some extensions
embed. Copy the file from an existing machine into the user dir, then fix the per-user
absolute paths:

```bash
# global username swap
sed -i '' 's#/Users/<old-user>#/Users/<new-user>#g' settings.json
```

Then hand-check these keys (they hold machine-specific absolute paths):
- `typeChallenges.workspaceFolder`
- the `find-it-faster` / ripgrep `--glob` param (points at a per-machine notes directory — repoint it)
- the Custom CSS/JS loader `vscode_custom_css.imports` (`file://` URLs → this machine's `vscode-custom`, which dotbot symlinks to `~/vscode-custom`)
- any `*.extensions/<publisher>.<ext>-<version>/...` schema association (version-pinned; harmless if stale)

**Gotcha — a running editor owns `settings.json`.** If the app is open when you write the
file externally, it can re-sanitise or overwrite your changes (e.g. it silently drops a
`workbench.colorTheme` that points at an uninstalled/invalid theme). Either edit while the
editor is closed, or write the change and then **Cmd-Shift-P → "Developer: Reload Window"**
without touching settings via the UI in between.

## 5. Theme (Catppuccin)

```bash
cursor --install-extension Catppuccin.catppuccin-vsc --force
cursor --install-extension Catppuccin.catppuccin-vsc-icons --force   # icons (optional)
# repeat with `code`
```

**Gotcha — theme name changed in v3.** Older settings carry
`"workbench.colorTheme": "Catppuccin Macchiato Bordered"`, but Catppuccin v3+ has **no**
"Bordered" theme label. Borders are now a config flag:

```jsonc
"workbench.colorTheme": "Catppuccin Macchiato",
"catppuccin.extraBordersEnabled": true
```

A stale "…Bordered" name is invalid → the editor ignores it and falls back to the default
theme (this is the usual "theme didn't carry over" symptom).

## 6. Snippets

```bash
# copy from an existing machine (example over ssh)
ssh <other-machine> 'cd ~/Library/Application\ Support/Code/User && tar cf - snippets' \
  | tar xf - -C ~/Library/Application\ Support/Code/User
```

## 7. Layout

Sidebar side and activity-bar visibility are **settings**, already in `settings.json`:

```jsonc
"workbench.sideBar.location": "right",
"workbench.activityBar.location": "hidden"
```

They apply on **Reload Window** — a freshly-launched editor was started before the
settings landed, so it shows the default until reloaded.

Finer layout (individual view containers, panel position/sizes, recent folders) lives in
`User/globalStorage/state.vscdb` and is **not** portable — it's large and full of
session/workspace/path state. Rebuild it from the settings above plus a few UI tweaks
rather than copying the DB.
