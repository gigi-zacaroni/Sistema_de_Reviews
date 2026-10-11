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
| Autenticação (planejado) | JWT | Login por e-mail e senha, com perfis Comum e Administrador |
| Testes de API (planejado) | Postman | Coleção com todos os endpoints |

## Estado atual do projeto

| Item | Situação |
|---|---|
| Modelagem (diagramas de classes e ER) | Concluída |
| Banco de dados (`Banco/schema.sql`) | Concluído |
| Execução em Docker | Concluída |
| Integração com a RAWG (busca e importação) | Funcionando |
| CRUDs de usuário, gênero, jogo e review | Planejado |
| Autenticação com JWT e controle de acesso | Planejado |
| Coleção do Postman | Planejado |

## Diagrama EER 

### Imagem do diagrama :
[Diagrama_EER](Imagens/Diagrama_EER.png)

### Regras de negócio detalhadas:

[Regras_de_negócio](Sprints/Sprint-1.md)

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


## Entrega 1 

| Semana | requisitos | link | 
|---|---|---|
| Semana 1 | definição do tema e escopo , modelagem inicial e criação e envio do repositório |[Sprint-1](Sprints/Sprint-1.md) |

## Entrega 2

| Semana | requisitos | link | 
|---|---|---|
| Semana 2 | modelagem concluída , persistência e base da aplicação executável com Docker | como executar: [Sprint-2](Sprints/Sprint-2.md) |

### Endpoints


| Grupo | Método | Caminho | Descrição | Permissão | Requisição | Resposta |
|---|---|---|---|---|---|---|
| Sistema | GET | `/health` | Verifica se a API está no ar e se consegue consultar o banco | Pública | — | `200` `{"api":"ok","banco":"ok"}`; `503` se o banco estiver indisponível |
| Gêneros | GET | `/generos` | Lista os gêneros, em ordem alfabética | Pública | — | `200` lista com `id_genero`, `nome`, `descricao` |
| Usuários | GET | `/usuarios` | Lista os usuários (nunca devolve `senha_hash`) | Pública por enquanto; será restrita ao administrador | — | `200` lista com `id_usuario`, `nome`, `email`, `perfil`, `criado_em` |
| RAWG | GET | `/rawg/jogos` | Busca até 10 jogos na RAWG pelo nome | Pública | Query `busca` (obrigatória) | `200` lista com `rawg_id`, `titulo`, `data_lancamento`, `capa_url`; `400` sem `busca`; `502` se a RAWG falhar |


