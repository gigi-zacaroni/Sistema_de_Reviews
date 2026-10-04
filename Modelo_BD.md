# Modelagem de Classes

O modelo representa um sistema de avaliações de jogos, onde usuários cadastrados publicam reviews sobre jogos organizados por gênero.

## Entidades

- **Usuario:** pessoa cadastrada na plataforma, com nome, e-mail e senha armazenada em formato hash. Pode se cadastrar, autenticar e editar o perfil.
- **Genero:** categoria de jogos (ação, RPG, etc.), com nome e descrição. Permite listar os jogos que pertencem a ela.
- **Jogo:** título avaliado na plataforma, com desenvolvedora, data de lançamento e nota média. Pode ser cadastrado, consultado e ter a média das notas calculada.
- **Review:** avaliação feita por um usuário sobre um jogo, com nota, comentário e datas de criação e atualização. Pode ser publicada, editada e excluída.

## Relacionamentos

- Um usuário escreve várias reviews (1:N), e cada review pertence a um único usuário.
- Um jogo recebe várias reviews (1:N), e cada review avalia um único jogo.
- Um gênero possui vários jogos (1:N), e cada jogo pertence a um único gênero.

## Modelo :


```mermaid
classDiagram
    class Usuario {
        -id: int
        -nome: String
        -email: String
        -senhaHash: String
        -criadoEm: DateTime
        +cadastrar() void
        +autenticar() boolean
        +editarPerfil() void
    }

    class Review {
        -id: int
        -nota: double
        -comentario: String
        -criadoEm: DateTime
        -atualizadoEm: DateTime
        +publicar() void
        +editar() void
        +excluir() void
    }

    class Jogo {
        -id: int
        -titulo: String
        -desenvolvedora: String
        -dataLancamento: Date
        -notaMedia: double
        +cadastrar() void
        +consultar() void
        +calcularMediaNotas() double
    }

    class Genero {
        -id: int
        -nome: String
        -descricao: String
        +cadastrar() void
        +listarJogos() List
    }

    Usuario "1" --> "0..*" Review : escreve
    Jogo "1" --> "0..*" Review : recebe
    Genero "1" --> "0..*" Jogo : possui
```
