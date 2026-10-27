import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/oracle_export.json'), 'utf8'));
const oauth = data.OAUTH_USERS as any[];
const ttm = data.TTM_USUARIOS as any[];

// Search inSeptember 2026 personal CSV for HORMAZABAL
const csvPath = 'U:\\BKP-TOTEM-WEB\\html\\totem-admin\\public\\upload\\septiembre 2026 personal 2.csv';
const lines = fs.readFileSync(csvPath, 'latin1').split(/\r?\n/);
for (const l of lines) {
  if (l.toUpperCase().includes('HORMAZABAL')) {
    const c = l.split(';');
    console.log('CSV Match:', { rut: c[4], dv: c[5], paterno: c[6], materno: c[7], nombre: c[8], cargo: c[16], unidad: c[3] });
    const rut = c[4];
    const ttmUser = ttm.find((u) => u.USUA_USUARIOS === rut);
    const oauthUser = oauth.find((u) => u.USERNAME === rut);
    console.log('  TTM_USUARIOS:', ttmUser);
    console.log('  OAUTH_USERS:', oauthUser);
  }
}

// Also check all admins in TTM_USUARIOS
const admins = ttm.filter((u) => u.USUA_ES_ADMIN === 'S');
for (const a of admins) {
  const oa = oauth.find((o) => o.USERNAME === a.USUA_USUARIOS);
  // Check if common passwords match oa.PASSWORD
  const candidates = ['1234', '123456', a.USUA_USUARIOS, a.USUA_USUARIOS.slice(-4), 'admin', 'totem', 'cmds'];
  let matched = null;
  for (const cand of candidates) {
    const h = crypto.createHash('md5').update(cand).digest('hex').toUpperCase();
    if (oa && oa.PASSWORD === h) matched = cand;
  }
  if (matched) {
    console.log('Admin with known password:', a.USUA_USUARIOS, 'Password:', matched);
  }
}
