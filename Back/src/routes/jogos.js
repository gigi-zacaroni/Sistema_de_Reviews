import { Router } from "express";
import { pool } from "../db.js";
import { autenticar, exigirPerfil } from "../middlewares/auth.js";
import {
  ErroHttp,
  dataOpcional,
  exigirTexto,
  idOpcional,
  lerPaginacao,
  textoOpcional,
  validarId,
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
function lerCampos(corpo, { criar }) {
  const dados = {};
  for (const [campo, validar] of Object.entries(CAMPOS)) {
    if (!criar && corpo[campo] === undefined) continue;
    dados[campo] = validar(corpo[campo]);
  }
  if (Object.keys(dados).length === 0) {
    throw new ErroHttp(400, "Informe ao menos um campo para atualizar");
  }
  return dados;
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
router.post("/", autenticar, exigirPerfil("ADMIN"), async (req, res) => {
  const dados = lerCampos(req.body ?? {}, { criar: true });
  const colunas = Object.keys(dados); // lista fixa (CAMPOS): segura para o SQL

  const [resultado] = await pool.query(
    `INSERT INTO jogo (${colunas.join(", ")}) VALUES (${colunas.map(() => "?").join(", ")})`,
    Object.values(dados)
  );
  res.status(201).json(await buscarJogo(resultado.insertId));
});

router.put("/:id", autenticar, exigirPerfil("ADMIN"), async (req, res) => {
  const id = validarId(req.params.id);
  const dados = lerCampos(req.body ?? {}, { criar: false });

  await buscarJogo(id); // 404 se não existir
  const colunas = Object.keys(dados);
  await pool.query(
    `UPDATE jogo SET ${colunas.map((c) => `${c} = ?`).join(", ")} WHERE id_jogo = ?`,
    [...Object.values(dados), id]
  );
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
