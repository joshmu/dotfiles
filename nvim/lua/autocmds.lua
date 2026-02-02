-- [[ Autocommands ]]
--  See `:help lua-guide-autocommands`

-- ============================================================================
-- Auto-reload files changed outside of Neovim
-- ============================================================================
-- This is essential when external tools (AI agents, formatters, git) modify
-- files while you have them open. Without this, you'd need to manually run `:e`
-- to see changes.
--
-- How it works:
-- 1. `autoread` allows Neovim to reload files if the buffer isn't locally modified
-- 2. `checktime` polls file mtimes and triggers reload when changes detected
-- 3. We run `checktime` on focus gain, buffer enter, and after cursor stops moving
-- ============================================================================

vim.opt.autoread = true

vim.api.nvim_create_autocmd({ 'FocusGained', 'BufEnter', 'CursorHold', 'CursorHoldI' }, {
  desc = 'Check if files changed externally and reload buffer',
  group = vim.api.nvim_create_augroup('auto-reload-files', { clear = true }),
  callback = function()
    -- Avoid interrupting command-line mode
    if vim.fn.mode() ~= 'c' then
      vim.cmd 'checktime'
    end
  end,
})

-- Notify when a file was reloaded due to external change
vim.api.nvim_create_autocmd('FileChangedShellPost', {
  desc = 'Notify when file reloaded from disk',
  group = vim.api.nvim_create_augroup('auto-reload-notify', { clear = true }),
  callback = function()
    vim.notify('File changed on disk. Buffer reloaded.', vim.log.levels.WARN)
  end,
})
