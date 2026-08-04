import { cpSync, mkdirSync, rmSync, existsSync } from 'fs';
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

console.log('Building admin panel...');
execSync('npm run build', {
  cwd: join(root, 'frontend'),
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_BASE_PATH: '/admin/',
    VITE_API_URL: '/api',
  },
});
cpSync(join(root, 'frontend', 'dist'), join(outputDir, 'admin'), { recursive: true });

console.log(`Firebase Hosting bundle ready at ${outputDir}`);
console.log('Next: firebase deploy --only hosting  (or: npm run deploy)');
