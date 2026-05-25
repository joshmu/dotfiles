return {
  'CopilotC-Nvim/CopilotChat.nvim',
  dependencies = {
    'github/copilot.vim', -- auth backend (already installed for ghost-text)
    'nvim-lua/plenary.nvim',
  },
  cmd = { 'CopilotChat', 'CopilotChatModels' },
  opts = {}, -- defaults: out-of-the-box copilot model
  keys = {
    -- highlight code, hit <C-l>, type an instruction to edit it
    { '<C-l>', ':CopilotChat<cr>', mode = 'v', desc = 'CopilotChat edit selection' },
  },
}
