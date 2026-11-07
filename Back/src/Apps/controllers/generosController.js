import { useCases } from "../../container.js";

const { generos } = useCases;

export const listarGeneros = async (req, res) => {
  res.json(await generos.listar());
};

export const obterGenero = async (req, res) => {
  res.json(await generos.obter(req.params.id));
};

export const criarGenero = async (req, res) => {
  res.status(201).json(await generos.criar(req.body ?? {}));
};

export const atualizarGenero = async (req, res) => {
  res.json(await generos.atualizar(req.params.id, req.body ?? {}));
};

export const excluirGenero = async (req, res) => {
  await generos.excluir(req.params.id);
  res.status(204).end();
};
