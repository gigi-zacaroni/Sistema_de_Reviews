import { useCases } from "../../container.js";

const { jogos } = useCases;

// GET /jogos?busca=zelda&id_genero=1&id_plataforma=2&limite=20&deslocamento=0
export const listarJogos = async (req, res) => {
  res.json(await jogos.listar(req.query));
};

export const obterJogo = async (req, res) => {
  res.json(await jogos.obter(req.params.id));
};

// POST /jogos/importar { "rawg_id": 3498 }: cadastra um jogo a partir da RAWG
export const importarJogo = async (req, res) => {
  res.status(201).json(await jogos.importarDaRawg(req.body ?? {}));
};

export const criarJogo = async (req, res) => {
  res.status(201).json(await jogos.criar(req.body ?? {}));
};

export const atualizarJogo = async (req, res) => {
  res.json(await jogos.atualizar(req.params.id, req.body ?? {}));
};

export const excluirJogo = async (req, res) => {
  await jogos.excluir(req.params.id);
  res.status(204).end();
};
