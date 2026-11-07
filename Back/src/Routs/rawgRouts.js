import { Router } from "express";
import { autenticar, exigirPerfil } from "../Apps/middlewares/auth.js";
import {
  buscarJogosRawg,
} from "../Apps/controllers/rawgController.js";

const router = Router();

router.get("/jogos", autenticar, exigirPerfil("ADMIN"), buscarJogosRawg);

export default router;
