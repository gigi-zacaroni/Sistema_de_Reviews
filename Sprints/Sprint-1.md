# Sistema de Reviews de Jogos

## Descrição do modelo

O Sistema de Reviews de Jogos gerencia avaliações de jogos feitas por usuários autenticados. Usuários cadastrados publicam reviews sobre jogos, que são organizados por gênero e plataforma.

A autenticação será feita por e-mail e senha, com emissão de token JWT. As senhas são armazenadas apenas como hash, e o controle de acesso é aplicado por perfil (Usuário Comum e Administrador) e por propriedade do recurso: somente o autor pode editar ou excluir a própria review. O banco garante e-mail único, nota entre 0,0 e 10,0, gênero obrigatório em todo jogo e uma única review por par usuário-jogo.

O modelo possui quatro entidades de negócio e quatro tabelas de apoio:

- **Usuario:** pessoa cadastrada na plataforma (nome, e-mail, senha em hash, perfil).
- **Genero:** categoria dos jogos (nome, descrição).
- **Jogo:** título avaliado (título, desenvolvedora, publicadora, descrição, data de lançamento, nota média, capa, id na RAWG).
- **Review:** avaliação de um usuário sobre um jogo (título, comentário, nota, datas de criação e atualização). Não é uma tabela de ligação: tem atributos e regras próprias.
- **Plataforma** e **jogo_plataforma:** plataformas em que o jogo está disponível (relação N:N), usadas nos filtros de busca.
- **review_curtida** e **review_denuncia:** interações com reviews (marcar como útil e denunciar), previstas no escopo.

### Relacionamentos

- Um usuário escreve várias reviews (1:N).
- Um jogo recebe várias reviews (1:N).
- Um gênero possui vários jogos (1:N).
- Um jogo está em várias plataformas e uma plataforma tem vários jogos (N:N, via `jogo_plataforma`).
- Um usuário pode curtir e denunciar várias reviews (N:N, via `review_curtida` e `review_denuncia`).

## Diagrama de classes

```mermaid
classDiagram
    class Usuario {
        -id: int
        -nome: String
        -email: String
        -senhaHash: String
        -perfil: COMUM | ADMIN
        -criadoEm: DateTime
        +cadastrar() void
        +autenticar() boolean
        +consultar() Usuario
        +editarPerfil() void
        +excluir() void
    }

    class Genero {
        -id: int
        -nome: String
        -descricao: String
        +cadastrar() void
        +listar() List
        +consultar() Genero
        +atualizar() void
        +excluir() void
        +listarJogos() List
    }

    class Jogo {
        -id: int
        -titulo: String
        -desenvolvedora: String
        -publicadora: String
        -descricao: String
        -dataLancamento: Date
        -notaMedia: double
        -capaUrl: String
        +cadastrar() void
        +listar() List
        +consultar() Jogo
        +atualizar() void
        +excluir() void
        +calcularMediaNotas() double
    }

    class Plataforma {
        -id: int
        -nome: String
    }

    class Review {
        -id: int
        -titulo: String
        -comentario: String
        -nota: double
        -criadoEm: DateTime
        -atualizadoEm: DateTime
        +publicar() void
        +listarPorJogo() List
        +listarPorUsuario() List
        +consultar() Review
        +editar() void
        +excluir() void
        +curtir() void
        +denunciar() void
    }

    Usuario "1" --> "0..*" Review : escreve
    Jogo "1" --> "0..*" Review : recebe
    Genero "1" --> "0..*" Jogo : possui
    Jogo "0..*" -- "0..*" Plataforma : disponível em
```

## Modelo do banco de dados

O script de criação está em [`Banco/schema.sql`](Banco/schema.sql). O banco é criado vazio: os jogos, gêneros e plataformas entram pela importação da RAWG

```mermaid
erDiagram
    USUARIO ||--o{ REVIEW : escreve
    JOGO ||--o{ REVIEW : recebe
    GENERO ||--o{ JOGO : possui
    JOGO ||--o{ JOGO_PLATAFORMA : tem
    PLATAFORMA ||--o{ JOGO_PLATAFORMA : agrupa
    REVIEW ||--o{ REVIEW_CURTIDA : recebe
    USUARIO ||--o{ REVIEW_CURTIDA : faz
    REVIEW ||--o{ REVIEW_DENUNCIA : recebe
    USUARIO ||--o{ REVIEW_DENUNCIA : faz

    USUARIO {
        int id_usuario PK
        varchar nome
        varchar email UK
        varchar senha_hash
        enum perfil
        datetime criado_em
    }
    GENERO {
        int id_genero PK
        varchar nome UK
        varchar descricao
    }
    PLATAFORMA {
        int id_plataforma PK
        varchar nome UK
    }
    JOGO {
        int id_jogo PK
        int id_genero FK
        varchar titulo
        varchar desenvolvedora
        varchar publicadora
        text descricao
        date data_lancamento
        decimal nota_media
        varchar capa_url
        int rawg_id UK
    }
    JOGO_PLATAFORMA {
        int id_jogo PK, FK
        int id_plataforma PK, FK
    }
    REVIEW {
        int id_review PK
        int id_usuario FK
        int id_jogo FK
        varchar titulo
        text comentario
        decimal nota
        datetime criado_em
        datetime atualizado_em
    }
    REVIEW_CURTIDA {
        int id_review PK, FK
        int id_usuario PK, FK
        datetime criado_em
    }
    REVIEW_DENUNCIA {
        int id_denuncia PK
        int id_review FK
        int id_usuario FK
        varchar motivo
        datetime criado_em
    }
```

## CRUD por entidade

Todas as operações de CRUD fazem sentido no domínio e estão previstas no modelo. Nenhuma foi omitida; algumas têm restrições, descritas nas regras de negócio.

| Entidade | Create | Read | Update | Delete |
|---|---|---|---|---|
| Usuario | `cadastrar` | `consultar`, `autenticar` | `editarPerfil` | `excluir` |
| Genero | `cadastrar` | `listar`, `consultar`, `listarJogos` | `atualizar` | `excluir` |
| Jogo | `cadastrar` | `listar`, `consultar` | `atualizar` | `excluir` |
| Review | `publicar` | `listarPorJogo`, `listarPorUsuario`, `consultar` | `editar` | `excluir` |

## Regras de negócio

| # | Regra | Onde é garantida |
|---|---|---|
| 1 | **E-mail único:** não podem existir dois usuários com o mesmo e-mail. | Banco (`UNIQUE` em `usuario.email`) |
| 2 | **Senha:** nunca é armazenada em texto puro, somente o hash (`senha_hash`). | Aplicação |
| 3 | **Autoria da review:** somente o autor pode editar ou excluir a própria review. Ao editar, `atualizado_em` é atualizado. | Aplicação (autoria) e banco (`ON UPDATE CURRENT_TIMESTAMP`) |
| 4 | **Uma review por usuário por jogo:** para mudar a opinião, o usuário edita a review existente. | Banco (`UNIQUE (id_usuario, id_jogo)`) |
| 5 | **Nota válida:** entre 0,0 e 10,0. | Banco (`CHECK`) e aplicação |
| 6 | **Nota média:** `nota_media` do jogo é recalculada sempre que uma review for publicada, editada ou excluída. | Aplicação |
| 7 | **Excluir Genero:** bloqueado se houver jogos associados. | Banco (`ON DELETE RESTRICT`) |
| 8 | **Excluir Jogo:** as reviews do jogo são excluídas em cascata. | Banco (`ON DELETE CASCADE`) |
| 9 | **Excluir Usuario:** as reviews do usuário são excluídas em cascata e a `nota_media` dos jogos afetados é recalculada. | Banco (cascata) e aplicação (recálculo) |
| 10 | **Gênero obrigatório:** todo jogo deve ter um gênero válido. | Banco (`id_genero NOT NULL` + FK) |
