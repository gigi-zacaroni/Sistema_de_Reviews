import { Router } from "express";
import { autenticar, exigirPerfil, proprioOuAdmin } from "../Apps/middlewares/auth.js";
import {
  listarUsuarios,
  obterUsuario,
  atualizarUsuario,
  alterarPerfil,
  excluirUsuario,
} from "../Apps/controllers/usuariosController.js";

const router = Router();

// Tudo em /usuarios exige login
router.use(autenticar);

router.get("/", exigirPerfil("ADMIN"), listarUsuarios);
router.get("/:id", proprioOuAdmin, obterUsuario);
router.put("/:id", proprioOuAdmin, atualizarUsuario);
router.patch("/:id/perfil", exigirPerfil("ADMIN"), alterarPerfil);
router.delete("/:id", proprioOuAdmin, excluirUsuario);

export default router;
