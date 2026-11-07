import "dotenv/config";
import { pool } from "./db.js";
import { useCases } from "../container.js";

// Carga inicial pela linha de comando (a API faz o mesmo com POST /jogos/importar).
// Uso: node Src/Database/importar_rawg.js <genero> <quantidade>
async function main() {
  const genero = process.argv[2] ?? "action";
  const quantidade = Number(process.argv[3] ?? 10);

  await useCases.jogos.importarPorGenero(genero, quantidade, (titulo) =>
    console.log(`Importado: ${titulo}`)
  );
}

main()
  .catch((erro) => {
    console.error("Falha na importação:", erro.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
