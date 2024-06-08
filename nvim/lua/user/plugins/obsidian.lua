-- https://github.com/epwalsh/obsidian.nvim
return {
  "epwalsh/obsidian.nvim",
  version = "*", -- recommended, use latest release instead of latest commit
  lazy = true,
  ft = "markdown",
  -- Replace the above line with this if you only want to load obsidian.nvim for markdown files in your vault:
  -- event = {
  --   -- If you want to use the home shortcut '~' here you need to call 'vim.fn.expand'.
  --   -- E.g. "BufReadPre " .. vim.fn.expand "~" .. "/my-vault/**.md"
  --   "BufReadPre path/to/my-vault/**.md",
  --   "BufNewFile path/to/my-vault/**.md",
  -- },
  dependencies = {
    -- Required.
    "nvim-lua/plenary.nvim",

    -- see below for full list of optional dependencies 👇
  },
  opts = {
    workspaces = {
      {
        name = "obsidian-vault",
        path = "/Users/joshmu/Library/Mobile Documents/iCloud~md~obsidian/Documents/obsidian",
      },
      -- {
      --   name = "work",
      --   path = "~/vaults/work",
      -- },
      new_notes_location = "notes",
      -- notes_subdir = "inbox",
      -- new_notes_location = "notes_subdir",
      -- disable_frontmatter = true,
      template = {
        path = "/Users/joshmua/Library/Mobile Documents/iCloud~md~obsidian/Documents/obsidian/templates",
        default = "note.md",
      },
    },
  },
}
