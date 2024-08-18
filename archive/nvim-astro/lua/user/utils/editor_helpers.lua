local M = {}

function M.print_to_editor(txt)
  -- do nothing if txt is nil or not a string
  if not txt or type(txt) ~= "string" then return end

  -- insert the current_line output onto the document
  vim.api.nvim_put({ txt }, "l", true, true)
end

return M
