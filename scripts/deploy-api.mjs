import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, '.env.firebase');

if (!existsSync(envFile)) {
  console.error('Missing .env.firebase — copy .env.firebase.example and fill in values.');
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
  FIREBASE_PROJECT_ID,
  CLOUD_RUN_REGION = 'me-west1',
  CLOUD_RUN_SERVICE = 'thepinkfront-api',
  MONGODB_URI,
  JWT_SECRET,
  JWT_EXPIRES_IN = '1h',
  GOOGLE_CLIENT_ID,
  ADMIN_WHITELIST,
  CLIENT_ORIGIN,
  COOKIE_SECURE = 'true',
} = env;

const required = {
  FIREBASE_PROJECT_ID,
  MONGODB_URI,
  JWT_SECRET,
  GOOGLE_CLIENT_ID,
  ADMIN_WHITELIST,
  CLIENT_ORIGIN,
};

for (const [key, value] of Object.entries(required)) {
  if (!value) {
    console.error(`Missing required value in .env.firebase: ${key}`);
    process.exit(1);
  }
}

const cloudRunEnvFile = join(root, 'backend', '.cloudrun.env.yaml');
const yaml = [
  'NODE_ENV: production',
  `MONGODB_URI: "${MONGODB_URI}"`,
  `JWT_SECRET: "${JWT_SECRET}"`,
  `JWT_EXPIRES_IN: "${JWT_EXPIRES_IN}"`,
  `GOOGLE_CLIENT_ID: "${GOOGLE_CLIENT_ID}"`,
  `ADMIN_WHITELIST: "${ADMIN_WHITELIST}"`,
  `CLIENT_ORIGIN: "${CLIENT_ORIGIN}"`,
  `COOKIE_SECURE: "${COOKIE_SECURE}"`,
].join('\n');

writeFileSync(cloudRunEnvFile, yaml);

try {
  const cmd = [
    'gcloud run deploy',
    CLOUD_RUN_SERVICE,
    '--source backend',
    `--region ${CLOUD_RUN_REGION}`,
    `--project ${FIREBASE_PROJECT_ID}`,
    '--allow-unauthenticated',
    '--port 8080',
    `--env-vars-file "${cloudRunEnvFile}"`,
  ].join(' ');

  console.log(`Deploying API to Cloud Run (${CLOUD_RUN_SERVICE}, ${CLOUD_RUN_REGION})...`);
  execSync(cmd, { cwd: root, stdio: 'inherit', shell: true });
} finally {
  rmSync(cloudRunEnvFile, { force: true });
}
