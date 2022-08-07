require('plugins')
require('lsp-config')
require('cmp-config')
-- require('treesitter-config')

local cmd = vim.cmd  -- to execute Vim commands e.g. cmd('pwd')
local fn = vim.fn    -- to call Vim functions e.g. fn.bufnr()
local g = vim.g      -- a table to access global variables
local opt = vim.opt  -- to set options

g.mapleader = ' '                   -- Leader
-- cmd 'colorscheme dracula'           -- Put your favorite colorscheme here
-- g.colors_name = 'dracula'
g.colors_name = 'OceanicNext'
opt.background = 'dark'             -- required for colours to work correctly
opt.completeopt = {'menuone', 'noinsert', 'noselect'}  -- Completion options (for deoplete)
opt.expandtab = true                -- Use spaces instead of tabs
opt.hidden = true                   -- Enable background buffers
opt.ignorecase = true               -- Ignore case
opt.joinspaces = false              -- No double spaces with join
opt.list = true                     -- Show some invisible characters
opt.number = true                   -- Show line numbers
opt.relativenumber = false           -- Relative line numbers
opt.scrolloff = 4                   -- Lines of context
opt.shiftround = true               -- Round indent
opt.shiftwidth = 2                  -- Size of an indent
opt.sidescrolloff = 8               -- Columns of context
opt.smartcase = true                -- Do not ignore case with capitals
opt.smartindent = true              -- Insert indents automatically
opt.splitbelow = true               -- Put new windows below current
opt.splitright = true               -- Put new windows right of current
opt.tabstop = 2                     -- Number of spaces tabs count for
opt.termguicolors = true            -- True color support
opt.wildmode = {'list', 'longest'}  -- Command-line completion mode
opt.wrap = false                    -- Disable line wrap
opt.cursorline = true               -- highlight current cursor line
opt.guicursor = 'n-v-c:block,i-ci-ve:ver25,r-cr:hor20,o:hor50'    -- cursor display modes
opt.clipboard = 'unnamedplus'       -- yank adds to system clipboard
opt.showmode = false                -- remove default status
opt.cmdheight = 1                   -- cmd line height
opt.foldmethod='expr'                       -- code folding using treesitter
opt.foldexpr='nvim_treesitter#foldexpr()'   -- code folding using treesitter
opt.foldlevelstart = 99             -- fold level when opening buffer

-- remove scroll bars
-- set guioptions=
opt.textwidth = 80
opt.errorbells = true
opt.nu = true

-- using ignorecase with smartcase so it becomes sensitive only when we use
-- upperccase characters
opt.ignorecase = true
opt.smartcase = true
opt.swapfile = false
opt.backup = false
-- opt.backupdir = os.getenv("HOME") .. "/.config/nvim/cache"
opt.undodir = os.getenv("HOME") .. '/.vim/undodir'
opt.undofile = true
opt.incsearch = true
opt.hlsearch = true
opt.clipboard='unnamed,unnamedplus'   -- use system clipboard
-- opt.colorcolumn = 120
opt.scrolloff = 999

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

-- auto install packer plugins when plugins.lua is updated
vim.cmd([[
augroup packer_user_config
autocmd!
autocmd BufWritePost plugins.lua source <afile> | PackerCompile
augroup end
]])


--[[
require('nvim-treesitter.configs').setup({
  ensure_installed = {'typescript'}, -- one of "all", "maintained" (parsers with maintainers), or a list of languages
  sync_install = false, -- install languages synchronously (only applied to `ensure_installed`)
  ignore_install = {}, -- List of parsers to ignore installing
  highlight = {
    enable = true,
    custom_captures = {
      -- Highlight the @foo.bar capture group with the "Identifier" highlight group.
      ["foo.bar"] = "Identifier",
    },
    -- Setting this to true will run `:h syntax` and tree-sitter at the same time.
    -- Set this to `true` if you depend on 'syntax' being enabled (like for indentation).
    -- Using this option may slow down your editor, and you may see some duplicate highlights.
    -- Instead of true it can also be a list of languages
    additional_vim_regex_highlighting = false,
  },
})
--]]
