/**
 * convert-assets.mjs
 *
 * Converts WAV audio files → MP3, re-compresses high-bitrate MP3s → 96 kbps,
 * converts all PNG/JPG images → WebP at 85% quality, and isolates raw WAV/PNG files
 * out of public/ assets to raw-assets/.
 *
 * Run: node scripts/convert-assets.mjs
 */

import { createRequire } from 'module';
import { spawn } from 'child_process';
import { existsSync, mkdirSync, renameSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative, extname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PUBLIC_ASSETS_DIR = join(ROOT, 'public', 'assets');
const RAW_ASSETS_DIR = join(ROOT, 'raw-assets');

function getFilesRecursively(dir) {
  let results = [];
  if (!existsSync(dir)) return results;
  const list = readdirSync(dir);
  for (const file of list) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(filePath));
    } else {
      results.push(filePath);
    }
  }
  return results;
}

function convertAudio(ffmpegBin, src, dst, bitrate = '96k') {
  return new Promise((resolve, reject) => {
    console.log(`  ⟳ Optimizing audio: ${relative(ROOT, src)} → ${relative(ROOT, dst)} (${bitrate})`);
    const proc = spawn(ffmpegBin, [
      '-y', '-i', src,
      '-codec:a', 'libmp3lame',
      '-b:a', bitrate,
      '-ac', '2',
      dst,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });

    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) {
        const srcKB = (statSync(src).size / 1024).toFixed(1);
        const dstKB = (statSync(dst).size / 1024).toFixed(1);
        console.log(`  ✅ done: ${srcKB}KB → ${dstKB}KB`);
        resolve();
      } else {
        reject(new Error(`ffmpeg failed (${code}) for ${src}:\n${stderr}`));
      }
    });
  });
}

async function convertImage(srcPath, dstPath) {
  console.log(`  ⟳ Converting image: ${relative(ROOT, srcPath)} → ${relative(ROOT, dstPath)}`);
  const sharp = (await import('sharp')).default;
  await sharp(srcPath).webp({ quality: 85, effort: 6 }).toFile(dstPath);
  const srcSize = (statSync(srcPath).size / 1024).toFixed(1);
  const dstSize = (statSync(dstPath).size / 1024).toFixed(1);
  console.log(`  ✅ done: ${srcSize}KB → ${dstSize}KB`);
}

async function main() {
  let ffmpegBin;
  try {
    ffmpegBin = require('ffmpeg-static');
  } catch (e) {
    console.error('❌ ffmpeg-static not found — run: npm install --save-dev ffmpeg-static');
    process.exit(1);
  }

  const allFiles = getFilesRecursively(PUBLIC_ASSETS_DIR);

  console.log('=== Step 1: Images PNG/JPG → WebP ===');
  for (const filePath of allFiles) {
    const ext = extname(filePath).toLowerCase();
    if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
      const dstPath = filePath.substring(0, filePath.lastIndexOf('.')) + '.webp';
      if (!existsSync(dstPath)) {
        await convertImage(filePath, dstPath);
      }
    }
  }

  console.log('\n=== Step 2: Optimizing MP3 Bitrates (96kbps) ===');
  const soundsDir = join(ROOT, 'public', 'assets', 'sounds');
  const mp3Files = getFilesRecursively(soundsDir).filter(f => f.endsWith('.mp3') && !f.endsWith('.tmp.mp3'));
  for (const mp3Path of mp3Files) {
    if (!existsSync(mp3Path)) continue;
    const sizeKB = statSync(mp3Path).size / 1024;
    // Only re-compress MP3s larger than 100KB to 96kbps
    if (sizeKB > 100 && !mp3Path.endsWith('.tmp.mp3')) {
      const tmpPath = mp3Path + '.tmp.mp3';
      try {
        await convertAudio(ffmpegBin, mp3Path, tmpPath, '96k');
        if (existsSync(tmpPath)) {
          const { copyFileSync, unlinkSync } = await import('fs');
          copyFileSync(tmpPath, mp3Path);
          unlinkSync(tmpPath);
        }
      } catch (err) {
        console.warn(`  ⚠️ Failed to optimize ${relative(ROOT, mp3Path)}: ${err.message}`);
      }
    }
  }

  console.log('\n=== Step 3: Isolating RAW WAV & source PNG/JPG files to raw-assets/ ===');
  if (!existsSync(RAW_ASSETS_DIR)) {
    mkdirSync(RAW_ASSETS_DIR, { recursive: true });
  }

  const updatedFileList = getFilesRecursively(PUBLIC_ASSETS_DIR);
  for (const filePath of updatedFileList) {
    const ext = extname(filePath).toLowerCase();
    // Move WAV files and PNG/JPG files (if a WebP counterpart exists) to raw-assets/
    if (ext === '.wav') {
      const rel = relative(PUBLIC_ASSETS_DIR, filePath);
      const targetPath = join(RAW_ASSETS_DIR, rel);
      mkdirSync(dirname(targetPath), { recursive: true });
      renameSync(filePath, targetPath);
      console.log(`  📦 Moved WAV: ${rel} → raw-assets/`);
    } else if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
      const webpPath = filePath.substring(0, filePath.lastIndexOf('.')) + '.webp';
      if (existsSync(webpPath)) {
        const rel = relative(PUBLIC_ASSETS_DIR, filePath);
        const targetPath = join(RAW_ASSETS_DIR, rel);
        mkdirSync(dirname(targetPath), { recursive: true });
        renameSync(filePath, targetPath);
        console.log(`  📦 Moved source image: ${rel} → raw-assets/`);
      }
    }
  }

  console.log('\n✅ All asset optimization and isolation complete!');
}

main().catch((e) => { console.error(e); process.exit(1); });

