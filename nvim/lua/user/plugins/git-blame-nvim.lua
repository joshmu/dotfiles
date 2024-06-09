return {
  "f-person/git-blame.nvim",
  event = "User AstroGitFile",
  config = function()
    -- disable the plugin if we are using the filepath includes the keywork 'obsidian'
    if vim.fn.expand("%:p"):find "obsidian" then vim.g.gitblame_enabled = false end
  end,
}
