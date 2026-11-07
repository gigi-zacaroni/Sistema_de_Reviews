const COLUNAS = "id_genero, nome, descricao";

export function criarGeneroRepository(db) {
  return {
    async listar() {
      const [linhas] = await db.query(`SELECT ${COLUNAS} FROM genero ORDER BY nome`);
      return linhas;
    },

    async buscarPorId(id) {
      const [linhas] = await db.query(`SELECT ${COLUNAS} FROM genero WHERE id_genero = ?`, [id]);
      return linhas[0] ?? null;
    },

    async criar({ nome, descricao }) {
      const [resultado] = await db.query("INSERT INTO genero (nome, descricao) VALUES (?, ?)", [
        nome,
        descricao,
      ]);
      return resultado.insertId;
    },

    async atualizar(id, { nome, descricao }) {
      await db.query("UPDATE genero SET nome = ?, descricao = ? WHERE id_genero = ?", [
        nome,
        descricao,
        id,
      ]);
    },

    // Regra 7: gênero com jogos não pode ser excluído (ON DELETE RESTRICT).
    // Devolve "ok" ou "emUso".
    async excluir(id) {
      try {
        await db.query("DELETE FROM genero WHERE id_genero = ?", [id]);
        return "ok";
      } catch (erro) {
        if (erro.errnoBanco === 1451) return "emUso";
        throw erro;
      }
    },

    // Insere o gênero (ou reaproveita se já existir) e devolve o id
    async salvarPorNome(nome) {
      const [r] = await db.query(
        `INSERT INTO genero (nome) VALUES (?)
         ON DUPLICATE KEY UPDATE id_genero = LAST_INSERT_ID(id_genero)`,
        [nome]
      );
      return r.insertId;
    },
  };
}
