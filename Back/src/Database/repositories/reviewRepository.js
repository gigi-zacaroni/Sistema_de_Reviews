import { colunasPermitidas } from "./colunas.js";

// O e-mail do autor nunca é devolvido: só o nome
const SELECT_REVIEW = `
  SELECT r.id_review, r.id_usuario, u.nome AS autor, r.id_jogo, j.titulo AS jogo,
         r.titulo, r.comentario, r.nota, r.criado_em, r.atualizado_em,
         (SELECT COUNT(*) FROM review_curtida c WHERE c.id_review = r.id_review) AS qtd_curtidas
    FROM review r
    JOIN usuario u ON u.id_usuario = r.id_usuario
    JOIN jogo j ON j.id_jogo = r.id_jogo`;

export function criarReviewRepository(db) {
  return {
    async buscarPorId(id) {
      const [linhas] = await db.query(`${SELECT_REVIEW} WHERE r.id_review = ?`, [id]);
      return linhas[0] ?? null;
    },

    async listar({ idJogo, idUsuario, limite, deslocamento }) {
      const filtros = [];
      const valores = [];
      if (idJogo) {
        filtros.push("r.id_jogo = ?");
        valores.push(idJogo);
      }
      if (idUsuario) {
        filtros.push("r.id_usuario = ?");
        valores.push(idUsuario);
      }
      const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

      const [linhas] = await db.query(
        `${SELECT_REVIEW} ${where} ORDER BY r.criado_em DESC LIMIT ? OFFSET ?`,
        [...valores, limite, deslocamento]
      );
      return linhas;
    },

    // Regra 4: uma review por usuário por jogo (UNIQUE no banco, vira 409)
    async criar({ idUsuario, idJogo, titulo, comentario, nota }) {
      const [resultado] = await db.query(
        "INSERT INTO review (id_usuario, id_jogo, titulo, comentario, nota) VALUES (?, ?, ?, ?, ?)",
        [idUsuario, idJogo, titulo, comentario, nota]
      );
      return resultado.insertId;
    },

    // O atualizado_em muda sozinho (banco)
    async atualizar(id, alteracoes) {
      const colunas = colunasPermitidas(alteracoes, ["titulo", "comentario", "nota"]);
      await db.query(
        `UPDATE review SET ${colunas.map((c) => `${c} = ?`).join(", ")} WHERE id_review = ?`,
        [...Object.values(alteracoes), id]
      );
    },

    async excluir(id) {
      await db.query("DELETE FROM review WHERE id_review = ?", [id]);
    },

    // Jogos que o usuário avaliou (para recalcular a nota média antes de apagá-lo)
    async listarIdsJogosDoUsuario(idUsuario) {
      const [jogos] = await db.query("SELECT DISTINCT id_jogo FROM review WHERE id_usuario = ?", [
        idUsuario,
      ]);
      return jogos.map((j) => j.id_jogo);
    },

    // A chave primária (id_review, id_usuario) garante uma curtida por pessoa.
    // Devolve false se a pessoa já tinha curtido.
    async curtir(idReview, idUsuario) {
      try {
        await db.query("INSERT INTO review_curtida (id_review, id_usuario) VALUES (?, ?)", [
          idReview,
          idUsuario,
        ]);
        return true;
      } catch (erro) {
        if (erro.errnoBanco === 1062) return false;
        throw erro;
      }
    },

    // Devolve false se a pessoa não tinha curtido
    async descurtir(idReview, idUsuario) {
      const [resultado] = await db.query(
        "DELETE FROM review_curtida WHERE id_review = ? AND id_usuario = ?",
        [idReview, idUsuario]
      );
      return resultado.affectedRows > 0;
    },

    // Uma denúncia por pessoa em cada review. Devolve o id da denúncia, ou null
    // se a pessoa já havia denunciado.
    async denunciar({ idReview, idUsuario, motivo }) {
      try {
        const [resultado] = await db.query(
          "INSERT INTO review_denuncia (id_review, id_usuario, motivo) VALUES (?, ?, ?)",
          [idReview, idUsuario, motivo]
        );
        return resultado.insertId;
      } catch (erro) {
        if (erro.errnoBanco === 1062) return null;
        throw erro;
      }
    },

    async listarDenuncias({ limite, deslocamento }) {
      const [linhas] = await db.query(
        `SELECT d.id_denuncia, d.id_review, r.titulo AS titulo_review, r.id_usuario AS id_autor,
                d.id_usuario AS id_denunciante, u.nome AS denunciante, d.motivo, d.criado_em
           FROM review_denuncia d
           JOIN review r ON r.id_review = d.id_review
           JOIN usuario u ON u.id_usuario = d.id_usuario
          ORDER BY d.criado_em DESC LIMIT ? OFFSET ?`,
        [limite, deslocamento]
      );
      return linhas;
    },

    // Devolve false se a denúncia não existe
    async excluirDenuncia(idDenuncia) {
      const [resultado] = await db.query("DELETE FROM review_denuncia WHERE id_denuncia = ?", [
        idDenuncia,
      ]);
      return resultado.affectedRows > 0;
    },
  };
}
