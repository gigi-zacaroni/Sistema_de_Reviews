import mysql from "mysql2/promise";
import { config } from "../Configs/config.js";
import { traduzirErroBanco } from "./traduzirErroBanco.js";

// Pool de conexões com o MySQL. Os valores vêm das variáveis de ambiente
// (definidas no docker-compose.yml ou no arquivo .env).
export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.porta,
  user: config.db.usuario,
  password: config.db.senha,
  database: config.db.banco,
  waitForConnections: true,
  connectionLimit: 10,
});

// Envolve um pool ou uma conexão: qualquer erro do MySQL sai já traduzido
// (ver traduzirErroBanco). Os repositórios só enxergam este objeto.
export function comTraducaoDeErros(executor) {
  return {
    async query(...argumentos) {
      try {
        return await executor.query(...argumentos);
      } catch (erro) {
        throw traduzirErroBanco(erro);
      }
    },
  };
}

// Usado pelo /health: falha se o banco não responder
export async function verificarBanco() {
  await pool.query("SELECT 1");
}
