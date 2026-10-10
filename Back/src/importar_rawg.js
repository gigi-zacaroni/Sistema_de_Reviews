import "dotenv/config";
import { pool } from "./db.js";

const BASE_URL = "https://api.rawg.io/api";
const CHAVE = process.env.RAWG_API_KEY;

// Faz uma requisição à RAWG e devolve o JSON
async function buscarNaRawg(caminho, parametros = {}) {
    const query = new URLSearchParams({ key: CHAVE, ...parametros });
    const resposta = await fetch(`${BASE_URL}${caminho}?${query}`);
    if (!resposta.ok) {
        throw new Error(`RAWG respondeu ${resposta.status} em ${caminho}`);
    }
    return resposta.json();
}

// Insere o gênero (ou reaproveita se já existir) e devolve o id
async function salvarGenero(nome) {
    const [r] = await pool.query(
        `INSERT INTO genero (nome) VALUES (?)
     ON DUPLICATE KEY UPDATE id_genero = LAST_INSERT_ID(id_genero)`,
        [nome.slice(0, 60)]
    );
    return r.insertId;
}

// Mesma ideia para a plataforma
async function salvarPlataforma(nome) {
    const [r] = await pool.query(
        `INSERT INTO plataforma (nome) VALUES (?)
     ON DUPLICATE KEY UPDATE id_plataforma = LAST_INSERT_ID(id_plataforma)`,
        [nome.slice(0, 60)]
    );
    return r.insertId;
}

// Insere o jogo; se o rawg_id já existe, só atualiza os dados
async function salvarJogo(d, idGenero) {
    const desenvolvedora = (d.developers ?? []).map((x) => x.name).join(", ");
    const publicadora = (d.publishers ?? []).map((x) => x.name).join(", ");

    const [r] = await pool.query(
        `INSERT INTO jogo
       (id_genero, titulo, desenvolvedora, publicadora, descricao,
        data_lancamento, capa_url, rawg_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) AS novo
     ON DUPLICATE KEY UPDATE
       id_jogo = LAST_INSERT_ID(id_jogo),
       id_genero = novo.id_genero,
       titulo = novo.titulo,
       desenvolvedora = novo.desenvolvedora,
       publicadora = novo.publicadora,
       descricao = novo.descricao,
       data_lancamento = novo.data_lancamento,
       capa_url = novo.capa_url`,
        [
            idGenero,
            d.name.slice(0, 150),
            desenvolvedora.slice(0, 100) || null,
            publicadora.slice(0, 100) || null,
            d.description_raw || null,
            d.released || null,
            d.background_image || null,
            d.id,
        ]
    );
    return r.insertId;
}

async function main() {
    if (!CHAVE) {
        throw new Error("RAWG_API_KEY não foi carregada (confira o Back/.env)");
    }

    // Uso: node src/importar-rawg.js <genero> <quantidade>
    const genero = process.argv[2] ?? "action";
    const quantidade = Number(process.argv[3] ?? 10);

    const lista = await buscarNaRawg("/games", {
        genres: genero,
        page_size: String(quantidade),
        ordering: "-added",
    });

    for (const item of lista.results) {
        // A lista não traz descrição nem desenvolvedora, então busco o detalhe
        const d = await buscarNaRawg(`/games/${item.id}`);

        // O jogo guarda um gênero só; uso o primeiro que a RAWG informa
        const nomeGenero = d.genres?.[0]?.name ?? "Outros";
        const idGenero = await salvarGenero(nomeGenero);
        const idJogo = await salvarJogo(d, idGenero);

        for (const p of d.platforms ?? []) {
            const idPlataforma = await salvarPlataforma(p.platform.name);
            await pool.query(
                "INSERT IGNORE INTO jogo_plataforma (id_jogo, id_plataforma) VALUES (?, ?)",
                [idJogo, idPlataforma]
            );
        }

        console.log(`Importado: ${d.name}`);
    }
}

main()
    .catch((erro) => {
        console.error("Falha na importação:", erro.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());