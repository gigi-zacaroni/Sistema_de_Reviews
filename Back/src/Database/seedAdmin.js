import { useCases } from "../container.js";

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Cria o administrador inicial (a regra está em auth.garantirAdminInicial).
// Tenta de novo se o banco ainda estiver ligando (acontece na primeira subida,
// quando o MySQL cria o schema antes de aceitar conexões da rede).
export async function criarAdminInicial(tentativas = 10) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      const email = await useCases.auth.garantirAdminInicial();
      if (email) console.log(`Administrador inicial criado: ${email}`);
      return;
    } catch (erro) {
      if (i === tentativas) throw erro;
      console.log(`Banco ainda não está pronto (${erro.code ?? erro.message}). Tentativa ${i}/${tentativas}...`);
      await esperar(3000);
    }
  }
}
