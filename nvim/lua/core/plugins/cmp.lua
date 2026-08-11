return {
  {
    'saghen/blink.cmp',
    event = 'InsertEnter',
    version = '1.*',
    opts = {
      -- Menu navigation mirrors the LSP hover popup (keymaps.lua): j/k move,
      -- Esc dismisses. Ctrl is the modifier here because bare j/k type letters
      -- in insert mode; normal-mode <C-j>/<C-k> stay herdr/tmux pane nav.
      -- Every binding ends in 'fallback', so with the menu closed <C-k> is
      -- still digraphs, <CR> still reaches nvim-autopairs, and <Tab> still
      -- reaches copilot.vim's accept.
      keymap = {
        preset = 'default',
        ['<C-j>'] = { 'select_next', 'fallback' },
        ['<C-k>'] = { 'select_prev', 'fallback' }, -- shadows the preset's unused signature toggle
        ['<CR>'] = { 'select_and_accept', 'fallback' },
        ['<Tab>'] = { 'select_and_accept', 'snippet_forward', 'fallback' },
        ['<Esc>'] = { 'cancel', 'fallback' },
        ['<C-y>'] = { 'select_and_accept' },
        ['<C-n>'] = { 'select_next', 'fallback' },
        ['<C-p>'] = { 'select_prev', 'fallback' },
        ['<C-b>'] = { 'scroll_documentation_up', 'fallback' },
        ['<C-f>'] = { 'scroll_documentation_down', 'fallback' },
        ['<C-Space>'] = { 'show' },
        ['<C-l>'] = { 'snippet_forward', 'fallback' },
        ['<C-h>'] = { 'snippet_backward', 'fallback' },
      },
      appearance = {
        nerd_font_variant = 'mono',
      },
      completion = {
        documentation = {
          auto_show = true,
          auto_show_delay_ms = 200,
        },
      },
      sources = {
        default = { 'lazydev', 'lsp', 'path', 'snippets', 'buffer' },
        providers = {
          lazydev = {
            name = 'LazyDev',
            module = 'lazydev.integrations.blink',
            score_offset = 100,
          },
        },
      },
      fuzzy = { implementation = 'prefer_rust_with_warning' },
    },
    opts_extend = { 'sources.default' },
  },
}
