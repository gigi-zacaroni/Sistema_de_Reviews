import { Router } from "express";
import { autenticar, exigirPerfil } from "../Apps/middlewares/auth.js";
import {
  listarGeneros,
  obterGenero,
  criarGenero,
  atualizarGenero,
  excluirGenero,
} from "../Apps/controllers/generosController.js";

const router = Router();

router.get("/", listarGeneros);
router.get("/:id", obterGenero);
router.post("/", autenticar, exigirPerfil("ADMIN"), criarGenero);
router.put("/:id", autenticar, exigirPerfil("ADMIN"), atualizarGenero);
router.delete("/:id", autenticar, exigirPerfil("ADMIN"), excluirGenero);

export default router;
