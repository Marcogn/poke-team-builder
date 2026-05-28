import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

function generateSvg(size = 512) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  const ballR = r * 0.7;
  const centerR = size * 0.078; // ~40px at 512
  const outerCenterR = centerR * 2; // ~80px at 512
  const lineY = cy;
  const lineThick = size * 0.0078; // ~4px at 512

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <!-- Background circle -->
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#5b21b6" stroke="#7c3aed" stroke-width="2"/>
  <!-- Top half (white) -->
  <path d="M ${cx - ballR} ${cy} A ${ballR} ${ballR} 0 0 1 ${cx + ballR} ${cy} L ${cx - ballR} ${cy} Z" fill="white"/>
  <!-- Bottom half (dark) -->
  <path d="M ${cx - ballR} ${cy} A ${ballR} ${ballR} 0 0 0 ${cx + ballR} ${cy} L ${cx - ballR} ${cy} Z" fill="#1a1a2e"/>
  <!-- Dividing line -->
  <rect x="${cx - ballR}" y="${lineY - lineThick / 2}" width="${ballR * 2}" height="${lineThick}" fill="#1a1a2e"/>
  <!-- Outer center circle -->
  <circle cx="${cx}" cy="${cy}" r="${outerCenterR}" fill="#1a1a2e" stroke="white" stroke-width="6"/>
  <!-- Inner center circle -->
  <circle cx="${cx}" cy="${cy}" r="${centerR}" fill="white"/>
</svg>`;
}

async function generate() {
  const svg512 = Buffer.from(generateSvg(512));

  await sharp(svg512).resize(512, 512).png().toFile(resolve(outDir, 'icon-512x512.png'));
  await sharp(svg512).resize(192, 192).png().toFile(resolve(outDir, 'icon-192x192.png'));
  await sharp(svg512).resize(180, 180).png().toFile(resolve(outDir, 'apple-touch-icon.png'));

  console.log('✅ Icons generated in public/icons/');
}

generate().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
