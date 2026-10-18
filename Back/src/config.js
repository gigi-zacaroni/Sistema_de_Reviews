import "dotenv/config";

// Lê uma variável de ambiente obrigatória; se faltar, a API nem inicia
// (melhor falhar logo do que rodar sem segredo do JWT).
function obrigatoria(nome) {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(
      `Variável de ambiente ${nome} não definida. Copie Back/.env.example para Back/.env.`
    );
  }
  return valor;
}

export const config = {
  porta: Number(process.env.PORT ?? 3000),

  // Endereço público da API: usado para montar o link do e-mail de recuperação
  appUrl: process.env.APP_URL ?? "http://localhost:3000",

  jwt: {
    segredo: obrigatoria("JWT_SECRET"),
    expiraEm: process.env.JWT_EXPIRES_IN ?? "2h",
  },

  recuperacaoSenha: {
    validadeMinutos: Number(process.env.RESET_TOKEN_MINUTES ?? 30),
  },

  smtp: {
    host: process.env.SMTP_HOST ?? "localhost",
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: process.env.SMTP_SECURE === "true",
    usuario: process.env.SMTP_USER || undefined,
    senha: process.env.SMTP_PASS || undefined,
    remetente:
      process.env.MAIL_FROM ??
      "Sistema de Reviews <nao-responder@sistemareviews.local>",
  },

  // Administrador inicial, criado na subida da API se ainda não existir
  admin: {
    nome: process.env.ADMIN_NOME ?? "Administrador",
    email: process.env.ADMIN_EMAIL,
    senha: process.env.ADMIN_SENHA,
  },
};
