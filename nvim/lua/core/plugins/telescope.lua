-- NOTE: Plugins can specify dependencies.
--
-- The dependencies are proper plugin specifications as well - anything
-- you do for a plugin at the top level, you can do for a dependency.
--
-- Use the `dependencies` key to specify the dependencies of a particular plugin

return {
  { -- Fuzzy Finder (files, lsp, etc)
    'nvim-telescope/telescope.nvim',
    event = 'VimEnter',
    branch = '0.1.x',
    dependencies = {
      'nvim-lua/plenary.nvim',
      { -- If encountering errors, see telescope-fzf-native README for installation instructions
        'nvim-telescope/telescope-fzf-native.nvim',

        -- `build` is used to run some command when the plugin is installed/updated.
        -- This is only run then, not every time Neovim starts up.
        build = 'make',

        -- `cond` is a condition used to determine whether this plugin should be
        -- installed and loaded.
        cond = function()
          return vim.fn.executable 'make' == 1
        end,
      },
      { 'nvim-telescope/telescope-ui-select.nvim' },

      {
        -- https://github.com/nvim-telescope/telescope-live-grep-args.nvim
        'nvim-telescope/telescope-live-grep-args.nvim',
        -- This will not install any breaking changes.
        -- For major updates, this must be adjusted manually.
        version = '^1.0.0',
      },

      -- Useful for getting pretty icons, but requires a Nerd Font.
      { 'nvim-tree/nvim-web-devicons', enabled = vim.g.have_nerd_font },
    },
    config = function()
      local z_utils = require 'telescope._extensions.zoxide.utils'
      -- Telescope is a fuzzy finder that comes with a lot of different things that
      -- it can fuzzy find! It's more than just a "file finder", it can search
      -- many different aspects of Neovim, your workspace, LSP, and more!
      --
      -- The easiest way to use Telescope, is to start by doing something like:
      --  :Telescope help_tags
      --
      -- After running this command, a window will open up and you're able to
      -- type in the prompt window. You'll see a list of `help_tags` options and
      -- a corresponding preview of the help.
      --
      -- Two important keymaps to use while in Telescope are:
      --  - Insert mode: <c-/>
      --  - Normal mode: ?
      --
      -- This opens a window that shows you all of the keymaps for the current
      -- Telescope picker. This is really useful to discover what Telescope can
      -- do as well as how to actually do it!

      -- [[ Configure Telescope ]]
      -- See `:help telescope` and `:help telescope.setup()`
      require('telescope').setup {
        -- You can put your default mappings / updates / etc. in here
        --  All the info you're looking for is in `:help telescope.setup()`
        defaults = {
          layout_strategy = 'horizontal',
          layout_config = {
            horizontal = {
              prompt_position = 'top',
              preview_cutoff = 80,
            },
          },
          sorting_strategy = 'ascending',
          --- other configs
        }, --
        -- defaults = {
        --   layout_config = {
        --     bottom_pane = {
        --       height = 25,
        --       preview_cutoff = 120,
        --       prompt_position = 'top',
        --     },
        --     center = {
        --       height = 0.4,
        --       preview_cutoff = 40,
        --       prompt_position = 'top',
        --       width = 0.5,
        --     },
        --     cursor = {
        --       height = 0.9,
        --       preview_cutoff = 40,
        --       width = 0.8,
        --     },
        --     horizontal = {
        --       height = 0.9,
        --       -- preview_cutoff = 120,
        --       preview_cutoff = 80,
        --       prompt_position = 'bottom',
        --       width = 0.8,
        --     },
        --     vertical = {
        --       height = 0.9,
        --       preview_cutoff = 40,
        --       prompt_position = 'bottom',
        --       width = 0.8,
        --     },
        --   },
        --   mappings = {
        --     i = { ['<c-enter>'] = 'to_fuzzy_refine' },
        --   },
        -- },
        -- pickers = {}
        extensions = {
          ['ui-select'] = {
            require('telescope.themes').get_dropdown(),
          },
          live_grep_args = {
            auto_quoting = true,
          },
          zoxide = {
            prompt_title = '[Z]oxide',
            mappings = {
              default = {
                after_action = function(selection)
                  print('Update to (' .. selection.z_score .. ') ' .. selection.path)
                end,
              },
              ['<C-s>'] = {
                before_action = function(selection)
                  print 'before C-s'
                end,
                action = function(selection)
                  vim.cmd.edit(selection.path)
                end,
              },
              -- Opens the selected entry in a new split
              ['<C-q>'] = { action = z_utils.create_basic_command 'split' },
            },
          },
        },
      }

      -- Enable Telescope extensions if they are installed
      pcall(require('telescope').load_extension, 'fzf')
      pcall(require('telescope').load_extension, 'ui-select')
      pcall(require('telescope').load_extension, 'live_grep_args')
      pcall(require('telescope').load_extension, 'zoxide')

      -- See `:help telescope.builtin`
      local builtin = require 'telescope.builtin'

      local search_and_find = {
        s = '[S]earch',
        f = '[F]ind',
      }
      for key, term in pairs(search_and_find) do
        vim.keymap.set('n', '<leader>' .. key .. 'h', builtin.help_tags, { desc = term .. ' [H]elp' })
        vim.keymap.set('n', '<leader>' .. key .. 'k', builtin.keymaps, { desc = term .. ' [K]eymaps' })
        vim.keymap.set('n', '<leader>' .. key .. 'f', builtin.find_files, { desc = term .. ' [F]iles' })
        vim.keymap.set('n', '<leader>' .. key .. 's', builtin.builtin, { desc = term .. ' [S]elect Telescope' })
        -- vim.keymap.set('n', '<leader>' .. key .. 'w', builtin.grep_string, { desc = term .. ' current [W]ord' })
        -- vim.keymap.set('n', '<leader>' .. key .. 'w', builtin.live_grep, { desc = term .. ' grep [W]ord' })
        -- vim.keymap.set('n', '<leader>' .. key .. 'g', builtin.live_grep, { desc = term .. ' by [G]rep' })
        vim.keymap.set('n', '<leader>' .. key .. 'w', require('telescope').extensions.live_grep_args.live_grep_args, { desc = term .. ' grep *args [W]ord' })
        vim.keymap.set('n', '<leader>' .. key .. 'g', require('telescope').extensions.live_grep_args.live_grep_args, { desc = term .. ' by *args [G]rep' })

        vim.keymap.set('n', '<leader>' .. key .. 'd', builtin.diagnostics, { desc = term .. ' [D]iagnostics' })
        vim.keymap.set('n', '<leader>' .. key .. 'r', builtin.resume, { desc = term .. ' [R]esume' })
        vim.keymap.set('n', '<leader>' .. key .. '.', builtin.oldfiles, { desc = term .. ' Recent Files ("." for repeat)' })

        vim.keymap.set('n', '<leader>' .. key .. 'b', builtin.buffers, { desc = term .. ' Existing [B]uffers' })

        -- zoxide
        vim.keymap.set('n', '<leader>' .. key .. 'z', require('telescope').extensions.zoxide.list, { desc = term .. ' [Z]oxide' })

        -- Shortcut for searching your Neovim configuration files
        vim.keymap.set('n', '<leader>' .. key .. 'n', function()
          builtin.find_files { cwd = vim.fn.stdpath 'config' }
        end, { desc = term .. ' [N]eovim files' })
      end

      vim.keymap.set('n', '<leader><leader>', builtin.buffers, { desc = '[ ] Find existing buffers' })

      -- Slightly advanced example of overriding default behavior and theme
      vim.keymap.set('n', '<leader>/', function()
        -- You can pass additional configuration to Telescope to change the theme, layout, etc.
        builtin.current_buffer_fuzzy_find(require('telescope.themes').get_dropdown {
          winblend = 10,
          previewer = false,
        })
      end, { desc = '[/] Fuzzily search in current buffer' })

      -- It's also possible to pass additional configuration options.
      --  See `:help telescope.builtin.live_grep()` for information about particular keys
      vim.keymap.set('n', '<leader>s/', function()
        builtin.live_grep {
          grep_open_files = true,
          prompt_title = 'Live Grep in Open Files',
        }
      end, { desc = '[S]earch [/] in Open Files' })
    end,
  },
}
