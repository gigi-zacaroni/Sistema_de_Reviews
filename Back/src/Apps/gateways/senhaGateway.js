import bcrypt from "bcryptjs";

// Hash de mentira usado quando o e-mail não existe, para o login gastar o mesmo
// tempo nos dois casos (e-mail inexistente x senha errada) e não revelar quem existe.
const HASH_FALSO = bcrypt.hashSync("senha-falsa-para-igualar-o-tempo", 10);

export function criarSenhaGateway() {
  return {
    hash: (senha) => bcrypt.hash(senha, 10),

    // Se não houver hash (usuário inexistente), compara com o falso e dá false
    comparar: (senha, hash) => bcrypt.compare(senha, hash ?? HASH_FALSO),
  };
}
