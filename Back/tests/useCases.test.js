// Testes das regras de negócio SEM banco, SEM Express e SEM internet:
// os casos de uso recebem repositórios e gateways falsos (injeção de dependência).
import test from "node:test";
import assert from "node:assert/strict";
import { criarReviewsUseCases } from "../Src/Apps/useCases/reviewsUseCases.js";
import { criarUsuariosUseCases } from "../Src/Apps/useCases/usuariosUseCases.js";
import { criarAuthUseCases } from "../Src/Apps/useCases/authUseCases.js";
import { criarJogosUseCases } from "../Src/Apps/useCases/jogosUseCases.js";
import { criarPlataformasUseCases } from "../Src/Apps/useCases/plataformasUseCases.js";

// "Transação" falsa: só repassa os mesmos repositórios falsos
const comUnitOfWork = (repos) => ({ executar: (fn) => fn(repos) });

const falha = (status) => (erro) => erro.status === status;

test("criar review: jogo inexistente devolve 404 e nada é gravado", async () => {
  const gravou = [];
  const repos = {
    reviewRepository: { criar: async () => gravou.push("review") },
    jogoRepository: { existe: async () => false, recalcularNotaMedia: async () => {} },
  };
  const uc = criarReviewsUseCases({ ...repos, unitOfWork: comUnitOfWork(repos) });

  await assert.rejects(
    uc.criar({ id_usuario: 1 }, { id_jogo: 99, titulo: "Ótimo", nota: 9 }),
    falha(404)
  );
  assert.deepEqual(gravou, []);
});

test("criar review: grava e recalcula a nota média do jogo (regra 6)", async () => {
  const chamadas = [];
  const repos = {
    reviewRepository: {
      criar: async (d) => (chamadas.push(["criar", d.idJogo, d.nota]), 7),
      buscarPorId: async (id) => ({ id_review: id }),
    },
    jogoRepository: {
      existe: async () => true,
      recalcularNotaMedia: async (id) => chamadas.push(["recalcular", id]),
    },
  };
  const uc = criarReviewsUseCases({ ...repos, unitOfWork: comUnitOfWork(repos) });

  const review = await uc.criar({ id_usuario: 1 }, { id_jogo: 5, titulo: "Bom", nota: "8.04" });
  assert.equal(review.id_review, 7);
  assert.deepEqual(chamadas, [["criar", 5, 8], ["recalcular", 5]]);
});

test("criar review: nota fora de 0 a 10 devolve 400", async () => {
  const uc = criarReviewsUseCases({ reviewRepository: {}, jogoRepository: {}, unitOfWork: {} });
  await assert.rejects(uc.criar({}, { id_jogo: 1, titulo: "x", nota: 11 }), falha(400));
});

test("editar review: só o autor (Administrador não edita texto alheio)", async () => {
  const reviewRepository = { buscarPorId: async () => ({ id_review: 1, id_usuario: 2, id_jogo: 3 }) };
  const uc = criarReviewsUseCases({ reviewRepository, jogoRepository: {}, unitOfWork: {} });
  await assert.rejects(
    uc.atualizar({ id_usuario: 9, perfil: "ADMIN" }, "1", { titulo: "novo" }),
    falha(403)
  );
});

test("excluir review: autor ou Administrador podem; outro comum não (regra 3)", async () => {
  const excluidas = [];
  const repos = {
    reviewRepository: {
      buscarPorId: async () => ({ id_review: 1, id_usuario: 2, id_jogo: 3 }),
      excluir: async (id) => excluidas.push(id),
    },
    jogoRepository: { recalcularNotaMedia: async () => {} },
  };
  const uc = criarReviewsUseCases({ ...repos, unitOfWork: comUnitOfWork(repos) });

  await assert.rejects(uc.excluir({ id_usuario: 7, perfil: "COMUM" }, "1"), falha(403));
  await uc.excluir({ id_usuario: 2, perfil: "COMUM" }, "1");
  await uc.excluir({ id_usuario: 7, perfil: "ADMIN" }, "1");
  assert.deepEqual(excluidas, [1, 1]);
});

test("curtir review duas vezes devolve 409", async () => {
  const reviewRepository = {
    buscarPorId: async () => ({ id_review: 1, qtd_curtidas: 1 }),
    curtir: async () => false,
  };
  const uc = criarReviewsUseCases({ reviewRepository, jogoRepository: {}, unitOfWork: {} });
  await assert.rejects(uc.curtir({ id_usuario: 1 }, "1"), falha(409));
});

test("excluir usuário recalcula a nota dos jogos que ele avaliou (regra 9)", async () => {
  const chamadas = [];
  const repos = {
    usuarioRepository: {
      buscarPorId: async () => ({ id_usuario: 4, perfil: "COMUM" }),
      excluir: async (id) => chamadas.push(["excluir", id]),
    },
    reviewRepository: { listarIdsJogosDoUsuario: async () => [10, 11] },
    jogoRepository: { recalcularNotaMedia: async (id) => chamadas.push(["recalcular", id]) },
  };
  const uc = criarUsuariosUseCases({ ...repos, unitOfWork: comUnitOfWork(repos) });

  await uc.excluir(4);
  assert.deepEqual(chamadas, [["excluir", 4], ["recalcular", 10], ["recalcular", 11]]);
});

test("não é possível excluir nem rebaixar o único administrador", async () => {
  const usuarioRepository = {
    buscarPorId: async () => ({ id_usuario: 1, perfil: "ADMIN" }),
    contarAdmins: async () => 1,
  };
  const uc = criarUsuariosUseCases({ usuarioRepository, unitOfWork: {} });
  await assert.rejects(uc.excluir(1), falha(409));
  await assert.rejects(uc.alterarPerfil("1", { perfil: "COMUM" }), falha(409));
});

test("login: e-mail inexistente e senha errada dão a mesma resposta 401", async () => {
  const senhaGateway = { comparar: async (senha, hash) => hash === "hash-ok" && senha === "certa" };
  const usuarioRepository = {
    buscarPorEmail: async (email) =>
      email === "a@a.com" ? { id_usuario: 1, senha_hash: "hash-ok", perfil: "COMUM" } : null,
  };
  const uc = criarAuthUseCases({ usuarioRepository, senhaGateway, tokenGateway: {}, config: {} });

  const erroInexistente = await uc.login({ email: "x@x.com", senha: "qualquer" }).catch((e) => e);
  const erroSenha = await uc.login({ email: "a@a.com", senha: "errada" }).catch((e) => e);
  assert.equal(erroInexistente.status, 401);
  assert.equal(erroSenha.status, 401);
  assert.equal(erroInexistente.message, erroSenha.message);
});

test("login correto devolve token e dados sem senha_hash", async () => {
  const uc = criarAuthUseCases({
    usuarioRepository: {
      buscarPorEmail: async () => ({ id_usuario: 1, nome: "Ana", email: "a@a.com", senha_hash: "h", perfil: "ADMIN" }),
    },
    senhaGateway: { comparar: async () => true },
    tokenGateway: { gerarAcesso: ({ idUsuario, perfil }) => `jwt-${idUsuario}-${perfil}`, expiraEm: "2h" },
    config: {},
  });
  const resposta = await uc.login({ email: " A@A.com ", senha: "12345678" });
  assert.equal(resposta.token, "jwt-1-ADMIN");
  assert.equal(resposta.usuario.senha_hash, undefined);
});

test("recuperação: pedido para e-mail inexistente não gera token nem e-mail", async () => {
  let enviou = false;
  const uc = criarAuthUseCases({
    usuarioRepository: { buscarPorEmail: async () => null },
    emailGateway: { enviarRecuperacaoSenha: async () => (enviou = true) },
    config: { recuperacaoSenha: { validadeMinutos: 30 }, appUrl: "http://x" },
  });
  await uc.solicitarRecuperacaoSenha("ninguem@x.com");
  assert.equal(enviou, false);
});

test("recuperação: o e-mail leva o token puro e o banco recebe só o hash", async () => {
  const gravado = [];
  let email;
  const repos = {
    recuperacaoSenhaRepository: {
      removerExpirados: async () => {},
      removerDoUsuario: async () => {},
      criar: async (d) => gravado.push(d),
    },
  };
  const uc = criarAuthUseCases({
    usuarioRepository: { buscarPorEmail: async () => ({ id_usuario: 1, nome: "Ana", email: "a@a.com" }) },
    unitOfWork: comUnitOfWork(repos),
    tokenGateway: { gerarTokenRecuperacao: () => ({ token: "TOKEN", hash: "HASH" }) },
    emailGateway: { enviarRecuperacaoSenha: async (d) => (email = d) },
    config: { recuperacaoSenha: { validadeMinutos: 30 }, appUrl: "http://api" },
  });
  await uc.solicitarRecuperacaoSenha("a@a.com");
  assert.equal(gravado[0].tokenHash, "HASH");
  assert.equal(email.link, "http://api/auth/redefinir-senha?token=TOKEN");
});

test("redefinir senha: token inválido ou expirado devolve 400 e não altera a senha", async () => {
  let alterou = false;
  const repos = {
    recuperacaoSenhaRepository: { buscarValidoComTravamento: async () => null },
    usuarioRepository: { atualizarSenha: async () => (alterou = true) },
  };
  const uc = criarAuthUseCases({
    unitOfWork: comUnitOfWork(repos),
    tokenGateway: { hashDoToken: (t) => t },
    senhaGateway: { hash: async (s) => s },
  });
  await assert.rejects(uc.redefinirSenha({ token: "velho", nova_senha: "12345678" }), falha(400));
  assert.equal(alterou, false);
});

test("redefinir senha: troca a senha e descarta os tokens do usuário", async () => {
  const chamadas = [];
  const repos = {
    recuperacaoSenhaRepository: {
      buscarValidoComTravamento: async () => 3,
      removerDoUsuario: async (id) => chamadas.push(["removerTokens", id]),
    },
    usuarioRepository: { atualizarSenha: async (id, h) => chamadas.push(["senha", id, h]) },
  };
  const uc = criarAuthUseCases({
    unitOfWork: comUnitOfWork(repos),
    tokenGateway: { hashDoToken: (t) => t },
    senhaGateway: { hash: async (s) => `hash(${s})` },
  });
  await uc.redefinirSenha({ token: "ok", nova_senha: "12345678" });
  assert.deepEqual(chamadas, [["senha", 3, "hash(12345678)"], ["removerTokens", 3]]);
});

test("importar da RAWG: jogo já importado devolve 409 sem chamar a RAWG", async () => {
  let chamouRawg = false;
  const uc = criarJogosUseCases({
    jogoRepository: { buscarIdPorRawgId: async () => 42 },
    rawgGateway: { buscarDetalhe: async () => (chamouRawg = true) },
    unitOfWork: {},
  });
  await assert.rejects(uc.importarDaRawg({ rawg_id: 3498 }), falha(409));
  assert.equal(chamouRawg, false);
});

test("importar da RAWG: grava gênero, jogo e plataformas na mesma transação", async () => {
  const chamadas = [];
  const repos = {
    generoRepository: { salvarPorNome: async (n) => (chamadas.push(["genero", n]), 1) },
    plataformaRepository: { salvarPorNome: async (n) => (chamadas.push(["plataforma", n]), n === "PC" ? 10 : 11) },
    jogoRepository: {
      salvarDaRawg: async (d) => (chamadas.push(["jogo", d.titulo, d.idGenero]), 5),
      vincularPlataforma: async (j, p) => chamadas.push(["vinculo", j, p]),
      buscarIdPorRawgId: async () => null,
      buscarPorId: async (id) => ({ id_jogo: id }),
    },
  };
  const uc = criarJogosUseCases({
    ...repos,
    unitOfWork: comUnitOfWork(repos),
    rawgGateway: {
      buscarDetalhe: async () => ({ rawgId: 1, titulo: "Zelda", genero: "Action", plataformas: ["PC", "Switch"] }),
    },
  });
  const jogo = await uc.importarDaRawg({ rawg_id: 1 });
  assert.equal(jogo.id_jogo, 5);
  assert.deepEqual(chamadas, [
    ["genero", "Action"], ["jogo", "Zelda", 1],
    ["plataforma", "PC"], ["vinculo", 5, 10],
    ["plataforma", "Switch"], ["vinculo", 5, 11],
  ]);
});

test("criar jogo: plataforma inexistente devolve 400", async () => {
  const repos = {
    jogoRepository: { criar: async () => 1 },
    plataformaRepository: { contarExistentes: async () => 1 },
  };
  const uc = criarJogosUseCases({ ...repos, unitOfWork: comUnitOfWork(repos), rawgGateway: {} });
  await assert.rejects(uc.criar({ id_genero: 1, titulo: "X", plataformas: [1, 2] }), falha(400));
});

test("excluir plataforma com jogos ligados devolve 409 (regra 11)", async () => {
  const plataformaRepository = {
    buscarPorId: async () => ({ id_plataforma: 1 }),
    excluirSeSemJogos: async () => false,
  };
  const uc = criarPlataformasUseCases({ plataformaRepository });
  await assert.rejects(uc.excluir("1"), falha(409));
});
