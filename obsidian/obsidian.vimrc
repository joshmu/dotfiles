" list of available commands via obsidian note look for -> 'obcommands via dataview'

" Normal mode mapping
imap jk <Esc>

" workaround for 'Space' to be the 'Leader' key
unmap <Space>

" quick open
exmap switcher_open obcommand switcher:open
nmap <Space>ff :switcher_open<CR>

" go to link
exmap followLink :obcommand editor:follow-link
nmap gd :followLink<CR>

" go to backlinks
exmap backlinks :obcommand backlink:open-backlinks
nmap gr :backlinks<CR>

" global search
exmap global_search obcommand global-search:open
nmap <Space>fw :global_search<CR>

" Yank to system clipboard
set clipboard=unnamed

" Go back and forward with Ctrl+O and Ctrl+I
" (make sure to remove default Obsidian shortcuts for these to work)
exmap back obcommand app:go-back
nmap <C-o> :back<CR>
exmap forward obcommand app:go-forward
nmap <C-i> :forward<CR>

" Surround mappings
exmap surround_wiki surround [[ ]]
exmap surround_double_quotes surround " "
exmap surround_single_quotes surround ' '
exmap surround_backticks surround ` `
exmap surround_brackets surround ( )
exmap surround_square_brackets surround [ ]
exmap surround_curly_brackets surround { }

" NOTE: must use 'map' and not 'nmap'
map [[ :surround_wiki
nunmap s
vunmap s
map s" :surround_double_quotes<CR>
map s' :surround_single_quotes<CR>
map s` :surround_backticks<CR>
map sb :surround_brackets<CR>
map s( :surround_brackets<CR>
map s) :surround_brackets<CR>
map s[ :surround_square_brackets<CR>
map s[ :surround_square_brackets<CR>
map s{ :surround_curly_brackets<CR>
map s} :surround_curly_brackets<CR>

" Emulate Folding https://vimhelp.org/fold.txt.html#fold-commands
exmap togglefold obcommand editor:toggle-fold
nmap zo :togglefold<CR>
nmap zc :togglefold<CR>
nmap za :togglefold<CR>

exmap unfoldall obcommand editor:unfold-all
nmap zR :unfoldall<CR>

exmap foldall obcommand editor:fold-all
nmap zM :foldall<CR>

" Emulate Tab Switching https://vimhelp.org/tabpage.txt.html#gt
" requires Cycle Through Panes Plugins https://obsidian.md/plugins?id=cycle-through-panes
exmap tabnext obcommand cycle-through-panes:cycle-through-panes
nmap gt :tabnext<CR>
exmap tabprev obcommand cycle-through-panes:cycle-through-panes-reverse
nmap gT :tabprev<CR>

" custom command to toggle markdown checkbox
exmap toggle_checkbox :obcommand editor:toggle-checklist-status
nmap <Space>d :toggle_checkbox<CR>

" open 'right click' context menu
exmap contextmenu obcommand editor:context-menu
nmap gh :contextmenu<CR>

" shell command - open current file in cursor
exmap open_file_in_cursor :obcommand obsidian-shellcommands:shell-command-cjzvhvijz4
nmap <Space>oc :open_file_in_cursor<CR>
