return {
  'kdheepak/lazygit.nvim',
  cmd = {
    'LazyGit',
    'LazyGitConfig',
    'LazyGitCurrentFile',
    'LazyGitFilter',
    'LazyGitFilterCurrentFile',
  },
  -- optional for floating window border decoration
  dependencies = {
    'nvim-lua/plenary.nvim',
  },
  -- setting the keybinding for LazyGit with 'keys' is recommended in
  -- order to load the plugin when the command is run for the first time
  keys = {
    { '<leader>lg', '<cmd>LazyGit<cr>', desc = 'LazyGit' },
    { '<leader>gg', '<cmd>LazyGit<cr>', desc = 'LazyGit' },
  },
  -- Pane navigation OUT of the embedded lazygit terminal. The multiplexer
  -- (herdr/tmux) forwards <C-hjkl> INTO nvim because the pane process is nvim,
  -- but the normal-mode nav maps don't fire in a terminal buffer — so lazygit
  -- swallows the chords. We intercept with buffer-local terminal-mode maps
  -- (ft=lazygit only) and call the multiplexer's pane-focus DIRECTLY: no
  -- wincmd, no leaving terminal mode. That skips nvim windows entirely (from
  -- lazygit the whole editor is one pane) and, because we stay in terminal
  -- mode, lazygit is still focused when the pane is re-entered.
  -- Tradeoff: shadows lazygit's <C-j>/<C-k> (moveDown/UpCommit; alt+arrows
  -- still work) and <C-l> (openLogMenu, no fallback) inside the embed.
  init = function()
    local tmux_flag = { left = '-L', down = '-D', up = '-U', right = '-R' }

    local function focus_pane(dir)
      if vim.env.HERDR_PANE_ID and vim.env.HERDR_PANE_ID ~= '' then
        local herdr = vim.env.HERDR_BIN_PATH
        if herdr == nil or herdr == '' then
          herdr = 'herdr'
        end
        vim.fn.system { herdr, 'pane', 'focus', '--direction', dir, '--current' }
      elseif vim.env.TMUX and vim.env.TMUX ~= '' then
        vim.fn.system { 'tmux', 'select-pane', tmux_flag[dir] }
      end
    end

    vim.api.nvim_create_autocmd('FileType', {
      pattern = 'lazygit',
      desc = 'lazygit: <C-hjkl> jump straight to neighbour tmux/herdr pane',
      callback = function(ev)
        for key, dir in pairs { h = 'left', j = 'down', k = 'up', l = 'right' } do
          vim.keymap.set('t', '<C-' .. key .. '>', function()
            focus_pane(dir)
          end, {
            buffer = ev.buf,
            silent = true,
            desc = 'lazygit: focus ' .. dir .. ' pane',
          })
        end
      end,
    })
  end,
}
