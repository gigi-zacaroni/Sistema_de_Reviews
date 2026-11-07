import { comTraducaoDeErros } from "./db.js";
import { criarRepositorios } from "./repositories/index.js";

// Unidade de trabalho: executa vários passos como uma única transação (ou tudo
// dá certo, ou nada é gravado). Os casos de uso recebem repositórios já ligados
// à conexão da transação e não sabem que existe MySQL por trás.
export function criarUnitOfWork(pool) {
  return {
    async executar(funcao) {
      const conexao = await pool.getConnection();
      try {
        await conexao.beginTransaction();
        const repositorios = criarRepositorios(comTraducaoDeErros(conexao));
        const resultado = await funcao(repositorios);
        await conexao.commit();
        return resultado;
      } catch (erro) {
        await conexao.rollback();
        throw erro;
      } finally {
        conexao.release();
      }
    },
  };
}
