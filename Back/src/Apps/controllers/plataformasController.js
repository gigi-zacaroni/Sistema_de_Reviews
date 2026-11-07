import { useCases } from "../../container.js";

const { plataformas } = useCases;

export const listarPlataformas = async (req, res) => {
  res.json(await plataformas.listar());
};

export const obterPlataforma = async (req, res) => {
  res.json(await plataformas.obter(req.params.id));
};

export const criarPlataforma = async (req, res) => {
  res.status(201).json(await plataformas.criar(req.body ?? {}));
};

export const atualizarPlataforma = async (req, res) => {
  res.json(await plataformas.atualizar(req.params.id, req.body ?? {}));
};

export const excluirPlataforma = async (req, res) => {
  await plataformas.excluir(req.params.id);
  res.status(204).end();
};
