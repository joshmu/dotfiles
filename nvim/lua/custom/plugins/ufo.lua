return {
  'kevinhwang91/nvim-ufo',
  dependencies = 'kevinhwang91/promise-async',
  config = function()
    vim.o.foldcolumn = '0'
    vim.wo.foldlevel = 99
    vim.o.foldlevelstart = 99
    vim.wo.foldenable = true

    require('ufo').setup()

    vim.keymap.set('n', 'zR', require('ufo').openAllFolds)
    vim.keymap.set('n', 'zM', require('ufo').closeAllFolds)
    vim.keymap.set('n', 'zm', require('ufo').closeFoldsWith)
  end,
}
