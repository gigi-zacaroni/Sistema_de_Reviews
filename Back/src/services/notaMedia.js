// Regra de negócio 6: a nota_media do jogo é recalculada sempre que uma review
// for publicada, editada ou excluída (e quando um usuário é excluído, regra 9).
// Recebe a conexão da transação para que tudo seja gravado junto.
export async function recalcularNotaMedia(conexao, idJogo) {
  await conexao.query(
    `UPDATE jogo
        SET nota_media = COALESCE(
              (SELECT ROUND(AVG(nota), 1) FROM review WHERE id_jogo = ?), 0)
      WHERE id_jogo = ?`,
    [idJogo, idJogo]
  );
}
