import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const type = process.argv[2] || 'patch'; // patch | minor | major
if (!['patch', 'minor', 'major'].includes(type)) {
  console.error('Uso: node scripts/bump-version.mjs [patch|minor|major]');
  process.exit(1);
}

const frontendPkgPath = path.join(rootDir, 'frontend', 'package.json');
const backendPkgPath = path.join(rootDir, 'backend', 'package.json');
const rootPkgPath = path.join(rootDir, 'package.json');

const frontendPkg = JSON.parse(fs.readFileSync(frontendPkgPath, 'utf8'));
const [maj, min, pat] = (frontendPkg.version || '2.0.0').split('.').map(Number);

let nextVersion = `${maj}.${min}.${pat + 1}`;
if (type === 'minor') nextVersion = `${maj}.${min + 1}.0`;
if (type === 'major') nextVersion = `${maj + 1}.0.0`;

for (const p of [frontendPkgPath, backendPkgPath, rootPkgPath]) {
  if (fs.existsSync(p)) {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    data.version = nextVersion;
    fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
}

console.log(`✔ Versión actualizada a v${nextVersion} en package.json (root, frontend, backend).`);

try {
  execSync(`git add package.json frontend/package.json backend/package.json`, {
    cwd: rootDir,
    stdio: 'inherit',
  });
  execSync(`git commit -m "chore(release): v${nextVersion}"`, {
    cwd: rootDir,
    stdio: 'inherit',
  });
  execSync(`git tag -a v${nextVersion} -m "Release v${nextVersion}"`, {
    cwd: rootDir,
    stdio: 'inherit',
  });
  console.log(`✔ Tag Git creado: v${nextVersion}`);
} catch (err) {
  console.warn('Nota: Archivos actualizados, verifique git status para confirmar commit/tag.');
}
