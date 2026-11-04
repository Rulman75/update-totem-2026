import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import pkg from './package.json';

function parseSemver(v: string): [number, number, number] {
  const clean = v.replace(/^v/i, '').split('-')[0];
  const parts = clean.split('.').map((n) => parseInt(n, 10) || 0);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function isGreaterSemver(a: string, b: string): boolean {
  const [aMaj, aMin, aPat] = parseSemver(a);
  const [bMaj, bMin, bPat] = parseSemver(b);
  if (aMaj !== bMaj) return aMaj > bMaj;
  if (aMin !== bMin) return aMin > bMin;
  return aPat > bPat;
}

function getGitInfo() {
  let commit = 'local';
  let tagVersion = pkg.version || '2.0.0';
  let date = new Date().toISOString().split('T')[0];

  try {
    commit = execSync('git rev-parse --short HEAD').toString().trim();
  } catch {}

  try {
    const rawDate = execSync('git log -1 --format=%cd --date=short').toString().trim();
    if (rawDate) date = rawDate;
  } catch {}

  try {
    const latestTag = execSync('git describe --tags --abbrev=0').toString().trim();
    if (latestTag) {
      const cleanTag = latestTag.replace(/^v/i, '');
      if (cleanTag && isGreaterSemver(cleanTag, tagVersion)) {
        tagVersion = cleanTag;
      }
    }
  } catch {}

  return { version: tagVersion, commit, date };
}

const gitInfo = getGitInfo();

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(gitInfo.version),
    __GIT_COMMIT__: JSON.stringify(gitInfo.commit),
    __BUILD_DATE__: JSON.stringify(gitInfo.date),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/assets': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
