import {
  ErroHttp,
  exigirTexto,
  lerPaginacao,
  textoOpcional,
  validarId,
  validarNota,
} from "../../Utils/validacao.js";

export function criarReviewsUseCases({ reviewRepository, jogoRepository, unitOfWork }) {
  async function buscarOuFalhar(id) {
    const review = await reviewRepository.buscarPorId(id);
    if (!review) throw new ErroHttp(404, "Review não encontrada");
    return review;
  }

  // Edição: somente o autor altera o conteúdo da própria review.
  // O Administrador não edita texto de outras pessoas, só pode excluir (moderação).
  function exigirAutor(review, usuario) {
    if (review.id_usuario !== usuario.id_usuario) {
      throw new ErroHttp(403, "Acesso negado: somente o autor pode editar esta review");
    }
  }

  // Exclusão (regra 3): o autor exclui a própria review e o Administrador pode
  // excluir qualquer uma. Outros usuários comuns não excluem reviews alheias.
  function exigirAutorOuAdmin(review, usuario) {
    const ehAutor = review.id_usuario === usuario.id_usuario;
    const ehAdmin = usuario.perfil === "ADMIN";
    if (!ehAutor && !ehAdmin) {
      throw new ErroHttp(
        403,
        "Acesso negado: somente o autor ou um administrador pode excluir esta review"
      );
    }
  }

  return {
    async listar(query) {
      return reviewRepository.listar({
        idJogo: query.id_jogo ? validarId(query.id_jogo, "id_jogo") : null,
        idUsuario: query.id_usuario ? validarId(query.id_usuario, "id_usuario") : null,
        ...lerPaginacao(query),
      });
    },

    obter: (idInformado) => buscarOuFalhar(validarId(idInformado)),

    // O autor vem sempre do usuário autenticado, nunca do corpo da requisição.
    // Regra 4: uma review por usuário por jogo (UNIQUE no banco, vira 409).
    async criar(usuario, corpo) {
      const idJogo = validarId(corpo.id_jogo, "id_jogo");
      const titulo = exigirTexto(corpo.titulo, "titulo", 120);
      const comentario = textoOpcional(corpo.comentario, "comentario", 20000);
      const nota = validarNota(corpo.nota);

      if (!(await jogoRepository.existe(idJogo))) {
        throw new ErroHttp(404, "Jogo não encontrado");
      }

      const idReview = await unitOfWork.executar(async (repos) => {
        const id = await repos.reviewRepository.criar({
          idUsuario: usuario.id_usuario,
          idJogo,
          titulo,
          comentario,
          nota,
        });
        await repos.jogoRepository.recalcularNotaMedia(idJogo); // regra 6
        return id;
      });

      return buscarOuFalhar(idReview);
    },

    // Somente o autor edita
    async atualizar(usuario, idInformado, corpo) {
      const id = validarId(idInformado);
      const review = await buscarOuFalhar(id);
      exigirAutor(review, usuario);

      const alteracoes = {};
      if (corpo.titulo !== undefined) alteracoes.titulo = exigirTexto(corpo.titulo, "titulo", 120);
      if (corpo.comentario !== undefined)
        alteracoes.comentario = textoOpcional(corpo.comentario, "comentario", 20000);
      if (corpo.nota !== undefined) alteracoes.nota = validarNota(corpo.nota);
      if (Object.keys(alteracoes).length === 0) {
        throw new ErroHttp(400, "Informe titulo, comentario e/ou nota para atualizar");
      }

      await unitOfWork.executar(async (repos) => {
        await repos.reviewRepository.atualizar(id, alteracoes);
        await repos.jogoRepository.recalcularNotaMedia(review.id_jogo); // regra 6
      });

      return buscarOuFalhar(id);
    },

    // O autor ou um Administrador (regra 3)
    async excluir(usuario, idInformado) {
      const id = validarId(idInformado);
      const review = await buscarOuFalhar(id);
      exigirAutorOuAdmin(review, usuario);

      await unitOfWork.executar(async (repos) => {
        await repos.reviewRepository.excluir(id);
        await repos.jogoRepository.recalcularNotaMedia(review.id_jogo); // regra 6
      });
    },

    // Marca a review como útil (qualquer usuário logado)
    async curtir(usuario, idInformado) {
      const id = validarId(idInformado);
      await buscarOuFalhar(id); // 404 se não existir

      if (!(await reviewRepository.curtir(id, usuario.id_usuario))) {
        throw new ErroHttp(409, "Você já curtiu esta review");
      }

      const review = await buscarOuFalhar(id);
      return { id_review: id, qtd_curtidas: review.qtd_curtidas };
    },

    // Remove a curtida da própria pessoa
    async removerCurtida(usuario, idInformado) {
      const id = validarId(idInformado);
      await buscarOuFalhar(id);

      if (!(await reviewRepository.descurtir(id, usuario.id_usuario))) {
        throw new ErroHttp(404, "Você não curtiu esta review");
      }
    },

    // Denuncia uma review inadequada (qualquer usuário logado)
    async denunciar(usuario, idInformado, corpo) {
      const id = validarId(idInformado);
      const motivo = exigirTexto(corpo.motivo, "motivo", 255);
      await buscarOuFalhar(id);

      const idDenuncia = await reviewRepository.denunciar({
        idReview: id,
        idUsuario: usuario.id_usuario,
        motivo,
      });
      if (idDenuncia === null) {
        throw new ErroHttp(409, "Você já denunciou esta review");
      }
      return { id_denuncia: idDenuncia, id_review: id, motivo };
    },

    // Todas as denúncias, para moderação (somente Administrador)
    listarDenuncias: (query) => reviewRepository.listarDenuncias(lerPaginacao(query)),

    // O Administrador descarta uma denúncia que analisou e considerou improcedente
    async descartarDenuncia(idInformado) {
      const id = validarId(idInformado);
      if (!(await reviewRepository.excluirDenuncia(id))) {
        throw new ErroHttp(404, "Denúncia não encontrada");
      }
    },
  };
}
