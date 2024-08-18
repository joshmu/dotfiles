local M = {}

-- get the latest commit hash of the current file
function M.getLatestCommitHashFromCurrentFile()
  local filename = vim.fn.expand '%'
  local git_dir = vim.fn.system 'git rev-parse --show-toplevel'
  if git_dir == '' then
    return nil
  end
  git_dir = git_dir:gsub('\n', '')
  local git_hash = vim.fn.system('git -C ' .. git_dir .. ' log -n 1 --pretty=format:%H -- ' .. filename)
  if git_hash == '' then
    return nil
  end
  git_hash = git_hash:gsub('\n', '')
  return git_hash
end

function M.get_commit_hash_for_current_line()
  local current_line = vim.api.nvim_win_get_cursor(0)[1]
  local current_file = vim.fn.expand '%:p' -- Get the full path of the current file

  if current_file == '' or current_file == nil then
    print 'No file found'
    return nil
  end

  -- Constructing the git blame command
  local cmd = string.format(
    'git -C %s blame -L %d,+1 --porcelain -- %s',
    vim.fn.escape(vim.fn.fnamemodify(current_file, ':h'), ' '),
    current_line,
    vim.fn.escape(current_file, ' ')
  )

  -- Execute the command and capture the output
  local handle = io.popen(cmd, 'r')
  if not handle then
    print 'Failed to run git blame'
    return nil
  end

  local result = handle:read '*a'
  handle:close()

  -- Extract the commit hash from the result
  local commit_hash = string.match(result, '^%w+')
  if commit_hash then
    if commit_hash == '0000000000000000000000000000000000000000' or commit_hash == '00000000' then
      print 'No commit info found'
      return nil
    else
      return commit_hash
    end
  else
    print 'No commit info found'
    return nil
  end

  -- Example key mapping
  vim.api.nvim_set_keymap('n', '<YourKeyCombination>', ':lua print(get_commit_hash_for_current_line())<CR>', { noremap = true, silent = true })
end

return M
