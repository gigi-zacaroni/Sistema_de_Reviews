import nodemailer from "nodemailer";
import { config } from "../config.js";

const transporte = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure, // true só para a porta 465
  auth: config.smtp.usuario
    ? { user: config.smtp.usuario, pass: config.smtp.senha }
    : undefined,
  // Não deixa a API esperando para sempre se o servidor de e-mail não responder
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

// O nome vem do cadastro do usuário, então é escapado antes de ir para o HTML
function escaparHtml(texto) {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Única funcionalidade de envio de e-mail da aplicação: recuperação de senha
export async function enviarEmailRecuperacao({ para, nome, link, validadeMinutos }) {
  const texto = [
    `Olá, ${nome}!`,
    "",
    "Recebemos um pedido para redefinir a senha da sua conta no Sistema de Reviews.",
    `Para criar uma nova senha, acesse o link abaixo (válido por ${validadeMinutos} minutos):`,
    "",
    link,
    "",
    "Se você não fez esse pedido, ignore este e-mail: sua senha continua a mesma.",
  ].join("\n");

  const html = `
    <p>Olá, ${escaparHtml(nome)}!</p>
    <p>Recebemos um pedido para redefinir a senha da sua conta no <strong>Sistema de Reviews</strong>.</p>
    <p><a href="${link}">Clique aqui para criar uma nova senha</a> (o link vale por ${validadeMinutos} minutos).</p>
    <p>Se o botão não funcionar, copie este endereço no navegador:<br>${link}</p>
    <p>Se você não fez esse pedido, ignore este e-mail: sua senha continua a mesma.</p>`;

  await transporte.sendMail({
    from: config.smtp.remetente,
    to: para,
    subject: "Recuperação de senha - Sistema de Reviews",
    text: texto,
    html,
  });
}
