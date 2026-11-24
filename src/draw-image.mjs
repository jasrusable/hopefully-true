// Step 3: draw the illustration (prompts/3-illustration.md, or the history painting) and save it as two small WebP files.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { draw } from './xai.mjs';
import { prompt } from './prompt.mjs';
import { CONTENT, MODELS } from './config.mjs';

const SIZES = { hero: 1200, thumb: 480 }; // pixels wide

export async function drawImage({ id, description, alt, promptFile = '3-illustration.md' }) {
  const { bytes, usd } = await draw({ model: MODELS.draw, prompt: prompt(promptFile, { description }) });
  const dir = path.join(CONTENT, 'images');
  fs.mkdirSync(dir, { recursive: true });
  const image = { alt, model: MODELS.draw, aiGenerated: true };
  for (const [name, width] of Object.entries(SIZES)) {
    const file = `${id}-${width}.webp`;
    const info = await sharp(bytes).resize({ width }).webp({ quality: 72 }).toFile(path.join(dir, file));
    image[name] = { src: `/img/${file}`, width: info.width, height: info.height };
  }
  return { image, usd };
}
