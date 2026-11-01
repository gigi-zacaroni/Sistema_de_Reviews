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
import plataformasRoutes from "./src/routes/plataformas.js";
import rawgRoutes from "./src/routes/rawg.js";

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
app.use("/plataformas", plataformasRoutes);
app.use("/jogos", jogosRoutes);
app.use("/reviews", reviewsRoutes);

// Integração com a RAWG (busca de jogos; a importação fica em POST /jogos/importar)
app.use("/rawg", rawgRoutes);

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
