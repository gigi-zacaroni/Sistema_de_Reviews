import { Router } from "express";
import { pool } from "../db.js";
import { autenticar, exigirPerfil } from "../middlewares/auth.js";
import { ErroHttp, exigirTexto, validarId } from "../utils/validacao.js";

const router = Router();

// qtd_jogos: quantos jogos estão ligados à plataforma
const SELECT_PLATAFORMA = `
  SELECT p.id_plataforma, p.nome,
         (SELECT COUNT(*) FROM jogo_plataforma jp WHERE jp.id_plataforma = p.id_plataforma) AS qtd_jogos
    FROM plataforma p`;

async function buscarPlataforma(id) {
  const [linhas] = await pool.query(`${SELECT_PLATAFORMA} WHERE p.id_plataforma = ?`, [id]);
  if (linhas.length === 0) throw new ErroHttp(404, "Plataforma não encontrada");
  return linhas[0];
}

// Leitura: pública
router.get("/", async (req, res) => {
  const [linhas] = await pool.query(`${SELECT_PLATAFORMA} ORDER BY p.nome`);
  res.json(linhas);
});

router.get("/:id", async (req, res) => {
  res.json(await buscarPlataforma(validarId(req.params.id)));
});

// Escrita: somente Administrador
router.post("/", autenticar, exigirPerfil("ADMIN"), async (req, res) => {
  const nome = exigirTexto((req.body ?? {}).nome, "nome", 60);
  const [resultado] = await pool.query("INSERT INTO plataforma (nome) VALUES (?)", [nome]);
  res.status(201).json(await buscarPlataforma(resultado.insertId));
});

router.put("/:id", autenticar, exigirPerfil("ADMIN"), async (req, res) => {
  const id = validarId(req.params.id);
  const nome = exigirTexto((req.body ?? {}).nome, "nome", 60);

  await buscarPlataforma(id); // 404 se não existir
  await pool.query("UPDATE plataforma SET nome = ? WHERE id_plataforma = ?", [nome, id]);
  res.json(await buscarPlataforma(id));
});

// Regra 11: plataforma que ainda tem jogos ligados a ela não pode ser excluída
router.delete("/:id", autenticar, exigirPerfil("ADMIN"), async (req, res) => {
  const id = validarId(req.params.id);
  await buscarPlataforma(id); // 404 se não existir

  // A checagem e a exclusão acontecem na mesma consulta, então nenhum jogo
  // consegue ser ligado à plataforma entre uma coisa e outra.
  const [resultado] = await pool.query(
    `DELETE FROM plataforma
      WHERE id_plataforma = ?
        AND NOT EXISTS (SELECT 1 FROM jogo_plataforma WHERE id_plataforma = ?)`,
    [id, id]
  );
  if (resultado.affectedRows === 0) {
    throw new ErroHttp(
      409,
      "Não é possível excluir: existem jogos ligados a esta plataforma. Remova a plataforma desses jogos antes"
    );
  }
  res.status(204).end();
});

export default router;
