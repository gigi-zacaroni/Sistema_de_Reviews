import { useCases } from "../../container.js";
import { ErroHttp, validarId } from "../../Utils/validacao.js";

// 1) AUTENTICAÇÃO: quem é você?
// Exige o cabeçalho "Authorization: Bearer <token>". Se o token for válido,
// carrega o usuário em req.usuario (a verificação fica no caso de uso).
export async function autenticar(req, res, next) {
  const [tipo, token] = (req.headers.authorization ?? "").split(" ");
  if (tipo !== "Bearer" || !token) {
    throw new ErroHttp(401, "Token não informado. Use o cabeçalho Authorization: Bearer <token>");
  }

  req.usuario = await useCases.auth.autenticarPorToken(token);
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
