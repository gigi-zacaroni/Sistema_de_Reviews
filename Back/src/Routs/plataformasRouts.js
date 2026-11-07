import { Router } from "express";
import { autenticar, exigirPerfil } from "../Apps/middlewares/auth.js";
import {
  listarPlataformas,
  obterPlataforma,
  criarPlataforma,
  atualizarPlataforma,
  excluirPlataforma,
} from "../Apps/controllers/plataformasController.js";

const router = Router();

router.get("/", listarPlataformas);
router.get("/:id", obterPlataforma);
router.post("/", autenticar, exigirPerfil("ADMIN"), criarPlataforma);
router.put("/:id", autenticar, exigirPerfil("ADMIN"), atualizarPlataforma);
router.delete("/:id", autenticar, exigirPerfil("ADMIN"), excluirPlataforma);

export default router;
