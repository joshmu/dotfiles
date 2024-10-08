-- [[ Basic Keymaps ]]
--  See `:help vim.keymap.set()`

-- Clear highlights on search when pressing <Esc> in normal mode
--  See `:help hlsearch`
vim.keymap.set('n', '<Esc>', '<cmd>nohlsearch<CR>')

-- Diagnostic keymaps
-- vim.keymap.set('n', '<leader>q', vim.diagnostic.setloclist, { desc = 'Open diagnostic [Q]uickfix list' })
vim.keymap.set('n', 'gl', vim.diagnostic.open_float, { desc = 'Open diagnostic float' })

-- Exit terminal mode in the builtin terminal with a shortcut that is a bit easier
-- for people to discover. Otherwise, you normally need to press <C-\><C-n>, which
-- is not what someone will guess without a bit more experience.
--
-- NOTE: This won't work in all terminal emulators/tmux/etc. Try your own mapping
-- or just use <C-\><C-n> to exit terminal mode
-- vim.keymap.set('t', '<Esc><Esc>', '<C-\\><C-n>', { desc = 'Exit terminal mode' })

-- TIP: Disable arrow keys in normal mode
-- vim.keymap.set('n', '<left>', '<cmd>echo "Use h to move!!"<CR>')
-- vim.keymap.set('n', '<right>', '<cmd>echo "Use l to move!!"<CR>')
-- vim.keymap.set('n', '<up>', '<cmd>echo "Use k to move!!"<CR>')
-- vim.keymap.set('n', '<down>', '<cmd>echo "Use j to move!!"<CR>')

-- Keybinds to make split navigation easier.
--  Use CTRL+<hjkl> to switch between windows

-- [[ Basic Autocommands ]]
--  See `:help lua-guide-autocommands`

-- Highlight when yanking (copying) text
--  Try it with `yap` in normal mode
--  See `:help vim.highlight.on_yank()`
vim.api.nvim_create_autocmd('TextYankPost', {
  desc = 'Highlight when yanking (copying) text',
  group = vim.api.nvim_create_augroup('kickstart-highlight-yank', { clear = true }),
  callback = function()
    vim.highlight.on_yank()
  end,
})

local function map(mode, lhs, rhs, opts)
  local options = { noremap = true }
  if opts then
    options = vim.tbl_extend('force', options, opts)
  end
  vim.api.nvim_set_keymap(mode, lhs, rhs, options)
end

vim.keymap.set('i', 'jk', '<Esc>', { desc = 'Escape insert mode' })

-- quicker saves & exits
vim.keymap.set('n', '<leader>w', '<cmd>w<CR>')
vim.keymap.set('n', '<leader>q', '<cmd>q!<CR>')

-- Switch tabs
vim.keymap.set('n', '<S-L>', 'gt')
vim.keymap.set('n', '<S-H>', 'gT')

-- splits
vim.keymap.set('n', '<leader>|', '<cmd>vsplit<CR>')
vim.keymap.set('n', '<leader>-', '<cmd>split<CR>')
-- close current split
vim.keymap.set('n', '<leader>c', '<cmd>close<CR>')

vim.keymap.set('n', '<leader>h', '<cmd>wincmd h<CR>')
vim.keymap.set('n', '<leader>j', '<cmd>wincmd j<CR>')
vim.keymap.set('n', '<leader>k', '<cmd>wincmd k<CR>')
vim.keymap.set('n', '<leader>l', '<cmd>wincmd l<CR>')

-- nvim-tree
-- vim.keymap.set('n', '<leader>e', '<cmd>NvimTreeToggle<CR>', { desc = 'Open Neotree' })
vim.keymap.set('n', '<leader>e', '<cmd>Neotree toggle<CR>', { desc = 'Toggle Neotree' })

vim.keymap.set('n', '<leader>vs', require('utils.code_helpers').openIDEWithWorkspaceEnabledIfAvailable, { desc = 'Open in [V][S]Code' })
vim.keymap.set('n', '<leader>oc', function()
  require('utils.code_helpers').openIDEWithWorkspaceEnabledIfAvailable 'cursor'
end, { desc = '[O]pen in [C]ursor' })

-- Centered scroll
vim.keymap.set('n', '<leader>zz', '<cmd>let &scrolloff=999-&scrolloff<CR>')

-- highlight
vim.keymap.set('n', '<esc>', '<cmd>noh <CR>') -- disable highlight

-- git
-- vim.keymap.set('n', '<leader>gd', '<cmd>Gvdiffsplit<CR>', { noremap = true, silent = true })
vim.keymap.set('n', '<leader>gd', require('utils.diff_helpers').diffview_toggle, { desc = 'View Git diff' })
vim.keymap.set('n', '<leader>gl', function()
  local commit_hash = require('utils.git_helpers').get_commit_hash_for_current_line()

  -- diffview plugin
  if commit_hash then
    local cmd = 'DiffviewOpen ' .. commit_hash .. '^!'
    vim.api.nvim_command(cmd)
  end
end, { desc = 'Line diff' })

vim.keymap.set('n', 'gh', vim.lsp.buf.hover, { desc = 'Hover symbol details' })

-- dismiss notifications
vim.keymap.set('n', '<leader><Esc>', function()
  require('notify').dismiss { silent = true, pending = true }
end, { desc = 'Dismiss notifications' })
