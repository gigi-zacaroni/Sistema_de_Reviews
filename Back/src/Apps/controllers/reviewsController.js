import { useCases } from "../../container.js";

const { reviews } = useCases;

// GET /reviews?id_jogo=1&id_usuario=2: leitura pública
export const listarReviews = async (req, res) => {
  res.json(await reviews.listar(req.query));
};

// GET /reviews/denuncias: para moderação (somente Administrador)
export const listarDenuncias = async (req, res) => {
  res.json(await reviews.listarDenuncias(req.query));
};

// DELETE /reviews/denuncias/:id: descarta uma denúncia improcedente
export const descartarDenuncia = async (req, res) => {
  await reviews.descartarDenuncia(req.params.id);
  res.status(204).end();
};

export const obterReview = async (req, res) => {
  res.json(await reviews.obter(req.params.id));
};

// POST /reviews: qualquer usuário autenticado publica
export const criarReview = async (req, res) => {
  res.status(201).json(await reviews.criar(req.usuario, req.body ?? {}));
};

// PUT /reviews/:id: somente o autor
export const atualizarReview = async (req, res) => {
  res.json(await reviews.atualizar(req.usuario, req.params.id, req.body ?? {}));
};

// DELETE /reviews/:id: o autor ou um Administrador
export const excluirReview = async (req, res) => {
  await reviews.excluir(req.usuario, req.params.id);
  res.status(204).end();
};

// POST /reviews/:id/curtida
export const curtirReview = async (req, res) => {
  res.status(201).json(await reviews.curtir(req.usuario, req.params.id));
};

// DELETE /reviews/:id/curtida
export const removerCurtida = async (req, res) => {
  await reviews.removerCurtida(req.usuario, req.params.id);
  res.status(204).end();
};

// POST /reviews/:id/denuncia
export const denunciarReview = async (req, res) => {
  res.status(201).json(await reviews.denunciar(req.usuario, req.params.id, req.body ?? {}));
};
