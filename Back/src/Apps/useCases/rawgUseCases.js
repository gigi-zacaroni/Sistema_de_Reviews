import { exigirTexto } from "../../Utils/validacao.js";

export function criarRawgUseCases({ rawgGateway, jogoRepository }) {
  return {
    // Primeiro passo para cadastrar um jogo: o Administrador procura na RAWG e
    // depois importa o escolhido. Restrita ao Administrador porque cada busca
    // gasta a cota da chave da RAWG.
    async buscarJogos(buscaInformada) {
      const busca = exigirTexto(buscaInformada, "busca", 100);
      const resultados = await rawgGateway.buscarPorNome(busca);

      // Marca o que já está no banco, para o administrador não tentar importar de novo
      const jaImportados = await jogoRepository.buscarRawgIdsExistentes(
        resultados.map((j) => j.rawg_id)
      );

      return resultados.map((j) => ({ ...j, ja_importado: jaImportados.has(j.rawg_id) }));
    },
  };
}
