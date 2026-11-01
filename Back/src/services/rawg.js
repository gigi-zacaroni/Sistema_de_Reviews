import { ErroHttp } from "../utils/validacao.js";

// Cliente da API RAWG (https://rawg.io/apidocs). Só fala com a internet:
// não conhece banco de dados nem rotas HTTP.
const BASE_URL = "https://api.rawg.io/api";
const TEMPO_LIMITE_MS = 8000;

async function chamarRawg(caminho, parametros = {}) {
  const chave = process.env.RAWG_API_KEY;
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

// Busca até 10 jogos pelo nome. Devolve só o que o sistema usa.
export async function buscarJogosPorNome(busca) {
  const dados = await chamarRawg("/games", { search: busca, page_size: "10" });
  return (dados.results ?? []).map((j) => ({
    rawg_id: j.id,
    titulo: j.name,
    data_lancamento: j.released ?? null,
    capa_url: j.background_image ?? null,
  }));
}

// Detalhe completo de um jogo (traz descrição, desenvolvedoras, publicadoras...)
export function buscarDetalheJogo(rawgId) {
  return chamarRawg(`/games/${rawgId}`);
}

// Lista de jogos de um gênero (usada pelo script de carga inicial)
export async function listarJogosPorGenero(genero, quantidade) {
  const dados = await chamarRawg("/games", {
    genres: genero,
    page_size: String(quantidade),
    ordering: "-added",
  });
  return dados.results ?? [];
}
