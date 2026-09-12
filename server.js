/**
 * server.js — API de renderização da caneca 3D
 *
 * POST /api/render   → 1 video (11s) + 2 fotos
 * GET  /api/status   → health check
 *
 * node server.js
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import puppeteer from 'puppeteer-core';
import { execSync } from 'child_process';
import {
  existsSync, mkdirSync, rmSync, writeFileSync,
  copyFileSync, createReadStream
} from 'fs';
import { join, resolve, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const PORT = 3003;
const OUTPUT_DIR = join(__dirname, 'output');
const TEMP_DIR = join(__dirname, '.temp_render');
const DIST_DIR = join(__dirname, 'dist');

const CHROME_PATH = process.platform === 'win32'
  ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  : process.env.CHROME_PATH || '/usr/bin/google-chrome';

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
if (!existsSync(TEMP_DIR)) mkdirSync(TEMP_DIR, { recursive: true });

// ═══════════════════════════════════════════
//  EXPRESS — serve TUDO (app built + artwork)
// ═══════════════════════════════════════════

const app = express();
app.use(cors());
app.use(express.json());

// Upload
const upload = multer({
  dest: TEMP_DIR,
  limits: { fileSize: 20 * 1024 * 1024 }
});

// Servir o app built (HTML, JS, CSS) — na raiz pros paths dos assets funcionarem
app.use(express.static(DIST_DIR));

// Servir artworks temporários
app.use('/uploads', express.static(TEMP_DIR));

// Servir outputs
app.use('/output', express.static(OUTPUT_DIR));

// SPA fallback — Express 5 precisa de pattern explícito
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/') || req.path.startsWith('/output/')) {
    return next();
  }
  res.sendFile(join(DIST_DIR, 'index.html'));
});

// ═══════════════════════════════════════════
//  RENDER ENGINE
// ═══════════════════════════════════════════

async function renderMug(artworkPath, options = {}) {
  const {
    exterior = '#ffffff',
    interior = '#f5efe4',
    handle = '#ffffff',
    background = '#1e1e2a',
    fps = 30,
    duration = 11,
    width = 1080,
    height = 1080,
  } = options;

  const totalFrames = fps * duration;
  const jobId = Date.now().toString();
  const jobDir = join(OUTPUT_DIR, `job_${jobId}`);
  const framesDir = join(jobDir, 'frames');
  mkdirSync(framesDir, { recursive: true });

  console.log(`[render] Job ${jobId} — ${totalFrames} frames, ${width}x${height}`);

  // Copiar artwork pra pasta de uploads
  const ext = extname(artworkPath) || '.png';
  const artFilename = `art_${jobId}${ext}`;
  const artDest = join(TEMP_DIR, artFilename);
  copyFileSync(artworkPath, artDest);

  // URL do artwork (via Express static)
  const artworkUrl = `http://127.0.0.1:${PORT}/uploads/${artFilename}`;

  // URL do app built
  const appUrl = `http://127.0.0.1:${PORT}/?headless=1` +
    `&artwork=${encodeURIComponent(artworkUrl)}` +
    `&exterior=${encodeURIComponent(exterior)}` +
    `&interior=${encodeURIComponent(interior)}` +
    `&handle=${encodeURIComponent(handle)}` +
    `&background=${encodeURIComponent(background)}`;

  console.log(`[render] App URL: ${appUrl}`);

  // Log colors being applied
  console.log(`[render] Cores: exterior=${exterior}, interior=${interior}, handle=${handle}, background=${background}`);

  // ── Launch Puppeteer ──
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--enable-webgl',
      '--use-gl=angle',
      '--use-angle=swiftshader-webgl',
      '--enable-unsafe-swiftshader',
      '--disable-gpu-sandbox',
      `--window-size=${width},${height}`,
    ],
    defaultViewport: { width, height, deviceScaleFactor: 1 },
  });

  try {
    const page = await browser.newPage();

    // Log de erros do console
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`[browser] ${msg.text()}`);
    });
    page.on('pageerror', err => console.log(`[browser] Page error: ${err.message}`));

    await page.setViewport({ width, height });

    // Navegar pro app
    console.log(`[render] Navegando...`);
    await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Esperar __mug ficar disponível
    console.log(`[render] Esperando cena 3D...`);
    await page.waitForFunction(
      () => window.__mug && window.__mug.scene,
      { timeout: 20000 }
    );

    // Esperar artwork carregar
    await new Promise(r => setTimeout(r, 2000));

    // Verificar cores aplicadas
    const appliedColors = await page.evaluate(() => {
      const scene = window.__mug?.scene;
      if (!scene) return null;
      return {
        interior: '#' + scene.interiorMat.color.getHexString(),
        handle: '#' + scene.handleMat.color.getHexString(),
      };
    });
    console.log(`[render] Cores aplicadas:`, appliedColors);

    // Verificar se artwork carregou
    const hasArt = await page.evaluate(() => window.__mug.scene._artworkTexture !== null);
    console.log(`[render] Artwork carregada: ${hasArt}`);

    // ── Desabilitar auto-rotate ──
    await page.evaluate(() => window.__mug.setAutoRotate(false));

    // ── CAPTURAR FRAMES DO VIDEO ──
    console.log(`[render] Capturando ${totalFrames} frames...`);

    for (let i = 0; i < totalFrames; i++) {
      const angle = (i / totalFrames) * Math.PI * 2;

      await page.evaluate((a) => {
        window.__mug.setMugRotation(a);
        window.__mug.render();
      }, angle);

      await new Promise(r => setTimeout(r, 50));

      const framePath = join(framesDir, `frame_${String(i).padStart(5, '0')}.png`);
      const dataUrl = await page.evaluate(() => window.__mug.capture());
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      writeFileSync(framePath, Buffer.from(base64, 'base64'));

      if (i % 60 === 0) console.log(`[render] Frame ${i}/${totalFrames}`);
    }

    console.log(`[render] Todos os frames capturados!`);

    // ── FOTO 1: Centro — arte centralizada, oposto da alça ──
    console.log(`[render] Foto 1 — centro (oposto da alça)...`);
    await page.evaluate(() => {
      // Alça fica em +X no mugGroup. Rotação +π/2 coloca -X (oposto) em +Z (câmera).
      window.__mug.setMugRotation(Math.PI / 2);
      window.__mug.setCamera(0, 2.5, 6.5);
      window.__mug.render();
    });
    await new Promise(r => setTimeout(r, 300));

    const photo1 = await page.evaluate(() => window.__mug.capture());
    writeFileSync(
      join(jobDir, 'foto_centro.png'),
      Buffer.from(photo1.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    );

    // ── FOTO 2: Alça + arte — intermediate, tending toward centro ──
    console.log(`[render] Foto 2 — centro com alça visível...`);
    await page.evaluate(() => {
      // Pi/2 = centro. Subtraindo mais (~0.9) pra inclinar e mostrar a alça.
      window.__mug.setMugRotation(Math.PI / 2 - 1.05);
      window.__mug.setCamera(0.5, 2.3, 6.5);
      window.__mug.render();
    });
    await new Promise(r => setTimeout(r, 300));

    const photo2 = await page.evaluate(() => window.__mug.capture());
    writeFileSync(
      join(jobDir, 'foto_alca.png'),
      Buffer.from(photo2.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    );

  } finally {
    await browser.close();
  }

  // ── FFMPEG: video ──
  console.log(`[render] Gerando video com ffmpeg...`);
  const videoPath = join(jobDir, 'video_caneca.mp4');

  try {
    execSync(
      `ffmpeg -y -framerate ${fps} -i "${join(framesDir, 'frame_%05d.png')}" ` +
      `-c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p ` +
      `-vf "scale=${width}:${height}" "${videoPath}"`,
      { stdio: 'pipe', timeout: 120000 }
    );
    console.log(`[render] Video pronto!`);
  } catch (err) {
    console.error('[render] ffmpeg error:', err.stderr?.toString());
    throw new Error('Falha ao gerar video');
  }

  // Limpar frames
  rmSync(framesDir, { recursive: true, force: true });

  // Cleanup artwork
  rmSync(artDest, { force: true });

  const baseUrl = `http://localhost:${PORT}/output/job_${jobId}`;
  return {
    jobId,
    video: `${baseUrl}/video_caneca.mp4`,
    fotoCentro: `${baseUrl}/foto_centro.png`,
    fotoAlca: `${baseUrl}/foto_alca.png`,
    localPaths: {
      video: videoPath,
      fotoCentro: join(jobDir, 'foto_centro.png'),
      fotoAlca: join(jobDir, 'foto_alca.png'),
    },
  };
}

// ═══════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════

app.post('/api/render', upload.single('artwork'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Envie uma imagem no campo "artwork"' });
    }

    const options = {
      exterior: req.body.exterior || '#ffffff',
      interior: req.body.interior || '#f5efe4',
      handle: req.body.handle || '#ffffff',
      background: req.body.background || '#1e1e2a',
      fps: parseInt(req.body.fps) || 30,
      duration: parseInt(req.body.duration) || 11,
      width: parseInt(req.body.width) || 1080,
      height: parseInt(req.body.height) || 1080,
    };

    console.log(`[api] Render request:`, options);
    const result = await renderMug(req.file.path, options);
    rmSync(req.file.path, { force: true });
    res.json(result);
  } catch (err) {
    console.error('[api] Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', chrome: CHROME_PATH, port: PORT });
});

// ═══════════════════════════════════════════
//  START
// ═══════════════════════════════════════════

if (!existsSync(DIST_DIR)) {
  console.error('[start] Pasta dist/ não encontrada. Roda "npm run build" primeiro!');
  process.exit(1);
}

if (!existsSync(CHROME_PATH)) {
  console.error(`[start] Chrome/Edge não encontrado: ${CHROME_PATH}`);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║  🎬 Caneca Mockup — API de Renderização  ║
╠══════════════════════════════════════════╣
║                                          ║
║  POST /api/render                        ║
║    Campo: artwork (arquivo)              ║
║    Opcionais: exterior, interior,        ║
║               handle, background,        ║
║               fps, duration, width,      ║
║               height                     ║
║                                          ║
║  GET  /api/status                        ║
║  GET  /app/                              ║
║                                          ║
║  http://localhost:${PORT}                  ║
╚══════════════════════════════════════════╝
  `);
});
