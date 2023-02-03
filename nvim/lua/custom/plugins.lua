return function(use)

  -- themes
  use 'dracula/vim'
  use 'mhartington/oceanic-next'

  -- startup
  use "lewis6991/impatient.nvim"
  use {
      'goolord/alpha-nvim',
      config = function ()
          -- require'alpha'.setup(require'alpha.themes.dashboard'.config)
      end
  }

  -- tree
  use {
    'nvim-tree/nvim-tree.lua',
    requires = {
      'nvim-tree/nvim-web-devicons', -- optional, for file icons
    },
    tag = 'nightly' -- optional, updated every week. (see issue #1193)
  }

  -- tabs
  use {
    'romgrk/barbar.nvim',
    requires = {'kyazdani42/nvim-web-devicons'}
  }

  -- tmux
  use 'christoomey/vim-tmux-navigator'

  -- surround
  use({
      "kylechui/nvim-surround",
      tag = "*", -- Use for stability; omit to use `main` branch for the latest features
      config = function()
          require("nvim-surround").setup({
              -- Configuration here, or leave empty to use defaults
          })
      end
  })

  -- sneak
  use 'justinmk/vim-sneak'

  --  react
  use 'maxmellon/vim-jsx-pretty'

end
