import { Router } from "express";
import { autenticar, exigirPerfil } from "../Apps/middlewares/auth.js";
import {
  listarReviews,
  listarDenuncias,
  descartarDenuncia,
  obterReview,
  criarReview,
  atualizarReview,
  excluirReview,
  curtirReview,
  removerCurtida,
  denunciarReview,
} from "../Apps/controllers/reviewsController.js";

const router = Router();

router.get("/", listarReviews);
router.get("/denuncias", autenticar, exigirPerfil("ADMIN"), listarDenuncias);
router.delete("/denuncias/:id", autenticar, exigirPerfil("ADMIN"), descartarDenuncia);
router.get("/:id", obterReview);
router.post("/", autenticar, criarReview);
router.put("/:id", autenticar, atualizarReview);
router.delete("/:id", autenticar, excluirReview);
router.post("/:id/curtida", autenticar, curtirReview);
router.delete("/:id/curtida", autenticar, removerCurtida);
router.post("/:id/denuncia", autenticar, denunciarReview);

export default router;
