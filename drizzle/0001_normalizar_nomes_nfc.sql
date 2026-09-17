-- Custom SQL migration file, put your code below! --

-- Nomes gravados antes da correção do NFC podem estar em forma decomposta.
--
-- O marcador abaixo não é decorativo: o migrator do Drizzle divide o arquivo por ele
-- e executa cada pedaço num tx.execute() separado (node_modules/drizzle-orm/pg-core/dialect.js).
-- Sem o marcador, os dois UPDATE viajam como uma única string e o protocolo estendido do
-- Postgres (usado pelo PGlite e pelo driver do Neon) recusa múltiplos comandos numa só
-- preparação: "cannot insert multiple commands into a prepared statement".
UPDATE pessoas SET nome = normalize(nome, NFC) WHERE nome <> normalize(nome, NFC);
--> statement-breakpoint
UPDATE categorias SET nome = normalize(nome, NFC) WHERE nome <> normalize(nome, NFC);