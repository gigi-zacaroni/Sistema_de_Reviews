// Monta as colunas de um INSERT/UPDATE dinâmico a partir de uma lista fixa.
// Nomes de coluna nunca vêm do usuário: se aparecer um campo fora da lista, é bug.
export function colunasPermitidas(dados, permitidas) {
  const colunas = Object.keys(dados);
  const invalida = colunas.find((c) => !permitidas.includes(c));
  if (invalida) throw new Error(`Coluna não permitida: ${invalida}`);
  return colunas;
}
