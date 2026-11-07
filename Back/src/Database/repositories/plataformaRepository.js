// qtd_jogos: quantos jogos estão ligados à plataforma
const SELECT_PLATAFORMA = `
  SELECT p.id_plataforma, p.nome,
         (SELECT COUNT(*) FROM jogo_plataforma jp WHERE jp.id_plataforma = p.id_plataforma) AS qtd_jogos
    FROM plataforma p`;

export function criarPlataformaRepository(db) {
  return {
    async listar() {
      const [linhas] = await db.query(`${SELECT_PLATAFORMA} ORDER BY p.nome`);
      return linhas;
    },

    async buscarPorId(id) {
      const [linhas] = await db.query(`${SELECT_PLATAFORMA} WHERE p.id_plataforma = ?`, [id]);
      return linhas[0] ?? null;
    },

    async criar(nome) {
      const [resultado] = await db.query("INSERT INTO plataforma (nome) VALUES (?)", [nome]);
      return resultado.insertId;
    },

    async atualizar(id, nome) {
      await db.query("UPDATE plataforma SET nome = ? WHERE id_plataforma = ?", [nome, id]);
    },

    // Regra 11: a checagem e a exclusão acontecem na mesma consulta, então nenhum
    // jogo consegue ser ligado à plataforma entre uma coisa e outra.
    // Devolve true se excluiu, false se ainda há jogos ligados.
    async excluirSeSemJogos(id) {
      const [resultado] = await db.query(
        `DELETE FROM plataforma
          WHERE id_plataforma = ?
            AND NOT EXISTS (SELECT 1 FROM jogo_plataforma WHERE id_plataforma = ?)`,
        [id, id]
      );
      return resultado.affectedRows > 0;
    },

    // Quantas das plataformas informadas realmente existem
    async contarExistentes(ids) {
      const [existentes] = await db.query(
        "SELECT id_plataforma FROM plataforma WHERE id_plataforma IN (?)",
        [ids]
      );
      return existentes.length;
    },

    // Insere a plataforma (ou reaproveita se já existir) e devolve o id
    async salvarPorNome(nome) {
      const [r] = await db.query(
        `INSERT INTO plataforma (nome) VALUES (?)
         ON DUPLICATE KEY UPDATE id_plataforma = LAST_INSERT_ID(id_plataforma)`,
        [nome]
      );
      return r.insertId;
    },
  };
}
