
const API_KEY = process.env.RAWG_API_KEY;
console.log('Chave:', API_KEY ? 'carregada, ' + API_KEY.length + ' caracteres' : 'NÃO carregada (undefined)');
const BASE_URL = 'https://api.rawg.io/api';

async function listarPorGenero(genero) {

    const parametros = new URLSearchParams({
        key: API_KEY,
        genres: genero,
        page_size: "10",
    });

    const resposta = await fetch(`${BASE_URL}/games?${parametros}`);
    if (!resposta.ok) {
        throw new Error(`Erro HTTP : ${resposta.status}`)
    }

    const dados = await resposta.json();
    return dados.results;

}

async function main() {
    try {
        const jogos = await listarPorGenero('action');

        for (const jogo of jogos) {
            console.log(jogo.name);
        }
    } catch (erro) {
        console.error('Algo deu errado:', erro.message);
    }
}

main();