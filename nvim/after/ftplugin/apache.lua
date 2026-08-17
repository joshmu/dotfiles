-- Extra behaviour for Apache httpd config, layered over runtime/ftplugin/apache.vim.
--
-- There is no Apache language server (nothing in the Mason registry or
-- nvim-lspconfig) and no treesitter parser, so structural navigation has to
-- come from matchit. AEM dispatcher vhosts run to hundreds of lines of nested
-- container directives, which makes `%` the main way to move between them.

-- `%` jumps between a container directive and its closing tag, e.g.
-- <VirtualHost *:80> <-> </VirtualHost>, <IfModule ...> <-> </IfModule>.
vim.b.match_words = [[<\(\a\+\)[^>]*>:</\1>]]

-- NOTE: folding is left alone on purpose. nvim-ufo owns 'foldmethod' and falls
-- back to its indent provider when no LSP is attached, which already folds
-- these blocks correctly.
