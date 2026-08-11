-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
--  VILLAS â€” Base de Dados MySQL
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE DATABASE IF NOT EXISTS villas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE villas;

CREATE TABLE IF NOT EXISTS clientes (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user         VARCHAR(50)  NOT NULL UNIQUE,
  pass         VARCHAR(100) NOT NULL,
  nome         VARCHAR(150) NOT NULL,
  nif          VARCHAR(20)  DEFAULT '',
  email        VARCHAR(150) DEFAULT '',
  telefone     VARCHAR(30)  DEFAULT '',
  admin        TINYINT(1)   DEFAULT 0,
  developer    TINYINT(1)   DEFAULT 0,
  activo       TINYINT(1)   DEFAULT 1,
  criado_em    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  ultimo_login DATETIME     DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS encomendas (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id   INT           NOT NULL,
  cliente_nome VARCHAR(150)  NOT NULL,
  cliente_nif  VARCHAR(20)   DEFAULT '',
  total        DECIMAL(10,2) NOT NULL,
  unidades     INT           NOT NULL,
  linhas       INT           NOT NULL,
  notas        TEXT          DEFAULT NULL,
  criado_em    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS encomenda_linhas (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  encomenda_id INT           NOT NULL,
  ref          VARCHAR(20)   NOT NULL,
  nome         VARCHAR(150)  NOT NULL,
  tipo         VARCHAR(100)  DEFAULT '',
  cor          VARCHAR(100)  NOT NULL,
  tamanho      VARCHAR(50)   NOT NULL,
  quantidade   INT           NOT NULL,
  preco_unit   DECIMAL(10,2) NOT NULL,
  total_linha  DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (encomenda_id) REFERENCES encomendas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS produtos (
  ref           VARCHAR(30) PRIMARY KEY,
  nome          VARCHAR(150) NOT NULL,
  tipo          VARCHAR(120) DEFAULT '',
  cat           VARCHAR(80)  NOT NULL,
  preco         DECIMAL(10,2) NOT NULL,
  pvp           DECIMAL(10,2) DEFAULT NULL,
  cores         JSON DEFAULT NULL,
  tams          JSON DEFAULT NULL,
  qtd_step      INT DEFAULT 12,
  imagem        LONGTEXT DEFAULT NULL,
  ordem         INT DEFAULT 0,
  activo        TINYINT(1) DEFAULT 1,
  estacao       VARCHAR(20) DEFAULT 'ambos',
  criado_em     DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categorias (
  id            VARCHAR(80) PRIMARY KEY,
  label         VARCHAR(120) NOT NULL,
  ordem         INT DEFAULT 0,
  activo        TINYINT(1) DEFAULT 1,
  criado_em     DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS login_logs (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id   INT DEFAULT NULL,
  user_input   VARCHAR(80) DEFAULT '',
  nome         VARCHAR(150) DEFAULT '',
  sucesso      TINYINT(1) DEFAULT 0,
  ip           VARCHAR(80) DEFAULT '',
  user_agent   VARCHAR(255) DEFAULT '',
  criado_em    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS error_logs (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  scope        VARCHAR(80) DEFAULT '',
  message      TEXT,
  details      LONGTEXT DEFAULT NULL,
  criado_em    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dev_notes (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  title         VARCHAR(180) NOT NULL,
  body          TEXT NOT NULL,
  audience      VARCHAR(30) DEFAULT 'admin',
  active        TINYINT(1) DEFAULT 1,
  created_by    VARCHAR(80) DEFAULT 'developer',
  criado_em     DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

SET @db_name = DATABASE();
SET @sql = IF(
  (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'clientes'
      AND COLUMN_NAME = 'developer'
  ) = 0,
  'ALTER TABLE clientes ADD COLUMN developer TINYINT(1) DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO categorias (id, label, ordem) VALUES
  ('Soquetes', 'Soquetes', 0),
  ('MiniMeia', 'Mini Meia / Meia Liga', 1),
  ('Collants', 'Collants', 2),
  ('Leggings', 'Leggings', 3),
  ('SegundaPele', 'Segunda Pele', 4),
  ('Crianca', 'Crianca', 5),
  ('PeugaMulher', 'Peuga Mulher', 6),
  ('PeugaHomem', 'Peuga Homem', 7),
  ('SoquetesHM', 'Soquetes H/M', 8);

-- Admin e primeiro cliente por defeito
INSERT IGNORE INTO clientes (user, pass, nome, nif, admin, activo)
VALUES ('admin', 'villas2026', 'Vitor Gouveia', '', 1, 1);

INSERT IGNORE INTO clientes (user, pass, nome, nif, admin, activo)
VALUES ('cidadefama', 'cf2026', 'Cidade da Fama - Unipessoal Lda', '509 889 026', 0, 1);

INSERT INTO clientes (user, pass, nome, nif, email, telefone, admin, developer, activo)
VALUES ('vlsdev4729', 'Nv7k!Q2mL9', 'Programador Villas', '', '', '', 0, 1, 1)
ON DUPLICATE KEY UPDATE
  pass = VALUES(pass),
  nome = VALUES(nome),
  email = VALUES(email),
  telefone = VALUES(telefone),
  developer = VALUES(developer),
  activo = VALUES(activo);



