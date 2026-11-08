import test from "node:test";
import assert from "node:assert/strict";
import { criarRawgGatewayFake } from "../Src/Apps/gateways/rawgGatewayFake.js";
import { criarRawgUseCases } from "../Src/Apps/useCases/rawgUseCases.js";

const falha = (status) => (e) => e.status === status;

test("RAWG falsa: busca ignora acento e maiúsculas e devolve o formato do gateway real", async () => {
  const gw = criarRawgGatewayFake();
  const r = await gw.buscarPorNome("PORTAL");
  assert.equal(r.length, 2);
  assert.deepEqual(Object.keys(r[0]).sort(), ["capa_url", "data_lancamento", "rawg_id", "titulo"]);
});

test("RAWG falsa: detalhe existente e inexistente (404)", async () => {
  const gw = criarRawgGatewayFake();
  assert.equal((await gw.buscarDetalhe(3498)).titulo, "Grand Theft Auto V");
  await assert.rejects(gw.buscarDetalhe(999999), falha(404));
});

test("RAWG falsa: simula 502 e 503 pela busca", async () => {
  const gw = criarRawgGatewayFake();
  await assert.rejects(gw.buscarPorNome("erro502"), falha(502));
  await assert.rejects(gw.buscarPorNome("erro503"), falha(503));
});

test("RAWG falsa: lista ids por gênero respeitando a quantidade", async () => {
  const gw = criarRawgGatewayFake();
  assert.deepEqual(await gw.listarIdsPorGenero("action", 1), [3498]);
  assert.equal((await gw.listarIdsPorGenero("Action", 10)).length, 2);
});

test("RAWG falsa funciona com o caso de uso de busca (marca já importados)", async () => {
  const uc = criarRawgUseCases({
    rawgGateway: criarRawgGatewayFake(),
    jogoRepository: { buscarRawgIdsExistentes: async () => new Set([3328]) },
  });
  const r = await uc.buscarJogos("witcher");
  assert.equal(r[0].ja_importado, true);
});
