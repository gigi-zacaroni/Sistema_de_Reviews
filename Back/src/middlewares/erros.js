import { ErroHttp } from "../utils/validacao.js";

// Rota que não existe
export function rotaNaoEncontrada(req, res) {
  res.status(404).json({ erro: "Rota não encontrada" });
}

// Todo erro lançado nas rotas cai aqui (o Express 5 repassa erros de funções
// async automaticamente, então as rotas não precisam de try/catch).
export function tratarErros(erro, req, res, next) {
  if (erro instanceof ErroHttp) {
    return res.status(erro.status).json({ erro: erro.message });
  }

  // JSON malformado no corpo da requisição
  if (erro.type === "entity.parse.failed") {
    return res.status(400).json({ erro: "Corpo da requisição não é um JSON válido" });
  }

  // Erros do MySQL traduzidos para respostas HTTP
  switch (erro.errno) {
    case 1062: {
      // Chave única repetida (regras 1 e 4, entre outras)
      const detalhe = erro.sqlMessage ?? "";
      let mensagem = "Registro duplicado";
      if (detalhe.includes("uq_usuario_email")) mensagem = "E-mail já cadastrado";
      else if (detalhe.includes("uq_review_usuario_jogo"))
        mensagem = "Você já avaliou este jogo. Edite a review existente";
      else if (detalhe.includes("uq_genero_nome")) mensagem = "Já existe um gênero com esse nome";
      else if (detalhe.includes("uq_jogo_rawg")) mensagem = "Já existe um jogo com esse rawg_id";
      return res.status(409).json({ erro: mensagem });
    }
    case 1451:
      // Tentou excluir algo que ainda é referenciado (RESTRICT)
      return res.status(409).json({ erro: "Não é possível excluir: existem registros associados" });
    case 1452:
      // Chave estrangeira apontando para algo que não existe
      return res.status(400).json({ erro: "Referência inválida: o registro relacionado não existe" });
    case 3819:
      // CHECK do banco (nota ou nota_media fora de 0 a 10)
      return res.status(400).json({ erro: "Valor fora do intervalo permitido" });
  }

  console.error(erro);
  res.status(500).json({ erro: "Erro interno do servidor" });
}
