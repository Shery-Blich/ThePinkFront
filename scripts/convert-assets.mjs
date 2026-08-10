/**
 * convert-assets.mjs
 *
 * Converts large WAV audio files → MP3 (128 kbps) and large PNG/JPG images → WebP
 * using ffmpeg-static (bundled binary) and sharp.
 *
 * Run: node scripts/convert-assets.mjs
 */

import { createRequire } from 'module';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SOUNDS_DIR = join(ROOT, 'public', 'assets', 'sounds');
const IMAGES_DIR = join(ROOT, 'public', 'assets');

// ──────────────────────────────────────────────────────────────────────────────
// Audio: WAV → MP3 at 128 kbps
// ──────────────────────────────────────────────────────────────────────────────
const WAV_TO_MP3 = [
  { src: 'music-for-middle.wav',         dst: 'music-for-middle.mp3' },
  { src: 'gaming-for-end.wav',           dst: 'gaming-for-end.mp3' },
  { src: 'scene-4-music.wav',            dst: 'scene-4-music.mp3' },
  { src: 'level-up.wav',                 dst: 'level-up.mp3' },
  { src: 'game-over.wav',                dst: 'game-over.mp3' },
  { src: 'drone_bomb.wav',               dst: 'drone_bomb.mp3' },
];

// ──────────────────────────────────────────────────────────────────────────────
// Images: PNG/JPG → WebP at 85% quality
// ──────────────────────────────────────────────────────────────────────────────
const IMAGES_TO_WEBP = [
  { src: 'Ellements/kalpi.png',                            dst: 'Ellements/kalpi.webp' },
  { src: 'backgrounds/KalpiSceneBackground.png',           dst: 'backgrounds/KalpiSceneBackground.webp' },
  { src: 'backgrounds/TelAvivBackground.png',              dst: 'backgrounds/TelAvivBackground.webp' },
  { src: 'Ellements/bus_stop_jerusalem_transparent.png',   dst: 'Ellements/bus_stop_jerusalem_transparent.webp' },
  { src: 'backgrounds/supermarketOutside.png',             dst: 'backgrounds/supermarketOutside.webp' },
  { src: 'backgrounds/background.jpg',                     dst: 'backgrounds/background.webp' },
];

// ──────────────────────────────────────────────────────────────────────────────
// Helper: run ffmpeg for audio conversion
// ──────────────────────────────────────────────────────────────────────────────
function convertAudio(ffmpegBin, src, dst) {
  return new Promise((resolve, reject) => {
    if (existsSync(dst)) {
      console.log(`  ✓ already exists: ${dst}`);
      resolve();
      return;
    }
    console.log(`  ⟳ ${src} → ${dst}`);
    const proc = spawn(ffmpegBin, [
      '-y', '-i', src,
      '-codec:a', 'libmp3lame',
      '-b:a', '128k',
      '-q:a', '2',
      dst,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });

    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) {
        const srcKB = (require('fs').statSync(src).size / 1024).toFixed(1);
        const dstKB = (require('fs').statSync(dst).size / 1024).toFixed(1);
        console.log(`  ✅ done: ${srcKB}KB → ${dstKB}KB`);
        resolve();
      } else {
        reject(new Error(`ffmpeg failed (${code}) for ${src}:\n${stderr}`));
      }
    });
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper: sharp for WebP conversion
// ──────────────────────────────────────────────────────────────────────────────
async function convertImage(srcPath, dstPath) {
  if (existsSync(dstPath)) {
    console.log(`  ✓ already exists: ${dstPath}`);
    return;
  }
  console.log(`  ⟳ ${srcPath} → ${dstPath}`);
  const sharp = (await import('sharp')).default;
  await sharp(srcPath).webp({ quality: 85 }).toFile(dstPath);
  const srcSize = (require('fs').statSync(srcPath).size / 1024).toFixed(1);
  const dstSize = (require('fs').statSync(dstPath).size / 1024).toFixed(1);
  console.log(`  ✅ done: ${srcSize}KB → ${dstSize}KB`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────
async function main() {
  let ffmpegBin;
  try {
    ffmpegBin = require('ffmpeg-static');
  } catch (e) {
    console.error('❌ ffmpeg-static not found — run: npm install --save-dev ffmpeg-static');
    process.exit(1);
  }
  console.log(`Using ffmpeg: ${ffmpegBin}\n`);

  console.log('=== Audio: WAV → MP3 ===');
  for (const { src, dst } of WAV_TO_MP3) {
    const srcPath = join(SOUNDS_DIR, src);
    const dstPath = join(SOUNDS_DIR, dst);
    if (!existsSync(srcPath)) {
      console.log(`  ⚠ skipping (not found): ${src}`);
      continue;
    }
    await convertAudio(ffmpegBin, srcPath, dstPath);
  }

  console.log('\n=== Images: PNG/JPG → WebP ===');
  for (const { src, dst } of IMAGES_TO_WEBP) {
    const srcPath = join(IMAGES_DIR, src);
    const dstPath = join(IMAGES_DIR, dst);
    if (!existsSync(srcPath)) {
      console.log(`  ⚠ skipping (not found): ${src}`);
      continue;
    }
    await convertImage(srcPath, dstPath);
  }

  console.log('\n✅ All conversions complete!');
}

main().catch((e) => { console.error(e); process.exit(1); });
