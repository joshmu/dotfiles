-- '(╯°□°)╯︵ ┻━┻'
return {
  'goolord/alpha-nvim',
  -- dependencies = { 'echasnovski/mini.icons' },
  dependencies = { 'nvim-tree/nvim-web-devicons' },
  config = function()
    local alpha = require 'alpha'
    local dashboard = require 'alpha.themes.dashboard'

    -- Set header
    dashboard.section.header.val = {
      '',
      '',
      '',
      '(╯°□°)╯︵ ┻━┻',
    }

    dashboard.section.buttons.val = {}

    -- Send config to alpha
    alpha.setup(dashboard.config)
  end,
}
