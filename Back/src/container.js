// Raiz de composição: o ÚNICO lugar que conhece todas as camadas e liga uma à outra.
// Os casos de uso recebem repositórios e gateways por parâmetro (injeção de
// dependência), então nenhuma regra de negócio importa MySQL, bcrypt, JWT, SMTP ou fetch.
import { config } from "./Configs/config.js";
import { pool, comTraducaoDeErros } from "./Database/db.js";
import { criarUnitOfWork } from "./Database/unitOfWork.js";
import { criarRepositorios } from "./Database/repositories/index.js";
import { criarSenhaGateway } from "./Apps/gateways/senhaGateway.js";
import { criarTokenGateway } from "./Apps/gateways/tokenGateway.js";
import { criarEmailGateway } from "./Apps/gateways/emailGateway.js";
import { criarRawgGateway } from "./Apps/gateways/rawgGateway.js";
import { criarAuthUseCases } from "./Apps/useCases/authUseCases.js";
import { criarUsuariosUseCases } from "./Apps/useCases/usuariosUseCases.js";
import { criarGenerosUseCases } from "./Apps/useCases/generosUseCases.js";
import { criarPlataformasUseCases } from "./Apps/useCases/plataformasUseCases.js";
import { criarJogosUseCases } from "./Apps/useCases/jogosUseCases.js";
import { criarReviewsUseCases } from "./Apps/useCases/reviewsUseCases.js";
import { criarRawgUseCases } from "./Apps/useCases/rawgUseCases.js";

// Persistência
const repositorios = criarRepositorios(comTraducaoDeErros(pool));
const unitOfWork = criarUnitOfWork(pool);

// Integrações externas
const senhaGateway = criarSenhaGateway();
const tokenGateway = criarTokenGateway(config);
const emailGateway = criarEmailGateway(config);
const rawgGateway = criarRawgGateway(config.rawg);

const base = { ...repositorios, unitOfWork };

// Casos de uso (regras de negócio)
export const useCases = {
  auth: criarAuthUseCases({ ...base, senhaGateway, tokenGateway, emailGateway, config }),
  usuarios: criarUsuariosUseCases(base),
  generos: criarGenerosUseCases(base),
  plataformas: criarPlataformasUseCases(base),
  jogos: criarJogosUseCases({ ...base, rawgGateway }),
  reviews: criarReviewsUseCases(base),
  rawg: criarRawgUseCases({ ...base, rawgGateway }),
};
