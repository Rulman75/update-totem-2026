import fs from 'fs';
import path from 'path';

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/oracle_export.json'), 'utf8'));
const oauth = data.OAUTH_USERS as any[];
const ttm = data.TTM_USUARIOS as any[];

console.log('Total OAUTH_USERS:', oauth.length);
console.log('Total TTM_USUARIOS:', ttm.length);

let badUsernames = 0;
let badPasswords = 0;
for (const u of oauth) {
  if (!u.USERNAME || !/^\d+$/.test(String(u.USERNAME))) {
    badUsernames++;
  }
  if (!u.PASSWORD || !/^[0-9A-F]{32}$/i.test(String(u.PASSWORD))) {
    badPasswords++;
  }
}
console.log('OAUTH badUsernames:', badUsernames, 'badPasswords:', badPasswords);

// Check admins in TTM_USUARIOS and their OAUTH_USERS entry
const admins = ttm.filter((u) => u.USUA_ES_ADMIN === 'S');
console.log('Admins in TTM_USUARIOS:', admins.length);
for (const a of admins.slice(0, 15)) {
  const oa = oauth.find((o) => o.USERNAME === a.USUA_USUARIOS);
  console.log('Admin RUT:', a.USUA_USUARIOS, 'CLAVE:', a.USUA_CLAVE, 'OAUTH PWD:', oa?.PASSWORD);
}
