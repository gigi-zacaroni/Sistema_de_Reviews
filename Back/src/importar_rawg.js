import "dotenv/config";
import { pool, comTransacao } from "./db.js";
import { buscarDetalheJogo, listarJogosPorGenero } from "./services/rawg.js";
import { salvarJogoDaRawg } from "./services/importarJogo.js";

// Carga inicial pela linha de comando (a API faz o mesmo com POST /jogos/importar).
// Uso: node src/importar_rawg.js <genero> <quantidade>
async function main() {
  const genero = process.argv[2] ?? "action";
  const quantidade = Number(process.argv[3] ?? 10);

  const lista = await listarJogosPorGenero(genero, quantidade);

  for (const item of lista) {
    // A lista não traz descrição nem desenvolvedora, então busco o detalhe
    const detalhe = await buscarDetalheJogo(item.id);
    await comTransacao((conexao) => salvarJogoDaRawg(conexao, detalhe));
    console.log(`Importado: ${detalhe.name}`);
  }
}

main()
  .catch((erro) => {
    console.error("Falha na importação:", erro.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
