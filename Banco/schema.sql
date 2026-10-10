-- =====================================================================
-- Sistema de Reviews de Jogos - Script de criação do banco (MySQL 8)
-- Para gerar o diagrama no MySQL Workbench:
--   File > Import > Reverse Engineer MySQL Create Script...
--   (selecione este arquivo) > Execute > Next > Finish
-- =====================================================================

CREATE DATABASE IF NOT EXISTS sistema_reviews
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE sistema_reviews;

-- Ordem inversa de dependência, para o script poder ser rodado de novo
DROP TABLE IF EXISTS review_denuncia;
DROP TABLE IF EXISTS review_curtida;
DROP TABLE IF EXISTS review;
DROP TABLE IF EXISTS jogo_plataforma;
DROP TABLE IF EXISTS jogo;
DROP TABLE IF EXISTS plataforma;
DROP TABLE IF EXISTS genero;
DROP TABLE IF EXISTS usuario;

-- ---------------------------------------------------------------------
-- USUARIO
-- Regra 1: e-mail único | Regra 2: somente o hash da senha é armazenado
-- ---------------------------------------------------------------------
CREATE TABLE usuario (
  id_usuario  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nome        VARCHAR(100)  NOT NULL,
  email       VARCHAR(150)  NOT NULL,
  senha_hash  VARCHAR(255)  NOT NULL,
  perfil      ENUM('COMUM','ADMIN') NOT NULL DEFAULT 'COMUM',
  criado_em   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY uq_usuario_email (email)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- GENERO
-- ---------------------------------------------------------------------
CREATE TABLE genero (
  id_genero  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nome       VARCHAR(60)   NOT NULL,
  descricao  VARCHAR(255)  NULL,
  PRIMARY KEY (id_genero),
  UNIQUE KEY uq_genero_nome (nome)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- PLATAFORMA (usada nos filtros de busca do escopo)
-- ---------------------------------------------------------------------
CREATE TABLE plataforma (
  id_plataforma  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nome           VARCHAR(60)   NOT NULL,
  PRIMARY KEY (id_plataforma),
  UNIQUE KEY uq_plataforma_nome (nome)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- JOGO
-- Regra 10: id_genero obrigatório (NOT NULL)
-- Regra 7: não é possível excluir um gênero que tenha jogos (RESTRICT)
-- nota_media é recalculada pela aplicação (regra 6)
-- rawg_id e capa_url guardam os dados vindos da API RAWG
-- ---------------------------------------------------------------------
CREATE TABLE jogo (
  id_jogo          INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  id_genero        INT UNSIGNED   NOT NULL,
  titulo           VARCHAR(150)   NOT NULL,
  desenvolvedora   VARCHAR(100)   NULL,
  publicadora      VARCHAR(100)   NULL,
  descricao        TEXT           NULL,
  data_lancamento  DATE           NULL,
  nota_media       DECIMAL(3,1)   NOT NULL DEFAULT 0.0,
  capa_url         VARCHAR(500)   NULL,
  rawg_id          INT UNSIGNED   NULL,
  PRIMARY KEY (id_jogo),
  UNIQUE KEY uq_jogo_rawg (rawg_id),
  KEY idx_jogo_titulo (titulo),
  KEY idx_jogo_genero (id_genero),
  CONSTRAINT fk_jogo_genero
    FOREIGN KEY (id_genero) REFERENCES genero (id_genero)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ck_jogo_nota_media CHECK (nota_media BETWEEN 0.0 AND 10.0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- JOGO_PLATAFORMA (relação N:N entre jogo e plataforma)
-- ---------------------------------------------------------------------
CREATE TABLE jogo_plataforma (
  id_jogo        INT UNSIGNED NOT NULL,
  id_plataforma  INT UNSIGNED NOT NULL,
  PRIMARY KEY (id_jogo, id_plataforma),
  KEY idx_jp_plataforma (id_plataforma),
  CONSTRAINT fk_jp_jogo
    FOREIGN KEY (id_jogo) REFERENCES jogo (id_jogo)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_jp_plataforma
    FOREIGN KEY (id_plataforma) REFERENCES plataforma (id_plataforma)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- REVIEW
-- Regra 3: autoria (verificada pela aplicação) | atualizado_em muda ao editar
-- Regra 4: uma review por usuário por jogo (UNIQUE)
-- Regra 5: nota entre 0,0 e 10,0 (CHECK)
-- Regras 8 e 9: exclusão em cascata ao apagar o jogo ou o usuário
-- ---------------------------------------------------------------------
CREATE TABLE review (
  id_review      INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  id_usuario     INT UNSIGNED   NOT NULL,
  id_jogo        INT UNSIGNED   NOT NULL,
  titulo         VARCHAR(120)   NOT NULL,
  comentario     TEXT           NULL,
  nota           DECIMAL(3,1)   NOT NULL,
  criado_em      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_review),
  UNIQUE KEY uq_review_usuario_jogo (id_usuario, id_jogo),
  KEY idx_review_jogo (id_jogo),
  CONSTRAINT fk_review_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_review_jogo
    FOREIGN KEY (id_jogo) REFERENCES jogo (id_jogo)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ck_review_nota CHECK (nota BETWEEN 0.0 AND 10.0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- REVIEW_CURTIDA (marcar review como útil; um usuário curte uma vez)
-- ---------------------------------------------------------------------
CREATE TABLE review_curtida (
  id_review   INT UNSIGNED NOT NULL,
  id_usuario  INT UNSIGNED NOT NULL,
  criado_em   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_review, id_usuario),
  KEY idx_curtida_usuario (id_usuario),
  CONSTRAINT fk_curtida_review
    FOREIGN KEY (id_review) REFERENCES review (id_review)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_curtida_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- REVIEW_DENUNCIA (denunciar review inadequada; uma denúncia por usuário)
-- ---------------------------------------------------------------------
CREATE TABLE review_denuncia (
  id_denuncia  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_review    INT UNSIGNED  NOT NULL,
  id_usuario   INT UNSIGNED  NOT NULL,
  motivo       VARCHAR(255)  NOT NULL,
  criado_em    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_denuncia),
  UNIQUE KEY uq_denuncia_review_usuario (id_review, id_usuario),
  KEY idx_denuncia_usuario (id_usuario),
  CONSTRAINT fk_denuncia_review
    FOREIGN KEY (id_review) REFERENCES review (id_review)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_denuncia_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;
