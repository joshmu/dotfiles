-- [[ Filetype detection ]]
--  See `:help vim.filetype.add`

-- ============================================================================
-- Apache httpd config (AEM dispatcher projects)
-- ============================================================================
-- Neovim ships syntax/apache.vim and ftplugin/apache.vim, but only detects the
-- `apache` filetype under system paths (/etc/httpd, /etc/apache2). Projects
-- that vendor their httpd config in-repo (AEM dispatcher being the common
-- case) get nothing useful:
--
--   *.vhost   no filetype at all (zero highlighting)
--   *.rules   misdetected as `hog` (Snort/Hogwash config)
--   *.vars    generic `conf`
--   *.conf    generic `conf`
--
-- `.vhost` is unambiguous, so it maps by extension. The rest are generic
-- extensions owned by plenty of other tools (semgrep rules, udev rules, ...),
-- so they are scoped by path to the dispatcher's conf.d/ layout.
--
-- conf.dispatcher.d/ is deliberately left alone: *.any and *.farm are the
-- dispatcher's own config language, not httpd, and `conf` suits them better.

vim.filetype.add {
  extension = {
    vhost = 'apache',
  },
  pattern = {
    -- Patterns are checked before extensions, so these win over builtin `conf`.
    ['.*/conf%.d/.*%.rules'] = 'apache',
    ['.*/conf%.d/.*%.vars'] = 'apache',
    ['.*/conf%.d/.*%.conf'] = 'apache',
  },
}
