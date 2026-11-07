import { colunasPermitidas } from "./colunas.js";

const COLUNAS = "id_usuario, nome, email, perfil, criado_em"; // nunca inclui senha_hash

export function criarUsuarioRepository(db) {
  return {
    async buscarPorId(id) {
      const [linhas] = await db.query(`SELECT ${COLUNAS} FROM usuario WHERE id_usuario = ?`, [id]);
      return linhas[0] ?? null;
    },

    // Dados mínimos que ficam em req.usuario depois da autenticação
    async buscarParaAutenticacao(id) {
      const [linhas] = await db.query(
        "SELECT id_usuario, nome, email, perfil FROM usuario WHERE id_usuario = ?",
        [id]
      );
      return linhas[0] ?? null;
    },

    // Único método que devolve senha_hash (usado no login)
    async buscarPorEmail(email) {
      const [linhas] = await db.query(
        "SELECT id_usuario, nome, email, senha_hash, perfil FROM usuario WHERE email = ?",
        [email]
      );
      return linhas[0] ?? null;
    },

    async listar() {
      const [linhas] = await db.query(`SELECT ${COLUNAS} FROM usuario ORDER BY nome`);
      return linhas;
    },

    async criar({ nome, email, senhaHash, perfil = "COMUM" }) {
      const [resultado] = await db.query(
        "INSERT INTO usuario (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)",
        [nome, email, senhaHash, perfil]
      );
      return resultado.insertId;
    },

    async atualizar(id, alteracoes) {
      const colunas = colunasPermitidas(alteracoes, ["nome", "email"]);
      await db.query(
        `UPDATE usuario SET ${colunas.map((c) => `${c} = ?`).join(", ")} WHERE id_usuario = ?`,
        [...Object.values(alteracoes), id]
      );
    },

    async atualizarPerfil(id, perfil) {
      await db.query("UPDATE usuario SET perfil = ? WHERE id_usuario = ?", [perfil, id]);
    },

    async atualizarSenha(id, senhaHash) {
      await db.query("UPDATE usuario SET senha_hash = ? WHERE id_usuario = ?", [senhaHash, id]);
    },

    async contarAdmins() {
      const [[{ total }]] = await db.query(
        "SELECT COUNT(*) AS total FROM usuario WHERE perfil = 'ADMIN'"
      );
      return total;
    },

    async excluir(id) {
      await db.query("DELETE FROM usuario WHERE id_usuario = ?", [id]);
    },
  };
}
