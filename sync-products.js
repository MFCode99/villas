const fs = require('fs');
const path = require('path');
const vm = require('vm');
const mysql = require('mysql2/promise');

const CONFIG = {
  db: {
    host: 'localhost',
    user: 'villas_user',
    password: 'Villas@2026!',
    database: 'villas',
    charset: 'utf8mb4'
  },
  appFile: path.join(__dirname, 'index.html')
};

function extractLiteral(source, name, openChar, closeChar) {
  const pattern = new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*`, 'm');
  const match = pattern.exec(source);
  if (!match) throw new Error(`Nao encontrei ${name} em index.html`);
  const start = match.index + match[0].length;
  let i = source.indexOf(openChar, start);
  if (i < 0) throw new Error(`Nao encontrei inicio de ${name}`);
  let depth = 0;
  let inString = false;
  let quote = '';
  let escaped = false;
  for (let pos = i; pos < source.length; pos++) {
    const ch = source[pos];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      quote = ch;
      continue;
    }
    if (ch === openChar) depth++;
    if (ch === closeChar) {
      depth--;
      if (depth === 0) return source.slice(i, pos + 1);
    }
  }
  throw new Error(`Nao consegui extrair ${name}`);
}

async function main() {
  const html = fs.readFileSync(CONFIG.appFile, 'utf8');
  const imgsLiteral = extractLiteral(html, 'IMGS', '{', '}');
  const catalogLiteral = extractLiteral(html, 'CATALOG', '[', ']');

  const sandbox = {};
  const IMGS = vm.runInNewContext(`(${imgsLiteral})`, sandbox);
  const CATALOG = vm.runInNewContext(`(${catalogLiteral})`, sandbox);

  const categories = CATALOG.filter((item) => item && item.cat && item.label);
  const products = CATALOG.filter((item) => item && item.ref);
  const conn = await mysql.createConnection(CONFIG.db);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS categorias (
      id            VARCHAR(80) PRIMARY KEY,
      label         VARCHAR(120) NOT NULL,
      ordem         INT DEFAULT 0,
      activo        TINYINT(1) DEFAULT 1,
      criado_em     DATETIME DEFAULT CURRENT_TIMESTAMP,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await conn.execute(`
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
      criado_em     DATETIME DEFAULT CURRENT_TIMESTAMP,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  for (let i = 0; i < categories.length; i++) {
    const c = categories[i];
    await conn.execute(
      `INSERT INTO categorias (id,label,ordem,activo)
       VALUES (?,?,?,1)
       ON DUPLICATE KEY UPDATE
         label=VALUES(label),
         ordem=VALUES(ordem),
         activo=1`,
      [
        String(c.cat),
        c.label || c.cat || '',
        i
      ]
    );
  }

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const inferredStep = Number.isFinite(Number(p.qtdStep))
      ? Math.max(1, parseInt(p.qtdStep, 10))
      : ((p.type || '').toLowerCase().includes('pack') ? 1 : 12);
    await conn.execute(
      `INSERT INTO produtos (ref,nome,tipo,cat,preco,pvp,cores,tams,qtd_step,imagem,ordem,activo)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,1)
       ON DUPLICATE KEY UPDATE
         nome=VALUES(nome),
         tipo=VALUES(tipo),
         cat=VALUES(cat),
         preco=VALUES(preco),
         pvp=VALUES(pvp),
         cores=VALUES(cores),
         tams=VALUES(tams),
         qtd_step=VALUES(qtd_step),
         imagem=VALUES(imagem),
         ordem=VALUES(ordem),
         activo=1`,
      [
        String(p.ref),
        p.name || '',
        p.type || '',
        p.cat || '',
        Number(p.price || 0),
        p.pvp == null ? null : Number(p.pvp),
        JSON.stringify(Array.isArray(p.cores) ? p.cores : []),
        JSON.stringify(Array.isArray(p.tams) ? p.tams : []),
        inferredStep,
        IMGS[p.ref] || null,
        i
      ]
    );
  }

  await conn.end();
  console.log(`Produtos sincronizados: ${products.length}`);
}

main().catch((err) => {
  console.error('Erro ao sincronizar produtos:', err.message);
  process.exit(1);
});

