-- disable netrw at the very start of your init.lua for 'nvim-tree'
vim.g.loaded_netrw = 1
vim.g.loaded_netrwPlugin = 1
require('plugins/nvim-tree')

require('plugins/alpha-nvim')

-- todo: use the new plugin config in this folder to replace the plugin config
--injected below for simplicity
require('plugins')

require('lsp-config')
require('cmp-config')
-- require('treesitter-config')
require('joshmu/settings')
require('joshmu/mappings')

-- auto install packer plugins when plugins.lua is updated
vim.cmd([[
augroup packer_user_config
autocmd!
autocmd BufWritePost plugins.lua source <afile> | PackerCompile
augroup end
]])


--[[
require('nvim-treesitter.configs').setup({
  ensure_installed = {'typescript'}, -- one of "all", "maintained" (parsers with maintainers), or a list of languages
  sync_install = false, -- install languages synchronously (only applied to `ensure_installed`)
  ignore_install = {}, -- List of parsers to ignore installing
  highlight = {
    enable = true,
    custom_captures = {
      -- Highlight the @foo.bar capture group with the "Identifier" highlight group.
      ["foo.bar"] = "Identifier",
    },
    -- Setting this to true will run `:h syntax` and tree-sitter at the same time.
    -- Set this to `true` if you depend on 'syntax' being enabled (like for indentation).
    -- Using this option may slow down your editor, and you may see some duplicate highlights.
    -- Instead of true it can also be a list of languages
    additional_vim_regex_highlighting = false,
  },
})
--]]
