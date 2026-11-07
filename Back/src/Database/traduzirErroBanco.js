import { ErroHttp } from "../Utils/validacao.js";

// Detalhe de infraestrutura: converte erros do MySQL em ErroHttp para que as
// camadas de cima (casos de uso, controllers) nunca precisem conhecer códigos
// do MySQL. O código original fica em `errnoBanco` para os repositórios que
// precisam tratar um caso específico (ex.: curtida duplicada).
export function traduzirErroBanco(erro) {
  let traduzido = null;

  switch (erro?.errno) {
    case 1062: {
      // Chave única repetida (regras 1 e 4, entre outras)
      const detalhe = erro.sqlMessage ?? "";
      let mensagem = "Registro duplicado";
      if (detalhe.includes("uq_usuario_email")) mensagem = "E-mail já cadastrado";
      else if (detalhe.includes("uq_review_usuario_jogo"))
        mensagem = "Você já avaliou este jogo. Edite a review existente";
      else if (detalhe.includes("uq_genero_nome")) mensagem = "Já existe um gênero com esse nome";
      else if (detalhe.includes("uq_jogo_rawg")) mensagem = "Já existe um jogo com esse rawg_id";
      traduzido = new ErroHttp(409, mensagem);
      break;
    }
    case 1451:
      // Tentou excluir algo que ainda é referenciado (RESTRICT)
      traduzido = new ErroHttp(409, "Não é possível excluir: existem registros associados");
      break;
    case 1452:
      // Chave estrangeira apontando para algo que não existe
      traduzido = new ErroHttp(400, "Referência inválida: o registro relacionado não existe");
      break;
    case 3819:
      // CHECK do banco (nota ou nota_media fora de 0 a 10)
      traduzido = new ErroHttp(400, "Valor fora do intervalo permitido");
      break;
  }

  if (!traduzido) return erro;
  traduzido.errnoBanco = erro.errno;
  return traduzido;
}
