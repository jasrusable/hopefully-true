// Local dry-run of the production find-stories and write-article steps.
// Writes only under dry-run/ (gitignored). Never writes to content/, never commits or deploys.
// Images are skipped. Uncommitted edits in prompts/ are picked up automatically; pass --prompt to try another file.
import fs from 'node:fs';
import path from 'node:path';
import { loadEnv } from './env.mjs';
loadEnv();

import { ROOT, CONTENT, ARTICLES_PER_DAY, MODELS, zurichDay, dimsLabel } from './config.mjs';
import { readAll, recentTitles } from './archive.mjs';
import { findStories } from './find-stories.mjs';
import { writeArticle } from './write-article.mjs';
import { promptMeta } from './prompt.mjs';

const DRY_RUN = path.join(ROOT, 'dry-run');
const LATEST = path.join(DRY_RUN, 'latest-headlines.json');

function usage(msg) {
  const out = msg ? console.error : console.log;
  if (msg) console.error(msg);
  out(`Usage:
  node src/dry-run.mjs headlines [--prompt <path>]
  node src/dry-run.mjs article <n> [--prompt <path>] [--from <dir>]

Uses the same findStories / writeArticle code, prompts and models as the daily run.
Output goes to dry-run/ (gitignored). content/ is never written. Images are skipped.
Uncommitted edits in prompts/ are used by default. --prompt takes any other prompt file.
`);
  process.exit(msg ? 1 : 0);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--prompt' || a === '--from') {
      const v = argv[++i];
      if (!v) usage(`missing value for ${a}`);
      args[a.slice(2)] = v;
    } else if (a === '-h' || a === '--help') {
      usage();
    } else if (a.startsWith('-')) {
      usage(`unknown option: ${a}`);
    } else {
      args._.push(a);
    }
  }
  return args;
}

function requireKey() {
  if (!process.env.XAI_API_KEY) {
    throw new Error('XAI_API_KEY is missing (looked in the environment and .env.local)');
  }
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function writeOutputs(dir, files) {
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n';
    fs.writeFileSync(path.join(dir, name), text);
  }
}

function rel(p) {
  const r = path.relative(ROOT, p);
  return r && !r.startsWith('..') ? r : p;
}

async function runHeadlines({ prompt: promptFile = '1-find-stories.md' } = {}) {
  requireKey();
  const started = Date.now();
  const date = zurichDay();
  const meta = promptMeta(promptFile);
  const saved = readAll(path.join(CONTENT, 'articles'));
  const recent = recentTitles(saved);

  console.log(`Finding stories for ${date}`);
  console.log(`Prompt: ${meta.file}`);
  console.log(`SHA-256: ${meta.hash}`);
  console.log(`Model: ${MODELS.find}  count: ${ARTICLES_PER_DAY}  recent titles: ${recent.length}`);

  const { stories, usd } = await findStories({ date, count: ARTICLES_PER_DAY, recent, promptFile });
  const elapsedMs = Date.now() - started;
  const outDir = path.join(DRY_RUN, `${stamp()}-headlines`);
  const record = {
    kind: 'headlines',
    date,
    generatedAt: new Date().toISOString(),
    elapsedMs,
    usd,
    model: MODELS.find,
    prompt: { file: meta.file, sha256: meta.hash },
    countRequested: ARTICLES_PER_DAY,
    recentTitleCount: recent.length,
    recentTitles: recent,
    stories,
  };
  const md = [
    `# Headlines for ${date}`,
    '',
    `Prompt: ${meta.file}`,
    `SHA-256: ${meta.hash}`,
    `Model: ${MODELS.find}`,
    `Cost: $${usd.toFixed(3)}  Time: ${(elapsedMs / 1000).toFixed(1)}s`,
    '',
    ...stories.map((s, i) => {
      const sources = (s.sources || []).length ? s.sources.map(u => `- ${u}`).join('\n') : '- (none)';
      return `## ${i + 1}. ${s.story}\n\nPlace: ${s.place || '—'}\n\nTopic: ${s.topic || '—'}\n\nSources:\n${sources}\n`;
    }),
  ].join('\n') + '\n';

  writeOutputs(outDir, { 'meta.json': record, 'stories.json': stories, 'stories.md': md });
  fs.writeFileSync(LATEST, JSON.stringify({
    dir: outDir,
    date,
    generatedAt: record.generatedAt,
    prompt: record.prompt,
    stories,
  }, null, 2) + '\n');

  console.log('');
  stories.forEach((s, i) => {
    console.log(`${i + 1}. ${s.story}`);
    const extra = [dimsLabel(s), s.sources?.[0]].filter(Boolean).join(' — ');
    console.log(`   ${extra}`);
  });
  console.log('');
  console.log(`${stories.length} stories  $${usd.toFixed(3)}  ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(`Wrote ${rel(outDir)}/`);
}

function loadHeadlines(from) {
  if (from) {
    const dir = path.resolve(from);
    const file = fs.existsSync(path.join(dir, 'meta.json')) ? path.join(dir, 'meta.json')
      : fs.existsSync(path.join(dir, 'stories.json')) ? path.join(dir, 'stories.json')
      : fs.existsSync(dir) && dir.endsWith('.json') ? dir
      : null;
    if (!file) throw new Error(`no headlines found in ${from}`);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const stories = data.stories || data;
    if (!Array.isArray(stories) || !stories.length) throw new Error(`no stories in ${file}`);
    return { dir, stories, date: data.date || zurichDay(), prompt: data.prompt };
  }
  if (!fs.existsSync(LATEST)) {
    throw new Error('no previous headlines run; run `npm run headlines` first, or pass --from <dir>');
  }
  const data = JSON.parse(fs.readFileSync(LATEST, 'utf8'));
  if (!Array.isArray(data.stories) || !data.stories.length) throw new Error('latest headlines file has no stories');
  return data;
}

async function runArticle({ n, prompt: promptFile = '2-write-article.md', from } = {}) {
  requireKey();
  const index = Number(n);
  if (!Number.isInteger(index) || index < 1) {
    usage('article needs a 1-based story number, e.g. npm run article -- 3');
  }
  const started = Date.now();
  const headlines = loadHeadlines(from);
  if (index > headlines.stories.length) {
    throw new Error(`story ${index} is out of range (1–${headlines.stories.length})`);
  }
  const story = headlines.stories[index - 1];
  const meta = promptMeta(promptFile);
  const date = headlines.date || zurichDay();

  console.log(`Writing article for story ${index} of ${headlines.stories.length}`);
  console.log(`Story: ${story.story}`);
  console.log(`Prompt: ${meta.file}`);
  console.log(`SHA-256: ${meta.hash}`);
  console.log(`Model: ${MODELS.write}  images: skipped`);

  const { article, usd } = await writeArticle({ date, story, promptFile });
  const elapsedMs = Date.now() - started;
  const outDir = path.join(DRY_RUN, `${stamp()}-article-${index}`);
  const record = {
    kind: 'article',
    date,
    storyIndex: index,
    story,
    generatedAt: new Date().toISOString(),
    elapsedMs,
    usd,
    model: MODELS.write,
    images: 'skipped',
    prompt: { file: meta.file, sha256: meta.hash },
    headlinesFrom: headlines.dir ? rel(headlines.dir) : undefined,
    headlinesPrompt: headlines.prompt,
    article,
  };
  const sources = (article.sources || []).length
    ? article.sources.map(s => `- ${s.title}: ${s.url}`).join('\n')
    : '- (none)';
  const md = [
    `# ${article.headline}`,
    '',
    article.summary,
    '',
    `Prompt: ${meta.file}`,
    `SHA-256: ${meta.hash}`,
    `Model: ${MODELS.write}`,
    `Cost: $${usd.toFixed(3)}  Time: ${(elapsedMs / 1000).toFixed(1)}s`,
    `Story ${index}: ${story.story}`,
    '',
    article.body,
    '',
    '## Sources',
    sources,
    '',
  ].join('\n');

  writeOutputs(outDir, { 'meta.json': record, 'article.json': article, 'article.md': md });

  console.log('');
  console.log(article.headline);
  console.log(article.summary);
  console.log('');
  console.log(article.body);
  console.log('');
  if (article.sources?.length) {
    console.log('Sources:');
    for (const s of article.sources) console.log(`- ${s.title}: ${s.url}`);
    console.log('');
  }
  console.log(`$${usd.toFixed(3)}  ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(`Wrote ${rel(outDir)}/`);
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
try {
  if (cmd === 'headlines') {
    await runHeadlines(args);
  } else if (cmd === 'article') {
    await runArticle({ ...args, n: args._[1] });
  } else {
    usage(cmd ? `unknown command: ${cmd}` : 'missing command');
  }
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
