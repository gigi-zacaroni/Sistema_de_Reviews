# Semana 5

Conclusão das operações de CRUD aplicáveis ao escopo e integração funcional com a API externa (RAWG).

## O que foi desenvolvido

### Integração com a RAWG

A RAWG alimenta o **cadastro de jogos**: em vez de digitar título, capa, desenvolvedora e plataformas, o administrador busca o jogo na RAWG e importa.

1. `GET /rawg/jogos?busca=zelda` (Admin) lista até 10 jogos da RAWG. Cada item traz `ja_importado`, para saber se já está no banco.
2. `POST /jogos/importar` (Admin) com `{"rawg_id": 123}` busca o detalhe do jogo na RAWG e grava **jogo, gênero e plataformas** de uma vez (transação: ou grava tudo, ou nada).

Tratamento de erros: `409` se o jogo já foi importado, `404` se o `rawg_id` não existe na RAWG, `502` se a RAWG falhar ou demorar mais de 8 s, `503` se `RAWG_API_KEY` não estiver configurada. A chave nunca aparece nas respostas nem nos logs.

O script `src/importar_rawg.js` (carga em lote pela linha de comando) continua funcionando e usa o mesmo código da importação pela API.

### CRUD completo

- **Plataforma:** `GET/POST/PUT/DELETE /plataformas` (leitura pública, escrita só do Administrador). Regra 11: plataforma com jogos ligados não é excluída (`409`).
- **Plataformas de um jogo:** `POST /jogos` e `PUT /jogos/:id` aceitam `plataformas` (lista de `id_plataforma`). No `PUT`, a lista substitui as plataformas atuais; lista vazia remove todas.
- **Denúncias:** o Administrador descarta uma denúncia analisada com `DELETE /reviews/denuncias/:id`. Para remover a review denunciada, continua valendo `DELETE /reviews/:id` (apaga também as denúncias dela).

Não houve mudança no banco: o `schema.sql` e o DER continuam os mesmos.

### Mudança de permissão

`GET /rawg/jogos` deixou de ser pública: cada busca gasta a cota da chave da RAWG, e a busca só serve para o administrador escolher o que importar.

## Como testar

Suba o projeto como na [Sprint-3](Sprint-3.md) (`docker compose up --build`), com `RAWG_API_KEY` preenchida em `Back/.env`. Use o **token do administrador** (login em `POST /auth/login`) e, onde indicado, o token de um usuário comum.

#### 1. Buscar e importar um jogo

| # | Requisição | Authorization | Body | Esperado |
|---|---|---|---|---|
| 1a | `GET /rawg/jogos?busca=zelda` | nenhuma | — | **401** |
| 1b | `GET /rawg/jogos?busca=zelda` | token da **Ana** (comum) | — | **403** |
| 1c | `GET /rawg/jogos?busca=zelda` | token do **administrador** | — | **200**, lista com `rawg_id` e `ja_importado: false` |
| 1d | `GET /rawg/jogos` (sem `busca`) | token do **administrador** | — | **400** |
| 1e | `POST /jogos/importar` | token do **administrador** | `{"rawg_id": <um rawg_id da 1c>}` | **201**, jogo com gênero e plataformas (anote o `id_jogo`) |
| 1f | `POST /jogos/importar` (o mesmo corpo) | token do **administrador** | igual ao 1e | **409** |
| 1g | `POST /jogos/importar` | token da **Ana** | igual ao 1e | **403** |
| 1h | `POST /jogos/importar` | token do **administrador** | `{"rawg_id": 999999999}` | **404** (não existe na RAWG) |
| 1i | `GET /rawg/jogos?busca=` repetindo a 1c | token do **administrador** | — | **200**, o jogo importado aparece com `ja_importado: true` |

#### 2. Plataformas

| # | Requisição | Authorization | Body | Esperado |
|---|---|---|---|---|
| 2a | `GET /plataformas` | nenhuma | — | **200**, com `qtd_jogos` |
| 2b | `POST /plataformas` | token da **Ana** | `{"nome":"Switch 2"}` | **403** |
| 2c | `POST /plataformas` | token do **administrador** | `{"nome":"Switch 2"}` | **201** (anote o `id_plataforma`) |
| 2d | `POST /plataformas` (o mesmo corpo) | token do **administrador** | igual ao 2c | **409** |
| 2e | `PUT /plataformas/<id>` | token do **administrador** | `{"nome":"Nintendo Switch 2"}` | **200** |
| 2f | `DELETE /plataformas/<id de uma plataforma com jogos>` | token do **administrador** | — | **409** (regra 11) |
| 2g | `DELETE /plataformas/<id da 2c>` | token do **administrador** | — | **204** |

#### 3. Plataformas de um jogo

| # | Requisição | Authorization | Body | Esperado |
|---|---|---|---|---|
| 3a | `PUT /jogos/<id_jogo>` | token do **administrador** | `{"plataformas":[1,2]}` | **200**, `plataformas` do jogo com os ids 1 e 2 |
| 3b | `PUT /jogos/<id_jogo>` | token do **administrador** | `{"plataformas":[999999]}` | **400** (plataforma inexistente; nada é alterado) |
| 3c | `PUT /jogos/<id_jogo>` | token do **administrador** | `{"plataformas":[]}` | **200**, jogo sem plataformas |

#### 4. Moderar denúncias

Precisa de uma review denunciada (veja o passo 5 da [Sprint-3](Sprint-3.md)). Considere `id_denuncia` 1.

| # | Requisição | Authorization | Esperado |
|---|---|---|---|
| 4a | `DELETE /reviews/denuncias/1` | token da **Bia** (comum) | **403** |
| 4b | `DELETE /reviews/denuncias/1` | token do **administrador** | **204** (a review continua no ar) |
| 4c | `GET /reviews/denuncias` | token do **administrador** | **200**, sem a denúncia descartada |
| 4d | `DELETE /reviews/denuncias/1` (de novo) | token do **administrador** | **404** |

### Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| **503** "Integração com a RAWG indisponível" | `RAWG_API_KEY` ausente ou com o valor de exemplo | Preencha a chave em `Back/.env` e rode `docker compose up --build` de novo |
| **502** "A RAWG recusou o acesso" | Chave inválida | Gere outra em https://rawg.io/apidocs |
