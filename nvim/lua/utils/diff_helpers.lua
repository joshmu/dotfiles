local M = {}

function M.diffview_toggle()
  local lib = require 'diffview.lib'
  local view = lib.get_current_view()
  if view then
    -- Current tabpage is a Diffview; close it
    vim.cmd.DiffviewClose()
  else
    -- No open Diffview exists: open a new one
    local commit_hash = require('utils.git_helpers').getLatestCommitHashFromCurrentFile()
    vim.cmd.DiffviewOpen(commit_hash .. '^!')
  end
end

return M
