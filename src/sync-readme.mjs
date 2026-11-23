// Copies the prompts into README.md between their markers, so the README always shows the real prompts.
// `node src/sync-readme.mjs --check` changes nothing and fails if the README is out of date (used in CI).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.mjs';

const readmeFile = path.join(ROOT, 'README.md');
const readme = fs.readFileSync(readmeFile, 'utf8');
const synced = readme.replace(/(<!-- prompt: (\S+) -->)[\s\S]*?(<!-- \/prompt -->)/g, (_, open, file, close) =>
  `${open}\n\`\`\`markdown\n${fs.readFileSync(path.join(ROOT, 'prompts', file), 'utf8').trim()}\n\`\`\`\n${close}`);

if (process.argv.includes('--check')) {
  if (synced !== readme) { console.error('README.md is out of date with prompts/. Run: npm run build'); process.exit(1); }
  console.log('README prompts are in sync');
} else if (synced !== readme) {
  fs.writeFileSync(readmeFile, synced);
  console.log('README prompts updated');
}
