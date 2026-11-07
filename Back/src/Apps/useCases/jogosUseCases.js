import {
  ErroHttp,
  dataOpcional,
  exigirTexto,
  idOpcional,
  lerPaginacao,
  textoOpcional,
  validarId,
  validarListaIds,
} from "../../Utils/validacao.js";

// Campos que o Administrador pode enviar e como cada um é validado.
// A nota_media NÃO está aqui: ela é calculada pelas reviews (regra 6).
const CAMPOS = {
  id_genero: (v) => validarId(v, "id_genero"),
  titulo: (v) => exigirTexto(v, "titulo", 150),
  desenvolvedora: (v) => textoOpcional(v, "desenvolvedora", 100),
  publicadora: (v) => textoOpcional(v, "publicadora", 100),
  descricao: (v) => textoOpcional(v, "descricao", 20000),
  data_lancamento: (v) => dataOpcional(v, "data_lancamento"),
  capa_url: (v) => textoOpcional(v, "capa_url", 500),
  rawg_id: (v) => idOpcional(v, "rawg_id"),
};

// Valida o corpo. Ao criar, todos os campos passam pela validação (id_genero e
// titulo são obrigatórios). Ao atualizar, só os campos enviados são considerados.
// "plataformas" (lista de id_plataforma) é opcional: quando enviada, substitui
// as plataformas do jogo; lista vazia remove todas.
function lerCampos(corpo, { criar }) {
  const dados = {};
  for (const [campo, validar] of Object.entries(CAMPOS)) {
    if (!criar && corpo[campo] === undefined) continue;
    dados[campo] = validar(corpo[campo]);
  }
  const plataformas =
    corpo.plataformas === undefined
      ? undefined
      : validarListaIds(corpo.plataformas, "plataformas");

  if (Object.keys(dados).length === 0 && plataformas === undefined) {
    throw new ErroHttp(400, "Informe ao menos um campo para atualizar");
  }
  return { dados, plataformas };
}

export function criarJogosUseCases({ jogoRepository, unitOfWork, rawgGateway }) {
  async function buscarOuFalhar(id) {
    const jogo = await jogoRepository.buscarPorId(id);
    if (!jogo) throw new ErroHttp(404, "Jogo não encontrado");
    return jogo;
  }

  // Troca as plataformas do jogo pela lista recebida (dentro de uma transação)
  async function definirPlataformas(repos, idJogo, idsPlataformas) {
    if (idsPlataformas.length > 0) {
      const existentes = await repos.plataformaRepository.contarExistentes(idsPlataformas);
      if (existentes !== idsPlataformas.length) {
        throw new ErroHttp(400, "plataformas contém um id que não existe");
      }
    }
    await repos.jogoRepository.substituirPlataformas(idJogo, idsPlataformas);
  }

  // Grava no banco um jogo vindo da RAWG, com o gênero e as plataformas dele:
  // ou grava tudo, ou nada. Se o rawg_id já existe, atualiza em vez de duplicar.
  async function gravarDaRawg(detalhe) {
    return unitOfWork.executar(async (repos) => {
      const idGenero = await repos.generoRepository.salvarPorNome(detalhe.genero);
      const idJogo = await repos.jogoRepository.salvarDaRawg({ ...detalhe, idGenero });

      for (const nome of detalhe.plataformas) {
        const idPlataforma = await repos.plataformaRepository.salvarPorNome(nome);
        await repos.jogoRepository.vincularPlataforma(idJogo, idPlataforma);
      }
      return idJogo;
    });
  }

  return {
    // Filtros: busca, id_genero, id_plataforma, limite, deslocamento
    async listar(query) {
      const filtros = {
        busca: query.busca,
        idGenero: query.id_genero ? validarId(query.id_genero, "id_genero") : null,
        idPlataforma: query.id_plataforma ? validarId(query.id_plataforma, "id_plataforma") : null,
        ...lerPaginacao(query),
      };
      return jogoRepository.listar(filtros);
    },

    obter: (idInformado) => buscarOuFalhar(validarId(idInformado)),

    // Cadastra um jogo a partir da RAWG: busca o detalhe e grava jogo, gênero e
    // plataformas de uma vez.
    async importarDaRawg(corpo) {
      const rawgId = validarId(corpo.rawg_id, "rawg_id");

      const existente = await jogoRepository.buscarIdPorRawgId(rawgId);
      if (existente !== null) {
        throw new ErroHttp(409, `Este jogo já foi importado (id_jogo ${existente})`);
      }

      const detalhe = await rawgGateway.buscarDetalhe(rawgId); // 404/502 se a RAWG falhar
      return buscarOuFalhar(await gravarDaRawg(detalhe));
    },

    // Carga em lote (script de linha de comando): importa ou atualiza os jogos
    // de um gênero. Chama `aoImportar(titulo)` a cada jogo gravado.
    async importarPorGenero(genero, quantidade, aoImportar = () => {}) {
      const ids = await rawgGateway.listarIdsPorGenero(genero, quantidade);
      for (const rawgId of ids) {
        // A lista da RAWG não traz descrição nem desenvolvedora, então busca o detalhe
        const detalhe = await rawgGateway.buscarDetalhe(rawgId);
        await gravarDaRawg(detalhe);
        aoImportar(detalhe.titulo);
      }
    },

    async criar(corpo) {
      const { dados, plataformas } = lerCampos(corpo, { criar: true });

      const idJogo = await unitOfWork.executar(async (repos) => {
        const id = await repos.jogoRepository.criar(dados);
        if (plataformas !== undefined) {
          await definirPlataformas(repos, id, plataformas);
        }
        return id;
      });
      return buscarOuFalhar(idJogo);
    },

    async atualizar(idInformado, corpo) {
      const id = validarId(idInformado);
      const { dados, plataformas } = lerCampos(corpo, { criar: false });

      await buscarOuFalhar(id); // 404 se não existir
      await unitOfWork.executar(async (repos) => {
        await repos.jogoRepository.atualizar(id, dados);
        if (plataformas !== undefined) {
          await definirPlataformas(repos, id, plataformas);
        }
      });
      return buscarOuFalhar(id);
    },

    // Regra 8: as reviews do jogo são excluídas em cascata (ON DELETE CASCADE)
    async excluir(idInformado) {
      const id = validarId(idInformado);
      await buscarOuFalhar(id);
      await jogoRepository.excluir(id);
    },
  };
}
