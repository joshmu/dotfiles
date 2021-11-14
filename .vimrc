"-------------------------------------------------------------
" PLUGINS
call plug#begin('~/.vim/plugged')

Plug 'neoclide/coc.nvim', {'branch': 'release'}
" Plug 'preservim/nerdtree'
" Plug 'preservim/nerdcommenter'
" Plug 'ctrlpvim/ctrlp.vim'
Plug 'justinmk/vim-sneak'
" Plug 'sheerun/vim-polyglot'
Plug 'vim-airline/vim-airline'
" Plug 'jremmen/vim-ripgrep'
" Plug 'tpope/vim-fugitive'
Plug 'leafgarland/typescript-vim'
Plug 'mxw/vim-jsx'
Plug 'pangloss/vim-javascript'
Plug 'vim-utils/vim-man'
" Plug 'mbbill/undotree'
Plug 'nvim-lua/plenary.nvim'
Plug 'nvim-telescope/telescope.nvim'
Plug 'junegunn/fzf', { 'do': { -> fzf#install() } }
Plug 'TimUntersberger/neogit'
Plug 'tpope/vim-surround'

" theming
Plug 'joshdick/onedark.vim'
Plug 'gruvbox-community/gruvbox'
Plug 'vim-airline/vim-airline-themes'

" games
" Plug 'ThePrimeagen/vim-be-good'

call plug#end()


"-------------------------------------------------------------
" MAPPINGS
inoremap jk <Esc>
let mapleader = " "

" quicker saves & exits
nnoremap <leader>w :w<CR>
nnoremap <leader>q :q<CR>

" Switch tabs
nnoremap <S-L> gt
nnoremap <S-H> gT

nnoremap <leader>h :wincmd h<CR>
nnoremap <leader>j :wincmd j<CR>
nnoremap <leader>k :wincmd k<CR>
nnoremap <leader>l :wincmd l<CR>
nnoremap <leader>u :UndotreeShow<CR>
nnoremap <leader>pv :wincmd v<bar> :Ex <bar> :vertical resize 30<CR>
nnoremap <Leader>ps :Rg<SPACE>
nnoremap <silent> <Leader>+ :vertical resize +5<CR>
nnoremap <silent> <Leader>- :vertical resize -5<CR>
vnoremap J :m '>+1<CR>gv=gv
vnoremap K :m '<-2<CR>gv=gv

" Use <c-space> to trigger completion.
inoremap <silent><expr> <c-space> coc#refresh()

" Find files using Telescope command-line sugar.
nnoremap <leader>ff <cmd>Telescope find_files<cr>
nnoremap <c-p> <cmd>Telescope find_files<cr>
nnoremap <leader>fg <cmd>Telescope live_grep<cr>
nnoremap <leader>fb <cmd>Telescope buffers<cr>
nnoremap <leader>fh <cmd>Telescope help_tags<cr>
nnoremap <Leader>fp <cmd>Telescope oldfiles<cr>

" Remap keys for gotos
nmap <silent> gd <Plug>(coc-definition)
nmap <silent> gy <Plug>(coc-type-definition)
nmap <silent> gi <Plug>(coc-implementation)
nmap <silent> gr <Plug>(coc-references)

" Use `[g` and `]g` to navigate diagnostics
" Use `:CocDiagnostics` to get all diagnostics of current buffer in location list.
nmap <silent> [g <Plug>(coc-diagnostic-prev)
nmap <silent> ]g <Plug>(coc-diagnostic-next)

" Use K to show documentation in preview window
nnoremap <silent> K :call <SID>show_documentation()<CR>
function! s:show_documentation()
  if (index(['vim','help'], &filetype) >= 0)
    execute 'h '.expand('<cword>')
  else
    call CocAction('doHover')
  endif
endfunction

" Highlight the symbol and its references when holding the cursor.
autocmd CursorHold * silent call CocActionAsync('highlight')

" Symbol renaming.
nmap <leader>rn <Plug>(coc-rename)
" Remap for rename current word
nmap <F2> <Plug>(coc-rename)

"-------------------------------------------------------------
" MACROS
" Record Macro > tabe ~/.vimrc > "qp (q being where the macro is held in
" register)
" map, imap, nmap, vmap, > modes
" ^M = <CR> = Enter (Carriage Return)
" ^[ = <esc>
"nmap === nnoremap
nmap <Leader>ch i- [ ]
" this gets translated to vscode (suppposedly imap and nnoremap work)
nnoremap <Leader>cl iconsole.log()<Esc>ha
nnoremap <Leader>ce iconsole.error()<Esc>ha

"-------------------------------------------------------------
" SETTINGS
syntax on
set t_Co=256
" true color suppoprt
set termguicolors

" remove scroll bars
set guioptions=

" text wraps and newline isn't created
" set textwidth=80
" set wrap

" set relativenumber

set hidden
set noerrorbells
set tabstop=4 softtabstop=4
set shiftwidth=4
set expandtab
set smartindent
set nu
set nowrap
" using ignorecase with smartcase so it becomes sensitive only when we use
" upperccase characters
set ignorecase
set smartcase
set noswapfile
set nobackup
set undodir=~/.vim/undodir
set undofile
set incsearch
set hlsearch

" use system clipboard
set clipboard^=unnamed,unnamedplus

set colorcolumn=80
" highlight ColorColumn ctermbg=0 guibg=lightgrey

" soft wrap hack
autocmd VimResized * if (&columns > 80) | set columns=80 | endif
set wrap
set linebreak
set showbreak=+++

" remove safe write for dev webpack code compilation potential issues
:set backupcopy=yes

"-------------------------------------------------------------
" RG
if executable('rg')
    let g:rg_derive_root='true'
endif

"-------------------------------------------------------------
" NERDTREE
" open automatically if no file specified or folder selected
autocmd StdinReadPre * let s:std_in=1
autocmd VimEnter * if argc() == 1 && isdirectory(argv()[0]) && !exists("s:std_in") | exe 'NERDTree' argv()[0] | wincmd p | ene | exe 'cd '.argv()[0] | endif
" auto close NERDTree if it is the last thing open
autocmd bufenter * if (winnr("$") == 1 && exists("b:NERDTree") && b:NERDTree.isTabTree()) | q | endif
" open NERDTree
map <C-n> :NERDTreeToggle<CR>
map <C-e> :NERDTreeToggle<CR>

let g:NERDTreeDirArrowExpandable = '▸'
let g:NERDTreeDirArrowCollapsible = '▾'

"-------------------------------------------------------------
" CTRLP
" let g:ctrlp_user_command = ['.git/', 'git --git-dir=%s/.git ls-files -oc --exclude-standard']
" let g:ctrlp_use_caching = 0

fun! TrimWhitespace()
    let l:save = winsaveview()
    keeppatterns %s/\s\+$//e
    call winrestview(l:save)
endfun

autocmd BufWritePre * :call TrimWhitespace()

"-------------------------------------------------------------
" THEME
" let g:gruvbox_italic=1
" let g:airline_theme='gruvbox'
" colorscheme gruvbox

let g:onedark_hide_endofbuffer = 1
let g:onedark_terminal_italics = 1
let g:airline_theme='onedark'
colorscheme onedark

let g:airline_powerline_fonts = 1
set background=dark
set guifont=Fira\ Mono\ for\ Powerline

set cursorline
hi CursorLine term=bold cterm=bold guibg=Grey10

"-------------------------------------------------------------
" COC CONFIG
let g:coc_global_extensions = [
  \ 'coc-snippets',
  \ 'coc-pairs',
  \ 'coc-tsserver',
  \ 'coc-eslint',
  \ 'coc-prettier',
  \ 'coc-json',
  \ ]

" prettier command for coc
command! -nargs=0 Prettier :CocCommand prettier.formatFile
vmap <leader>f  <Plug>(coc-format-selected)
nmap <leader>f  <Plug>(coc-format-selected)

" Use tab for trigger completion with characters ahead and navigate.
" Use command ':verbose imap <tab>' to make sure tab is not mapped by other plugin.
inoremap <silent><expr> <TAB>
      \ pumvisible() ? "\<C-n>" :
      \ <SID>check_back_space() ? "\<TAB>" :
      \ coc#refresh()
inoremap <expr><S-TAB> pumvisible() ? "\<C-p>" : "\<C-h>"

function! s:check_back_space() abort
  let col = col('.') - 1
  return !col || getline('.')[col - 1]  =~# '\s'
endfunction

" TextEdit might fail if hidden is not set.
set hidden

" Some servers have issues with backup files, see #649.
set nobackup
set nowritebackup

" Give more space for displaying messages.
set cmdheight=2

" Having longer updatetime (default is 4000 ms = 4 s) leads to noticeable
" delays and poor user experience.
set updatetime=300

" Don't pass messages to |ins-completion-menu|.
set shortmess+=c

" Always show the signcolumn, otherwise it would shift the text each time
" diagnostics appear/become resolved.
if has("patch-8.1.1564")
  " Recently vim can merge signcolumn and number column into one
  set signcolumn=number
else
  set signcolumn=yes
endif

"-------------------------------------------------------------
" COMMENTER
" Add spaces after comment delimiters by default
let g:NERDSpaceDelims = 1
" Use compact syntax for prettified multi-line comments
let g:NERDCompactSexyComs = 1
" Enable trimming of trailing whitespace when uncommenting
let g:NERDTrimTrailingWhitespace = 1


"-------------------------------------------------------------
" PYTHON PROVIDERS {{{

if has('macunix')

" OSX

let g:python3_host_prog = '/usr/local/bin/python3' " -- Set python 3 provider

let g:python_host_prog = '/usr/local/bin/python2' " --- Set python 2 provider

elseif has('unix')

" Ubuntu

let g:python3_host_prog = '/usr/bin/python3' " -------- Set python 3 provider

let g:python_host_prog = '/usr/bin/python' " ---------- Set python 2 provider

elseif has('win32') || has('win64')

" Window

endif

" }}}
