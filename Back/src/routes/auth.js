import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool, comTransacao } from "../db.js";
import { config } from "../config.js";
import { autenticar } from "../middlewares/auth.js";
import { enviarEmailRecuperacao } from "../services/email.js";
import {
  ErroHttp,
  exigirTexto,
  validarEmail,
  validarSenha,
} from "../utils/validacao.js";

const router = Router();
const pastaAtual = path.dirname(fileURLToPath(import.meta.url));

// Hash de mentira usado quando o e-mail não existe, para o login gastar o mesmo
// tempo nos dois casos (e-mail inexistente x senha errada) e não revelar quem existe.
const HASH_FALSO = bcrypt.hashSync("senha-falsa-para-igualar-o-tempo", 10);

const hashDoToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// POST /auth/cadastro: cria uma conta. O perfil é sempre COMUM, mesmo que
// o corpo da requisição tente enviar outro valor.
router.post("/cadastro", async (req, res) => {
  const corpo = req.body ?? {};
  const nome = exigirTexto(corpo.nome, "nome", 100);
  const email = validarEmail(corpo.email);
  const senha = validarSenha(corpo.senha);

  // Regra 2: só o hash da senha vai para o banco
  const senhaHash = await bcrypt.hash(senha, 10);
  const [resultado] = await pool.query(
    "INSERT INTO usuario (nome, email, senha_hash) VALUES (?, ?, ?)",
    [nome, email, senhaHash]
  );

  res.status(201).json({ id_usuario: resultado.insertId, nome, email, perfil: "COMUM" });
});

// POST /auth/login: confere e-mail e senha e devolve o token JWT
router.post("/login", async (req, res) => {
  const { email, senha } = req.body ?? {};
  if (typeof email !== "string" || typeof senha !== "string") {
    throw new ErroHttp(400, "Informe email e senha");
  }

  const [linhas] = await pool.query(
    "SELECT id_usuario, nome, email, senha_hash, perfil FROM usuario WHERE email = ?",
    [email.trim().toLowerCase()]
  );
  const usuario = linhas[0];

  const senhaConfere = await bcrypt.compare(senha, usuario?.senha_hash ?? HASH_FALSO);
  if (!usuario || !senhaConfere) {
    throw new ErroHttp(401, "E-mail ou senha inválidos");
  }

  const token = jwt.sign({ perfil: usuario.perfil }, config.jwt.segredo, {
    algorithm: "HS256",
    subject: String(usuario.id_usuario),
    expiresIn: config.jwt.expiraEm,
  });

  res.json({
    token,
    tipo: "Bearer",
    expira_em: config.jwt.expiraEm,
    usuario: {
      id_usuario: usuario.id_usuario,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
    },
  });
});

// GET /auth/eu: devolve o usuário dono do token (útil para testar o login)
router.get("/eu", autenticar, (req, res) => {
  res.json(req.usuario);
});

// POST /auth/esqueci-senha: gera um token de uso único e envia o link por e-mail.
// A resposta é sempre a mesma, exista o e-mail ou não, para ninguém descobrir
// quais e-mails estão cadastrados.
router.post("/esqueci-senha", async (req, res) => {
  const email = validarEmail((req.body ?? {}).email);

  const [linhas] = await pool.query(
    "SELECT id_usuario, nome, email FROM usuario WHERE email = ?",
    [email]
  );
  const usuario = linhas[0];

  if (usuario) {
    // O token vai por e-mail; no banco fica só o hash dele
    const token = crypto.randomBytes(32).toString("hex");
    const { validadeMinutos } = config.recuperacaoSenha;

    // A validade é calculada pelo próprio MySQL (NOW()) para não depender de
    // fuso horário diferente entre a API e o banco.
    await comTransacao(async (conexao) => {
      await conexao.query("DELETE FROM recuperacao_senha WHERE expira_em < NOW()");
      // Um pedido novo invalida o anterior
      await conexao.query("DELETE FROM recuperacao_senha WHERE id_usuario = ?", [
        usuario.id_usuario,
      ]);
      await conexao.query(
        `INSERT INTO recuperacao_senha (id_usuario, token_hash, expira_em)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
        [usuario.id_usuario, hashDoToken(token), validadeMinutos]
      );
    });

    const link = `${config.appUrl}/auth/redefinir-senha?token=${token}`;

    // Sem await de propósito: o tempo de resposta não deve mudar se o e-mail existe.
    // Se o envio falhar, o erro aparece no log da API.
    enviarEmailRecuperacao({
      para: usuario.email,
      nome: usuario.nome,
      link,
      validadeMinutos,
    }).catch((erro) => console.error("Falha ao enviar e-mail de recuperação:", erro.message));
  }

  res.json({ mensagem: "Se o e-mail estiver cadastrado, enviamos um link para redefinir a senha." });
});

// GET /auth/redefinir-senha?token=...: página aberta pelo link do e-mail
router.get("/redefinir-senha", (req, res) => {
  res.set("Referrer-Policy", "no-referrer"); // o token está na URL
  res.set("Cache-Control", "no-store");
  res.sendFile(path.join(pastaAtual, "../../public/redefinir-senha.html"));
});

// POST /auth/redefinir-senha: troca a senha usando o token recebido por e-mail
router.post("/redefinir-senha", async (req, res) => {
  const { token, nova_senha } = req.body ?? {};
  if (typeof token !== "string" || token === "") {
    throw new ErroHttp(400, "token é obrigatório");
  }
  validarSenha(nova_senha, "nova_senha");

  await comTransacao(async (conexao) => {
    // FOR UPDATE trava a linha: dois cliques ao mesmo tempo não usam o token duas vezes
    const [linhas] = await conexao.query(
      `SELECT id_usuario FROM recuperacao_senha
        WHERE token_hash = ? AND expira_em > NOW() FOR UPDATE`,
      [hashDoToken(token)]
    );
    if (linhas.length === 0) {
      throw new ErroHttp(400, "Link inválido ou expirado. Peça a recuperação de senha novamente.");
    }

    const { id_usuario } = linhas[0];
    const novoHash = await bcrypt.hash(nova_senha, 10);
    await conexao.query("UPDATE usuario SET senha_hash = ? WHERE id_usuario = ?", [
      novoHash,
      id_usuario,
    ]);
    // Token usado (e quaisquer outros do mesmo usuário) é descartado
    await conexao.query("DELETE FROM recuperacao_senha WHERE id_usuario = ?", [id_usuario]);
  });

  res.json({ mensagem: "Senha redefinida com sucesso. Faça login com a nova senha." });
});

export default router;
