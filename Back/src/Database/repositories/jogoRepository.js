import { colunasPermitidas } from "./colunas.js";

const COLUNAS_EDITAVEIS = [
  "id_genero",
  "titulo",
  "desenvolvedora",
  "publicadora",
  "descricao",
  "data_lancamento",
  "capa_url",
  "rawg_id",
];

const SELECT_JOGO = `
  SELECT j.id_jogo, j.titulo, j.id_genero, g.nome AS genero, j.desenvolvedora,
         j.publicadora, j.descricao, j.data_lancamento, j.nota_media, j.capa_url,
         j.rawg_id,
         (SELECT COUNT(*) FROM review r WHERE r.id_jogo = j.id_jogo) AS qtd_reviews
    FROM jogo j
    JOIN genero g ON g.id_genero = j.id_genero`;

export function criarJogoRepository(db) {
  return {
    async buscarPorId(id) {
      const [linhas] = await db.query(`${SELECT_JOGO} WHERE j.id_jogo = ?`, [id]);
      if (linhas.length === 0) return null;

      const [plataformas] = await db.query(
        `SELECT p.id_plataforma, p.nome
           FROM jogo_plataforma jp
           JOIN plataforma p ON p.id_plataforma = jp.id_plataforma
          WHERE jp.id_jogo = ? ORDER BY p.nome`,
        [id]
      );
      return { ...linhas[0], plataformas };
    },

    async existe(id) {
      const [linhas] = await db.query("SELECT id_jogo FROM jogo WHERE id_jogo = ?", [id]);
      return linhas.length > 0;
    },

    async listar({ busca, idGenero, idPlataforma, limite, deslocamento }) {
      const filtros = [];
      const valores = [];

      if (busca) {
        filtros.push("j.titulo LIKE ?");
        valores.push(`%${busca}%`);
      }
      if (idGenero) {
        filtros.push("j.id_genero = ?");
        valores.push(idGenero);
      }
      if (idPlataforma) {
        filtros.push(
          "EXISTS (SELECT 1 FROM jogo_plataforma jp WHERE jp.id_jogo = j.id_jogo AND jp.id_plataforma = ?)"
        );
        valores.push(idPlataforma);
      }

      const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";
      const [linhas] = await db.query(
        `${SELECT_JOGO} ${where} ORDER BY j.titulo LIMIT ? OFFSET ?`,
        [...valores, limite, deslocamento]
      );
      return linhas;
    },

    async buscarIdPorRawgId(rawgId) {
      const [linhas] = await db.query("SELECT id_jogo FROM jogo WHERE rawg_id = ?", [rawgId]);
      return linhas.length === 0 ? null : linhas[0].id_jogo;
    },

    // Quais destes rawg_id já estão no banco
    async buscarRawgIdsExistentes(rawgIds) {
      if (rawgIds.length === 0) return new Set();
      const [linhas] = await db.query("SELECT rawg_id FROM jogo WHERE rawg_id IN (?)", [rawgIds]);
      return new Set(linhas.map((l) => l.rawg_id));
    },

    async criar(dados) {
      const colunas = colunasPermitidas(dados, COLUNAS_EDITAVEIS);
      const [resultado] = await db.query(
        `INSERT INTO jogo (${colunas.join(", ")}) VALUES (${colunas.map(() => "?").join(", ")})`,
        Object.values(dados)
      );
      return resultado.insertId;
    },

    async atualizar(id, dados) {
      const colunas = colunasPermitidas(dados, COLUNAS_EDITAVEIS);
      if (colunas.length === 0) return;
      await db.query(
        `UPDATE jogo SET ${colunas.map((c) => `${c} = ?`).join(", ")} WHERE id_jogo = ?`,
        [...Object.values(dados), id]
      );
    },

    // Regra 8: as reviews do jogo são excluídas em cascata (ON DELETE CASCADE)
    async excluir(id) {
      await db.query("DELETE FROM jogo WHERE id_jogo = ?", [id]);
    },

    // Troca as plataformas do jogo pela lista recebida (lista vazia remove todas)
    async substituirPlataformas(idJogo, idsPlataformas) {
      await db.query("DELETE FROM jogo_plataforma WHERE id_jogo = ?", [idJogo]);
      if (idsPlataformas.length > 0) {
        await db.query("INSERT INTO jogo_plataforma (id_jogo, id_plataforma) VALUES ?", [
          idsPlataformas.map((id) => [idJogo, id]),
        ]);
      }
    },

    async vincularPlataforma(idJogo, idPlataforma) {
      await db.query("INSERT IGNORE INTO jogo_plataforma (id_jogo, id_plataforma) VALUES (?, ?)", [
        idJogo,
        idPlataforma,
      ]);
    },

    // Grava um jogo vindo da RAWG. Se o rawg_id já existe, atualiza em vez de duplicar.
    async salvarDaRawg(d) {
      const [r] = await db.query(
        `INSERT INTO jogo
           (id_genero, titulo, desenvolvedora, publicadora, descricao,
            data_lancamento, capa_url, rawg_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) AS novo
         ON DUPLICATE KEY UPDATE
           id_jogo = LAST_INSERT_ID(id_jogo),
           id_genero = novo.id_genero,
           titulo = novo.titulo,
           desenvolvedora = novo.desenvolvedora,
           publicadora = novo.publicadora,
           descricao = novo.descricao,
           data_lancamento = novo.data_lancamento,
           capa_url = novo.capa_url`,
        [
          d.idGenero,
          d.titulo,
          d.desenvolvedora,
          d.publicadora,
          d.descricao,
          d.dataLancamento,
          d.capaUrl,
          d.rawgId,
        ]
      );
      return r.insertId;
    },

    // Regra 6: a nota_media do jogo vem da média das reviews. Quem chama decide
    // quando recalcular (e deve fazê-lo dentro da mesma transação da mudança).
    async recalcularNotaMedia(idJogo) {
      await db.query(
        `UPDATE jogo
            SET nota_media = COALESCE(
                  (SELECT ROUND(AVG(nota), 1) FROM review WHERE id_jogo = ?), 0)
          WHERE id_jogo = ?`,
        [idJogo, idJogo]
      );
    },
  };
}
