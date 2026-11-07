import { ErroHttp, exigirTexto, textoOpcional, validarId } from "../../Utils/validacao.js";

export function criarGenerosUseCases({ generoRepository }) {
  async function buscarOuFalhar(id) {
    const genero = await generoRepository.buscarPorId(id);
    if (!genero) throw new ErroHttp(404, "Gênero não encontrado");
    return genero;
  }

  function lerCorpo(corpo) {
    return {
      nome: exigirTexto(corpo.nome, "nome", 60),
      descricao: textoOpcional(corpo.descricao, "descricao", 255),
    };
  }

  return {
    listar: () => generoRepository.listar(),

    obter: (idInformado) => buscarOuFalhar(validarId(idInformado)),

    async criar(corpo) {
      const dados = lerCorpo(corpo);
      const id = await generoRepository.criar(dados);
      return buscarOuFalhar(id);
    },

    async atualizar(idInformado, corpo) {
      const id = validarId(idInformado);
      const dados = lerCorpo(corpo);

      await buscarOuFalhar(id); // 404 se não existir
      await generoRepository.atualizar(id, dados);
      return buscarOuFalhar(id);
    },

    // Regra 7: gênero com jogos não pode ser excluído
    async excluir(idInformado) {
      const id = validarId(idInformado);
      await buscarOuFalhar(id);

      const resultado = await generoRepository.excluir(id);
      if (resultado === "emUso") {
        throw new ErroHttp(409, "Não é possível excluir: existem jogos associados a este gênero");
      }
    },
  };
}
