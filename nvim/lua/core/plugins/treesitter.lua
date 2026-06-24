return {
  { -- Highlight, edit, and navigate code
    -- `main` branch: full rewrite for Neovim 0.12+ (set up from scratch).
    -- https://github.com/nvim-treesitter/nvim-treesitter/blob/main/README.md
    'nvim-treesitter/nvim-treesitter',
    branch = 'main',
    lazy = false, -- main branch does not support lazy-loading
    build = ':TSUpdate',
    config = function()
      require('nvim-treesitter').setup()

      -- Parsers to keep installed (replaces master's `ensure_installed`).
      require('nvim-treesitter').install {
        'bash',
        'c',
        'css',
        'diff',
        'html',
        'javascript',
        'json',
        'lua',
        'luadoc',
        'markdown',
        'markdown_inline',
        'mermaid',
        'query',
        'tsx',
        'typescript',
        'vim',
        'vimdoc',
      }

      -- Highlighting and indentation are no longer modules; enable per buffer.
      vim.api.nvim_create_autocmd('FileType', {
        group = vim.api.nvim_create_augroup('kickstart-treesitter', { clear = true }),
        callback = function(args)
          local buf = args.buf
          local ft = vim.bo[buf].filetype
          local lang = vim.treesitter.language.get_lang(ft) or ft

          -- Start TS highlighting; no-op if the parser for `lang` isn't installed.
          if not pcall(vim.treesitter.start, buf, lang) then
            return
          end

          -- Ruby relies on vim's regex highlighting for indent rules.
          if ft == 'ruby' then
            vim.bo[buf].syntax = 'on'
          else
            vim.bo[buf].indentexpr = "v:lua.require'nvim-treesitter'.indentexpr()"
          end
        end,
      })
    end,
  },
}
