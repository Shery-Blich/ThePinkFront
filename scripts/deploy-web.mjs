import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, '.env.production');

if (!existsSync(envFile)) {
  console.error('Missing .env.production — copy .env.production.example and fill in values.');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(envFile, 'utf8')
    .split('\n')
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .map((line) => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

const {
  GCP_PROJECT_ID,
  GCP_REGION = 'me-west1',
} = env;

const required = { GCP_PROJECT_ID };
for (const [key, value] of Object.entries(required)) {
  if (!value) {
    console.error(`Missing required value in .env.production: ${key}`);
    process.exit(1);
  }
}

// Builds the root Dockerfile's last stage ("web" — nginx + game + admin).
// The Load Balancer routes /api/* straight to the backend Cloud Run service,
// so this container never needs to know the backend's URL.
const cmd = [
  'gcloud run deploy',
  'thepinkfront-web',
  '--source .',
  `--region ${GCP_REGION}`,
  `--project ${GCP_PROJECT_ID}`,
  '--allow-unauthenticated',
  '--port 80',
].join(' ');

console.log(`Deploying web (game + admin) to Cloud Run (thepinkfront-web, ${GCP_REGION})...`);
execSync(cmd, { cwd: root, stdio: 'inherit', shell: true });
