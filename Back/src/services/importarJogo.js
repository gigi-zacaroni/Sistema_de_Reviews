import { ErroHttp } from "../utils/validacao.js";

// Grava no banco um jogo vindo da RAWG (detalhe de /games/{id}), com o gênero e
// as plataformas dele. Recebe a conexão da transação: ou grava tudo, ou nada.
// Se o rawg_id já existe, atualiza os dados em vez de duplicar.

// Insere o gênero (ou reaproveita se já existir) e devolve o id
async function salvarGenero(conexao, nome) {
  const [r] = await conexao.query(
    `INSERT INTO genero (nome) VALUES (?)
     ON DUPLICATE KEY UPDATE id_genero = LAST_INSERT_ID(id_genero)`,
    [nome.slice(0, 60)]
  );
  return r.insertId;
}

// Mesma ideia para a plataforma
async function salvarPlataforma(conexao, nome) {
  const [r] = await conexao.query(
    `INSERT INTO plataforma (nome) VALUES (?)
     ON DUPLICATE KEY UPDATE id_plataforma = LAST_INSERT_ID(id_plataforma)`,
    [nome.slice(0, 60)]
  );
  return r.insertId;
}

async function salvarJogo(conexao, d, idGenero) {
  const desenvolvedora = (d.developers ?? []).map((x) => x.name).join(", ");
  const publicadora = (d.publishers ?? []).map((x) => x.name).join(", ");

  const [r] = await conexao.query(
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
      idGenero,
      d.name.slice(0, 150),
      desenvolvedora.slice(0, 100) || null,
      publicadora.slice(0, 100) || null,
      d.description_raw?.slice(0, 20000) || null,
      d.released || null,
      d.background_image?.slice(0, 500) || null,
      d.id,
    ]
  );
  return r.insertId;
}

// Devolve o id_jogo gravado
export async function salvarJogoDaRawg(conexao, detalhe) {
  if (!detalhe?.id || typeof detalhe.name !== "string" || detalhe.name === "") {
    throw new ErroHttp(502, "A RAWG devolveu um jogo em formato inesperado");
  }

  // O jogo guarda um gênero só; usa o primeiro que a RAWG informa
  const nomeGenero = detalhe.genres?.[0]?.name ?? "Outros";
  const idGenero = await salvarGenero(conexao, nomeGenero);
  const idJogo = await salvarJogo(conexao, detalhe, idGenero);

  for (const p of detalhe.platforms ?? []) {
    const idPlataforma = await salvarPlataforma(conexao, p.platform.name);
    await conexao.query(
      "INSERT IGNORE INTO jogo_plataforma (id_jogo, id_plataforma) VALUES (?, ?)",
      [idJogo, idPlataforma]
    );
  }
  return idJogo;
}
