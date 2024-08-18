local M = {}

-- ':silent execute "! code --goto %:" . getcurpos()[1] . ":" . getcurpos()[2] <bar> q!<CR>',
function M.openVscodeAtPosition(shouldCloseBuffer)
  shouldCloseBuffer = shouldCloseBuffer or false

  local curpos = vim.fn.getcurpos()
  local command = string.format("!code --goto %s:%d:%d", vim.fn.expand "%:p", curpos[2], curpos[3])
  vim.cmd(":silent " .. command)

  if shouldCloseBuffer then vim.cmd "q!" end
end

function M.openVscodeWithWorkspaceEnabledIfAvailable()
  -- Temporary log file path
  local log_file = "/tmp/workspace_modification.log"
  local log = io.open(log_file, "w")

  -- Helper function to write logs
  local function log_message(message)
    if log == nil then
      print "Failed to open log file for writing."
      return
    end
    log:write(message .. "\n")
    log:flush()
  end

  -- Get the root directory of the repo
  local git_root = vim.fn.systemlist("git rev-parse --show-toplevel")[1]
  log_message("Git root directory: " .. git_root)

  if git_root ~= "" then
    -- Get the parent directory of the git root
    local parent_dir = vim.fn.fnamemodify(git_root, ":h")
    log_message("Parent directory: " .. parent_dir)

    -- Get the name of the git root folder
    local root_folder_name = vim.fn.fnamemodify(git_root, ":t")
    log_message("Root folder name to search for: " .. root_folder_name)

    -- Find the .code-workspace files in the parent directory and use only the first one
    local workspace_files = vim.fn.glob(parent_dir .. "/*.code-workspace", false, true)
    if #workspace_files > 0 then
      local workspace_file = workspace_files[1] -- Use the first file found
      log_message("Workspace file selected: " .. workspace_file)

      -- Read the workspace file
      local lines = vim.fn.readfile(workspace_file)
      local modified = false

      -- Search and modify lines matching the pattern
      for i, line in ipairs(lines) do
        log_message("Checking line: " .. line) -- Log each line for debugging
        log_message("Using pattern: " .. root_folder_name)

        -- Attempt the match
        if string.find(line, root_folder_name, 1, true) then
          log_message("Match found in line: " .. line)
          -- Ensure the line is uncommented by removing leading '//' or any comment characters
          local new_line = line:gsub("// ", "")
          if new_line ~= line then
            lines[i] = new_line
            modified = true
            log_message("Modified line: " .. new_line)
          end
        else
          log_message("No match found in line: " .. line)
        end
      end

      if modified then
        -- Write the updated lines back to the workspace file
        vim.fn.writefile(lines, workspace_file)
        log_message "Workspace file modified and saved."
      else
        log_message "No changes made to the workspace file."
      end
    else
      log_message "No .code-workspace file found in the parent directory."
    end
  else
    log_message "Not in a Git repository."
  end

  -- Run the command to open the file in VSCode
  M.openVscodeAtPosition(false)

  -- Close the log file
  log:close()

  -- Notify the user where to find the log file
  print("Log written to " .. log_file)
end

return M
