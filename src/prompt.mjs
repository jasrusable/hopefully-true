// Reads a prompt and fills in its {{placeholders}}.
// A bare name is loaded from prompts/; any path (./file, ../file, /abs, or a/b.md) is used as given.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ROOT } from './config.mjs';

export function promptPath(file) {
  if (!file) throw new Error('no prompt file given');
  if (path.isAbsolute(file) || file.startsWith('.') || file.includes('/') || file.includes('\\')) {
    return path.resolve(file);
  }
  return path.join(ROOT, 'prompts', file);
}

export function promptMeta(file) {
  const resolved = promptPath(file);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`prompt file not found: ${file}`);
  }
  const text = fs.readFileSync(resolved, 'utf8');
  const hash = createHash('sha256').update(text).digest('hex');
  const rel = path.relative(ROOT, resolved);
  const display = rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel : resolved;
  return { file: display, path: resolved, hash };
}

export function prompt(file, values) {
  const text = fs.readFileSync(promptPath(file), 'utf8');
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`${file}: no value for {{${key}}}`);
    return String(values[key]);
  });
}
