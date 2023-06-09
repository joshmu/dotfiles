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
opt.relativenumber = true           -- Relative line numbers
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
