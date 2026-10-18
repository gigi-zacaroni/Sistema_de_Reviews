// Erro com código HTTP: o middleware de erros transforma em resposta JSON.
export class ErroHttp extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

export function exigirTexto(valor, campo, max) {
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new ErroHttp(400, `${campo} é obrigatório`);
  }
  const texto = valor.trim();
  if (texto.length > max) {
    throw new ErroHttp(400, `${campo} deve ter no máximo ${max} caracteres`);
  }
  return texto;
}

// Campo opcional: ausente, null ou vazio vira null
export function textoOpcional(valor, campo, max) {
  if (valor === undefined || valor === null || valor === "") return null;
  return exigirTexto(valor, campo, max);
}

export function validarEmail(valor) {
  const email = exigirTexto(valor, "email", 150).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ErroHttp(400, "email inválido");
  }
  return email;
}

// Senha: mínimo 8 caracteres. O bcrypt só usa os 72 primeiros bytes,
// então senhas maiores que isso são recusadas em vez de cortadas em silêncio.
export function validarSenha(valor, campo = "senha") {
  if (typeof valor !== "string" || valor.length < 8) {
    throw new ErroHttp(400, `${campo} deve ter pelo menos 8 caracteres`);
  }
  if (Buffer.byteLength(valor, "utf8") > 72) {
    throw new ErroHttp(400, `${campo} deve ter no máximo 72 bytes`);
  }
  return valor;
}

export function validarId(valor, campo = "id") {
  const numero = Number(valor);
  if (valor === null || valor === "" || !Number.isInteger(numero) || numero <= 0) {
    throw new ErroHttp(400, `${campo} deve ser um número inteiro positivo`);
  }
  return numero;
}

export function idOpcional(valor, campo) {
  if (valor === undefined || valor === null || valor === "") return null;
  return validarId(valor, campo);
}

// Regra de negócio 5: nota entre 0,0 e 10,0 (o banco guarda 1 casa decimal)
export function validarNota(valor) {
  const tipoOk = typeof valor === "number" || typeof valor === "string";
  const numero = Number(valor);
  if (!tipoOk || valor === "" || !Number.isFinite(numero) || numero < 0 || numero > 10) {
    throw new ErroHttp(400, "nota deve estar entre 0,0 e 10,0");
  }
  return Math.round(numero * 10) / 10;
}

// Data no formato AAAA-MM-DD (opcional)
export function dataOpcional(valor, campo) {
  if (valor === undefined || valor === null || valor === "") return null;
  const valida =
    typeof valor === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(valor) &&
    !Number.isNaN(Date.parse(valor));
  if (!valida) {
    throw new ErroHttp(400, `${campo} deve estar no formato AAAA-MM-DD`);
  }
  return valor;
}

// Paginação: ?limite=20&deslocamento=0
export function lerPaginacao(query) {
  const limite = Math.min(Math.max(Number(query.limite) || 20, 1), 100);
  const deslocamento = Math.max(Number(query.deslocamento) || 0, 0);
  return { limite, deslocamento };
}
