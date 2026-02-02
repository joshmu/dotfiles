return {
  {
    'rcarriga/nvim-notify',
    opts = {
      timeout = 5000,
      background_colour = '#000000',
      render = 'wrapped-compact',
    },
  },

  -- buffer line
  {
    'akinsho/bufferline.nvim',
    event = 'VeryLazy',
    keys = {
      { '<S-]>', '<Cmd>BufferLineCycleNext<CR>', desc = 'Next tab' },
      { '<S-[>', '<Cmd>BufferLineCyclePrev<CR>', desc = 'Prev tab' },
      { '<C-]>', '<Cmd>BufferLineCycleNext<CR>', desc = 'Next tab' }, -- want these
      { '<C-[>', '<Cmd>BufferLineCyclePrev<CR>', desc = 'Prev tab' },
      { ']b', '<Cmd>BufferLineCycleNext<CR>', desc = 'Next tab' }, -- want these
      { '[b', '<Cmd>BufferLineCyclePrev<CR>', desc = 'Prev tab' },
    },
    opts = {
      options = {
        -- mode = 'tabs',
        show_buffer_close_icons = false,
        show_close_icon = false,
      },
    },
  },

  -- filename
  -- https://github.com/b0o/incline.nvim
  {
    'b0o/incline.nvim',
    event = 'BufReadPre',
    priority = 1200,
    config = function()
      local helpers = require 'incline.helpers'
      local devicons = require 'nvim-web-devicons'
      require('incline').setup {
        window = {
          padding = 0,
          margin = { horizontal = 0 },
        },
        -- render = function(props)
        --   local filename = vim.fn.fnamemodify(vim.api.nvim_buf_get_name(props.buf), ':t')
        --   local ft_icon, ft_color = require('nvim-web-devicons').get_icon_color(filename)
        --   local modified = vim.bo[props.buf].modified
        --   local buffer = {
        --     ft_icon and { ' ', ft_icon, ' ', guibg = ft_color, guifg = helpers.contrast_color(ft_color) } or '',
        --     ' ',
        --     { filename, gui = modified and 'bold,italic' or 'bold' },
        --     ' ',
        --     guibg = '#363944',
        --   }
        --   return buffer
        -- end,
        render = function(props)
          local filename = vim.fn.fnamemodify(vim.api.nvim_buf_get_name(props.buf), ':t')
          if filename == '' then
            filename = '[No Name]'
          end
          local ft_icon, ft_color = devicons.get_icon_color(filename)

          local function get_git_diff()
            local icons = { removed = '', changed = '', added = '' }
            local signs = vim.b[props.buf].gitsigns_status_dict
            local labels = {}
            if signs == nil then
              return labels
            end
            for name, icon in pairs(icons) do
              if tonumber(signs[name]) and signs[name] > 0 then
                table.insert(labels, { icon .. signs[name] .. ' ', group = 'Diff' .. name })
              end
            end
            if #labels > 0 then
              table.insert(labels, { '┊ ' })
            end
            return labels
          end

          local function get_diagnostic_label()
            local icons = { error = '', warn = '', info = '', hint = '' }
            local label = {}

            for severity, icon in pairs(icons) do
              local n = #vim.diagnostic.get(props.buf, { severity = vim.diagnostic.severity[string.upper(severity)] })
              if n > 0 then
                table.insert(label, { icon .. n .. ' ', group = 'DiagnosticSign' .. severity })
              end
            end
            if #label > 0 then
              table.insert(label, { '┊ ' })
            end
            return label
          end

          return {
            { get_diagnostic_label() },
            { get_git_diff() },
            { (ft_icon or '') .. ' ', guifg = ft_color, guibg = 'none' },
            { filename .. ' ', gui = vim.bo[props.buf].modified and 'bold,italic' or 'bold' },
            { '┊  ' .. vim.api.nvim_win_get_number(props.win), group = 'DevIconWindows' },
          }
        end,
      }
    end,
  },
}
