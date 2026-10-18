import { Router } from "express";
import { pool, comTransacao } from "../db.js";
import { autenticar, exigirPerfil } from "../middlewares/auth.js";
import { recalcularNotaMedia } from "../services/notaMedia.js";
import {
  ErroHttp,
  exigirTexto,
  lerPaginacao,
  textoOpcional,
  validarId,
  validarNota,
} from "../utils/validacao.js";

const router = Router();

// O e-mail do autor nunca é devolvido: só o nome
const SELECT_REVIEW = `
  SELECT r.id_review, r.id_usuario, u.nome AS autor, r.id_jogo, j.titulo AS jogo,
         r.titulo, r.comentario, r.nota, r.criado_em, r.atualizado_em,
         (SELECT COUNT(*) FROM review_curtida c WHERE c.id_review = r.id_review) AS qtd_curtidas
    FROM review r
    JOIN usuario u ON u.id_usuario = r.id_usuario
    JOIN jogo j ON j.id_jogo = r.id_jogo`;

async function buscarReview(id) {
  const [linhas] = await pool.query(`${SELECT_REVIEW} WHERE r.id_review = ?`, [id]);
  if (linhas.length === 0) throw new ErroHttp(404, "Review não encontrada");
  return linhas[0];
}

// Edição: somente o autor altera o conteúdo da própria review.
// O Administrador não edita texto de outras pessoas, só pode excluir (moderação).
function exigirAutor(review, usuario) {
  if (review.id_usuario !== usuario.id_usuario) {
    throw new ErroHttp(403, "Acesso negado: somente o autor pode editar esta review");
  }
}

// Exclusão (regra 3): o autor exclui a própria review e o Administrador pode
// excluir qualquer uma. Outros usuários comuns não excluem reviews alheias.
function exigirAutorOuAdmin(review, usuario) {
  const ehAutor = review.id_usuario === usuario.id_usuario;
  const ehAdmin = usuario.perfil === "ADMIN";
  if (!ehAutor && !ehAdmin) {
    throw new ErroHttp(403, "Acesso negado: somente o autor ou um administrador pode excluir esta review");
  }
}

// GET /reviews?id_jogo=1&id_usuario=2: leitura pública
router.get("/", async (req, res) => {
  const filtros = [];
  const valores = [];
  if (req.query.id_jogo) {
    filtros.push("r.id_jogo = ?");
    valores.push(validarId(req.query.id_jogo, "id_jogo"));
  }
  if (req.query.id_usuario) {
    filtros.push("r.id_usuario = ?");
    valores.push(validarId(req.query.id_usuario, "id_usuario"));
  }
  const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";
  const { limite, deslocamento } = lerPaginacao(req.query);

  const [linhas] = await pool.query(
    `${SELECT_REVIEW} ${where} ORDER BY r.criado_em DESC LIMIT ? OFFSET ?`,
    [...valores, limite, deslocamento]
  );
  res.json(linhas);
});

// GET /reviews/denuncias: todas as denúncias, para moderação (somente Administrador).
// Precisa ficar antes de "/:id", senão "denuncias" seria lido como um id.
router.get("/denuncias", autenticar, exigirPerfil("ADMIN"), async (req, res) => {
  const { limite, deslocamento } = lerPaginacao(req.query);
  const [linhas] = await pool.query(
    `SELECT d.id_denuncia, d.id_review, r.titulo AS titulo_review, r.id_usuario AS id_autor,
            d.id_usuario AS id_denunciante, u.nome AS denunciante, d.motivo, d.criado_em
       FROM review_denuncia d
       JOIN review r ON r.id_review = d.id_review
       JOIN usuario u ON u.id_usuario = d.id_usuario
      ORDER BY d.criado_em DESC LIMIT ? OFFSET ?`,
    [limite, deslocamento]
  );
  res.json(linhas);
});

router.get("/:id", async (req, res) => {
  res.json(await buscarReview(validarId(req.params.id)));
});

// POST /reviews: qualquer usuário autenticado publica (Comum ou Administrador).
// O autor vem sempre do token, nunca do corpo da requisição.
// Regra 4: uma review por usuário por jogo (UNIQUE no banco, vira 409).
router.post("/", autenticar, async (req, res) => {
  const corpo = req.body ?? {};
  const idJogo = validarId(corpo.id_jogo, "id_jogo");
  const titulo = exigirTexto(corpo.titulo, "titulo", 120);
  const comentario = textoOpcional(corpo.comentario, "comentario", 20000);
  const nota = validarNota(corpo.nota);

  const [jogos] = await pool.query("SELECT id_jogo FROM jogo WHERE id_jogo = ?", [idJogo]);
  if (jogos.length === 0) throw new ErroHttp(404, "Jogo não encontrado");

  const idReview = await comTransacao(async (conexao) => {
    const [resultado] = await conexao.query(
      "INSERT INTO review (id_usuario, id_jogo, titulo, comentario, nota) VALUES (?, ?, ?, ?, ?)",
      [req.usuario.id_usuario, idJogo, titulo, comentario, nota]
    );
    await recalcularNotaMedia(conexao, idJogo); // regra 6
    return resultado.insertId;
  });

  res.status(201).json(await buscarReview(idReview));
});

// PUT /reviews/:id: somente o autor. O atualizado_em muda sozinho (banco).
router.put("/:id", autenticar, async (req, res) => {
  const id = validarId(req.params.id);
  const review = await buscarReview(id);
  exigirAutor(review, req.usuario);

  const corpo = req.body ?? {};
  const alteracoes = {};
  if (corpo.titulo !== undefined) alteracoes.titulo = exigirTexto(corpo.titulo, "titulo", 120);
  if (corpo.comentario !== undefined)
    alteracoes.comentario = textoOpcional(corpo.comentario, "comentario", 20000);
  if (corpo.nota !== undefined) alteracoes.nota = validarNota(corpo.nota);
  if (Object.keys(alteracoes).length === 0) {
    throw new ErroHttp(400, "Informe titulo, comentario e/ou nota para atualizar");
  }

  const colunas = Object.keys(alteracoes); // só titulo/comentario/nota: lista fixa
  await comTransacao(async (conexao) => {
    await conexao.query(
      `UPDATE review SET ${colunas.map((c) => `${c} = ?`).join(", ")} WHERE id_review = ?`,
      [...Object.values(alteracoes), id]
    );
    await recalcularNotaMedia(conexao, review.id_jogo); // regra 6
  });

  res.json(await buscarReview(id));
});

// DELETE /reviews/:id: o autor ou um Administrador (regra 3)
router.delete("/:id", autenticar, async (req, res) => {
  const id = validarId(req.params.id);
  const review = await buscarReview(id);
  exigirAutorOuAdmin(review, req.usuario);

  await comTransacao(async (conexao) => {
    await conexao.query("DELETE FROM review WHERE id_review = ?", [id]);
    await recalcularNotaMedia(conexao, review.id_jogo); // regra 6
  });

  res.status(204).end();
});

// POST /reviews/:id/curtida: marca a review como útil (qualquer usuário logado).
// A chave primária (id_review, id_usuario) garante uma curtida por pessoa.
router.post("/:id/curtida", autenticar, async (req, res) => {
  const id = validarId(req.params.id);
  await buscarReview(id); // 404 se não existir

  try {
    await pool.query("INSERT INTO review_curtida (id_review, id_usuario) VALUES (?, ?)", [
      id,
      req.usuario.id_usuario,
    ]);
  } catch (erro) {
    if (erro.errno === 1062) throw new ErroHttp(409, "Você já curtiu esta review");
    throw erro;
  }

  const review = await buscarReview(id);
  res.status(201).json({ id_review: id, qtd_curtidas: review.qtd_curtidas });
});

// DELETE /reviews/:id/curtida: remove a curtida da própria pessoa
router.delete("/:id/curtida", autenticar, async (req, res) => {
  const id = validarId(req.params.id);
  await buscarReview(id);

  const [resultado] = await pool.query(
    "DELETE FROM review_curtida WHERE id_review = ? AND id_usuario = ?",
    [id, req.usuario.id_usuario]
  );
  if (resultado.affectedRows === 0) throw new ErroHttp(404, "Você não curtiu esta review");

  res.status(204).end();
});

// POST /reviews/:id/denuncia: denuncia uma review inadequada (qualquer usuário logado).
// Uma denúncia por pessoa em cada review.
router.post("/:id/denuncia", autenticar, async (req, res) => {
  const id = validarId(req.params.id);
  const motivo = exigirTexto((req.body ?? {}).motivo, "motivo", 255);
  await buscarReview(id);

  try {
    const [resultado] = await pool.query(
      "INSERT INTO review_denuncia (id_review, id_usuario, motivo) VALUES (?, ?, ?)",
      [id, req.usuario.id_usuario, motivo]
    );
    res.status(201).json({ id_denuncia: resultado.insertId, id_review: id, motivo });
  } catch (erro) {
    if (erro.errno === 1062) throw new ErroHttp(409, "Você já denunciou esta review");
    throw erro;
  }
});

export default router;
