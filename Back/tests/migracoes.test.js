import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { aplicarMigracoes, PASTA_MIGRACOES } from "../Src/Database/migracoes.js";

// Conexão falsa: guarda o que foi executado e simula a tabela schema_migrations
function criarConexaoFalsa({ jaAplicadas = [], travou = 1 } = {}) {
  const executados = [];
  return {
    executados,
    async query(sql, params) {
      executados.push(sql.trim());
      if (sql.includes("GET_LOCK")) return [[{ travou }]];
      if (sql.includes("FROM schema_migrations")) return [jaAplicadas.map((versao) => ({ versao }))];
      return [[]];
    },
  };
}

async function criarPasta(arquivos) {
  const pasta = await fs.mkdtemp(path.join(os.tmpdir(), "migr-"));
  for (const [nome, sql] of Object.entries(arquivos)) await fs.writeFile(path.join(pasta, nome), sql);
  return pasta;
}

test("migrações: aplica só as pendentes, em ordem, e anota cada uma", async () => {
  const pasta = await criarPasta({
    "002_b.sql": "SQL-B;",
    "001_a.sql": "SQL-A;",
    "003_c.sql": "SQL-C;",
    "leiame.txt": "ignorado",
  });
  const conexao = criarConexaoFalsa({ jaAplicadas: ["001_a.sql"] });

  const aplicadas = await aplicarMigracoes(conexao, pasta, () => {});

  assert.deepEqual(aplicadas, ["002_b.sql", "003_c.sql"]);
  const ordem = conexao.executados.filter((s) => s.startsWith("SQL-"));
  assert.deepEqual(ordem, ["SQL-B;", "SQL-C;"]);
  assert.ok(conexao.executados.some((s) => s.startsWith("INSERT INTO schema_migrations")));
  assert.ok(conexao.executados.at(-1).includes("RELEASE_LOCK"));
});

test("migrações: banco atualizado não executa nada", async () => {
  const pasta = await criarPasta({ "001_a.sql": "SQL-A;" });
  const conexao = criarConexaoFalsa({ jaAplicadas: ["001_a.sql"] });
  assert.deepEqual(await aplicarMigracoes(conexao, pasta, () => {}), []);
  assert.equal(conexao.executados.filter((s) => s.startsWith("SQL-")).length, 0);
});

test("migrações: falha numa migração não é anotada e libera o bloqueio", async () => {
  const pasta = await criarPasta({ "001_a.sql": "QUEBRADO;" });
  const conexao = criarConexaoFalsa();
  const original = conexao.query;
  conexao.query = async (sql, p) => {
    if (sql.startsWith("QUEBRADO")) throw new Error("erro de sintaxe");
    return original(sql, p);
  };
  await assert.rejects(aplicarMigracoes(conexao, pasta, () => {}), /erro de sintaxe/);
  assert.ok(!conexao.executados.some((s) => s.startsWith("INSERT INTO schema_migrations")));
  assert.ok(conexao.executados.at(-1).includes("RELEASE_LOCK"));
});

test("migrações: sem conseguir o bloqueio, não aplica nada", async () => {
  const pasta = await criarPasta({ "001_a.sql": "SQL-A;" });
  await assert.rejects(aplicarMigracoes(criarConexaoFalsa({ travou: 0 }), pasta, () => {}), /bloqueio/);
});

// Guarda contra o problema original: tabela existe no schema.sql mas não nas migrações
test("toda tabela do schema.sql é criada por alguma migração", async () => {
  const tabelas = (sql) =>
    [...sql.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)/gi)].map((m) => m[1]).sort();

  const schema = await fs.readFile(new URL("../Src/Schema/schema.sql", import.meta.url), "utf8");
  let migracoes = "";
  for (const f of (await fs.readdir(PASTA_MIGRACOES)).filter((n) => n.endsWith(".sql"))) {
    migracoes += await fs.readFile(path.join(PASTA_MIGRACOES, f), "utf8");
  }
  const naMigracao = new Set(tabelas(migracoes));
  const faltando = tabelas(schema).filter((t) => !naMigracao.has(t));
  assert.deepEqual(faltando, [], `Tabelas no schema.sql sem migração: ${faltando.join(", ")}`);
});
