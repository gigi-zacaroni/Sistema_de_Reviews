import { criarUsuarioRepository } from "./usuarioRepository.js";
import { criarRecuperacaoSenhaRepository } from "./recuperacaoSenhaRepository.js";
import { criarGeneroRepository } from "./generoRepository.js";
import { criarPlataformaRepository } from "./plataformaRepository.js";
import { criarJogoRepository } from "./jogoRepository.js";
import { criarReviewRepository } from "./reviewRepository.js";

// Cria todos os repositórios ligados ao mesmo executor (o pool, ou a conexão
// de uma transação). Assim o mesmo código roda dentro ou fora de transação.
export function criarRepositorios(db) {
  return {
    usuarioRepository: criarUsuarioRepository(db),
    recuperacaoSenhaRepository: criarRecuperacaoSenhaRepository(db),
    generoRepository: criarGeneroRepository(db),
    plataformaRepository: criarPlataformaRepository(db),
    jogoRepository: criarJogoRepository(db),
    reviewRepository: criarReviewRepository(db),
  };
}
