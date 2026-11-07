import { ErroHttp, exigirTexto, validarEmail, validarId } from "../../Utils/validacao.js";

export function criarUsuariosUseCases({ usuarioRepository, unitOfWork }) {
  async function buscarOuFalhar(id) {
    const usuario = await usuarioRepository.buscarPorId(id);
    if (!usuario) throw new ErroHttp(404, "Usuário não encontrado");
    return usuario;
  }

  return {
    listar: () => usuarioRepository.listar(),

    // O id já chega validado pelo middleware de acesso (proprioOuAdmin)
    obter: (id) => buscarOuFalhar(id),

    // Edita nome e/ou e-mail. O perfil NÃO pode ser alterado aqui: existe
    // operação própria, só para Administrador.
    async atualizar(id, corpo) {
      const alteracoes = {};
      if (corpo.nome !== undefined) alteracoes.nome = exigirTexto(corpo.nome, "nome", 100);
      if (corpo.email !== undefined) alteracoes.email = validarEmail(corpo.email);
      if (Object.keys(alteracoes).length === 0) {
        throw new ErroHttp(400, "Informe nome e/ou email para atualizar");
      }

      await buscarOuFalhar(id); // 404 se não existir
      await usuarioRepository.atualizar(id, alteracoes);
      return buscarOuFalhar(id);
    },

    // Promove ou rebaixa (somente Administrador)
    async alterarPerfil(idInformado, { perfil }) {
      const id = validarId(idInformado);
      if (!["COMUM", "ADMIN"].includes(perfil)) {
        throw new ErroHttp(400, "perfil deve ser COMUM ou ADMIN");
      }

      const alvo = await buscarOuFalhar(id);
      if (alvo.perfil === "ADMIN" && perfil === "COMUM" && (await usuarioRepository.contarAdmins()) <= 1) {
        throw new ErroHttp(409, "Não é possível rebaixar o único administrador");
      }

      await usuarioRepository.atualizarPerfil(id, perfil);
      return buscarOuFalhar(id);
    },

    // Regra 9: as reviews do usuário somem em cascata (banco) e a nota_media dos
    // jogos afetados é recalculada (aqui).
    async excluir(id) {
      const alvo = await buscarOuFalhar(id);

      if (alvo.perfil === "ADMIN" && (await usuarioRepository.contarAdmins()) <= 1) {
        throw new ErroHttp(409, "Não é possível excluir o único administrador");
      }

      await unitOfWork.executar(async (repos) => {
        // Guarda os jogos avaliados ANTES de apagar, senão não dá para saber quais recalcular
        const idsJogos = await repos.reviewRepository.listarIdsJogosDoUsuario(id);
        await repos.usuarioRepository.excluir(id);
        for (const idJogo of idsJogos) {
          await repos.jogoRepository.recalcularNotaMedia(idJogo);
        }
      });
    },
  };
}
