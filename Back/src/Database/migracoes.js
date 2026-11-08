import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PASTA_MIGRACOES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "migrations"
);

const NOME_DO_BLOQUEIO = "sistema_reviews_migracoes";

// Aplica, em ordem, as migrações (arquivos NNN_nome.sql) que ainda não rodaram
// neste banco e anota cada uma na tabela schema_migrations. Assim todo banco
// (novo, antigo, de outro colega, de produção) chega ao mesmo schema.
//
// `conexao` precisa ter query() e aceitar vários comandos por chamada
// (multipleStatements). Como o DDL do MySQL não pode ser desfeito, escreva as
// migrações de forma repetível (IF NOT EXISTS...): se uma falhar no meio, ela
// não é anotada e roda de novo na próxima subida.
export async function aplicarMigracoes(conexao, pasta = PASTA_MIGRACOES, log = console.log) {
  // Bloqueio: duas instâncias subindo ao mesmo tempo não aplicam a mesma migração duas vezes
  const [[{ travou }]] = await conexao.query("SELECT GET_LOCK(?, 60) AS travou", [NOME_DO_BLOQUEIO]);
  if (travou !== 1) throw new Error("Não foi possível obter o bloqueio das migrações do banco");

  try {
    await conexao.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         versao       VARCHAR(100) NOT NULL,
         aplicada_em  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
         PRIMARY KEY (versao)
       ) ENGINE=InnoDB`
    );
    const [linhas] = await conexao.query("SELECT versao FROM schema_migrations");
    const jaAplicadas = new Set(linhas.map((l) => l.versao));

    // O prefixo numérico com zeros (001, 002...) mantém a ordem alfabética = ordem de execução
    const arquivos = (await fs.readdir(pasta)).filter((n) => /^\d+_.+\.sql$/.test(n)).sort();

    const aplicadas = [];
    for (const arquivo of arquivos) {
      if (jaAplicadas.has(arquivo)) continue;
      await conexao.query(await fs.readFile(path.join(pasta, arquivo), "utf8"));
      await conexao.query("INSERT INTO schema_migrations (versao) VALUES (?)", [arquivo]);
      log(`Migração aplicada: ${arquivo}`);
      aplicadas.push(arquivo);
    }
    return aplicadas;
  } finally {
    await conexao.query("SELECT RELEASE_LOCK(?)", [NOME_DO_BLOQUEIO]);
  }
}
