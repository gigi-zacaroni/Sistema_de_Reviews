import mysql from "mysql2/promise";

// Pool de conexões com o MySQL. Os valores vêm das variáveis de ambiente
// (definidas no docker-compose.yml ou no arquivo .env).
export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});
