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
    ["<leader>fw"] = {
      require("telescope").extensions.live_grep_args.live_grep_args,
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
    ["<leader>zz"] = {
      function()
        local scrolloff = vim.api.nvim_get_option "scrolloff"
        local notify = require "notify"
        if scrolloff == 0 then
          vim.api.nvim_set_option("scrolloff", 999)
          notify("Enabled", "info", { title = "Sticky Cursor Centre", render = "compact", timeout = 1000 })
        else
          vim.api.nvim_set_option("scrolloff", 0)
          notify("Disabled", "warn", { title = "Sticky Cursor Centre", render = "compact", timeout = 1000 })
        end
      end,
      desc = "Toggle Sticky Cursor Centre",
    },
    ["gh"] = {
      function() vim.lsp.buf.hover() end,
      desc = "Hover symbol details",
    },
    ["<leader><Esc>"] = {
      function() require("notify").dismiss() end,
      desc = "Dismiss notifications",
    },
    ["vg"] = {
      ':silent execute "! code --goto %:" . getcurpos()[1] . ":" . getcurpos()[2] <bar> q!<CR>',
      desc = "Goto VScode",
    },
    ["vs"] = {
      function()
        -- Temporary log file path
        local log_file = "/tmp/workspace_modification.log"
        local log = io.open(log_file, "w")

        -- Helper function to write logs
        local function log_message(message)
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
        local curpos = vim.fn.getcurpos()
        local command = string.format("!code --goto %s:%d:%d", vim.fn.expand "%:p", curpos[2], curpos[3])
        vim.cmd(":silent " .. command)
        -- Close the buffer
        -- vim.cmd "q!"

        -- Close the log file
        log:close()

        -- Notify the user where to find the log file
        print("Log written to " .. log_file)
      end,
      desc = "Goto VSCode and handle workspace file",
    },
    ["<leader>on"] = {
      ":ObsidianTemplate note<CR>",
      desc = "New Obsidian note",
    },
    ["<leader>off"] = {
      function()
        require("telescope.builtin").find_files {
          search_dirs = { "/Users/joshmu/library/Mobile Documents/iCloud~md~obsidian/Documents/obsidian" },
        }
      end,
      desc = "Obsidian Find Files",
    },
    ["<leader>ofw"] = {
      function()
        require("telescope").extensions.live_grep_args.live_grep_args {
          search_dirs = { "/Users/joshmu/library/Mobile Documents/iCloud~md~obsidian/Documents/obsidian" },
        }
      end,
      desc = "Obsidian Grep",
    },
  },
  t = {
    -- setting a mapping to false will disable it
    -- ["<esc>"] = false,
  },
}
