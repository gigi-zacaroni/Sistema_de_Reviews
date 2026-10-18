import { Router } from "express";
import { pool } from "../db.js";
import { autenticar, exigirPerfil } from "../middlewares/auth.js";
import { ErroHttp, exigirTexto, textoOpcional, validarId } from "../utils/validacao.js";

const router = Router();
const COLUNAS = "id_genero, nome, descricao";

async function buscarGenero(id) {
  const [linhas] = await pool.query(`SELECT ${COLUNAS} FROM genero WHERE id_genero = ?`, [id]);
  if (linhas.length === 0) throw new ErroHttp(404, "Gênero não encontrado");
  return linhas[0];
}

// Leitura: pública
router.get("/", async (req, res) => {
  const [linhas] = await pool.query(`SELECT ${COLUNAS} FROM genero ORDER BY nome`);
  res.json(linhas);
});

router.get("/:id", async (req, res) => {
  res.json(await buscarGenero(validarId(req.params.id)));
});

// Escrita: somente Administrador
router.post("/", autenticar, exigirPerfil("ADMIN"), async (req, res) => {
  const corpo = req.body ?? {};
  const nome = exigirTexto(corpo.nome, "nome", 60);
  const descricao = textoOpcional(corpo.descricao, "descricao", 255);

  const [resultado] = await pool.query("INSERT INTO genero (nome, descricao) VALUES (?, ?)", [
    nome,
    descricao,
  ]);
  res.status(201).json(await buscarGenero(resultado.insertId));
});

router.put("/:id", autenticar, exigirPerfil("ADMIN"), async (req, res) => {
  const id = validarId(req.params.id);
  const corpo = req.body ?? {};
  const nome = exigirTexto(corpo.nome, "nome", 60);
  const descricao = textoOpcional(corpo.descricao, "descricao", 255);

  await buscarGenero(id); // 404 se não existir
  await pool.query("UPDATE genero SET nome = ?, descricao = ? WHERE id_genero = ?", [
    nome,
    descricao,
    id,
  ]);
  res.json(await buscarGenero(id));
});

// Regra 7: gênero com jogos não pode ser excluído (ON DELETE RESTRICT no banco)
router.delete("/:id", autenticar, exigirPerfil("ADMIN"), async (req, res) => {
  const id = validarId(req.params.id);
  await buscarGenero(id);

  try {
    await pool.query("DELETE FROM genero WHERE id_genero = ?", [id]);
  } catch (erro) {
    if (erro.errno === 1451) {
      throw new ErroHttp(409, "Não é possível excluir: existem jogos associados a este gênero");
    }
    throw erro;
  }
  res.status(204).end();
});

export default router;
