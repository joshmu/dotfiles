-- extending telescope with new plugin
-- https://docs.astronvim.com/recipes/custom_plugins/
return {
  "nvim-telescope/telescope.nvim",
  dependencies = { -- add a new dependency to telescope that is our new plugin
    {
      -- https://github.com/nvim-telescope/telescope-live-grep-args.nvim
      "nvim-telescope/telescope-live-grep-args.nvim",
      -- This will not install any breaking changes.
      -- For major updates, this must be adjusted manually.
      version = "^1.0.0",
    },
  },
  -- the first parameter is the plugin specification
  -- the second is the table of options as set up in Lazy with the `opts` key
  config = function(plugin, opts)
    -- run the core AstroNvim configuration function with the options table
    require "plugins.configs.telescope" (plugin, opts)

    -- require telescope and load extensions as necessary
    local telescope = require "telescope"
    telescope.load_extension "live_grep_args"

    local lga_actions = require "telescope-live-grep-args.actions"

    telescope.setup {
      extensions = {
        live_grep_args = {
          auto_quoting = true,
          mappings = {
            -- todo: these mappings are not working...
            i = {
              ["<C-k>"] = lga_actions.quote_prompt(),
              ["<C-i>"] = lga_actions.quote_prompt { postfix = " --iglob " },
            },
          },
        },
      },
    }
  end,
}
