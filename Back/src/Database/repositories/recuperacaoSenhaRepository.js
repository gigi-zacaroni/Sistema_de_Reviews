export function criarRecuperacaoSenhaRepository(db) {
  return {
    async removerExpirados() {
      await db.query("DELETE FROM recuperacao_senha WHERE expira_em < NOW()");
    },

    async removerDoUsuario(idUsuario) {
      await db.query("DELETE FROM recuperacao_senha WHERE id_usuario = ?", [idUsuario]);
    },

    // A validade é calculada pelo próprio MySQL (NOW()) para não depender de
    // fuso horário diferente entre a API e o banco.
    async criar({ idUsuario, tokenHash, validadeMinutos }) {
      await db.query(
        `INSERT INTO recuperacao_senha (id_usuario, token_hash, expira_em)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
        [idUsuario, tokenHash, validadeMinutos]
      );
    },

    // FOR UPDATE trava a linha: dois cliques ao mesmo tempo não usam o token
    // duas vezes. Só faz sentido dentro de uma transação.
    async buscarValidoComTravamento(tokenHash) {
      const [linhas] = await db.query(
        `SELECT id_usuario FROM recuperacao_senha
          WHERE token_hash = ? AND expira_em > NOW() FOR UPDATE`,
        [tokenHash]
      );
      return linhas.length === 0 ? null : linhas[0].id_usuario;
    },
  };
}
