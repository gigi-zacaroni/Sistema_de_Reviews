import { ErroHttp } from "../../Utils/validacao.js";

// Cliente da API RAWG (https://rawg.io/apidocs). Só fala com a internet:
// não conhece banco de dados nem rotas HTTP, e devolve dados já no formato
// do sistema (o formato da RAWG não vaza para os casos de uso).
const BASE_URL = "https://api.rawg.io/api";
const TEMPO_LIMITE_MS = 8000;

// Converte o detalhe de /games/{id} para o formato interno, respeitando os
// tamanhos das colunas do banco.
function normalizarDetalhe(d) {
  if (!d?.id || typeof d.name !== "string" || d.name === "") {
    throw new ErroHttp(502, "A RAWG devolveu um jogo em formato inesperado");
  }

  const desenvolvedora = (d.developers ?? []).map((x) => x.name).join(", ");
  const publicadora = (d.publishers ?? []).map((x) => x.name).join(", ");

  return {
    rawgId: d.id,
    titulo: d.name.slice(0, 150),
    desenvolvedora: desenvolvedora.slice(0, 100) || null,
    publicadora: publicadora.slice(0, 100) || null,
    descricao: d.description_raw?.slice(0, 20000) || null,
    dataLancamento: d.released || null,
    capaUrl: d.background_image?.slice(0, 500) || null,
    // O jogo guarda um gênero só; usa o primeiro que a RAWG informa
    genero: (d.genres?.[0]?.name ?? "Outros").slice(0, 60),
    plataformas: (d.platforms ?? []).map((p) => p.platform.name.slice(0, 60)),
  };
}

export function criarRawgGateway({ chave }) {
  async function chamarRawg(caminho, parametros = {}) {
    if (!chave || chave === "coloque_sua_chave_aqui") {
      console.error("RAWG_API_KEY não definida (confira o Back/.env)");
      throw new ErroHttp(503, "Integração com a RAWG indisponível no servidor");
    }

    let resposta;
    try {
      const query = new URLSearchParams({ key: chave, ...parametros });
      resposta = await fetch(`${BASE_URL}${caminho}?${query}`, {
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      });
    } catch (erro) {
      // Só o tipo do erro vai para o log, para a chave nunca aparecer nele
      console.error("Falha de rede ao chamar a RAWG:", erro.name);
      throw new ErroHttp(502, "Não foi possível consultar a RAWG");
    }

    if (resposta.status === 404) {
      throw new ErroHttp(404, "Jogo não encontrado na RAWG");
    }
    if (resposta.status === 401 || resposta.status === 403) {
      console.error(`RAWG recusou a chave de acesso (status ${resposta.status})`);
      throw new ErroHttp(502, "A RAWG recusou o acesso. Avise o responsável pelo sistema");
    }
    if (!resposta.ok) {
      console.error(`RAWG respondeu ${resposta.status} em ${caminho}`);
      throw new ErroHttp(502, "A RAWG respondeu com erro");
    }
    return resposta.json();
  }

  return {
    // Busca até 10 jogos pelo nome. Devolve só o que o sistema usa.
    async buscarPorNome(busca) {
      const dados = await chamarRawg("/games", { search: busca, page_size: "10" });
      return (dados.results ?? []).map((j) => ({
        rawg_id: j.id,
        titulo: j.name,
        data_lancamento: j.released ?? null,
        capa_url: j.background_image ?? null,
      }));
    },

    // Detalhe completo de um jogo (traz descrição, desenvolvedoras, publicadoras...)
    async buscarDetalhe(rawgId) {
      return normalizarDetalhe(await chamarRawg(`/games/${rawgId}`));
    },

    // Ids de jogos de um gênero (usado pelo script de carga inicial)
    async listarIdsPorGenero(genero, quantidade) {
      const dados = await chamarRawg("/games", {
        genres: genero,
        page_size: String(quantidade),
        ordering: "-added",
      });
      return (dados.results ?? []).map((j) => j.id);
    },
  };
}
