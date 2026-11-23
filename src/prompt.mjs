// Reads a prompt from prompts/ and fills in its {{placeholders}}.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.mjs';

export function prompt(file, values) {
  const text = fs.readFileSync(path.join(ROOT, 'prompts', file), 'utf8');
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`${file}: no value for {{${key}}}`);
    return String(values[key]);
  });
}
