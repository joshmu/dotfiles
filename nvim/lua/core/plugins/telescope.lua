return {
  { -- Fuzzy Finder (files, lsp, etc)
    'nvim-telescope/telescope.nvim',
    event = 'VimEnter',
    branch = 'master',
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
        },
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

      -- extra_args: rg flags appended to the default vimgrep_arguments
      local function grep_with_args(extra_args)
        local opts = {}
        if extra_args then
          opts.vimgrep_arguments = vim.list_extend(vim.deepcopy(require('telescope.config').values.vimgrep_arguments), extra_args)
        end
        local mode = vim.fn.mode()
        if mode == 'v' or mode == 'V' or mode == '\22' then
          opts.postfix = ' --hidden '
          require('telescope-live-grep-args.shortcuts').grep_visual_selection(opts)
        else
          require('telescope').extensions.live_grep_args.live_grep_args(opts)
        end
      end

      -- Everything: dot-dirs and gitignored files too (still skips .git/)
      local function grep_everything()
        grep_with_args { '--hidden', '--no-ignore', '--glob', '!.git/' }
      end

      vim.keymap.set('n', '<leader>fh', builtin.help_tags, { desc = 'Find [H]elp' })
      vim.keymap.set('n', '<leader>fk', builtin.keymaps, { desc = 'Find [K]eymaps' })
      vim.keymap.set('n', '<leader>fb', builtin.builtin, { desc = 'Find Telescope [B]uiltins' })
      vim.keymap.set({ 'n', 'v' }, '<leader>fg', function() grep_with_args() end, { desc = 'Find [G]rep' })
      vim.keymap.set({ 'n', 'v' }, '<leader>fG', grep_everything, { desc = 'Find [G]rep everywhere (hidden + ignored)' })
      vim.keymap.set({ 'n', 'v' }, '<leader>fw', function() grep_with_args() end, { desc = 'Find [W]ord (grep)' })
      vim.keymap.set({ 'n', 'v' }, '<leader>fW', grep_everything, { desc = 'Find [W]ord everywhere (hidden + ignored)' })
      vim.keymap.set('n', '<leader>fs', builtin.git_status, { desc = 'Find Git [S]tatus' })
      vim.keymap.set('n', '<leader>fd', builtin.diagnostics, { desc = 'Find [D]iagnostics' })
      vim.keymap.set('n', '<leader>fr', builtin.resume, { desc = 'Find [R]esume' })
      vim.keymap.set('n', '<leader>f.', builtin.oldfiles, { desc = 'Find Recent Files' })
      vim.keymap.set('n', '<leader>ff', function()
        require('telescope.builtin').find_files {
          find_command = { 'rg', '--files', '--iglob', '!.git', '--hidden' },
          previewer = false,
        }
      end, { desc = 'Find [F]iles' })
      vim.keymap.set('n', '<leader>fz', require('telescope').extensions.zoxide.list, { desc = 'Find [Z]oxide' })
      vim.keymap.set('n', '<leader>fn', function()
        builtin.find_files { cwd = vim.fn.stdpath 'config' }
      end, { desc = 'Find [N]eovim files' })

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
