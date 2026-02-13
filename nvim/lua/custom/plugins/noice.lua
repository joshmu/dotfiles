return {
  {
    'folke/noice.nvim',
    event = 'VeryLazy',
    dependencies = {
      'MunifTanjim/nui.nvim',
      'rcarriga/nvim-notify',
    },
    opts = {
      lsp = {
        override = {
          ['vim.lsp.util.convert_input_to_markdown_lines'] = true,
          ['vim.lsp.util.stylize_markdown'] = true,
        },
        hover = {
          enabled = true,
        },
        signature = {
          enabled = true,
        },
      },
      views = {
        cmdline_popup = {
          position = {
            row = '50%',
            col = '50%',
          },
        },
      },
      notify = {
        enabled = true,
        view = 'notify',
      },
      presets = {
        bottom_search = true,
        command_palette = true,
        long_message_to_split = true,
        inc_rename = false,
        lsp_doc_border = true,
      },
    },
    config = function(_, opts)
      require('noice').setup(opts)
      -- Ensure vim.notify routes through noice -> nvim-notify
      vim.notify = require('notify')
    end,
  },
  {
    'rcarriga/nvim-notify',
    lazy = true,
    opts = {
      timeout = 5000,
      background_colour = '#000000',
      render = 'wrapped-compact',
      stages = 'static',
    },
  },
}
