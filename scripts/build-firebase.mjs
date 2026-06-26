import { cpSync, mkdirSync, rmSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(root, 'firebase-public');

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

console.log('Building game...');
execSync('npm run build', { cwd: root, stdio: 'inherit' });
cpSync(join(root, 'dist'), outputDir, { recursive: true });

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

console.log(`Firebase hosting bundle ready at ${outputDir}`);
