import "dotenv/config";
import express from "express";
import { pool } from "./src/db.js";

const app = express();
app.use(express.json());

// Verifica se a API está no ar e se consegue falar com o banco
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ api: "ok", banco: "ok" });
  } catch (erro) {
    console.error("Falha ao consultar o banco:", erro.message);
    res.status(503).json({ api: "ok", banco: "indisponivel" });
  }
});

// Lista os gêneros do banco (confirma que a persistência funciona)
app.get("/generos", async (req, res) => {
  try {
    const [linhas] = await pool.query(
      "SELECT id_genero, nome, descricao FROM genero ORDER BY nome"
    );
    res.json(linhas);
  } catch (erro) {
    console.error(erro.message);
    res.status(500).json({ erro: "Erro ao consultar gêneros" });
  }
});

// Lista os usuários (nunca devolve a senha_hash)
app.get("/usuarios", async (req, res) => {
  try {
    const [linhas] = await pool.query(
      "SELECT id_usuario, nome, email, perfil, criado_em FROM usuario"
    );
    res.json(linhas);
  } catch (erro) {
    console.error(erro.message);
    res.status(500).json({ erro: "Erro ao consultar usuários" });
  }
});

// Busca jogos na RAWG pelo nome: /rawg/jogos?busca=zelda
app.get("/rawg/jogos", async (req, res) => {
  const busca = req.query.busca;
  if (!busca) {
    return res.status(400).json({ erro: "Informe ?busca=nome do jogo" });
  }

  try {
    const parametros = new URLSearchParams({
      key: process.env.RAWG_API_KEY,
      search: busca,
      page_size: "10",
    });

    const resposta = await fetch(`https://api.rawg.io/api/games?${parametros}`);
    if (!resposta.ok) {
      throw new Error(`RAWG respondeu ${resposta.status}`);
    }

    const dados = await resposta.json();

    // Devolve só o que o banco usa (colunas da tabela jogo)
    res.json(
      dados.results.map((j) => ({
        rawg_id: j.id,
        titulo: j.name,
        data_lancamento: j.released,
        capa_url: j.background_image,
      }))
    );
  } catch (erro) {
    console.error(erro.message);
    res.status(502).json({ erro: "Falha ao consultar a RAWG" });
  }
});

const PORTA = Number(process.env.PORT ?? 3000);
app.listen(PORTA, () => {
  console.log(`API rodando na porta ${PORTA}`);
});
