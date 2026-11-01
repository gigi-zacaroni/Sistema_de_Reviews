import { Router } from "express";
import { pool } from "../db.js";
import { autenticar, exigirPerfil } from "../middlewares/auth.js";
import { buscarJogosPorNome } from "../services/rawg.js";
import { exigirTexto } from "../utils/validacao.js";

const router = Router();

// GET /rawg/jogos?busca=zelda: primeiro passo para cadastrar um jogo.
// O Administrador procura na RAWG e depois importa o escolhido com
// POST /jogos/importar. Restrita ao Administrador porque cada busca gasta a
// cota da chave da RAWG.
router.get("/jogos", autenticar, exigirPerfil("ADMIN"), async (req, res) => {
  const busca = exigirTexto(req.query.busca, "busca", 100);
  const resultados = await buscarJogosPorNome(busca);

  // Marca o que já está no banco, para o administrador não tentar importar de novo
  let jaImportados = new Set();
  if (resultados.length > 0) {
    const [linhas] = await pool.query("SELECT rawg_id FROM jogo WHERE rawg_id IN (?)", [
      resultados.map((j) => j.rawg_id),
    ]);
    jaImportados = new Set(linhas.map((l) => l.rawg_id));
  }

  res.json(resultados.map((j) => ({ ...j, ja_importado: jaImportados.has(j.rawg_id) })));
});

export default router;
