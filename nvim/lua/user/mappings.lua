-- Mapping data with "desc" stored directly by vim.keymap.set().
--
-- Please use this mappings table to set keyboard mapping since this is the
-- lower level configuration and more robust one. (which-key will
-- automatically pick-up stored data by this setting.)
return {
  -- first key is the mode
  n = {
    -- second key is the lefthand side of the map
    -- mappings seen under group name "Buffer"
    ["<leader>bn"] = { "<cmd>tabnew<cr>", desc = "New tab" },
    ["<leader>bD"] = {
      function()
        require("astronvim.utils.status").heirline.buffer_picker(
          function(bufnr) require("astronvim.utils.buffer").close(bufnr) end
        )
      end,
      desc = "Pick to close",
    },
    -- tables with the `name` key will be registered with which-key if it's installed
    -- this is useful for naming menus
    ["<leader>b"] = { name = "Buffers" },
    -- quick save
    -- ["<C-s>"] = { ":w!<cr>", desc = "Save File" },  -- change description but the same command
    ["<leader>gd"] = {
      -- diffview plugin
      -- function() vim.api.nvim_command "DiffviewOpen" end,
      require("user.utils.diff_helpers").diffview_toggle,
      desc = "View Git diff",
    },
    ["<leader>gl"] = {
      function()
        local commit_hash = require("user.utils.git_helpers").get_commit_hash_for_current_line()

        -- diffview plugin
        if commit_hash then
          local cmd = "DiffviewOpen " .. commit_hash .. "^!"
          vim.api.nvim_command(cmd)
        end
      end,
      desc = "Line diff",
    },
    ["gh"] = {
      function() vim.lsp.buf.hover() end,
      desc = "Hover symbol details",
    },
    ["<leader><Esc>"] = {
      function() require("notify").dismiss() end,
      desc = "Dismiss notifications",
    },
    ["vs"] = {
      ':silent execute "! code --goto %:" . getcurpos()[1] . ":" . getcurpos()[2] <bar> q!<CR>',
      desc = "Goto VScode",
    },
  },
  t = {
    -- setting a mapping to false will disable it
    -- ["<esc>"] = false,
  },
}
