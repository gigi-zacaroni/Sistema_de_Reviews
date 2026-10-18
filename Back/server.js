import "dotenv/config";
import express from "express";
import { pool } from "./src/db.js";
import { config } from "./src/config.js";
import { criarAdminInicial } from "./src/seedAdmin.js";
import { rotaNaoEncontrada, tratarErros } from "./src/middlewares/erros.js";
import authRoutes from "./src/routes/auth.js";
import usuariosRoutes from "./src/routes/usuarios.js";
import generosRoutes from "./src/routes/generos.js";
import jogosRoutes from "./src/routes/jogos.js";
import reviewsRoutes from "./src/routes/reviews.js";

const app = express();
app.disable("x-powered-by");
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

// Autenticação e recuperação de senha
app.use("/auth", authRoutes);

// Recursos do sistema (cada rota define quem pode acessar)
app.use("/usuarios", usuariosRoutes);
app.use("/generos", generosRoutes);
app.use("/jogos", jogosRoutes);
app.use("/reviews", reviewsRoutes);

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

// Estes dois precisam ser os últimos
app.use(rotaNaoEncontrada);
app.use(tratarErros);

// Cria o administrador inicial (se ainda não existir) antes de aceitar requisições
try {
  await criarAdminInicial();
} catch (erro) {
  console.error("Não foi possível criar o administrador inicial:", erro.message);
}

app.listen(config.porta, () => {
  console.log(`API rodando na porta ${config.porta}`);
});
