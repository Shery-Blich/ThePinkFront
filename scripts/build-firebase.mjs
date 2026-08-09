import { cpSync, mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

/**
 * Build static site for Firebase Hosting (Node only — no Docker).
 *
 * Output: firebase-public/
 *   - game (Vite dist from root; public/ assets included by Vite)
 *   - admin under /admin
 *
 * Deploy:
 *   npm run deploy:hosting
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(root, 'firebase-public');
const publicAssetsDir = join(root, 'public', 'assets');
const legacyAssetsDir = join(root, 'assets');

/**
 * Read KEY=value pairs from a simple .env file (no export).
 * @param {string} filePath
 * @returns {Record<string, string>}
 */
function readEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  return Object.fromEntries(
    readFileSync(filePath, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const idx = line.indexOf('=');
        return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
      })
  );
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

console.log('Building game (Vite → dist, includes public/)...');
execSync('npm run build', { cwd: root, stdio: 'inherit' });
cpSync(join(root, 'dist'), outputDir, { recursive: true });

// Ensure Phaser /assets are present (Vite copies public/; also support leftover root assets/)
const assetsOut = join(outputDir, 'assets');
if (existsSync(publicAssetsDir)) {
  console.log('Merging public/assets into firebase-public/assets...');
  mkdirSync(assetsOut, { recursive: true });
  cpSync(publicAssetsDir, assetsOut, { recursive: true });
}
if (existsSync(legacyAssetsDir)) {
  console.log('Merging root assets/ into firebase-public/assets...');
  mkdirSync(assetsOut, { recursive: true });
  cpSync(legacyAssetsDir, assetsOut, { recursive: true });
}

const frontendEnv = readEnvFile(join(root, 'frontend', '.env'));
const auth0Domain = process.env.VITE_AUTH0_DOMAIN || frontendEnv.VITE_AUTH0_DOMAIN || '';
const auth0ClientId = process.env.VITE_AUTH0_CLIENT_ID || frontendEnv.VITE_AUTH0_CLIENT_ID || '';

if (!auth0Domain || !auth0ClientId) {
  console.warn(
    'Warning: VITE_AUTH0_DOMAIN / VITE_AUTH0_CLIENT_ID missing — admin build will show config error until set in frontend/.env'
  );
}

console.log('Building admin panel...');
execSync('npm run build', {
  cwd: join(root, 'frontend'),
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_BASE_PATH: '/admin/',
    VITE_API_URL: '/api',
    VITE_AUTH0_DOMAIN: auth0Domain,
    VITE_AUTH0_CLIENT_ID: auth0ClientId,
  },
});
cpSync(join(root, 'frontend', 'dist'), join(outputDir, 'admin'), { recursive: true });

console.log(`Firebase Hosting bundle ready at ${outputDir}`);
console.log('Next: firebase deploy --only hosting  (or: npm run deploy)');
