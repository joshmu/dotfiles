return {
  'folke/snacks.nvim',
  opts = {
    image = {
      doc = {
        enabled = true,
        inline = true,
        float = true,
        max_width = 240,
        max_height = 120,
      },
    },
  },
  keys = {
    { '<leader>si', function() Snacks.image.hover() end, desc = 'Show image in float' },
    {
      '<leader>so',
      function()
        -- Find mermaid code block under cursor using treesitter
        local node = vim.treesitter.get_node()
        while node and node:type() ~= 'fenced_code_block' do
          node = node:parent()
        end
        if not node then
          vim.notify('No code block found under cursor', vim.log.levels.WARN)
          return
        end
        -- Extract the code content (skip the ``` lines)
        local start_row, _, end_row, _ = node:range()
        local lines = vim.api.nvim_buf_get_lines(0, start_row + 1, end_row, false)
        local content = table.concat(lines, '\n')
        -- Write to temp file and render
        local tmp = '/tmp/mermaid-preview.mmd'
        local out = '/tmp/mermaid-preview.png'
        local f = io.open(tmp, 'w')
        if f then
          f:write(content)
          f:close()
        end
        vim.fn.jobstart(
          string.format('mmdc -i %s -o %s -b transparent -s 4 && open %s', tmp, out, out),
          { detach = true }
        )
      end,
      ft = 'markdown',
      desc = 'Open mermaid diagram in Preview.app',
    },
  },
}
