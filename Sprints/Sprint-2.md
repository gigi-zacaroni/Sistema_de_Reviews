# Semana 2: 

 Conclusão da modelagem , persitência e base da aplicação executável com docker

## O que foi desenvolvido :

 Conclusão do Diagrama EER,  criação do banco de dados em MySQL e integração da API

## Como executar com Docker

**Pré-requisito:** Docker Desktop instalado e aberto (o motor precisa estar com status "Engine running").

```bash

cd Sistema_de_Reviews

# necessário para a integração com a RAWG :
# crie o arquivo ".env" dentro da pasta "Back" e preencha RAWG_API_KEY="sua_chave"
# para gerar uma chave , acesse "https://rawg.io/apidocs" e faça login

docker compose up --build
```

O Compose sobe dois contêineres:

| Serviço | Descrição | Porta no computador |
|---|---|---|
| `db` | MySQL 8. Na primeira execução cria as tabelas a partir de `Banco/schema.sql`. Os dados ficam no volume `db_data`. | 3308 |
| `api` | API Node.js/Express. Só inicia depois que o banco estiver saudável. | 3000 |

A subida terminou quando o terminal mostrar `API rodando na porta 3000`.

## Como testar

### 1. Verificar se tudo está no ar

Abra no navegador `http://localhost:3000/health`. O resultado esperado é:

```json
{ "api": "ok", "banco": "ok" }
```

### 2. Popular o banco com jogos da RAWG

Para carregar dados, com os contêineres rodando, abra **outro terminal** na pasta do projeto e rode:

```bash
docker compose exec api node src/importar_rawg.js action 5
```

O comando importa 5 jogos do gênero `action`, com seus gêneros e plataformas. Os dois argumentos são opcionais: o primeiro é o gênero (padrão `action`) e o segundo é a quantidade (padrão `10`). Exige `RAWG_API_KEY` preenchida em `Back/.env`.

Depois da importação, abra `http://localhost:3000/generos` e os gêneros devem aparecer.

### 3. Testar a busca na RAWG

`http://localhost:3000/rawg/jogos?busca=zelda` devolve até 10 jogos encontrados.

### 4. Consultar o banco diretamente

```bash
docker compose exec db mysql -ureviews_user -previews_pass sistema_reviews -e "SHOW TABLES; SELECT titulo FROM jogo;"
```

Para usar o MySQL Workbench: host `127.0.0.1`, porta `3308`, usuário `reviews_user`, senha `reviews_pass`, schema `sistema_reviews`.

### Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `port is already allocated` | Outro programa usa a porta 3000 ou 3308 | Feche o programa ou troque a porta à esquerda dos `:` no `docker-compose.yml` |
| `/health` retorna `"banco": "indisponivel"` | O MySQL ainda está iniciando | Aguarde alguns segundos e atualize |
| Mudei o `schema.sql` e nada mudou | O volume antigo já existia | Rode `docker compose down -v` e suba de novo |
| Importação falha com "RAWG_API_KEY não foi carregada" | `Back/.env` ausente ou sem a chave | Crie o arquivo a partir de `.env.example` e preencha a chave |
