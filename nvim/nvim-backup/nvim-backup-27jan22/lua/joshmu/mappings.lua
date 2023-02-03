local function map(mode, lhs, rhs, opts)
  local options = {noremap = true}
  if opts then options = vim.tbl_extend('force', options, opts) end
  vim.api.nvim_set_keymap(mode, lhs, rhs, options)
end

-- escape
map('i', 'jk', '<Esc>')

-- quicker saves & exits
map('n', '<leader>w', ':w<CR>')
map('n', '<leader>q', ':q<CR>')

-- Switch tabs
map('n', '<S-L>', 'gt')
map('n', '<S-H>', 'gT')

map('n', '<leader>h', ':wincmd h<CR>')
map('n', '<leader>j', ':wincmd j<CR>')
map('n', '<leader>k', ':wincmd k<CR>')
map('n', '<leader>l', ':wincmd l<CR>')

-- nvim-tree
map('n', '<leader>e', ':NvimTreeToggle<CR>')

-- telescope
map('n', '<leader>ff', '<cmd> lua require("telescope.builtin").find_files()<cr>')
map('n', '<leader>fg', '<cmd> lua require("telescope.builtin").live_grep()<cr>')
map('n', '<leader>fb', '<cmd> lua require("telescope.builtin").buffers()<cr>')
map('n', '<C-p>', '<cmd> lua require("telescope.builtin").buffers()<cr>')
map('n', 'gr', '<cmd> lua require("telescope.builtin").lsp_references()<cr>')
map('n', 'gd', '<cmd> lua require("telescope.builtin").lsp_definitions()<cr>')

-- Centered scroll
map('n', '<leader>zz', ':let &scrolloff=999-&scrolloff<CR>')

-- Vscode jump to
map('n', '<silent> <leader>go', ':execute "! code --goto %:" . getcurpos()[1] . ":" . getcurpos()[2] <bar> q!<CR>')
-- todo: hyper key support in vim for hyper+p?
map('n', '<silent> <leader>v', ':execute "! code --goto %:" . getcurpos()[1] . ":" . getcurpos()[2] <bar> q!<CR>')

-- highlight
map('n', '<esc>', ':noh <CR>')      -- disable highlight

-- comment
map('n', '<C-_>', ':Commentary<CR>')  -- '_' is '/'
map('o', '<C-_>', ':Commentary<CR>')  -- '_' is '/'
map('x', '<C-_>', ':Commentary<CR>')  -- '_' is '/'

-- tabs
-- Move to previous/next
map('n', '<C-[>', ':BufferPrevious<CR>')
map('n', '<C-]>', ':BufferNext<CR>')
-- -- Close buffer
map('n', '<leader>x', ':BufferClose<CR>')

