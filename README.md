# Sistema de Reviews de Jogos

API em **Node.js (Express)** com banco **MySQL** para avaliação de jogos eletrônicos. Usuários cadastrados publicam reviews com nota de 0 a 10, e a aplicação calcula a nota média de cada jogo. Os dados dos jogos (título, capa, desenvolvedora etc.) podem ser importados da [RAWG API](https://rawg.io/apidocs).

O projeto roda inteiro em Docker: um comando sobe a API e o banco.

## Tecnologias

| Categoria | Tecnologia | Uso no projeto |
|---|---|---|
| Linguagem | Node.js + JavaScript | API |
| Framework | Express 5 | Rotas HTTP |
| Banco de dados | MySQL 8 (driver `mysql2`) | Persistência relacional |
| API externa | RAWG API | Busca e importação de jogos |
| Contêineres | Docker + Docker Compose | Subir API e banco juntos |
| Autenticação | JWT (`jsonwebtoken`) + `bcryptjs` | Login por e-mail e senha, com perfis Comum e Administrador |
| E-mail | Nodemailer + Mailpit (Docker) | Recuperação de senha por e-mail |
| Testes de API (planejado) | Postman | Coleção com todos os endpoints |

## Estado atual do projeto

| Item | Situação |
|---|---|
| Modelagem (diagramas de classes e ER) | Concluída |
| Banco de dados (`Banco/schema.sql`) | Concluído |
| Execução em Docker | Concluída |
| Integração com a RAWG (busca e importação) | Funcionando |
| CRUDs de usuário, gênero, jogo e review | Concluídos |
| Autenticação com JWT e controle de acesso por perfil | Concluída ([Sprint-3](Sprints/Sprint-3.md)) |
| Recuperação de senha por e-mail | Concluída ([Sprint-3](Sprints/Sprint-3.md)) |
| Coleção do Postman | Planejado |

## Diagrama EER 

### Imagem do diagrama :
[Diagrama_EER](Banco/Diagrama_EER.png)

### Regras de negócio detalhadas: [Regras_de_negócio](Sprints/Sprint-1.md)

### Resumo do schema.sql

| Tabela | Função | Principais restrições | Regras de negócio |
|---|---|---|---|
| `usuario` | Pessoas cadastradas (nome, e-mail, hash da senha, perfil) | `email` único; `perfil` é `COMUM` (padrão) ou `ADMIN` | 1 (e-mail único), 2 (senha só em hash), 9 (exclusão apaga as reviews do usuário) |
| `genero` | Categorias dos jogos | `nome` único | 7 (não pode ser excluído se tiver jogos) |
| `plataforma` | Plataformas em que os jogos existem | `nome` único | — |
| `jogo` | Jogos avaliados, com `nota_media` e `rawg_id` da RAWG | `id_genero` obrigatório; `rawg_id` único; `nota_media` entre 0,0 e 10,0 | 6 (nota média recalculada), 8 (exclusão apaga as reviews do jogo), 10 (gênero obrigatório) |
| `jogo_plataforma` | Liga jogos e plataformas (N:N) | Chave primária composta `(id_jogo, id_plataforma)` | — |
| `review` | Avaliação de um usuário sobre um jogo | Uma review por `(id_usuario, id_jogo)`; `nota` entre 0,0 e 10,0; `atualizado_em` muda sozinho ao editar | 3 (só o autor edita ou exclui), 4 (uma review por usuário por jogo), 5 (nota válida), 6 (recálculo da nota média) |
| `review_curtida` | Marcações de "útil" em reviews | Uma curtida por usuário em cada review | — (prevista no escopo) |
| `review_denuncia` | Denúncias de reviews, com motivo | Uma denúncia por usuário em cada review | — (prevista no escopo) |

**Regras de integridade nas exclusões** (ver regras de negócio 7, 8 e 9)

- Excluir um gênero que tem jogos é bloqueado (`RESTRICT`).
- Excluir um jogo ou um usuário apaga em cascata as reviews dele (`CASCADE`).
- Excluir uma review apaga suas curtidas e denúncias, e excluir um jogo apaga suas ligações com plataformas.


## Entregas

| Semana | requisitos | link | Commit |
|---|---|---|---|
| Semana 1 | definição do tema e escopo , modelagem inicial e criação e envio do repositório |[Sprint-1](Sprints/Sprint-1.md) | [Commit](https://github.com/gigi-zacaroni/Sistema_de_Reviews/commit/99be1da5d5089d59d23d84a82b5738c1c031b2ca) , [Commit](https://github.com/gigi-zacaroni/Sistema_de_Reviews/commit/061ff0e5484c526d6798ed0ed18c858e1eb08e30), [commit](https://github.com/gigi-zacaroni/Sistema_de_Reviews/commit/235fc16ebcb130cf730af1cba52efcd3c196c3f4)  |
| Semana 2 | modelagem concluída , persistência e base da aplicação executável com Docker | ***como executar e testar o código***: [Sprint-2](Sprints/Sprint-2.md) |[Commit](https://github.com/gigi-zacaroni/Sistema_de_Reviews/commit/1e045e90b33d43e380b3316c1bc1281aa368d53e)|
| Semana 3 | autenticação com JWT (Usuário Comum e Administrador), controle de acesso, CRUDs e recuperação de senha por e-mail | ***como executar e testar o código***: [Sprint-3](Sprints/Sprint-3.md) | [Commit](https://github.com/gigi-zacaroni/Sistema_de_Reviews/commit/a06948157ba0def69ca62da2857d413574da23ed) |

### Endpoints

Permissões: **Pública** (sem login), **Logado** (qualquer usuário autenticado), **Dono** (só o autor/dono do recurso), **Dono ou Admin** e **Admin**. Rotas protegidas exigem o cabeçalho `Authorization: Bearer <token>`. Erros comuns: `400` dados inválidos, `401` sem login/token inválido, `403` sem permissão, `404` não encontrado, `409` conflito (duplicado ou regra de negócio).

| Grupo | Método | Caminho | Descrição | Permissão | Requisição | Resposta |
|---|---|---|---|---|---|---|
| Sistema | GET | `/health` | Verifica se a API está no ar e se consegue consultar o banco | Pública | — | `200` `{"api":"ok","banco":"ok"}`; `503` se o banco estiver indisponível |
| Auth | POST | `/auth/cadastro` | Cria conta (perfil sempre `COMUM`) | Pública | `nome`, `email`, `senha` (mín. 8) | `201` usuário criado; `409` e-mail já cadastrado |
| Auth | POST | `/auth/login` | Faz login e devolve o token JWT | Pública | `email`, `senha` | `200` `token`, `tipo`, `expira_em`, `usuario`; `401` credenciais inválidas |
| Auth | GET | `/auth/eu` | Mostra o usuário dono do token | Logado | — | `200` usuário |
| Auth | POST | `/auth/esqueci-senha` | Envia por e-mail o link de recuperação (resposta igual exista o e-mail ou não) | Pública | `email` | `200` mensagem |
| Auth | GET | `/auth/redefinir-senha?token=` | Página (aberta pelo link do e-mail) para digitar a nova senha | Pública | Query `token` | `200` HTML |
| Auth | POST | `/auth/redefinir-senha` | Troca a senha com o token recebido por e-mail | Pública | `token`, `nova_senha` (mín. 8) | `200` mensagem; `400` token inválido ou expirado |
| Usuários | GET | `/usuarios` | Lista usuários (nunca devolve `senha_hash`) | Admin | — | `200` lista |
| Usuários | GET | `/usuarios/:id` | Consulta um usuário | Dono ou Admin | — | `200` usuário; `403`; `404` |
| Usuários | PUT | `/usuarios/:id` | Edita `nome` e/ou `email` | Dono ou Admin | `nome`, `email` | `200` usuário; `409` e-mail em uso |
| Usuários | PATCH | `/usuarios/:id/perfil` | Promove ou rebaixa | Admin | `perfil` (`COMUM`/`ADMIN`) | `200` usuário; `409` se for o único admin |
| Usuários | DELETE | `/usuarios/:id` | Exclui a conta e as reviews dela (regra 9) | Dono ou Admin | — | `204`; `409` se for o único admin |
| Gêneros | GET | `/generos`, `/generos/:id` | Lista / consulta gêneros | Pública | — | `200` |
| Gêneros | POST | `/generos` | Cadastra gênero | Admin | `nome`, `descricao` | `201`; `409` nome repetido |
| Gêneros | PUT | `/generos/:id` | Atualiza gênero | Admin | `nome`, `descricao` | `200` |
| Gêneros | DELETE | `/generos/:id` | Exclui gênero (regra 7) | Admin | — | `204`; `409` se houver jogos |
| Jogos | GET | `/jogos` | Lista jogos com filtros | Pública | Query `busca`, `id_genero`, `id_plataforma`, `limite`, `deslocamento` | `200` lista com `nota_media` e `qtd_reviews` |
| Jogos | GET | `/jogos/:id` | Detalha um jogo, com plataformas | Pública | — | `200`; `404` |
| Jogos | POST | `/jogos` | Cadastra jogo | Admin | `id_genero`, `titulo` + opcionais | `201`; `400` gênero inexistente |
| Jogos | PUT | `/jogos/:id` | Atualiza jogo | Admin | campos do jogo | `200` |
| Jogos | DELETE | `/jogos/:id` | Exclui jogo e suas reviews (regra 8) | Admin | — | `204` |
| Reviews | GET | `/reviews`, `/reviews/:id` | Lista (filtros `id_jogo`, `id_usuario`) / consulta reviews, com `qtd_curtidas` | Pública | — | `200` |
| Reviews | POST | `/reviews` | Publica review (autor = dono do token; regras 4, 5 e 6) | Logado | `id_jogo`, `titulo`, `comentario`, `nota` | `201`; `409` já avaliou o jogo |
| Reviews | PUT | `/reviews/:id` | Edita a própria review (regras 3, 5 e 6) | Dono | `titulo`, `comentario`, `nota` | `200`; `403` se não for o autor |
| Reviews | DELETE | `/reviews/:id` | Exclui uma review (regras 3 e 6) | Dono ou Admin | — | `204`; `403` se não for o autor nem administrador |
| Reviews | POST | `/reviews/:id/curtida` | Marca a review como útil | Logado | — | `201` com `qtd_curtidas`; `409` se já curtiu |
| Reviews | DELETE | `/reviews/:id/curtida` | Remove a própria curtida | Logado | — | `204`; `404` se não curtiu |
| Reviews | POST | `/reviews/:id/denuncia` | Denuncia uma review inadequada | Logado | `motivo` | `201`; `409` se já denunciou |
| Reviews | GET | `/reviews/denuncias` | Lista as denúncias, para moderação | Admin | Query `limite`, `deslocamento` | `200` lista com `motivo`, `denunciante`, `titulo_review` |
| RAWG | GET | `/rawg/jogos` | Busca até 10 jogos na RAWG pelo nome | Pública | Query `busca` (obrigatória) | `200` lista com `rawg_id`, `titulo`, `data_lancamento`, `capa_url`; `400` sem `busca`; `502` se a RAWG falhar |
