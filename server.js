// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  VILLAS â€” Servidor com MySQL + Email + PDF
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const http       = require('http');
const crypto     = require('crypto');
const fs         = require('fs');
const path       = require('path');
const nodemailer = require('nodemailer');
const mysql      = require('mysql2/promise');

// â”€â”€ CONFIGURAÃ‡ÃƒO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const RUNTIME_CONFIG_FILE = path.join(__dirname, '.runtime-config.json');

const CONFIG = {
  port:      parseInt(process.env.PORT || '3000', 10),
  emailFrom: process.env.VILLAS_EMAIL_FROM || 'nunomggouveia@gmail.com',
  emailTo:   process.env.VILLAS_EMAIL_TO || process.env.VILLAS_EMAIL_FROM || 'nunomggouveia@gmail.com',
  emailPass: process.env.VILLAS_EMAIL_PASS || 'mlsnmovhdfwaruiq',
  appFile:   path.join(__dirname, 'index.html'),
  db: {
    host:     process.env.VILLAS_DB_HOST || 'localhost',
    user:     process.env.VILLAS_DB_USER || 'villas_user',
    password: process.env.VILLAS_DB_PASS || 'Villas@2026!',
    database: process.env.VILLAS_DB_NAME || 'villas',
    port:     parseInt(process.env.VILLAS_DB_PORT || '3306', 10),
    charset:  'utf8mb4',
  }
};
const SESSION_TTL_MS = 30 * 60 * 1000;
const MIN_ORDER_TOTAL = 250;
const sessions = new Map();
let smtpStatus = { ready:false, message:'SMTP ainda não verificado.' };
let siteSettings = {};
const SESSION_COOKIE_NAME = 'villas_session';
let runtimeConfig = loadRuntimeConfig();

function loadRuntimeConfig() {
  try {
    if (!fs.existsSync(RUNTIME_CONFIG_FILE)) return {};
    const raw = fs.readFileSync(RUNTIME_CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    console.log('Aviso runtime config:', e.message);
    return {};
  }
}

function saveRuntimeConfig() {
  fs.writeFileSync(RUNTIME_CONFIG_FILE, JSON.stringify(runtimeConfig, null, 2), 'utf8');
}

function applyRuntimeEmailConfig() {
  applyEmailConfigFromSettings();
}

function getMaskedSecret(secret) {
  const clean = String(secret || '').trim();
  if (!clean) return '';
  if (clean.length <= 4) return '****';
  return `${'*'.repeat(Math.max(4, clean.length - 4))}${clean.slice(-4)}`;
}

function getPublicSmtpConfig() {
  return {
    emailFrom: CONFIG.emailFrom,
    emailTo: CONFIG.emailTo,
    hasPassword: !!String(CONFIG.emailPass || '').trim(),
    maskedPassword: getMaskedSecret(CONFIG.emailPass)
  };
}

function getPublicSiteSettings() {
  return {
    collectionMode: getCollectionModeSetting(),
    showInactiveProducts: getShowInactiveProductsSetting()
  };
}

function parseCookies(req) {
  const raw = String(req.headers.cookie || '');
  if (!raw) return {};
  return raw.split(';').reduce(function(acc, part) {
    const idx = part.indexOf('=');
    if (idx < 0) return acc;
    const key = decodeURIComponent(part.slice(0, idx).trim());
    const value = decodeURIComponent(part.slice(idx + 1).trim());
    if (key) acc[key] = value;
    return acc;
  }, {});
}

function getRequestToken(req) {
  const cookies = parseCookies(req);
  return String(cookies[SESSION_COOKIE_NAME] || req.headers['x-token'] || '').trim();
}

function buildSessionCookie(token, maxAgeSeconds) {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0, Math.floor(maxAgeSeconds || 0))}`;
}

function buildClearedSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function getSiteSetting(key, fallback = '') {
  const value = siteSettings && Object.prototype.hasOwnProperty.call(siteSettings, key)
    ? siteSettings[key]
    : undefined;
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function getBoolSiteSetting(key, fallback = true) {
  const raw = getSiteSetting(key, fallback ? '1' : '0');
  return !['0', 'false', 'off', 'no'].includes(String(raw).toLowerCase());
}

function getCollectionModeSetting() {
  return String(getSiteSetting('collection_mode', 'personalizada')).toLowerCase();
}

function getShowInactiveProductsSetting() {
  return getBoolSiteSetting('show_inactive_products', true);
}

function applyEmailConfigFromSettings() {
  CONFIG.emailFrom = String(getSiteSetting('smtp_email_from', process.env.VILLAS_EMAIL_FROM || CONFIG.emailFrom || 'nunomggouveia@gmail.com')).trim();
  CONFIG.emailTo = String(getSiteSetting('smtp_email_to', process.env.VILLAS_EMAIL_TO || CONFIG.emailTo || CONFIG.emailFrom)).trim();
  CONFIG.emailPass = String(getSiteSetting('smtp_email_pass', process.env.VILLAS_EMAIL_PASS || CONFIG.emailPass || 'mlsnmovhdfwaruiq')).trim();
}

async function loadSiteSettingsFromDB() {
  const [rows] = await db.execute('SELECT setting_key, setting_value FROM site_settings');
  siteSettings = {};
  rows.forEach(function(row){
    siteSettings[row.setting_key] = row.setting_value;
  });
  return siteSettings;
}

async function seedSiteSettingsDefaults() {
  const defaults = [
    ['collection_mode', String(runtimeConfig.collectionMode || 'personalizada').toLowerCase()],
    ['show_inactive_products', runtimeConfig.showInactiveProducts === false ? '0' : '1'],
    ['smtp_email_from', String((runtimeConfig.smtp && runtimeConfig.smtp.emailFrom) || process.env.VILLAS_EMAIL_FROM || 'nunomggouveia@gmail.com')],
    ['smtp_email_to', String((runtimeConfig.smtp && runtimeConfig.smtp.emailTo) || process.env.VILLAS_EMAIL_TO || process.env.VILLAS_EMAIL_FROM || 'nunomggouveia@gmail.com')],
    ['smtp_email_pass', String((runtimeConfig.smtp && runtimeConfig.smtp.emailPass) || process.env.VILLAS_EMAIL_PASS || 'mlsnmovhdfwaruiq')]
  ];
  for (const [key, value] of defaults) {
    await db.execute(
      `INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES (?, ?)`,
      [key, value]
    );
  }
}

async function setSiteSetting(key, value) {
  await db.execute(
    `INSERT INTO site_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value), updated_at=CURRENT_TIMESTAMP`,
    [String(key), String(value == null ? '' : value)]
  );
  siteSettings[String(key)] = String(value == null ? '' : value);
}

applyRuntimeEmailConfig();

// â”€â”€ BASE DE DADOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let db;
async function connectDB() {
  db = await mysql.createPool({ ...CONFIG.db, waitForConnections: true, connectionLimit: 10 });
  await ensureSchemaFixes();
  await loadSessionsFromDB().catch(function(){});
  applyEmailConfigFromSettings();
  console.log('Ligado a MySQL');
}

async function ensureSchemaFixes() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS login_logs (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        cliente_id   INT DEFAULT NULL,
        user_input   VARCHAR(80) DEFAULT '',
        nome         VARCHAR(150) DEFAULT '',
        sucesso      TINYINT(1) DEFAULT 0,
        ip           VARCHAR(80) DEFAULT '',
        user_agent   VARCHAR(255) DEFAULT '',
        criado_em    DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS error_logs (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        scope        VARCHAR(80) DEFAULT '',
        message      TEXT,
        details      LONGTEXT DEFAULT NULL,
        criado_em    DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS dev_notes (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        title         VARCHAR(180) NOT NULL,
        body          TEXT NOT NULL,
        audience      VARCHAR(30) DEFAULT 'admin',
        active        TINYINT(1) DEFAULT 1,
        created_by    VARCHAR(80) DEFAULT 'developer',
        criado_em     DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS cart_states (
        cliente_id   INT PRIMARY KEY,
        payload      LONGTEXT NOT NULL,
        updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        expires_at   DATETIME NOT NULL,
        FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        token        CHAR(64) PRIMARY KEY,
        cliente_id   INT NOT NULL,
        admin        TINYINT(1) DEFAULT 0,
        developer    TINYINT(1) DEFAULT 0,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        expires_at   DATETIME NOT NULL,
        FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS site_settings (
        setting_key   VARCHAR(80) PRIMARY KEY,
        setting_value LONGTEXT NOT NULL,
        updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS categorias (
        id            VARCHAR(80) PRIMARY KEY,
        label         VARCHAR(120) NOT NULL,
        ordem         INT DEFAULT 0,
        activo        TINYINT(1) DEFAULT 1,
        criado_em     DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS produtos (
        ref           VARCHAR(30) PRIMARY KEY,
        nome          VARCHAR(150) NOT NULL,
        tipo          VARCHAR(120) DEFAULT '',
        cat           VARCHAR(80) NOT NULL,
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
      )
    `);
    const [qtyStepRows] = await db.execute(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'produtos'
         AND COLUMN_NAME = 'qtd_step'`,
      [CONFIG.db.database]
    );

    if (!qtyStepRows.length) {
      await db.execute(`ALTER TABLE produtos ADD COLUMN qtd_step INT DEFAULT 12`);
      await db.execute(`
        UPDATE produtos
        SET qtd_step = CASE
          WHEN LOWER(COALESCE(tipo, '')) LIKE '%pack%' THEN 1
          ELSE 12
        END
      `);
    }
    const [seasonColRows] = await db.execute(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'produtos'
         AND COLUMN_NAME = 'estacao'`,
      [CONFIG.db.database]
    );

    if (!seasonColRows.length) {
      await db.execute(`ALTER TABLE produtos ADD COLUMN estacao VARCHAR(20) DEFAULT 'ambos'`);
    }
    const [devColRows] = await db.execute(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'clientes'
         AND COLUMN_NAME = 'developer'`,
      [CONFIG.db.database]
    );
    if (!devColRows.length) {
      await db.execute(`ALTER TABLE clientes ADD COLUMN developer TINYINT(1) DEFAULT 0`);
    }
    const [loginColRows] = await db.execute(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'clientes'
         AND COLUMN_NAME = 'ultimo_login'`,
      [CONFIG.db.database]
    );
    if (!loginColRows.length) {
      await db.execute(`ALTER TABLE clientes ADD COLUMN ultimo_login DATETIME DEFAULT NULL`);
    }

    const defaultCategories = [
      ['Soquetes', 'Soquetes', 0],
      ['MiniMeia', 'Mini Meia / Meia Liga', 1],
      ['Collants', 'Collants', 2],
      ['Leggings', 'Leggings', 3],
      ['SegundaPele', 'Segunda Pele', 4],
      ['Crianca', 'Crianca', 5],
      ['PeugaMulher', 'Peuga Mulher', 6],
      ['PeugaHomem', 'Peuga Homem', 7],
      ['SoquetesHM', 'Soquetes H/M', 8]
    ];
    for (const [id, label, ordem] of defaultCategories) {
      await db.execute(
        `INSERT INTO categorias (id,label,ordem,activo)
         VALUES (?,?,?,1)
         ON DUPLICATE KEY UPDATE label=VALUES(label)`,
        [id, label, ordem]
      );
    }

    const [fkRows] = await db.execute(
      `SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'encomenda_linhas'
         AND COLUMN_NAME = 'encomenda_id'
         AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [CONFIG.db.database]
    );

    if (fkRows.length && fkRows[0].REFERENCED_TABLE_NAME !== 'encomendas') {
      await db.execute(`ALTER TABLE encomenda_linhas DROP FOREIGN KEY \`${fkRows[0].CONSTRAINT_NAME}\``);
      await db.execute(
        `ALTER TABLE encomenda_linhas
         ADD CONSTRAINT fk_encomenda_linhas_encomenda
         FOREIGN KEY (encomenda_id) REFERENCES encomendas(id) ON DELETE CASCADE`
      );
      console.log('Foreign key de encomenda_linhas corrigida');
    }
    await db.execute(
      `INSERT IGNORE INTO clientes (user,pass,nome,nif,email,telefone,admin,developer,activo)
       VALUES (?,?,?,?,?,?,0,1,1)`,
      ['vlsdev4729', 'Nv7k!Q2mL9', 'Programador Villas', '', '', '']
    );
    await seedSiteSettingsDefaults();
    await loadSiteSettingsFromDB();
    applyEmailConfigFromSettings();
    await db.execute('DELETE FROM cart_states WHERE expires_at < NOW()');
    await db.execute('DELETE FROM sessions WHERE expires_at < NOW()');
  } catch (e) {
    console.log('Aviso ao validar schema:', e.message);
  }
}

// â”€â”€ EMAIL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function createEmailTransport() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: CONFIG.emailFrom, pass: CONFIG.emailPass }
  });
}

let transporter = createEmailTransport();

async function verifyEmailTransport() {
  try {
    await transporter.verify();
    smtpStatus = {
      ready:true,
      message:`SMTP pronto: ${CONFIG.emailFrom} -> ${CONFIG.emailTo}`,
      updatedAt: new Date().toISOString()
    };
    console.log(`SMTP pronto: ${CONFIG.emailFrom} -> ${CONFIG.emailTo}`);
  } catch (e) {
    smtpStatus = {
      ready:false,
      message:String(e.message || 'Falha SMTP'),
      updatedAt: new Date().toISOString()
    };
    console.log(`Aviso SMTP: ${e.message}`);
  }
}

async function refreshEmailTransport() {
  applyRuntimeEmailConfig();
  transporter = createEmailTransport();
  await verifyEmailTransport();
}

async function updateEmailConfig(data = {}) {
  const nextFrom = String(data.emailFrom || '').trim();
  const nextTo = String(data.emailTo || '').trim();
  const nextPass = data.emailPass == null ? '' : String(data.emailPass).trim();
  if (!nextFrom) throw new Error('O email de envio é obrigatório.');
  if (!nextTo) throw new Error('O email de destino é obrigatório.');
  await setSiteSetting('smtp_email_from', nextFrom);
  await setSiteSetting('smtp_email_to', nextTo);
  if (nextPass) await setSiteSetting('smtp_email_pass', nextPass);
  await loadSiteSettingsFromDB();
  applyEmailConfigFromSettings();
  await refreshEmailTransport();
  return {
    config: getPublicSmtpConfig(),
    status: smtpStatus
  };
}

function buildOrderHTML(order, opts = {}) {
  const hidePrices = !!opts.hidePrices;
  const { client, nif, date, time, notes, total, units, lines, items } = order;
  const rows = items.map((c, i) => {
    const bg = i % 2 === 0 ? '#ffffff' : '#f9f7f4';
    const td = 'padding:7px 10px;border-bottom:1px solid #e2ddd5;font-size:12px;';
    let row = `<tr style='background:${bg}'>`
      + `<td style='${td}'><b>Ref. ${c.ref}</b></td>`
      + `<td style='${td};text-align:center'>${c.name}</td>`
      + `<td style='${td};color:#7a7369;text-align:center'>${c.type}</td>`
      + `<td style='${td};text-align:center'>${c.cor}</td>`
      + `<td style='${td};text-align:center'>${c.tam}</td>`
      + `<td style='${td};text-align:center'>${c.qty}</td>`;
    if (!hidePrices) {
      row += `<td style='${td};text-align:right'>${parseFloat(c.price).toFixed(2).replace('.', ',')}€</td>`
        + `<td style='${td};text-align:right;font-weight:700'>${(c.price * c.qty).toFixed(2).replace('.', ',')}€</td>`;
    }
    row += `</tr>`;
    return row;
  }).join('');
  const notesHtml = notes
    ? `<div style='background:#fffdf0;border:1px solid #e8d08a;border-radius:4px;padding:10px 14px;margin-bottom:18px;font-size:12px'><strong style='font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;display:block;margin-bottom:4px'>Notas</strong>${notes}</div>`
    : '';
  const priceHeadHtml = hidePrices
    ? ''
    : "<th style='color:#6c6458;padding:8px 10px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px'>P.Unit.</th>"
      + "<th style='color:#6c6458;padding:8px 10px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px'>Total</th>";
  const unitsTopHtml = hidePrices
    ? ''
    : "<div style='font-size:13px'><strong style='font-size:10px;display:block;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:3px'>Unidades</strong>" + units + "</div>";
  const totalsHtml = hidePrices
    ? "<div style='text-align:right;padding:12px 0;border-top:2px solid #c9a84c;margin-bottom:20px'>"
      + "<div style='font-size:11px;color:#888;margin-top:2px'>" + lines + " linhas</div>"
      + "</div>"
    : "<div style='text-align:right;padding:12px 0;border-top:2px solid #c9a84c;margin-bottom:20px'>"
      + "<div style='font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px'>Total (preço de custo)</div>"
      + "<div style='font-size:22px;font-weight:700'>" + parseFloat(total).toFixed(2).replace('.', ',') + " &euro;</div>"
      + "<div style='font-size:11px;color:#888;margin-top:2px'>" + units + " unidades &middot; " + lines + " linhas</div>"
      + "</div>";
  return "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Encomenda Villas</title>"
    + "<style>"
    + "*{box-sizing:border-box;margin:0;padding:0}"
    + "@page{size:A4;margin:16mm 10mm 16mm 10mm}"
    + "body{font-family:Arial,sans-serif;color:#0f0f0f;padding:0;margin:0;background:#fff}"
    + "table{width:100%;border-collapse:collapse;margin-bottom:16px}"
    + "thead{display:table-header-group}"
    + "tr{page-break-inside:avoid}"
    + ".doc-shell{padding:0 0 6mm}"
    + ".prtbtn{display:block;margin:0 auto;background:#c9a84c;color:#0f0f0f;border:none;padding:12px 40px;font-size:14px;font-weight:700;border-radius:4px;cursor:pointer}"
    + "@media print{.prtbtn{display:none}}"
    + "</style></head><body>"
    + "<div class='doc-shell'>"
    + "<h1 style='font-family:Georgia,serif;font-size:28px;border-bottom:2px solid #c9a84c;padding-bottom:8px;margin-bottom:4px'>Villas&reg;</h1>"
    + "<p style='font-size:10px;color:#888;text-transform:uppercase;letter-spacing:3px;margin-bottom:20px'>Outono/Inverno 2025&middot;2026 &mdash; Nota de Encomenda</p>"
    + "<div style='display:flex;flex-wrap:wrap;gap:28px;background:#f7f4ef;padding:12px 16px;border-radius:4px;margin-bottom:18px'>"
    + "<div style='font-size:13px'><strong style='font-size:10px;display:block;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:3px'>Cliente</strong>" + (client || "&mdash;") + "</div>"
    + "<div style='font-size:13px'><strong style='font-size:10px;display:block;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:3px'>NIF</strong>" + (nif || "&mdash;") + "</div>"
    + "<div style='font-size:13px'><strong style='font-size:10px;display:block;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:3px'>Data</strong>" + date + " " + time + "</div>"
    + unitsTopHtml
    + "</div>"
    + notesHtml
    + "<table><thead><tr style='background:#f7f4ef;border-top:1px solid #e2ddd5;border-bottom:1px solid #e2ddd5'>"
    + "<th style='color:#6c6458;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px'>Ref.</th>"
    + "<th style='color:#6c6458;padding:8px 10px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px'>Descrição</th>"
    + "<th style='color:#6c6458;padding:8px 10px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px'>Tipo</th>"
    + "<th style='color:#6c6458;padding:8px 10px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px'>Cor</th>"
    + "<th style='color:#6c6458;padding:8px 10px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px'>Tam.</th>"
    + "<th style='color:#6c6458;padding:8px 10px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px'>Qtd.</th>"
    + priceHeadHtml
    + "</tr></thead><tbody>" + rows + "</tbody></table>"
    + totalsHtml
    + "<div style='font-size:10px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:12px;margin-bottom:20px'>VÍTOR GOUVEIA &middot; +351 968 350 394 &middot; Vitormbgouveia@gmail.com</div>"
    + "</div>"
    + "<button class='prtbtn' onclick='window.print()'>\uD83D\uDDA8 IMPRIMIR</button>"
    + "</body></html>";
}

async function generatePDF(html) {
  try {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      margin: { top:'14mm', right:'10mm', bottom:'14mm', left:'10mm' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="width:100%;padding:0 10mm;font-size:9px;color:#8a8175;text-transform:uppercase;letter-spacing:1.2px;font-family:Arial,sans-serif;">
          <div style="display:flex;justify-content:space-between;align-items:center;width:100%;border-bottom:1px solid #e9e1d4;padding:0 0 4px;">
            <span>Villas&reg; Nota de Encomenda</span>
            <span style="text-transform:none;letter-spacing:0;">${new Date().toLocaleDateString('pt-PT')}</span>
          </div>
        </div>
      `,
      footerTemplate: `
        <div style="width:100%;padding:0 10mm 2px;font-size:9px;color:#8a8175;font-family:Arial,sans-serif;">
          <div style="display:flex;justify-content:space-between;align-items:center;width:100%;border-top:1px solid #e9e1d4;padding-top:4px;">
            <span>VÍTOR GOUVEIA &middot; +351 968 350 394 &middot; Vitormbgouveia@gmail.com</span>
            <span>Página <span class="pageNumber"></span> / <span class="totalPages"></span></span>
          </div>
        </div>
      `
    });
    await browser.close();
    return pdf;
  } catch(e) { console.log('PDF não gerado:', e.message); return null; }
}

async function buildOrderPdfAttachments(order) {
  const name = (order.client || 'cliente').replace(/\s+/g, '_');
  const date = String(order.date || '').replace(/\//g, '-');
  const baseName = `encomenda_${name}_${date || 'villas'}`;
  const variants = [
    {
      filename: `${baseName}.pdf`,
      html: buildOrderHTML(order)
    },
    {
      filename: `${baseName}_sem_precos.pdf`,
      html: buildOrderHTML(order, { hidePrices: true })
    }
  ];
  const attachments = [];
  for (const variant of variants) {
    const pdf = await generatePDF(variant.html);
    if (!pdf) continue;
    attachments.push({
      filename: variant.filename,
      content: pdf,
      contentType: 'application/pdf'
    });
  }
  return attachments;
}

async function sendEmail(order) {
  const html = buildOrderHTML(order);
  const attachments = await buildOrderPdfAttachments(order);
  try {
    await transporter.sendMail({
      from: `"Catálogo Villas" <${CONFIG.emailFrom}>`,
      to:   CONFIG.emailTo,
      subject: `Encomenda Villas - ${order.client||'Cliente'} - ${order.date}`,
      html,
      attachments
    });
  } catch (e) {
    const err = new Error(`Falha no envio do email: ${e.message}`);
    err.code = 'EMAIL_SEND_FAILED';
    throw err;
  }
}

async function sendClientEmail({ to, subject, message, html = '', order = null }) {
  if (!to) {
    const err = new Error('O cliente não tem email configurado.');
    err.code = 'CLIENT_EMAIL_MISSING';
    throw err;
  }
  const attachments = [];
  if (order) {
    attachments.push(...await buildOrderPdfAttachments(order));
  }
  await transporter.sendMail({
    from: `"Catálogo Villas" <${CONFIG.emailFrom}>`,
    to,
    subject: subject || 'Mensagem Villas',
    text: message || '',
    html: html || undefined,
    attachments
  });
}

function buildNewClientWelcomeEmail({ user, pass, nome }) {
  const clientName = String(nome || '').trim();
  const greeting = clientName ? `Exmo(a). Sr(a) ${clientName},` : 'Exmo(a). Sr(a),';
  const safeGreeting = clientName ? `Exmo(a). Sr(a) ${clientName},` : 'Exmo(a). Sr(a),';
  return {
    subject: 'Dados de acesso ao catálogo Villas',
    message:
`${greeting}

Junto envio os dados de acesso ao nosso novo catálogo digital, onde poderá consultar toda a coleção Villas Outono/Inverno 2025/2026 e fazer as suas encomendas online.

─────────────────────────────
DADOS DE ACESSO
─────────────────────────────
Endereço:   https://villas.mlabcorp.net
Utilizador: ${user}
Password:   ${pass}
─────────────────────────────

COMO FAZER UMA ENCOMENDA:
1. Aceda ao endereço acima
2. Introduza o utilizador e a password
3. Navegue pelo catálogo e adicione os produtos ao carrinho
4. Clique em "Finalizar Encomenda" e depois em "Enviar Encomenda"
5. A encomenda chega-nos de imediato por email

Nota: consoante a referência, os artigos são vendidos em packs de 12 unidades ou à unidade. A quantidade mínima e o modo de venda estão indicados em cada produto no catálogo.

Para qualquer dúvida ou questão, não hesite em contactar-me.

Com os melhores cumprimentos,

Vitor Gouveia
Comercial
+351 968 350 394
Vitormbgouveia@gmail.com`,
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="margin:0;padding:0;background:#f5f1ea;font-family:Arial,sans-serif;color:#0f0f0f;">
  <div style="max-width:720px;margin:0 auto;padding:28px 18px;">
    <div style="background:#ffffff;border:1px solid #e2ddd5;border-radius:14px;overflow:hidden;box-shadow:0 12px 34px rgba(15,15,15,.06);">
      <div style="background:#0f0f0f;padding:28px 30px 22px;">
        <div style="font-family:Georgia,serif;font-size:32px;line-height:1;color:#c9a84c;margin-bottom:6px;">Villas&reg;</div>
        <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,.55);">Outono / Inverno 2025 &middot; 2026</div>
      </div>
      <div style="padding:28px 30px 30px;">
        <p style="margin:0 0 18px;font-size:14px;line-height:1.7;">${safeGreeting}</p>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.7;">Junto envio os dados de acesso ao nosso novo cat&aacute;logo digital, onde poder&aacute; consultar toda a cole&ccedil;&atilde;o Villas Outono/Inverno 2025/2026 e fazer as suas encomendas online.</p>

        <div style="background:#f7f4ef;border:1px solid #e2ddd5;border-radius:12px;padding:18px 20px;margin:22px 0;">
          <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#7a7369;font-weight:700;margin-bottom:14px;">Dados de Acesso</div>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;font-size:12px;color:#7a7369;text-transform:uppercase;letter-spacing:1px;">Endere&ccedil;o</td>
              <td style="padding:8px 0;font-size:14px;font-weight:700;text-align:right;"><a href="https://villas.mlabcorp.net" style="color:#0f0f0f;text-decoration:none;">https://villas.mlabcorp.net</a></td>
            </tr>
            <tr>
              <td style="padding:8px 0;font-size:12px;color:#7a7369;text-transform:uppercase;letter-spacing:1px;border-top:1px solid #e2ddd5;">Utilizador</td>
              <td style="padding:8px 0;font-size:14px;font-weight:700;text-align:right;border-top:1px solid #e2ddd5;">${String(user || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;font-size:12px;color:#7a7369;text-transform:uppercase;letter-spacing:1px;border-top:1px solid #e2ddd5;">Password</td>
              <td style="padding:8px 0;font-size:14px;font-weight:700;text-align:right;border-top:1px solid #e2ddd5;">${String(pass || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
            </tr>
          </table>
        </div>

        <div style="margin:24px 0 18px;">
          <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#7a7369;font-weight:700;margin-bottom:12px;">Como Fazer Uma Encomenda</div>
          <ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.8;color:#2c2925;">
            <li>Aceda ao endere&ccedil;o acima</li>
            <li>Introduza o utilizador e a password</li>
            <li>Navegue pelo cat&aacute;logo e adicione os produtos ao carrinho</li>
            <li>Clique em "Finalizar Encomenda" e depois em "Enviar Encomenda"</li>
            <li>A encomenda chega-nos de imediato por email</li>
          </ol>
        </div>

        <div style="background:#fffaf0;border:1px solid #ead8a0;border-radius:12px;padding:14px 16px;margin:20px 0 24px;font-size:13px;line-height:1.7;color:#5d533d;">
          <strong style="color:#7a5c00;">Nota:</strong> consoante a refer&ecirc;ncia, os artigos s&atilde;o vendidos em packs de 12 unidades ou &agrave; unidade. A quantidade m&iacute;nima e o modo de venda est&atilde;o indicados em cada produto no cat&aacute;logo.
        </div>

        <p style="margin:0 0 20px;font-size:14px;line-height:1.7;">Para qualquer d&uacute;vida ou quest&atilde;o, n&atilde;o hesite em contactar-me.</p>

        <div style="padding-top:18px;border-top:1px solid #ece7de;">
          <div style="font-size:14px;font-weight:700;margin-bottom:4px;">Vitor Gouveia</div>
          <div style="font-size:12px;color:#7a7369;margin-bottom:8px;">Comercial</div>
          <div style="font-size:13px;line-height:1.7;">
            <a href="tel:+351968350394" style="color:#0f0f0f;text-decoration:none;">+351 968 350 394</a><br>
            <a href="mailto:Vitormbgouveia@gmail.com" style="color:#0f0f0f;text-decoration:none;">Vitormbgouveia@gmail.com</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`
  };
}

async function saveOrder(clientId, order) {
  const cid = parseInt(clientId, 10);
  if (!Number.isInteger(cid) || cid <= 0) {
    const err = new Error('Sessão inválida. Faz login novamente.');
    err.code = 'INVALID_CLIENT';
    throw err;
  }

  const total = Number(order.total || 0);
  if (!Number.isFinite(total) || total < MIN_ORDER_TOTAL) {
    const err = new Error(`Encomenda mínima de ${MIN_ORDER_TOTAL.toFixed(2)} EUR.`);
    err.code = 'MIN_ORDER_TOTAL';
    throw err;
  }

  const [r] = await db.execute(
    'INSERT INTO encomendas (cliente_id,cliente_nome,cliente_nif,total,unidades,linhas,notas) VALUES (?,?,?,?,?,?,?)',
    [cid, order.client, order.nif||'', total, order.units, order.lines, order.notes||null]
  );
  const eid = r.insertId;
  for (const i of order.items) {
    await db.execute(
      'INSERT INTO encomenda_linhas (encomenda_id,ref,nome,tipo,cor,tamanho,quantidade,preco_unit,total_linha) VALUES (?,?,?,?,?,?,?,?,?)',
      [eid, i.ref, i.name, i.type||'', i.cor, i.tam, i.qty, i.price, i.price*i.qty]
    );
  }
  return eid;
}

async function getClientById(clientId) {
  const [rows] = await db.execute(
    'SELECT id,user,nome,nif,email,telefone,admin,activo FROM clientes WHERE id=? LIMIT 1',
    [clientId]
  );
  return rows[0] || null;
}

async function listClientOrders(clientId) {
  const [rows] = await db.execute(
    `SELECT e.id,e.cliente_id,e.cliente_nome,e.cliente_nif,e.total,e.unidades,e.linhas,e.notas,e.criado_em,
            c.email AS cliente_email,c.telefone AS cliente_telefone
     FROM encomendas e
     LEFT JOIN clientes c ON c.id = e.cliente_id
     WHERE e.cliente_id=?
     ORDER BY e.criado_em DESC`,
    [clientId]
  );
  return rows.map(mapOrderRow);
}

function mapOrderRow(row) {
  const created = row.criado_em ? new Date(row.criado_em) : null;
  const iso = created && !Number.isNaN(created.getTime()) ? created.toISOString() : null;
  const date = created && !Number.isNaN(created.getTime())
    ? created.toLocaleDateString('pt-PT')
    : '';
  const time = created && !Number.isNaN(created.getTime())
    ? created.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
    : '';
  return {
    id: Number(row.id),
    clientId: Number(row.cliente_id),
    client: row.cliente_nome,
    nif: row.cliente_nif || '',
    email: row.cliente_email || '',
    telefone: row.cliente_telefone || '',
    total: Number(row.total || 0),
    units: Number(row.unidades || 0),
    lines: Number(row.linhas || 0),
    notes: row.notas || '',
    createdAt: iso,
    date,
    time
  };
}

function mapOrderItemRow(row) {
  return {
    ref: row.ref,
    name: row.nome,
    type: row.tipo || '',
    cor: row.cor,
    tam: row.tamanho,
    qty: Number(row.quantidade || 0),
    price: Number(row.preco_unit || 0),
    total: Number(row.total_linha || 0)
  };
}

function normalizeCartItem(ref, item) {
  const product = item && typeof item === 'object' ? item : {};
  const cleanRef = String(ref || product.ref || '').trim();
  if (!cleanRef) return null;
  const qty = Math.max(1, parseInt(product.qty, 10) || 0);
  const price = Number(product.price);
  return {
    key: String(product.key || `${cleanRef}|${String(product.cor || '').trim()}|${String(product.tam || '').trim()}`),
    ref: cleanRef,
    name: String(product.name || '').trim(),
    type: String(product.type || '').trim(),
    cor: String(product.cor || '').trim(),
    tam: String(product.tam || '').trim(),
    qty,
    price: Number.isFinite(price) ? price : 0,
    img: product.img ? String(product.img) : null
  };
}

function normalizeCartPayload(items) {
  if (!Array.isArray(items)) return [];
  return items.map(function(item) {
    return normalizeCartItem(item && item.ref, item);
  }).filter(Boolean);
}

async function getCartState(clientId) {
  const [rows] = await db.execute(
    `SELECT payload, expires_at
     FROM cart_states
     WHERE cliente_id=? AND expires_at >= NOW()
     LIMIT 1`,
    [clientId]
  );
  if (!rows.length) {
    await db.execute('DELETE FROM cart_states WHERE cliente_id=?', [clientId]);
    return [];
  }
  try {
    const parsed = JSON.parse(rows[0].payload || '[]');
    return normalizeCartPayload(parsed);
  } catch (e) {
    return [];
  }
}

async function saveCartState(clientId, items) {
  const payload = JSON.stringify(normalizeCartPayload(items));
  await db.execute(
    `INSERT INTO cart_states (cliente_id,payload,expires_at)
     VALUES (?,?,DATE_ADD(NOW(), INTERVAL 7 DAY))
     ON DUPLICATE KEY UPDATE
       payload=VALUES(payload),
       expires_at=VALUES(expires_at),
       updated_at=CURRENT_TIMESTAMP`,
    [clientId, payload]
  );
}

async function clearCartState(clientId) {
  await db.execute('DELETE FROM cart_states WHERE cliente_id=?', [clientId]);
}

async function getOrderById(orderId, opts = {}) {
  const { clientId = null, allowAdmin = false } = opts;
  const params = [orderId];
  let where = 'WHERE e.id=?';
  if (!allowAdmin && clientId != null) {
    where += ' AND e.cliente_id=?';
    params.push(clientId);
  }
  const [rows] = await db.execute(
    `SELECT e.id,e.cliente_id,e.cliente_nome,e.cliente_nif,e.total,e.unidades,e.linhas,e.notas,e.criado_em,
            c.email AS cliente_email,c.telefone AS cliente_telefone
     FROM encomendas e
     LEFT JOIN clientes c ON c.id = e.cliente_id
     ${where}
     LIMIT 1`,
    params
  );
  if (!rows.length) return null;
  const order = mapOrderRow(rows[0]);
  const [items] = await db.execute(
    `SELECT ref,nome,tipo,cor,tamanho,quantidade,preco_unit,total_linha
     FROM encomenda_linhas
     WHERE encomenda_id=?
     ORDER BY id ASC`,
    [orderId]
  );
  order.items = items.map(mapOrderItemRow);
  return order;
}

async function listAllOrders() {
  const [rows] = await db.execute(
    `SELECT e.id,e.cliente_id,e.cliente_nome,e.cliente_nif,e.total,e.unidades,e.linhas,e.notas,e.criado_em,
            c.email AS cliente_email,c.telefone AS cliente_telefone
     FROM encomendas e
     LEFT JOIN clientes c ON c.id = e.cliente_id
     ORDER BY e.criado_em DESC
     LIMIT 500`
  );
  return rows.map(mapOrderRow);
}


function sendJSON(res, code, data) {
  res.writeHead(code, { 'Content-Type':'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function loadSessionsFromDB() {
  const [rows] = await db.execute(
    `SELECT token, cliente_id, admin, developer, expires_at
     FROM sessions
     WHERE expires_at >= NOW()`
  );
  sessions.clear();
  rows.forEach(function(row){
    sessions.set(row.token, {
      id: Number(row.cliente_id),
      admin: !!row.admin,
      developer: !!row.developer,
      expiresAt: new Date(row.expires_at).getTime()
    });
  });
}

async function createSession(client) {
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const session = {
    id: client.id,
    admin: !!client.admin,
    developer: !!client.developer,
    expiresAt
  };
  sessions.set(token, session);
  await db.execute(
    `INSERT INTO sessions (token, cliente_id, admin, developer, expires_at)
     VALUES (?, ?, ?, ?, FROM_UNIXTIME(? / 1000))
     ON DUPLICATE KEY UPDATE
       cliente_id=VALUES(cliente_id),
       admin=VALUES(admin),
       developer=VALUES(developer),
       expires_at=VALUES(expires_at),
       updated_at=CURRENT_TIMESTAMP`,
    [token, client.id, session.admin ? 1 : 0, session.developer ? 1 : 0, expiresAt]
  );
  return token;
}

function getSessionFromReq(req) {
  const token = getRequestToken(req);
  if (!token || !sessions.has(token)) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  db.execute(
    `UPDATE sessions SET expires_at=FROM_UNIXTIME(? / 1000), updated_at=CURRENT_TIMESTAMP WHERE token=?`,
    [session.expiresAt, token]
  ).catch(function(){});
  return { token, ...session };
}

function requireSession(req, adminOnly = false) {
  const session = getSessionFromReq(req);
  if (!session) {
    const err = new Error('Sessão inválida. Faz login novamente.');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  if (adminOnly && !session.admin) {
    const err = new Error('Acesso reservado ao admin.');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return session;
}

function requireDeveloperSession(req) {
  const session = requireSession(req, false);
  if (!session.developer) {
    const err = new Error('Acesso reservado ao programador.');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return session;
}

function getRequestMeta(req) {
  return {
    ip: String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(),
    userAgent: String(req.headers['user-agent'] || '')
  };
}

async function logLoginAttempt(req, info) {
  try {
    const meta = getRequestMeta(req);
    await db.execute(
      `INSERT INTO login_logs (cliente_id,user_input,nome,sucesso,ip,user_agent)
       VALUES (?,?,?,?,?,?)`,
      [
        info.clienteId || null,
        info.user || '',
        info.nome || '',
        info.success ? 1 : 0,
        meta.ip,
        meta.userAgent.slice(0, 255)
      ]
    );
  } catch (e) {}
}

async function logError(scope, err, details = '') {
  try {
    await db.execute(
      `INSERT INTO error_logs (scope,message,details)
       VALUES (?,?,?)`,
      [
        String(scope || 'server').slice(0, 80),
        String(err && err.message ? err.message : err || ''),
        String(details || '').slice(0, 12000)
      ]
    );
  } catch (e) {}
}

async function listDevNotes(activeOnly = false) {
  const sql = activeOnly
    ? `SELECT id,title,body,audience,active,created_by,criado_em,atualizado_em
       FROM dev_notes WHERE active=1 ORDER BY criado_em DESC LIMIT 100`
    : `SELECT id,title,body,audience,active,created_by,criado_em,atualizado_em
       FROM dev_notes ORDER BY criado_em DESC LIMIT 100`;
  const [rows] = await db.execute(sql);
  return rows;
}

async function createDevNote(data, author) {
  const title = String(data.title || '').trim();
  const body = String(data.body || '').trim();
  const audience = ['admin', 'all'].includes(String(data.audience || '').toLowerCase())
    ? String(data.audience || '').toLowerCase()
    : 'admin';
  if (!title || !body) throw new Error('Título e conteúdo são obrigatórios.');
  const [result] = await db.execute(
    `INSERT INTO dev_notes (title,body,audience,active,created_by)
     VALUES (?,?,?,?,?)`,
    [title, body, audience, 1, author || 'developer']
  );
  const [rows] = await db.execute('SELECT * FROM dev_notes WHERE id=? LIMIT 1', [result.insertId]);
  return rows[0];
}

async function updateDevNote(noteId, data) {
  const [exists] = await db.execute('SELECT id FROM dev_notes WHERE id=? LIMIT 1', [noteId]);
  if (!exists.length) throw new Error('Notificação não encontrada.');
  const fields = [];
  const values = [];
  if (data.title != null) {
    fields.push('title=?');
    values.push(String(data.title || '').trim());
  }
  if (data.body != null) {
    fields.push('body=?');
    values.push(String(data.body || '').trim());
  }
  if (data.audience != null) {
    fields.push('audience=?');
    values.push(['admin', 'all'].includes(String(data.audience).toLowerCase()) ? String(data.audience).toLowerCase() : 'admin');
  }
  if (data.active != null) {
    fields.push('active=?');
    values.push(data.active ? 1 : 0);
  }
  if (!fields.length) return;
  values.push(noteId);
  await db.execute(`UPDATE dev_notes SET ${fields.join(',')} WHERE id=?`, values);
}

async function deleteDevNote(noteId) {
  await db.execute('DELETE FROM dev_notes WHERE id=?', [noteId]);
}

async function listLoginLogs(limit = 80, failedOnly = false) {
  const where = failedOnly ? 'WHERE sucesso=0' : '';
  const [rows] = await db.execute(
    `SELECT id,cliente_id,user_input,nome,sucesso,ip,user_agent,criado_em
     FROM login_logs
     ${where}
     ORDER BY criado_em DESC
     LIMIT ?`,
    [Math.max(1, Math.min(200, Number(limit) || 80))]
  );
  return rows;
}

async function listErrorLogs(limit = 80) {
  const [rows] = await db.execute(
    `SELECT id,scope,message,details,criado_em
     FROM error_logs
     ORDER BY criado_em DESC
     LIMIT ?`,
    [Math.max(1, Math.min(200, Number(limit) || 80))]
  );
  return rows;
}

async function getDeveloperSummary() {
  const [[clientsRow]] = await db.execute('SELECT COUNT(*) AS total FROM clientes');
  const [[ordersRow]] = await db.execute('SELECT COUNT(*) AS total FROM encomendas');
  const [[notesRow]] = await db.execute('SELECT COUNT(*) AS total FROM dev_notes WHERE active=1');
  const [[failedRow]] = await db.execute('SELECT COUNT(*) AS total FROM login_logs WHERE sucesso=0 AND criado_em >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
  const [[loginsRow]] = await db.execute('SELECT COUNT(*) AS total FROM login_logs WHERE criado_em >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
  return {
    clientes: Number(clientsRow.total || 0),
    encomendas: Number(ordersRow.total || 0),
    notificacoesAtivas: Number(notesRow.total || 0),
    falhasLogin7d: Number(failedRow.total || 0),
    logins7d: Number(loginsRow.total || 0),
    sessoesAtivas: sessions.size,
    smtpReady: !!smtpStatus.ready,
    smtpMessage: smtpStatus.message || ''
  };
}

async function listRecentOrders(limit = 10) {
  const [rows] = await db.execute(
    `SELECT e.id,e.cliente_id,e.cliente_nome,e.cliente_nif,e.total,e.unidades,e.linhas,e.notas,e.criado_em,
            c.email AS cliente_email,c.telefone AS cliente_telefone
     FROM encomendas e
     LEFT JOIN clientes c ON c.id = e.cliente_id
     ORDER BY e.criado_em DESC
     LIMIT ?`,
    [Math.max(1, Math.min(50, Number(limit) || 10))]
  );
  return rows.map(mapOrderRow);
}

function parseArrayField(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function normalizeQtyStep(value, fallbackType) {
  const num = parseInt(value, 10);
  if (Number.isInteger(num) && num > 0) return num;
  return String(fallbackType || '').toLowerCase().includes('pack') ? 1 : 12;
}

function normalizeSeason(value) {
  const season = String(value || 'ambos').toLowerCase();
  return ['inverno', 'verao', 'ambos'].includes(season) ? season : 'ambos';
}

function mapProductRow(row) {
  return {
    ref: row.ref,
    name: row.nome,
    type: row.tipo || '',
    cat: row.cat,
    price: Number(row.preco),
    pvp: row.pvp == null ? null : Number(row.pvp),
    cores: parseArrayField(row.cores),
    tams: parseArrayField(row.tams),
    qtdStep: normalizeQtyStep(row.qtd_step, row.tipo),
    img: row.imagem || '',
    active: !!row.activo,
    season: normalizeSeason(row.estacao)
  };
}

function mapCategoryRow(row) {
  return {
    id: row.id,
    label: row.label,
    ordem: Number(row.ordem || 0),
    active: !!row.activo
  };
}

async function listCategories(includeInactive = false) {
  const sql = includeInactive
    ? 'SELECT id,label,ordem,activo FROM categorias ORDER BY ordem ASC, label ASC'
    : 'SELECT id,label,ordem,activo FROM categorias WHERE activo=1 ORDER BY ordem ASC, label ASC';
  const [rows] = await db.execute(sql);
  return rows.map(mapCategoryRow);
}

async function listProducts(includeInactive = false) {
  const sql = includeInactive
    ? 'SELECT ref,nome,tipo,cat,preco,pvp,cores,tams,qtd_step,imagem,ordem,activo,estacao FROM produtos ORDER BY ordem ASC, ref ASC'
    : `SELECT p.ref,p.nome,p.tipo,p.cat,p.preco,p.pvp,p.cores,p.tams,p.qtd_step,p.imagem,p.ordem,p.activo,p.estacao
       FROM produtos p
       INNER JOIN categorias c ON c.id = p.cat
       WHERE p.activo=1 AND c.activo=1
       ORDER BY p.ordem ASC, p.ref ASC`;
  const [rows] = await db.execute(sql);
  return rows.map(mapProductRow);
}

async function upsertProduct(ref, data) {
  await ensureCategoryExists(data.cat);
  await db.execute(
    `INSERT INTO produtos (ref,nome,tipo,cat,preco,pvp,cores,tams,qtd_step,imagem,ordem,activo,estacao)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
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
       activo=VALUES(activo),
       estacao=VALUES(estacao)`,
    [
      ref,
      data.nome,
      data.tipo || '',
      data.cat,
      data.preco,
      data.pvp == null ? null : data.pvp,
      JSON.stringify(data.cores || []),
      JSON.stringify(data.tams || []),
      normalizeQtyStep(data.qtd_step, data.tipo),
      data.imagem || null,
      Number.isInteger(data.ordem) ? data.ordem : 0,
      data.activo ? 1 : 0,
      normalizeSeason(data.estacao)
    ]
  );
}

function slugifyCategory(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .trim();
}

async function ensureCategoryExists(catId) {
  if (!catId) throw new Error('Categoria invalida');
  const [rows] = await db.execute('SELECT id FROM categorias WHERE id=? LIMIT 1', [catId]);
  if (!rows.length) throw new Error('Categoria invalida');
}

async function createCategory(data) {
  const label = String(data.label || '').trim();
  if (!label) throw new Error('Nome da categoria obrigatorio');
  const id = slugifyCategory(data.id || label);
  if (!id) throw new Error('ID de categoria invalido');

  const [exists] = await db.execute('SELECT id FROM categorias WHERE id=? LIMIT 1', [id]);
  if (exists.length) {
    const err = new Error('Ja existe uma categoria com esse nome');
    err.code = 'DUPLICATE_CATEGORY';
    throw err;
  }

  const [orderRows] = await db.execute('SELECT COALESCE(MAX(ordem), -1) AS max_ordem FROM categorias');
  const ordem = Number(orderRows[0]?.max_ordem || 0) + 1;

  await db.execute(
    'INSERT INTO categorias (id,label,ordem,activo) VALUES (?,?,?,1)',
    [id, label, ordem]
  );
  return { id, label, ordem, active: true };
}

async function deleteCategory(catId) {
  const [rows] = await db.execute('SELECT id FROM categorias WHERE id=? LIMIT 1', [catId]);
  if (!rows.length) {
    const err = new Error('Categoria nao encontrada');
    err.code = 'CATEGORY_NOT_FOUND';
    throw err;
  }

  const [productRows] = await db.execute('SELECT COUNT(*) AS total FROM produtos WHERE cat=?', [catId]);
  if (Number(productRows[0]?.total || 0) > 0) {
    const err = new Error('Nao podes apagar uma categoria que ainda tem produtos');
    err.code = 'CATEGORY_HAS_PRODUCTS';
    throw err;
  }

  await db.execute('DELETE FROM categorias WHERE id=?', [catId]);
}

async function updateCategory(catId, data) {
  const [rows] = await db.execute('SELECT id,label,ordem,activo FROM categorias WHERE id=? LIMIT 1', [catId]);
  if (!rows.length) {
    const err = new Error('Categoria nao encontrada');
    err.code = 'CATEGORY_NOT_FOUND';
    throw err;
  }

  const current = rows[0];
  const nextLabel = String(data.label || current.label || '').trim();
  if (!nextLabel) {
    const err = new Error('Nome da categoria obrigatorio');
    err.code = 'INVALID_CATEGORY';
    throw err;
  }

  const nextActive = data.activo === false ? 0 : 1;
  await db.execute(
    'UPDATE categorias SET label=?, activo=? WHERE id=?',
    [nextLabel, nextActive, catId]
  );
  await db.execute('UPDATE produtos SET activo=? WHERE cat=?', [nextActive ? 1 : 0, catId]);
  return {
    id: current.id,
    label: nextLabel,
    ordem: Number(current.ordem || 0),
    active: !!nextActive
  };
}

async function reorderCategories(order) {
  if (!Array.isArray(order) || !order.length) {
    const err = new Error('Ordem de categorias invalida');
    err.code = 'INVALID_CATEGORY_ORDER';
    throw err;
  }

  for (let i = 0; i < order.length; i++) {
    await db.execute('UPDATE categorias SET ordem=? WHERE id=?', [i, order[i]]);
  }
}

async function applySeasonMode(mode) {
  const normalized = String(mode || '').toLowerCase();
  if (normalized === 'verao') {
    await db.execute(
      "UPDATE produtos SET activo = CASE WHEN COALESCE(estacao,'ambos')='inverno' THEN 0 ELSE 1 END"
    );
    await setSiteSetting('collection_mode', 'verao');
    return 'verao';
  }
  if (normalized === 'inverno') {
    await db.execute(
      "UPDATE produtos SET activo = CASE WHEN COALESCE(estacao,'ambos')='verao' THEN 0 ELSE 1 END"
    );
    await setSiteSetting('collection_mode', 'inverno');
    return 'inverno';
  }
  if (normalized === 'todos') {
    await db.execute("UPDATE produtos SET activo = 1");
    await setSiteSetting('collection_mode', 'todos');
    return 'todos';
  }
  throw new Error('Modo de colecao invalido');
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.css': return 'text/css; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    case '.gif': return 'image/gif';
    case '.ico': return 'image/x-icon';
    default: return 'application/octet-stream';
  }
}

function serveStaticFile(res, filePath) {
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Ficheiro não encontrado');
      return true;
    }
    const file = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': getMimeType(filePath),
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(file);
    return true;
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Erro ao servir ficheiro');
    return true;
  }
}
async function handleRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Token, X-Client-Id');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  let body = '';
  await new Promise(r => { req.on('data', c => body += c); req.on('end', r); });
  let data = {};
  try { if (body) data = JSON.parse(body); } catch(e) {}

  const requestUrl = new URL(req.url, 'http://localhost');
  const url = requestUrl.pathname;

    if (req.method === 'GET' && (url.startsWith('/styles/') || url.startsWith('/js/'))) {
    const relativePath = url.replace(/^\//, '');
    const filePath = path.join(__dirname, relativePath);
    if (!filePath.startsWith(__dirname)) {
      res.writeHead(403, { 'Content-Type':'text/plain; charset=utf-8' });
      res.end('Acesso negado');
      return;
    }
    serveStaticFile(res, filePath);
    return;
  }
  // Servir app
  if (req.method === 'GET' && (url==='/'||url==='/index.html'||url==='/catalogo'||url==='/entrar'||url==='/admin')) {
    try {
      const html = fs.readFileSync(CONFIG.appFile, 'utf8');
      res.writeHead(200, {
        'Content-Type':'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(html);
    } catch(e) { res.writeHead(404); res.end('App não encontrada'); }
    return;
  }

  if (req.method === 'GET' && url === '/produtos') {
    const categorias = await listCategories();
    const produtos = await listProducts();
    return sendJSON(res, 200, {
      ok:true,
      categorias,
      produtos,
      collectionMode: getCollectionModeSetting()
    });
  }

  if (req.method === 'GET' && url === '/site-settings') {
    return sendJSON(res, 200, {
      ok:true,
      ...getPublicSiteSettings(),
      smtpReady: !!smtpStatus.ready,
      smtpMessage: smtpStatus.message || ''
    });
  }

  if (req.method === 'GET' && url === '/me') {
    const session = requireSession(req, false);
    const client = await getClientById(session.id);
    if (!client) {
      return sendJSON(res, 404, { ok:false, message:'Cliente não encontrado' });
    }
    return sendJSON(res, 200, {
      ok:true,
      id: client.id,
      nome: client.nome,
      nif: client.nif || '',
      email: client.email || '',
      telefone: client.telefone || '',
      admin: !!client.admin,
      developer: !!client.developer,
      token: session.token
    });
  }

  if (req.method === 'POST' && url === '/logout') {
    const session = getSessionFromReq(req);
    if (session) {
      sessions.delete(session.token);
      await db.execute('DELETE FROM sessions WHERE token=?', [session.token]).catch(function(){});
    }
    res.setHeader('Set-Cookie', buildClearedSessionCookie());
    return sendJSON(res, 200, { ok:true });
  }

  // Login
  if (req.method==='POST' && url==='/login') {
    const [rows] = await db.execute(
      'SELECT id,nome,nif,email,telefone,admin,developer FROM clientes WHERE user=? AND pass=? AND activo=1',
      [data.user, data.pass]
    );
    if (!rows.length) {
      await logLoginAttempt(req, { user: data.user, success: false });
      return sendJSON(res, 401, { ok:false, message:'Utilizador ou password incorrectos' });
    }
    await db.execute('UPDATE clientes SET ultimo_login=NOW() WHERE id=?', [rows[0].id]);
    await logLoginAttempt(req, { user: data.user, clienteId: rows[0].id, nome: rows[0].nome, success: true });
    const token = await createSession(rows[0]);
    res.setHeader('Set-Cookie', buildSessionCookie(token, SESSION_TTL_MS / 1000));
    return sendJSON(res, 200, {
      ok:true,
      id:rows[0].id,
      nome:rows[0].nome,
      nif:rows[0].nif,
      email: rows[0].email || '',
      telefone: rows[0].telefone || '',
      admin:!!rows[0].admin,
      developer:!!rows[0].developer,
      token
    });
  }

  // Receber encomenda
  if (req.method==='POST' && url==='/encomenda') {
    try {
      const session = requireSession(req, false);
      const eid = await saveOrder(session.id, data);
      await sendEmail(data);
      await clearCartState(session.id).catch(function() {});
      return sendJSON(res, 200, { ok:true, encId:eid, message:'Encomenda enviada com sucesso!' });
    } catch(e) {
      if (e.code === 'INVALID_CLIENT') {
        return sendJSON(res, 401, { ok:false, message:e.message });
      }
      if (e.code === 'UNAUTHORIZED') {
        return sendJSON(res, 401, { ok:false, message:e.message });
      }
      if (e.code === 'MIN_ORDER_TOTAL') {
        return sendJSON(res, 400, { ok:false, message:e.message });
      }
      return sendJSON(res, 500, { ok:false, message:e.message });
    }
  }

  if (req.method==='GET' && url==='/me/encomendas') {
    const session = requireSession(req, false);
    const encomendas = await listClientOrders(session.id);
    return sendJSON(res, 200, { ok:true, encomendas });
  }

  if (req.method === 'GET' && url === '/me/cart') {
    const session = requireSession(req, false);
    const cart = await getCartState(session.id);
    return sendJSON(res, 200, { ok:true, cart });
  }

  if (req.method === 'PUT' && url === '/me/cart') {
    const session = requireSession(req, false);
    const cart = normalizeCartPayload(Array.isArray(data.cart) ? data.cart : (Array.isArray(data.items) ? data.items : []));
    await saveCartState(session.id, cart);
    return sendJSON(res, 200, { ok:true, cart });
  }

  if (req.method === 'DELETE' && url === '/me/cart') {
    const session = requireSession(req, false);
    await clearCartState(session.id);
    return sendJSON(res, 200, { ok:true, cart:[] });
  }

  const myOrderMatch = url.match(/^\/me\/encomendas\/(\d+)$/);
  if (req.method==='GET' && myOrderMatch) {
    const session = requireSession(req, false);
    const encomenda = await getOrderById(parseInt(myOrderMatch[1], 10), { clientId: session.id, allowAdmin: false });
    if (!encomenda) return sendJSON(res, 404, { ok:false, message:'Encomenda não encontrada' });
    return sendJSON(res, 200, { ok:true, encomenda });
  }

  const reorderMatch = url.match(/^\/me\/encomendas\/(\d+)\/reencomendar$/);
  if (req.method==='POST' && reorderMatch) {
    const session = requireSession(req, false);
    const encomenda = await getOrderById(parseInt(reorderMatch[1], 10), { clientId: session.id, allowAdmin: false });
    if (!encomenda) return sendJSON(res, 404, { ok:false, message:'Encomenda não encontrada' });
    return sendJSON(res, 200, {
      ok:true,
      encomenda: {
        id: encomenda.id,
        client: encomenda.client,
        nif: encomenda.nif,
        notes: encomenda.notes,
        items: encomenda.items || []
      }
    });
  }

  const pdfMatch = url.match(/^\/encomendas\/(\d+)\/pdf$/);
  if (req.method === 'GET' && pdfMatch) {
    const session = requireSession(req, false);
    const orderId = parseInt(pdfMatch[1], 10);
    const encomenda = await getOrderById(orderId, {
      clientId: (session.admin || session.developer) ? null : session.id,
      allowAdmin: !!(session.admin || session.developer)
    });
    if (!encomenda) {
      res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' });
      res.end('Encomenda não encontrada');
      return;
    }
    const mode = requestUrl.searchParams.get('mode') || 'normal';
    const hidePrices = mode === 'sem_precos';
    const pdf = await generatePDF(buildOrderHTML(encomenda, { hidePrices }));
    if (!pdf) {
      res.writeHead(500, { 'Content-Type':'text/plain; charset=utf-8' });
      res.end('PDF não disponível');
      return;
    }
    const safeName = (encomenda.client || 'cliente').replace(/[^\w.-]+/g, '_');
    const suffix = hidePrices ? '_sem_precos' : '';
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="encomenda_${safeName}_${orderId}${suffix}.pdf"`
    });
    res.end(pdf);
    return;
  }

  // Admin â€” listar clientes
  if (req.method==='GET' && url==='/admin/produtos') {
    requireSession(req, true);
    const categorias = await listCategories(true);
    const produtos = await listProducts(true);
    return sendJSON(res, 200, {
      ok:true,
      categorias,
      produtos,
      collectionMode: getCollectionModeSetting()
    });
  }

  if (req.method==='POST' && url==='/admin/produtos') {
    requireSession(req, true);
    if (!data.ref || !data.nome || !data.cat || !Number.isFinite(Number(data.preco))) {
      return sendJSON(res,400,{ok:false,message:'ref, nome, cat e preco sao obrigatorios'});
    }
    await upsertProduct(data.ref, {
      nome: data.nome,
      tipo: data.tipo || '',
      cat: data.cat,
      preco: Number(data.preco),
      pvp: data.pvp == null || data.pvp === '' ? null : Number(data.pvp),
      cores: parseArrayField(data.cores),
      tams: parseArrayField(data.tams),
      qtd_step: normalizeQtyStep(data.qtd_step, data.tipo),
      imagem: data.imagem || '',
      ordem: Number.isInteger(data.ordem) ? data.ordem : 999999,
      activo: data.activo !== false,
      estacao: normalizeSeason(data.estacao)
    });
    return sendJSON(res, 200, { ok:true });
  }

  if (req.method==='POST' && url==='/admin/produtos/colecao') {
    requireSession(req, true);
    try {
      const modo = await applySeasonMode(data.modo);
      return sendJSON(res, 200, { ok:true, modo });
    } catch (e) {
      return sendJSON(res, 400, { ok:false, message:e.message });
    }
  }

  if (req.method==='GET' && url==='/admin/produtos/colecao') {
    requireSession(req, true);
    return sendJSON(res, 200, {
      ok:true,
      modo: getCollectionModeSetting()
    });
  }

  if (req.method==='GET' && url==='/admin/site-settings') {
    requireSession(req, true);
    return sendJSON(res, 200, {
      ok:true,
      ...getPublicSiteSettings()
    });
  }

  if (req.method==='PUT' && url==='/admin/site-settings') {
    requireSession(req, true);
    if (data.showInactiveProducts != null) {
      await setSiteSetting('show_inactive_products', data.showInactiveProducts ? '1' : '0');
    }
    if (data.collectionMode != null) {
      const mode = await applySeasonMode(data.collectionMode);
      return sendJSON(res, 200, { ok:true, mode, ...getPublicSiteSettings() });
    }
    return sendJSON(res, 200, { ok:true, ...getPublicSiteSettings() });
  }

  const prodM = url.match(/^\/admin\/produtos\/([^/]+)$/);
  if (req.method==='PUT' && prodM) {
    requireSession(req, true);
    const oldRef = decodeURIComponent(prodM[1]);
    const newRef = data.ref || oldRef;
    if (!newRef || !data.nome || !data.cat || !Number.isFinite(Number(data.preco))) {
      return sendJSON(res,400,{ok:false,message:'Dados do produto invalidos'});
    }
    if (newRef !== oldRef) {
      await db.execute('DELETE FROM produtos WHERE ref=?', [oldRef]);
    }
    await upsertProduct(newRef, {
      nome: data.nome,
      tipo: data.tipo || '',
      cat: data.cat,
      preco: Number(data.preco),
      pvp: data.pvp == null || data.pvp === '' ? null : Number(data.pvp),
      cores: parseArrayField(data.cores),
      tams: parseArrayField(data.tams),
      qtd_step: normalizeQtyStep(data.qtd_step, data.tipo),
      imagem: data.imagem || '',
      ordem: Number.isInteger(data.ordem) ? data.ordem : 999999,
      activo: data.activo !== false,
      estacao: normalizeSeason(data.estacao)
    });
    return sendJSON(res, 200, { ok:true, ref:newRef });
  }

  if (req.method==='DELETE' && prodM) {
    requireSession(req, true);
    await db.execute('DELETE FROM produtos WHERE ref=?', [decodeURIComponent(prodM[1])]);
    return sendJSON(res, 200, { ok:true });
  }

  if (req.method==='GET' && url==='/admin/categorias') {
    requireSession(req, true);
    const categorias = await listCategories(true);
    return sendJSON(res, 200, { ok:true, categorias });
  }

  if (req.method==='POST' && url==='/admin/categorias') {
    requireSession(req, true);
    try {
      const categoria = await createCategory(data);
      return sendJSON(res, 200, { ok:true, categoria });
    } catch (e) {
      const code = e.code === 'DUPLICATE_CATEGORY' ? 400 : 500;
      return sendJSON(res, code, { ok:false, message:e.message });
    }
  }

  if (req.method==='POST' && url==='/admin/categorias/ordem') {
    requireSession(req, true);
    try {
      await reorderCategories(data.ordem);
      return sendJSON(res, 200, { ok:true });
    } catch (e) {
      const code = e.code === 'INVALID_CATEGORY_ORDER' ? 400 : 500;
      return sendJSON(res, code, { ok:false, message:e.message });
    }
  }

  const catM = url.match(/^\/admin\/categorias\/([^/]+)$/);
  if (req.method==='PUT' && catM) {
    requireSession(req, true);
    try {
      const categoria = await updateCategory(decodeURIComponent(catM[1]), data);
      return sendJSON(res, 200, { ok:true, categoria });
    } catch (e) {
      const code = (e.code === 'CATEGORY_NOT_FOUND' || e.code === 'INVALID_CATEGORY') ? 400 : 500;
      return sendJSON(res, code, { ok:false, message:e.message });
    }
  }

  if (req.method==='DELETE' && catM) {
    requireSession(req, true);
    try {
      await deleteCategory(decodeURIComponent(catM[1]));
      return sendJSON(res, 200, { ok:true });
    } catch (e) {
      const code = (e.code === 'CATEGORY_NOT_FOUND' || e.code === 'CATEGORY_HAS_PRODUCTS') ? 400 : 500;
      return sendJSON(res, code, { ok:false, message:e.message });
    }
  }

  if (req.method==='GET' && url==='/admin/clientes') {
    requireSession(req, true);
    const [rows] = await db.execute(
      `SELECT c.id,c.user,c.pass,c.nome,c.nif,c.email,c.telefone,c.admin,c.activo,c.criado_em,c.ultimo_login,
              COUNT(e.id) AS total_encomendas
       FROM clientes c
       LEFT JOIN encomendas e ON e.cliente_id = c.id
       WHERE COALESCE(c.developer,0)=0
       GROUP BY c.id,c.user,c.pass,c.nome,c.nif,c.email,c.telefone,c.admin,c.activo,c.criado_em,c.ultimo_login
       ORDER BY c.nome`
    );
    return sendJSON(res, 200, { ok:true, clientes:rows });
  }

  // Admin â€” criar cliente
  if (req.method==='POST' && url==='/admin/clientes') {
    requireSession(req, true);
    if (!data.user||!data.pass||!data.nome) return sendJSON(res,400,{ok:false,message:'user, pass e nome são obrigatórios'});
    try {
      const [r] = await db.execute(
        'INSERT INTO clientes (user,pass,nome,nif,email,telefone) VALUES (?,?,?,?,?,?)',
        [data.user.toLowerCase(), data.pass, data.nome, data.nif||'', data.email||'', data.telefone||'']
      );
      if (data.email) {
        try {
          const welcome = buildNewClientWelcomeEmail({
            user: data.user.toLowerCase(),
            pass: data.pass,
            nome: data.nome
          });
          await sendClientEmail({
            to: data.email,
            subject: welcome.subject,
            message: welcome.message,
            html: welcome.html
          });
        } catch (emailErr) {
          console.log(`Aviso email novo cliente: ${emailErr.message}`);
        }
      }
      return sendJSON(res, 200, { ok:true, id:r.insertId });
    } catch(e) {
      if (e.code==='ER_DUP_ENTRY') return sendJSON(res,400,{ok:false,message:'Utilizador já existe'});
      return sendJSON(res, 500, { ok:false, message:e.message });
    }
  }

  // Admin â€” editar cliente
  const editM = url.match(/^\/admin\/clientes\/(\d+)$/);
  if (req.method==='PUT' && editM) {
    requireSession(req, true);
    const [lockedRows] = await db.execute('SELECT developer FROM clientes WHERE id=? LIMIT 1', [parseInt(editM[1])]);
    if (lockedRows[0]?.developer) return sendJSON(res,400,{ok:false,message:'Não é possível editar esta conta'});
    await db.execute(
      'UPDATE clientes SET pass=?,nome=?,nif=?,email=?,telefone=?,activo=? WHERE id=?',
      [data.pass,data.nome,data.nif||'',data.email||'',data.telefone||'',data.activo?1:0,parseInt(editM[1])]
    );
    return sendJSON(res, 200, { ok:true });
  }

  // Admin â€” apagar cliente
  const delM = url.match(/^\/admin\/clientes\/(\d+)$/);
  if (req.method==='DELETE' && delM) {
    requireSession(req, true);
    const id = parseInt(delM[1]);
    const [rows] = await db.execute('SELECT admin,developer FROM clientes WHERE id=?',[id]);
    if (rows[0]?.admin) return sendJSON(res,400,{ok:false,message:'Não é possível apagar o admin'});
    if (rows[0]?.developer) return sendJSON(res,400,{ok:false,message:'Não é possível apagar esta conta'});
    await db.execute('DELETE FROM clientes WHERE id=?',[id]);
    return sendJSON(res, 200, { ok:true });
  }

  const clientOrdersMatch = url.match(/^\/admin\/clientes\/(\d+)\/encomendas$/);
  if (req.method==='GET' && clientOrdersMatch) {
    requireSession(req, true);
    const encomendas = await listClientOrders(parseInt(clientOrdersMatch[1], 10));
    return sendJSON(res, 200, { ok:true, encomendas });
  }

  // Admin â€” histórico encomendas (todas)
  if (req.method==='GET' && url==='/admin/encomendas') {
    requireSession(req, true);
    const encomendas = await listAllOrders();
    return sendJSON(res, 200, { ok:true, encomendas });
  }

  if (req.method==='GET' && url==='/admin/notificacoes') {
    requireSession(req, true);
    const notes = await listDevNotes(true);
    return sendJSON(res, 200, {
      ok:true,
      notificacoes: notes.filter((note) => note.audience === 'admin' || note.audience === 'all')
    });
  }

  if (req.method==='GET' && url==='/admin/email-config') {
    requireSession(req, true);
    return sendJSON(res, 200, {
      ok:true,
      config: getPublicSmtpConfig(),
      status: smtpStatus
    });
  }

  if (req.method==='PUT' && url==='/admin/email-config') {
    requireSession(req, true);
    try {
      const result = await updateEmailConfig(data || {});
      return sendJSON(res, 200, {
        ok:true,
        config: result.config,
        status: result.status,
        message:'Configuração SMTP atualizada.'
      });
    } catch (e) {
      return sendJSON(res, 400, { ok:false, message:e.message });
    }
  }

  const orderDetailMatch = url.match(/^\/admin\/encomendas\/(\d+)$/);
  if (req.method==='GET' && orderDetailMatch) {
    requireSession(req, true);
    const encomenda = await getOrderById(parseInt(orderDetailMatch[1], 10), { allowAdmin: true });
    if (!encomenda) return sendJSON(res, 404, { ok:false, message:'Encomenda não encontrada' });
    return sendJSON(res, 200, { ok:true, encomenda });
  }

  if (req.method==='DELETE' && orderDetailMatch) {
    requireSession(req, true);
    const orderId = parseInt(orderDetailMatch[1], 10);
    const [found] = await db.execute('SELECT id FROM encomendas WHERE id=? LIMIT 1', [orderId]);
    if (!found.length) return sendJSON(res, 404, { ok:false, message:'Encomenda não encontrada' });
    await db.execute('DELETE FROM encomendas WHERE id=?', [orderId]);
    return sendJSON(res, 200, { ok:true });
  }

  if (req.method==='GET' && url==='/dev/summary') {
    requireDeveloperSession(req);
    const summary = await getDeveloperSummary();
    return sendJSON(res, 200, { ok:true, summary });
  }

  if (req.method==='GET' && url==='/dev/status') {
    requireDeveloperSession(req);
    return sendJSON(res, 200, {
      ok:true,
      status: {
        smtpReady: !!smtpStatus.ready,
        smtpMessage: smtpStatus.message || '',
        sessoesAtivas: sessions.size,
        servidor: 'online'
      }
    });
  }

  if (req.method==='GET' && url==='/dev/notes') {
    requireDeveloperSession(req);
    const notes = await listDevNotes(false);
    return sendJSON(res, 200, { ok:true, notes });
  }

  if (req.method==='POST' && url==='/dev/notes') {
    const session = requireDeveloperSession(req);
    const note = await createDevNote(data, `dev#${session.id}`);
    return sendJSON(res, 200, { ok:true, note });
  }

  const devNoteMatch = url.match(/^\/dev\/notes\/(\d+)$/);
  if (req.method==='PUT' && devNoteMatch) {
    requireDeveloperSession(req);
    await updateDevNote(parseInt(devNoteMatch[1], 10), data || {});
    return sendJSON(res, 200, { ok:true });
  }

  if (req.method==='DELETE' && devNoteMatch) {
    requireDeveloperSession(req);
    await deleteDevNote(parseInt(devNoteMatch[1], 10));
    return sendJSON(res, 200, { ok:true });
  }

  if (req.method==='GET' && url==='/dev/logins') {
    requireDeveloperSession(req);
    const onlyFailed = requestUrl.searchParams.get('failed') === '1';
    const logs = await listLoginLogs(requestUrl.searchParams.get('limit'), onlyFailed);
    return sendJSON(res, 200, { ok:true, logs });
  }

  if (req.method==='GET' && url==='/dev/encomendas-recentes') {
    requireDeveloperSession(req);
    const encomendas = await listRecentOrders(requestUrl.searchParams.get('limit'));
    return sendJSON(res, 200, { ok:true, encomendas });
  }

  if (req.method==='POST' && url==='/dev/sessions/clear') {
    const session = requireDeveloperSession(req);
    const keepToken = session.token;
    Array.from(sessions.keys()).forEach((token) => {
      if (token !== keepToken) sessions.delete(token);
    });
    return sendJSON(res, 200, { ok:true });
  }

  if (req.method==='GET' && url==='/dev/errors') {
    requireDeveloperSession(req);
    const logs = await listErrorLogs(requestUrl.searchParams.get('limit'));
    return sendJSON(res, 200, { ok:true, logs });
  }

  res.writeHead(404); res.end('Not found');
}

const server = http.createServer(async (req, res) => {
  try { await handleRequest(req, res); }
  catch(e) {
    logError('request', e, `${req.method} ${req.url}`);
    console.error('Erro:', e.message);
    if (!res.headersSent) {
      if (e.code === 'UNAUTHORIZED') return sendJSON(res, 401, { ok:false, message:e.message });
      if (e.code === 'FORBIDDEN') return sendJSON(res, 403, { ok:false, message:e.message });
      sendJSON(res, 500, { ok:false, message:'Erro interno' });
    }
  }
});

connectDB().then(() => {
  refreshEmailTransport().finally(() => {
    server.listen(CONFIG.port, () => {
    console.log(`Servidor Villas na porta ${CONFIG.port}`);
    console.log(`App: http://localhost:${CONFIG.port}`);
    });
  });
}).catch(e => { console.error('Erro BD:', e.message); process.exit(1); });









