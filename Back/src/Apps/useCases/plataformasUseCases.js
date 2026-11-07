import { ErroHttp, exigirTexto, validarId } from "../../Utils/validacao.js";

export function criarPlataformasUseCases({ plataformaRepository }) {
  async function buscarOuFalhar(id) {
    const plataforma = await plataformaRepository.buscarPorId(id);
    if (!plataforma) throw new ErroHttp(404, "Plataforma não encontrada");
    return plataforma;
  }

  return {
    listar: () => plataformaRepository.listar(),

    obter: (idInformado) => buscarOuFalhar(validarId(idInformado)),

    async criar(corpo) {
      const nome = exigirTexto(corpo.nome, "nome", 60);
      const id = await plataformaRepository.criar(nome);
      return buscarOuFalhar(id);
    },

    async atualizar(idInformado, corpo) {
      const id = validarId(idInformado);
      const nome = exigirTexto(corpo.nome, "nome", 60);

      await buscarOuFalhar(id); // 404 se não existir
      await plataformaRepository.atualizar(id, nome);
      return buscarOuFalhar(id);
    },

    // Regra 11: plataforma que ainda tem jogos ligados a ela não pode ser excluída
    async excluir(idInformado) {
      const id = validarId(idInformado);
      await buscarOuFalhar(id); // 404 se não existir

      const excluida = await plataformaRepository.excluirSeSemJogos(id);
      if (!excluida) {
        throw new ErroHttp(
          409,
          "Não é possível excluir: existem jogos ligados a esta plataforma. Remova a plataforma desses jogos antes"
        );
      }
    },
  };
}
