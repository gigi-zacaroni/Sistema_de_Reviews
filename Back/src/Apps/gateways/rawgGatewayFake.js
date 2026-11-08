import { ErroHttp } from "../../Utils/validacao.js";

// Versão FALSA do rawgGateway, para desenvolver e testar sem internet e sem
// chave (ou quando a RAWG está fora do ar). Tem exatamente a mesma interface
// do gateway real e devolve os dados já no formato interno do sistema.
// Ligada pelo container quando RAWG_MOCK=1 no Back/.env.
//
// Para simular falhas, busque por um destes termos em GET /rawg/jogos:
//   "erro502"  -> 502 (RAWG fora do ar)
//   "erro503"  -> 503 (chave não configurada)
// ou importe um rawg_id que não está na lista abaixo (ex.: 999999) -> 404.

const JOGOS = [
  {
    rawgId: 3498,
    titulo: "Grand Theft Auto V",
    desenvolvedora: "Rockstar North",
    publicadora: "Rockstar Games",
    descricao: "Jogo de ação em mundo aberto ambientado em Los Santos (dado de teste).",
    dataLancamento: "2013-09-17",
    capaUrl: "https://placehold.co/600x400?text=GTA+V",
    genero: "Action",
    plataformas: ["PC", "PlayStation 4", "Xbox One"],
  },
  {
    rawgId: 3328,
    titulo: "The Witcher 3: Wild Hunt",
    desenvolvedora: "CD PROJEKT RED",
    publicadora: "CD PROJEKT RED",
    descricao: "RPG de mundo aberto com o caçador de monstros Geralt (dado de teste).",
    dataLancamento: "2015-05-18",
    capaUrl: "https://placehold.co/600x400?text=Witcher+3",
    genero: "RPG",
    plataformas: ["PC", "PlayStation 4", "Xbox One", "Nintendo Switch"],
  },
  {
    rawgId: 4200,
    titulo: "Portal 2",
    desenvolvedora: "Valve",
    publicadora: "Valve",
    descricao: "Quebra-cabeça em primeira pessoa com portais (dado de teste).",
    dataLancamento: "2011-04-18",
    capaUrl: "https://placehold.co/600x400?text=Portal+2",
    genero: "Puzzle",
    plataformas: ["PC", "PlayStation 3", "Xbox 360"],
  },
  {
    rawgId: 22511,
    titulo: "The Legend of Zelda: Breath of the Wild",
    desenvolvedora: "Nintendo EPD",
    publicadora: "Nintendo",
    descricao: "Aventura de mundo aberto em Hyrule (dado de teste).",
    dataLancamento: "2017-03-03",
    capaUrl: "https://placehold.co/600x400?text=Zelda+BotW",
    genero: "Adventure",
    plataformas: ["Nintendo Switch", "Wii U"],
  },
  {
    rawgId: 28,
    titulo: "Red Dead Redemption 2",
    desenvolvedora: "Rockstar Games",
    publicadora: "Rockstar Games",
    descricao: "Faroeste de ação e aventura em mundo aberto (dado de teste).",
    dataLancamento: "2018-10-26",
    capaUrl: "https://placehold.co/600x400?text=RDR2",
    genero: "Action",
    plataformas: ["PC", "PlayStation 4", "Xbox One"],
  },
  {
    rawgId: 13536,
    titulo: "Portal",
    desenvolvedora: "Valve",
    publicadora: "Valve, Electronic Arts",
    descricao: "O primeiro Portal (dado de teste).",
    dataLancamento: "2007-10-09",
    capaUrl: null,
    genero: "Puzzle",
    plataformas: ["PC", "Xbox 360"],
  },
];

const semAcento = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function criarRawgGatewayFake() {
  return {
    async buscarPorNome(busca) {
      const termo = semAcento(busca);
      if (termo === "erro502") throw new ErroHttp(502, "A RAWG respondeu com erro (simulado)");
      if (termo === "erro503") {
        throw new ErroHttp(503, "Integração com a RAWG indisponível no servidor (simulado)");
      }
      return JOGOS.filter((j) => semAcento(j.titulo).includes(termo))
        .slice(0, 10)
        .map((j) => ({
          rawg_id: j.rawgId,
          titulo: j.titulo,
          data_lancamento: j.dataLancamento,
          capa_url: j.capaUrl,
        }));
    },

    async buscarDetalhe(rawgId) {
      const jogo = JOGOS.find((j) => j.rawgId === Number(rawgId));
      if (!jogo) throw new ErroHttp(404, "Jogo não encontrado na RAWG");
      return structuredClone(jogo);
    },

    async listarIdsPorGenero(genero, quantidade) {
      const alvo = semAcento(String(genero));
      return JOGOS.filter((j) => semAcento(j.genero) === alvo)
        .slice(0, Number(quantidade))
        .map((j) => j.rawgId);
    },
  };
}
