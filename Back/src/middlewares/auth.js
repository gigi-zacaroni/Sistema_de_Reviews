import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { pool } from "../db.js";
import { ErroHttp, validarId } from "../utils/validacao.js";

// 1) AUTENTICAÇÃO: quem é você?
// Exige o cabeçalho "Authorization: Bearer <token>". Se o token for válido,
// carrega o usuário do banco em req.usuario. Buscar no banco garante que um
// usuário excluído, ou que mudou de perfil, não continue usando um token antigo.
export async function autenticar(req, res, next) {
  const [tipo, token] = (req.headers.authorization ?? "").split(" ");
  if (tipo !== "Bearer" || !token) {
    throw new ErroHttp(401, "Token não informado. Use o cabeçalho Authorization: Bearer <token>");
  }

  let payload;
  try {
    payload = jwt.verify(token, config.jwt.segredo, { algorithms: ["HS256"] });
  } catch {
    throw new ErroHttp(401, "Token inválido ou expirado");
  }

  const [linhas] = await pool.query(
    "SELECT id_usuario, nome, email, perfil FROM usuario WHERE id_usuario = ?",
    [payload.sub]
  );
  if (linhas.length === 0) {
    throw new ErroHttp(401, "Usuário do token não existe mais");
  }

  req.usuario = linhas[0];
  next();
}

// 2) AUTORIZAÇÃO POR PERFIL: o que você pode fazer?
// Uso: exigirPerfil("ADMIN"). Precisa vir depois de autenticar.
export function exigirPerfil(...perfisPermitidos) {
  return (req, res, next) => {
    if (!perfisPermitidos.includes(req.usuario.perfil)) {
      throw new ErroHttp(403, "Acesso negado: operação restrita ao perfil Administrador");
    }
    next();
  };
}

// 3) AUTORIZAÇÃO POR PROPRIEDADE: a própria conta ou um Administrador.
// Guarda o id do alvo (já validado) em req.idAlvo.
export function proprioOuAdmin(req, res, next) {
  const idAlvo = validarId(req.params.id);
  const ehProprio = req.usuario.id_usuario === idAlvo;
  const ehAdmin = req.usuario.perfil === "ADMIN";
  if (!ehProprio && !ehAdmin) {
    throw new ErroHttp(403, "Acesso negado: você só pode acessar a sua própria conta");
  }
  req.idAlvo = idAlvo;
  next();
}
