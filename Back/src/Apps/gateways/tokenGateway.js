import jwt from "jsonwebtoken";
import crypto from "node:crypto";

export function criarTokenGateway(config) {
  const hashDoToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

  return {
    expiraEm: config.jwt.expiraEm,

    // Token de acesso (JWT) do usuário logado
    gerarAcesso({ idUsuario, perfil }) {
      return jwt.sign({ perfil }, config.jwt.segredo, {
        algorithm: "HS256",
        subject: String(idUsuario),
        expiresIn: config.jwt.expiraEm,
      });
    },

    // Devolve o id do usuário dono do token, ou null se for inválido/expirado
    verificarAcesso(token) {
      try {
        const payload = jwt.verify(token, config.jwt.segredo, { algorithms: ["HS256"] });
        return payload.sub;
      } catch {
        return null;
      }
    },

    // O token vai por e-mail; no banco fica só o hash dele
    gerarTokenRecuperacao() {
      const token = crypto.randomBytes(32).toString("hex");
      return { token, hash: hashDoToken(token) };
    },

    hashDoToken,
  };
}
