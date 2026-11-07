import { useCases } from "../../container.js";

const { usuarios } = useCases;

// GET /usuarios: lista todos (somente Administrador)
export const listarUsuarios = async (req, res) => {
  res.json(await usuarios.listar());
};

// GET /usuarios/:id: a própria conta ou Administrador
export const obterUsuario = async (req, res) => {
  res.json(await usuarios.obter(req.idAlvo));
};

// PUT /usuarios/:id: edita nome e/ou e-mail (o perfil tem rota própria)
export const atualizarUsuario = async (req, res) => {
  res.json(await usuarios.atualizar(req.idAlvo, req.body ?? {}));
};

// PATCH /usuarios/:id/perfil: promove ou rebaixa (somente Administrador)
export const alterarPerfil = async (req, res) => {
  res.json(await usuarios.alterarPerfil(req.params.id, req.body ?? {}));
};

// DELETE /usuarios/:id: o próprio usuário ou um Administrador
export const excluirUsuario = async (req, res) => {
  await usuarios.excluir(req.idAlvo);
  res.status(204).end();
};
