import { Router } from "express";
import { autenticar, exigirPerfil } from "../Apps/middlewares/auth.js";
import {
  listarJogos,
  obterJogo,
  importarJogo,
  criarJogo,
  atualizarJogo,
  excluirJogo,
} from "../Apps/controllers/jogosController.js";

const router = Router();

router.get("/", listarJogos);
router.get("/:id", obterJogo);
router.post("/importar", autenticar, exigirPerfil("ADMIN"), importarJogo);
router.post("/", autenticar, exigirPerfil("ADMIN"), criarJogo);
router.put("/:id", autenticar, exigirPerfil("ADMIN"), atualizarJogo);
router.delete("/:id", autenticar, exigirPerfil("ADMIN"), excluirJogo);

export default router;
