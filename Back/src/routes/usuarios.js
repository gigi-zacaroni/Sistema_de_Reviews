import { Router } from "express";
import { pool, comTransacao } from "../db.js";
import { autenticar, exigirPerfil, proprioOuAdmin } from "../middlewares/auth.js";
import { recalcularNotaMedia } from "../services/notaMedia.js";
import { ErroHttp, exigirTexto, validarEmail, validarId } from "../utils/validacao.js";

const router = Router();
const COLUNAS = "id_usuario, nome, email, perfil, criado_em"; // nunca inclui senha_hash

// Tudo em /usuarios exige login
router.use(autenticar);

async function buscarUsuario(id) {
  const [linhas] = await pool.query(`SELECT ${COLUNAS} FROM usuario WHERE id_usuario = ?`, [id]);
  if (linhas.length === 0) throw new ErroHttp(404, "Usuário não encontrado");
  return linhas[0];
}

async function contarAdmins() {
  const [[{ total }]] = await pool.query(
    "SELECT COUNT(*) AS total FROM usuario WHERE perfil = 'ADMIN'"
  );
  return total;
}

// GET /usuarios: lista todos (somente Administrador)
router.get("/", exigirPerfil("ADMIN"), async (req, res) => {
  const [linhas] = await pool.query(`SELECT ${COLUNAS} FROM usuario ORDER BY nome`);
  res.json(linhas);
});

// GET /usuarios/:id: a própria conta ou Administrador
router.get("/:id", proprioOuAdmin, async (req, res) => {
  res.json(await buscarUsuario(req.idAlvo));
});

// PUT /usuarios/:id: edita nome e/ou e-mail (a própria conta ou Administrador).
// O perfil NÃO pode ser alterado aqui: existe rota própria, só para Administrador.
router.put("/:id", proprioOuAdmin, async (req, res) => {
  const corpo = req.body ?? {};
  const alteracoes = {};
  if (corpo.nome !== undefined) alteracoes.nome = exigirTexto(corpo.nome, "nome", 100);
  if (corpo.email !== undefined) alteracoes.email = validarEmail(corpo.email);
  if (Object.keys(alteracoes).length === 0) {
    throw new ErroHttp(400, "Informe nome e/ou email para atualizar");
  }

  await buscarUsuario(req.idAlvo); // 404 se não existir

  const colunas = Object.keys(alteracoes); // só nome/email: lista fixa, segura para o SQL
  await pool.query(
    `UPDATE usuario SET ${colunas.map((c) => `${c} = ?`).join(", ")} WHERE id_usuario = ?`,
    [...Object.values(alteracoes), req.idAlvo]
  );
  res.json(await buscarUsuario(req.idAlvo));
});

// PATCH /usuarios/:id/perfil: promove ou rebaixa (somente Administrador)
router.patch("/:id/perfil", exigirPerfil("ADMIN"), async (req, res) => {
  const idAlvo = validarId(req.params.id);
  const { perfil } = req.body ?? {};
  if (!["COMUM", "ADMIN"].includes(perfil)) {
    throw new ErroHttp(400, "perfil deve ser COMUM ou ADMIN");
  }

  const alvo = await buscarUsuario(idAlvo);
  if (alvo.perfil === "ADMIN" && perfil === "COMUM" && (await contarAdmins()) <= 1) {
    throw new ErroHttp(409, "Não é possível rebaixar o único administrador");
  }

  await pool.query("UPDATE usuario SET perfil = ? WHERE id_usuario = ?", [perfil, idAlvo]);
  res.json(await buscarUsuario(idAlvo));
});

// DELETE /usuarios/:id: o usuário exclui a própria conta, ou um Administrador
// exclui qualquer conta.
// Regra 9: as reviews do usuário somem em cascata (banco) e a nota_media dos jogos
// afetados é recalculada (aplicação).
router.delete("/:id", proprioOuAdmin, async (req, res) => {
  const alvo = await buscarUsuario(req.idAlvo);

  if (alvo.perfil === "ADMIN" && (await contarAdmins()) <= 1) {
    throw new ErroHttp(409, "Não é possível excluir o único administrador");
  }

  await comTransacao(async (conexao) => {
    // Guarda os jogos avaliados ANTES de apagar, senão não dá para saber quais recalcular
    const [jogos] = await conexao.query(
      "SELECT DISTINCT id_jogo FROM review WHERE id_usuario = ?",
      [req.idAlvo]
    );
    await conexao.query("DELETE FROM usuario WHERE id_usuario = ?", [req.idAlvo]);
    for (const { id_jogo } of jogos) {
      await recalcularNotaMedia(conexao, id_jogo);
    }
  });

  res.status(204).end();
});

export default router;
