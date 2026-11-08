import "dotenv/config";
import mysql from "mysql2/promise";
import { fileURLToPath } from "node:url";
import { config } from "../Configs/config.js";
import { aplicarMigracoes } from "./migracoes.js";

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ERROS_DE_CONEXAO = ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "PROTOCOL_CONNECTION_LOST"];

// Conecta (esperando o MySQL ligar, se preciso) e aplica as migrações pendentes.
// Chamada pelo server.js a cada subida da API; também pode ser rodada à mão:
//   npm run migrar
export async function migrarBanco(tentativas = 10) {
  for (let i = 1; ; i++) {
    let conexao;
    try {
      // Conexão própria (fora do pool) porque as migrações têm vários comandos SQL por arquivo
      conexao = await mysql.createConnection({
        host: config.db.host,
        port: config.db.porta,
        user: config.db.usuario,
        password: config.db.senha,
        database: config.db.banco,
        multipleStatements: true,
      });
      const aplicadas = await aplicarMigracoes(conexao);
      if (aplicadas.length === 0) console.log("Banco já está atualizado (nenhuma migração pendente).");
      return aplicadas;
    } catch (erro) {
      if (!ERROS_DE_CONEXAO.includes(erro.code) || i >= tentativas) throw erro;
      console.log(`Banco ainda não está pronto (${erro.code}). Tentativa ${i}/${tentativas}...`);
      await esperar(3000);
    } finally {
      await conexao?.end().catch(() => {});
    }
  }
}

// Rodado direto (npm run migrar)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrarBanco()
    .catch((erro) => {
      console.error("Falha nas migrações:", erro.message);
      process.exitCode = 1;
    });
}
