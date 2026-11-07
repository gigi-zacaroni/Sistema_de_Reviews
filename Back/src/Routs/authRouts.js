import { Router } from "express";
import { autenticar } from "../Apps/middlewares/auth.js";
import {
  cadastrar,
  login,
  obterUsuarioLogado,
  esqueciSenha,
  paginaRedefinirSenha,
  redefinirSenha,
} from "../Apps/controllers/authController.js";

const router = Router();

router.post("/cadastro", cadastrar);
router.post("/login", login);
router.get("/eu", autenticar, obterUsuarioLogado);
router.post("/esqueci-senha", esqueciSenha);
router.get("/redefinir-senha", paginaRedefinirSenha);
router.post("/redefinir-senha", redefinirSenha);

export default router;
