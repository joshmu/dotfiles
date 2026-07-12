return {
  'alexghergh/nvim-tmux-navigation',
  config = function()
    -- Inside herdr: use vim-herdr-navigation's shim for <C-hjkl> (split-edge
    -- handoff to herdr panes). Glob survives the hash-suffixed install dir.
    if vim.env.HERDR_PANE_ID and vim.env.HERDR_PANE_ID ~= '' then
      local shim = vim.split(vim.fn.glob '~/.config/herdr/plugins/github/vim-herdr-navigation-*/editor/nvim.lua', '\n')[1]
      if shim and shim ~= '' then
        dofile(shim)
        return
      end
    end

    local nvim_tmux_nav = require 'nvim-tmux-navigation'

    nvim_tmux_nav.setup {
      disable_when_zoomed = true, -- defaults to false
    }

    vim.keymap.set('n', '<C-h>', nvim_tmux_nav.NvimTmuxNavigateLeft)
    vim.keymap.set('n', '<C-j>', nvim_tmux_nav.NvimTmuxNavigateDown)
    vim.keymap.set('n', '<C-k>', nvim_tmux_nav.NvimTmuxNavigateUp)
    vim.keymap.set('n', '<C-l>', nvim_tmux_nav.NvimTmuxNavigateRight)
    -- vim.keymap.set('n', '<C-\\>', nvim_tmux_nav.NvimTmuxNavigateLastActive)
    -- vim.keymap.set('n', '<C-Space>', nvim_tmux_nav.NvimTmuxNavigateNext)
  end,
}
