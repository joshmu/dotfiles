return {
  -- You can also add new plugins here as well:
  -- Add plugins, the lazy syntax
  -- "andweeb/presence.nvim",
  -- {
  --   "ray-x/lsp_signature.nvim",
  --   event = "BufRead",
  --   config = function()
  --     require("lsp_signature").setup()
  --   end,
  -- },
  {
    "nvim-neo-tree/neo-tree.nvim",
    opts = {
      window = {
        position = "right",
      },
      filesystem = {
        filtered_items = {
          visible = true, -- show dot files but remain dimmed
          -- show_hidden_count = true,
          -- hide_dotfiles = false,
          -- hide_gitignored = false,
          -- always_show = {
          --   ".gitingore",
          -- },
          never_show = {
            ".git",
            ".DS_Store",
            "thumbs.db",
          },
        },
      },
    },
  },
  { "dracula/vim" },
  { "mhartington/oceanic-next" },
  { "justinmk/vim-sneak" },
}
