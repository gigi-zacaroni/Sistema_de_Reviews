import { ErroHttp, exigirTexto, validarEmail, validarSenha } from "../../Utils/validacao.js";

export function criarAuthUseCases({
  usuarioRepository,
  recuperacaoSenhaRepository,
  unitOfWork,
  senhaGateway,
  tokenGateway,
  emailGateway,
  config,
}) {
  return {
    // O perfil é sempre COMUM, mesmo que o corpo da requisição tente enviar outro valor.
    async cadastrar(corpo) {
      const nome = exigirTexto(corpo.nome, "nome", 100);
      const email = validarEmail(corpo.email);
      const senha = validarSenha(corpo.senha);

      // Regra 2: só o hash da senha vai para o banco
      const senhaHash = await senhaGateway.hash(senha);
      const idUsuario = await usuarioRepository.criar({ nome, email, senhaHash });

      return { id_usuario: idUsuario, nome, email, perfil: "COMUM" };
    },

    // Confere e-mail e senha e devolve o token JWT
    async login({ email, senha }) {
      if (typeof email !== "string" || typeof senha !== "string") {
        throw new ErroHttp(400, "Informe email e senha");
      }

      const usuario = await usuarioRepository.buscarPorEmail(email.trim().toLowerCase());
      const senhaConfere = await senhaGateway.comparar(senha, usuario?.senha_hash);
      if (!usuario || !senhaConfere) {
        throw new ErroHttp(401, "E-mail ou senha inválidos");
      }

      const token = tokenGateway.gerarAcesso({
        idUsuario: usuario.id_usuario,
        perfil: usuario.perfil,
      });

      return {
        token,
        tipo: "Bearer",
        expira_em: tokenGateway.expiraEm,
        usuario: {
          id_usuario: usuario.id_usuario,
          nome: usuario.nome,
          email: usuario.email,
          perfil: usuario.perfil,
        },
      };
    },

    // Devolve o usuário dono do token. Buscar no banco garante que um usuário
    // excluído, ou que mudou de perfil, não continue usando um token antigo.
    async autenticarPorToken(token) {
      const idUsuario = tokenGateway.verificarAcesso(token);
      if (idUsuario === null) {
        throw new ErroHttp(401, "Token inválido ou expirado");
      }

      const usuario = await usuarioRepository.buscarParaAutenticacao(idUsuario);
      if (!usuario) {
        throw new ErroHttp(401, "Usuário do token não existe mais");
      }
      return usuario;
    },

    // Gera um token de uso único e envia o link por e-mail. Quem chama responde
    // sempre a mesma coisa, exista o e-mail ou não, para ninguém descobrir
    // quais e-mails estão cadastrados.
    async solicitarRecuperacaoSenha(emailInformado) {
      const email = validarEmail(emailInformado);
      const usuario = await usuarioRepository.buscarPorEmail(email);
      if (!usuario) return;

      const { token, hash } = tokenGateway.gerarTokenRecuperacao();
      const { validadeMinutos } = config.recuperacaoSenha;

      await unitOfWork.executar(async (repos) => {
        await repos.recuperacaoSenhaRepository.removerExpirados();
        // Um pedido novo invalida o anterior
        await repos.recuperacaoSenhaRepository.removerDoUsuario(usuario.id_usuario);
        await repos.recuperacaoSenhaRepository.criar({
          idUsuario: usuario.id_usuario,
          tokenHash: hash,
          validadeMinutos,
        });
      });

      const link = `${config.appUrl}/auth/redefinir-senha?token=${token}`;

      // Sem await de propósito: o tempo de resposta não deve mudar se o e-mail existe.
      // Se o envio falhar, o erro aparece no log da API.
      emailGateway
        .enviarRecuperacaoSenha({
          para: usuario.email,
          nome: usuario.nome,
          link,
          validadeMinutos,
        })
        .catch((erro) => console.error("Falha ao enviar e-mail de recuperação:", erro.message));
    },

    // Troca a senha usando o token recebido por e-mail
    async redefinirSenha({ token, nova_senha }) {
      if (typeof token !== "string" || token === "") {
        throw new ErroHttp(400, "token é obrigatório");
      }
      validarSenha(nova_senha, "nova_senha");

      await unitOfWork.executar(async (repos) => {
        const idUsuario = await repos.recuperacaoSenhaRepository.buscarValidoComTravamento(
          tokenGateway.hashDoToken(token)
        );
        if (idUsuario === null) {
          throw new ErroHttp(
            400,
            "Link inválido ou expirado. Peça a recuperação de senha novamente."
          );
        }

        const novoHash = await senhaGateway.hash(nova_senha);
        await repos.usuarioRepository.atualizarSenha(idUsuario, novoHash);
        // Token usado (e quaisquer outros do mesmo usuário) é descartado
        await repos.recuperacaoSenhaRepository.removerDoUsuario(idUsuario);
      });
    },

    // Ninguém consegue se cadastrar como Administrador pela API (o cadastro público
    // sempre cria perfil COMUM). Por isso o primeiro administrador nasce aqui, a
    // partir de ADMIN_EMAIL e ADMIN_SENHA. Se o e-mail já existe, nada muda.
    // Devolve o e-mail criado, ou null se nada foi criado.
    async garantirAdminInicial() {
      const { nome, email, senha } = config.admin;
      if (!email || !senha) {
        console.warn("ADMIN_EMAIL/ADMIN_SENHA não definidos: nenhum administrador inicial criado.");
        return null;
      }

      const existente = await usuarioRepository.buscarPorEmail(email.toLowerCase());
      if (existente) return null;

      const senhaHash = await senhaGateway.hash(senha);
      await usuarioRepository.criar({
        nome,
        email: email.toLowerCase(),
        senhaHash,
        perfil: "ADMIN",
      });
      return email;
    },
  };
}
