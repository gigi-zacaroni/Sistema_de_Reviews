import path from "node:path";
import { fileURLToPath } from "node:url";
import { useCases } from "../../container.js";

const { auth } = useCases;
const pastaAtual = path.dirname(fileURLToPath(import.meta.url));

// POST /auth/cadastro: cria uma conta (perfil sempre COMUM)
export const cadastrar = async (req, res) => {
  res.status(201).json(await auth.cadastrar(req.body ?? {}));
};

// POST /auth/login: confere e-mail e senha e devolve o token JWT
export const login = async (req, res) => {
  res.json(await auth.login(req.body ?? {}));
};

// GET /auth/eu: devolve o usuário dono do token (útil para testar o login)
export const obterUsuarioLogado = (req, res) => {
  res.json(req.usuario);
};

// POST /auth/esqueci-senha: a resposta é sempre a mesma, exista o e-mail ou não,
// para ninguém descobrir quais e-mails estão cadastrados.
export const esqueciSenha = async (req, res) => {
  await auth.solicitarRecuperacaoSenha((req.body ?? {}).email);
  res.json({ mensagem: "Se o e-mail estiver cadastrado, enviamos um link para redefinir a senha." });
};

// GET /auth/redefinir-senha?token=...: página aberta pelo link do e-mail
export const paginaRedefinirSenha = (req, res) => {
  res.set("Referrer-Policy", "no-referrer"); // o token está na URL
  res.set("Cache-Control", "no-store");
  res.sendFile(path.join(pastaAtual, "../../../public/redefinir-senha.html"));
};

// POST /auth/redefinir-senha: troca a senha usando o token recebido por e-mail
export const redefinirSenha = async (req, res) => {
  await auth.redefinirSenha(req.body ?? {});
  res.json({ mensagem: "Senha redefinida com sucesso. Faça login com a nova senha." });
};
