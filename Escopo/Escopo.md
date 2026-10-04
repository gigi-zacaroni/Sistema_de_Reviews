# Sistema de Review de Jogos

## Tema

O projeto consiste no desenvolvimento de um sistema web de **avaliação e review de jogos eletrônicos**. A aplicação terá como objetivo permitir que jogadores consultem informações sobre jogos, publiquem avaliações e compartilhem suas opiniões com outros usuários.

O sistema também permitirá a atribuição de notas aos jogos, possibilitando o cálculo de uma média geral das avaliações realizadas pela comunidade.

---

# Escopo da Aplicação

## 1. Cadastro e Autenticação

- Cadastro de usuários;
- Login e logout;
- Alteração das informações do perfil;
- Gerenciamento básico da conta do usuário.

## 2. Gerenciamento de Jogos

- Cadastro de jogos;
- Registro das informações dos jogos, como:
  - Nome;
  - Gênero;
  - Plataforma;
  - Data de lançamento;
  - Desenvolvedora;
  - Publicadora;
  - Descrição;
- Edição de informações dos jogos;
- Exclusão de jogos por administradores.

## 3. Consulta de Jogos

- Listagem dos jogos cadastrados;
- Busca de jogos por nome;
- Filtros por gênero e plataforma;
- Visualização detalhada de cada jogo.

## 4. Sistema de Reviews

Usuários cadastrados poderão publicar reviews sobre os jogos.

Cada review poderá conter:

- Título;
- Texto da avaliação;
- Nota de 0 a 10;
- Data de publicação.

Além disso:

- O usuário poderá editar suas próprias reviews;
- O usuário poderá excluir suas próprias reviews;
- As reviews serão exibidas na página do respectivo jogo.

## 5. Avaliação dos Jogos

- Atribuição de notas aos jogos;
- Cálculo da média das avaliações;
- Exibição da média geral do jogo;
- Exibição da quantidade de avaliações recebidas.

## 6. Interação com Reviews

- Visualização das reviews publicadas por outros usuários;
- Possibilidade de marcar uma review como útil ou curtir;
- Possibilidade de denunciar reviews inadequadas.

---

## Tecnologias 

| Categoria | Tecnologia | Finalidade no projeto |
|---|---|---|
| Linguagem | Node.js + JavaScript | Base obrigatória da API |
| Banco de dados | MySQL | Persistência relacional de usuários, jogos, gêneros e reviews |
| Autenticação | JWT (jsonwebtoken) | Login por e-mail e senha, com perfis Usuário Comum e Administrador |
| API externa | RAWG API | Busca de dados e capas de jogos para facilitar o cadastro de jogos |
| Documentação da API | Swagger (swagger-ui-express) | Documentação interativa dos endpoints |
|Testes de API | Postman | Collection com todos os endpoints (autenticação, recuperação de senha, CRUDs e integração externa), usada para testar e avaliar a API |
|Conteinerização | Docker + Docker Compose | Subir API e banco com `docker-compose up` |

