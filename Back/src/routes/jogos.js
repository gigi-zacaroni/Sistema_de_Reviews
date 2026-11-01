import { Router } from "express";
import { pool, comTransacao } from "../db.js";
import { autenticar, exigirPerfil } from "../middlewares/auth.js";
import { buscarDetalheJogo } from "../services/rawg.js";
import { salvarJogoDaRawg } from "../services/importarJogo.js";
import {
  ErroHttp,
  dataOpcional,
  exigirTexto,
  idOpcional,
  lerPaginacao,
  textoOpcional,
  validarId,
  validarListaIds,
} from "../utils/validacao.js";

const router = Router();

// Campos que o Administrador pode enviar e como cada um é validado.
// A nota_media NÃO está aqui: ela é calculada pelas reviews (regra 6).
const CAMPOS = {
  id_genero: (v) => validarId(v, "id_genero"),
  titulo: (v) => exigirTexto(v, "titulo", 150),
  desenvolvedora: (v) => textoOpcional(v, "desenvolvedora", 100),
  publicadora: (v) => textoOpcional(v, "publicadora", 100),
  descricao: (v) => textoOpcional(v, "descricao", 20000),
  data_lancamento: (v) => dataOpcional(v, "data_lancamento"),
  capa_url: (v) => textoOpcional(v, "capa_url", 500),
  rawg_id: (v) => idOpcional(v, "rawg_id"),
};

// Valida o corpo. Ao criar, todos os campos passam pela validação (id_genero e
// titulo são obrigatórios). Ao atualizar, só os campos enviados são considerados.
// "plataformas" (lista de id_plataforma) é opcional: quando enviada, substitui
// as plataformas do jogo; lista vazia remove todas.
function lerCampos(corpo, { criar }) {
  const dados = {};
  for (const [campo, validar] of Object.entries(CAMPOS)) {
    if (!criar && corpo[campo] === undefined) continue;
    dados[campo] = validar(corpo[campo]);
  }
  const plataformas =
    corpo.plataformas === undefined
      ? undefined
      : validarListaIds(corpo.plataformas, "plataformas");

  if (Object.keys(dados).length === 0 && plataformas === undefined) {
    throw new ErroHttp(400, "Informe ao menos um campo para atualizar");
  }
  return { dados, plataformas };
}

// Troca as plataformas do jogo pela lista recebida (dentro de uma transação)
async function definirPlataformas(conexao, idJogo, idsPlataformas) {
  if (idsPlataformas.length > 0) {
    const [existentes] = await conexao.query(
      "SELECT id_plataforma FROM plataforma WHERE id_plataforma IN (?)",
      [idsPlataformas]
    );
    if (existentes.length !== idsPlataformas.length) {
      throw new ErroHttp(400, "plataformas contém um id que não existe");
    }
  }
  await conexao.query("DELETE FROM jogo_plataforma WHERE id_jogo = ?", [idJogo]);
  if (idsPlataformas.length > 0) {
    await conexao.query("INSERT INTO jogo_plataforma (id_jogo, id_plataforma) VALUES ?", [
      idsPlataformas.map((id) => [idJogo, id]),
    ]);
  }
}

const SELECT_JOGO = `
  SELECT j.id_jogo, j.titulo, j.id_genero, g.nome AS genero, j.desenvolvedora,
         j.publicadora, j.descricao, j.data_lancamento, j.nota_media, j.capa_url,
         j.rawg_id,
         (SELECT COUNT(*) FROM review r WHERE r.id_jogo = j.id_jogo) AS qtd_reviews
    FROM jogo j
    JOIN genero g ON g.id_genero = j.id_genero`;

async function buscarJogo(id) {
  const [linhas] = await pool.query(`${SELECT_JOGO} WHERE j.id_jogo = ?`, [id]);
  if (linhas.length === 0) throw new ErroHttp(404, "Jogo não encontrado");

  const [plataformas] = await pool.query(
    `SELECT p.id_plataforma, p.nome
       FROM jogo_plataforma jp
       JOIN plataforma p ON p.id_plataforma = jp.id_plataforma
      WHERE jp.id_jogo = ? ORDER BY p.nome`,
    [id]
  );
  return { ...linhas[0], plataformas };
}

// GET /jogos?busca=zelda&id_genero=1&id_plataforma=2&limite=20&deslocamento=0
// Leitura pública
router.get("/", async (req, res) => {
  const filtros = [];
  const valores = [];

  if (req.query.busca) {
    filtros.push("j.titulo LIKE ?");
    valores.push(`%${req.query.busca}%`);
  }
  if (req.query.id_genero) {
    filtros.push("j.id_genero = ?");
    valores.push(validarId(req.query.id_genero, "id_genero"));
  }
  if (req.query.id_plataforma) {
    filtros.push(
      "EXISTS (SELECT 1 FROM jogo_plataforma jp WHERE jp.id_jogo = j.id_jogo AND jp.id_plataforma = ?)"
    );
    valores.push(validarId(req.query.id_plataforma, "id_plataforma"));
  }

  const { limite, deslocamento } = lerPaginacao(req.query);
  const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

  const [linhas] = await pool.query(
    `${SELECT_JOGO} ${where} ORDER BY j.titulo LIMIT ? OFFSET ?`,
    [...valores, limite, deslocamento]
  );
  res.json(linhas);
});

router.get("/:id", async (req, res) => {
  res.json(await buscarJogo(validarId(req.params.id)));
});

// Cadastro, edição e exclusão: somente Administrador

// POST /jogos/importar { "rawg_id": 3498 }: cadastra um jogo a partir da RAWG.
// O Administrador acha o rawg_id em GET /rawg/jogos?busca=...; a API busca o
// detalhe na RAWG e grava jogo, gênero e plataformas de uma vez.
// Precisa ficar antes das rotas com "/:id".
router.post("/importar", autenticar, exigirPerfil("ADMIN"), async (req, res) => {
  const rawgId = validarId((req.body ?? {}).rawg_id, "rawg_id");

  const [existente] = await pool.query("SELECT id_jogo FROM jogo WHERE rawg_id = ?", [rawgId]);
  if (existente.length > 0) {
    throw new ErroHttp(409, `Este jogo já foi importado (id_jogo ${existente[0].id_jogo})`);
  }

  const detalhe = await buscarDetalheJogo(rawgId); // 404/502 se a RAWG falhar
  const idJogo = await comTransacao((conexao) => salvarJogoDaRawg(conexao, detalhe));
  res.status(201).json(await buscarJogo(idJogo));
});

router.post("/", autenticar, exigirPerfil("ADMIN"), async (req, res) => {
  const { dados, plataformas } = lerCampos(req.body ?? {}, { criar: true });
  const colunas = Object.keys(dados); // lista fixa (CAMPOS): segura para o SQL

  const idJogo = await comTransacao(async (conexao) => {
    const [resultado] = await conexao.query(
      `INSERT INTO jogo (${colunas.join(", ")}) VALUES (${colunas.map(() => "?").join(", ")})`,
      Object.values(dados)
    );
    if (plataformas !== undefined) {
      await definirPlataformas(conexao, resultado.insertId, plataformas);
    }
    return resultado.insertId;
  });
  res.status(201).json(await buscarJogo(idJogo));
});

router.put("/:id", autenticar, exigirPerfil("ADMIN"), async (req, res) => {
  const id = validarId(req.params.id);
  const { dados, plataformas } = lerCampos(req.body ?? {}, { criar: false });

  await buscarJogo(id); // 404 se não existir
  const colunas = Object.keys(dados);
  await comTransacao(async (conexao) => {
    if (colunas.length > 0) {
      await conexao.query(
        `UPDATE jogo SET ${colunas.map((c) => `${c} = ?`).join(", ")} WHERE id_jogo = ?`,
        [...Object.values(dados), id]
      );
    }
    if (plataformas !== undefined) {
      await definirPlataformas(conexao, id, plataformas);
    }
  });
  res.json(await buscarJogo(id));
});

// Regra 8: as reviews do jogo são excluídas em cascata (ON DELETE CASCADE)
router.delete("/:id", autenticar, exigirPerfil("ADMIN"), async (req, res) => {
  const id = validarId(req.params.id);
  await buscarJogo(id);
  await pool.query("DELETE FROM jogo WHERE id_jogo = ?", [id]);
  res.status(204).end();
});

export default router;
