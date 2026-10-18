import bcrypt from "bcryptjs";
import { pool } from "./db.js";
import { config } from "./config.js";

// Ninguém consegue se cadastrar como Administrador pela API (o cadastro público
// sempre cria perfil COMUM). Por isso o primeiro administrador nasce aqui, a
// partir das variáveis ADMIN_EMAIL e ADMIN_SENHA. Se o e-mail já existe, nada muda.
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Tenta de novo se o banco ainda estiver ligando (acontece na primeira subida,
// quando o MySQL cria o schema antes de aceitar conexões da rede).
export async function criarAdminInicial(tentativas = 10) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      await criarAdmin();
      return;
    } catch (erro) {
      if (i === tentativas) throw erro;
      console.log(`Banco ainda não está pronto (${erro.code ?? erro.message}). Tentativa ${i}/${tentativas}...`);
      await esperar(3000);
    }
  }
}

async function criarAdmin() {
  const { nome, email, senha } = config.admin;
  if (!email || !senha) {
    console.warn("ADMIN_EMAIL/ADMIN_SENHA não definidos: nenhum administrador inicial criado.");
    return;
  }

  const [existente] = await pool.query("SELECT id_usuario FROM usuario WHERE email = ?", [
    email.toLowerCase(),
  ]);
  if (existente.length > 0) return;

  const senhaHash = await bcrypt.hash(senha, 10);
  await pool.query(
    "INSERT INTO usuario (nome, email, senha_hash, perfil) VALUES (?, ?, ?, 'ADMIN')",
    [nome, email.toLowerCase(), senhaHash]
  );
  console.log(`Administrador inicial criado: ${email}`);
}
