import "dotenv/config";
import express from "express";
import { verificarBanco } from "./Src/Database/db.js";
import { config } from "./Src/Configs/config.js";
import { migrarBanco } from "./Src/Database/migrar.js";
import { criarAdminInicial } from "./Src/Database/seedAdmin.js";
import { rotaNaoEncontrada, tratarErros } from "./Src/Apps/middlewares/erros.js";
import authRoutes from "./Src/Routs/authRouts.js";
import usuariosRoutes from "./Src/Routs/usuariosRouts.js";
import generosRoutes from "./Src/Routs/generosRouts.js";
import jogosRoutes from "./Src/Routs/jogosRouts.js";
import reviewsRoutes from "./Src/Routs/reviewsRouts.js";
import plataformasRoutes from "./Src/Routs/plataformasRouts.js";
import rawgRoutes from "./Src/Routs/rawgRouts.js";

const app = express();
app.disable("x-powered-by");
app.use(express.json());

// Verifica se a API está no ar e se consegue falar com o banco
app.get("/health", async (req, res) => {
  try {
    await verificarBanco();
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

// Atualiza o schema do banco (migrações pendentes) ANTES de aceitar requisições.
// Se falhar, a API não sobe: melhor parar do que rodar com tabelas faltando.
try {
  await migrarBanco();
} catch (erro) {
  console.error("Não foi possível atualizar o banco (migrações):", erro.message);
  process.exit(1);
}

// Cria o administrador inicial (se ainda não existir) antes de aceitar requisições
try {
  await criarAdminInicial();
} catch (erro) {
  console.error("Não foi possível criar o administrador inicial:", erro.message);
}

app.listen(config.porta, () => {
  console.log(`API rodando na porta ${config.porta}`);
});
