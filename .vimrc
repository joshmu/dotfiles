syntax on

inoremap jk <Esc>

" remove scroll bars
set guioptions=

" text wraps and newline isn't created
" set textwidth=80
" set wrap

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
set clipboard=unnamedplus

" Give more space for displaying messages.
set cmdheight=2

" Having longer updatetime (default is 4000 ms = 4 s) leads to noticeable
" delays and poor user experience.
set updatetime=50

" Don't pass messages to |ins-completion-menu|.
set shortmess+=c

set colorcolumn=80
" highlight ColorColumn ctermbg=0 guibg=lightgrey

" soft wrap hack
autocmd VimResized * if (&columns > 80) | set columns=80 | endif
set wrap
set linebreak
set showbreak=+++

call plug#begin('~/.vim/plugged')

Plug 'ThePrimeagen/vim-be-good'
Plug 'justinmk/vim-sneak'
Plug 'jiangmiao/auto-pairs'
Plug 'sheerun/vim-polyglot'
Plug 'vim-airline/vim-airline'
Plug 'vim-airline/vim-airline-themes'
Plug 'ycm-core/YouCompleteMe'
Plug 'morhetz/gruvbox'
Plug 'jremmen/vim-ripgrep'
Plug 'tpope/vim-fugitive'
Plug 'leafgarland/typescript-vim'
Plug 'vim-utils/vim-man'
Plug 'ctrlpvim/ctrlp.vim'
Plug 'mbbill/undotree'

call plug#end()

if executable('rg')
    let g:rg_derive_root='true'
endif

let g:ctrlp_user_command = ['.git/', 'git --git-dir=%s/.git ls-files -oc --exclude-standard']
let mapleader = " "

let g:netrw_browse_split = 1
let g:netrw_banner = 0
" let g:netrw_winsize = 25

let g:ctrlp_use_caching = 0

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

fun! GoYCM()
    nnoremap <buffer> <silent> <leader>gd :YcmCompleter GoTo<CR>
    nnoremap <buffer> <silent> <leader>gr :YcmCompleter GoToReferences<CR>
    nnoremap <buffer> <silent> <leader>rr :YcmCompleter RefactorRename<space>
endfun

fun! TrimWhitespace()
    let l:save = winsaveview()
    keeppatterns %s/\s\+$//e
    call winrestview(l:save)
endfun

autocmd BufWritePre * :call TrimWhitespace()
autocmd FileType typescript :call GoYCM()


set t_Co=256

colorscheme gruvbox
" colorscheme cobalt2
"
let g:airline_theme='gruvbox'
let g:airline_powerline_fonts = 1

set background=dark

set guifont=Fira\ Mono\ for\ Powerline

set cursorline
hi CursorLine term=none cterm=none guibg=Grey40
" hi CursorLine term=bold cterm=bold guibg=Grey40



