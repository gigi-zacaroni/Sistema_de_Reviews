import { useCases } from "../../container.js";

// GET /rawg/jogos?busca=zelda: procura jogos na RAWG antes de importar
export const buscarJogosRawg = async (req, res) => {
  res.json(await useCases.rawg.buscarJogos(req.query.busca));
};
