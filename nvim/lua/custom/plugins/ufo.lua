return {
  'kevinhwang91/nvim-ufo',
  disable = false,
  dependencies = 'kevinhwang91/promise-async',
  config = function()
    vim.o.foldcolumn = '0'
    vim.wo.foldlevel = 99 -- feel free to decrease the value
    vim.o.foldlevelstart = 99
    vim.wo.foldenable = true
    vim.o.fillchars = [[eob: ,fold: ,foldopen:,foldsep: ,foldclose:]]

    vim.keymap.set('n', 'zR', require('ufo').openAllFolds)
    vim.keymap.set('n', 'zM', require('ufo').closeAllFolds)
    vim.keymap.set('n', 'zm', require('ufo').closeFoldsWith)
  end,
}
