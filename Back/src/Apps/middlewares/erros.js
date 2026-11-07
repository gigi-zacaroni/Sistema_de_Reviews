import { ErroHttp } from "../../Utils/validacao.js";

// Rota que não existe
export function rotaNaoEncontrada(req, res) {
  res.status(404).json({ erro: "Rota não encontrada" });
}

// Todo erro lançado nas rotas cai aqui (o Express 5 repassa erros de funções
// async automaticamente, então as rotas não precisam de try/catch).
// Erros do banco já chegam traduzidos para ErroHttp pela camada de persistência.
export function tratarErros(erro, req, res, next) {
  if (erro instanceof ErroHttp) {
    return res.status(erro.status).json({ erro: erro.message });
  }

  // JSON malformado no corpo da requisição
  if (erro.type === "entity.parse.failed") {
    return res.status(400).json({ erro: "Corpo da requisição não é um JSON válido" });
  }

  console.error(erro);
  res.status(500).json({ erro: "Erro interno do servidor" });
}
