// The daily run: find today's stories, write each one up and illustrate it.
// Safe to run again: it only tops today up to ARTICLES_PER_DAY, and it stops spending at MAX_DAILY_USD.
import fs from 'node:fs';
import path from 'node:path';
import { CONTENT, ARTICLES_PER_DAY, MAX_RUN_USD, MODELS, zurichDay } from './config.mjs';
import { findStories } from './find-stories.mjs';
import { writeArticle } from './write-article.mjs';
import { drawImage } from './draw-image.mjs';

const date = zurichDay();
const articlesDir = path.join(CONTENT, 'articles');
const storiesFile = path.join(CONTENT, 'stories', `${date}.json`);
fs.mkdirSync(articlesDir, { recursive: true });
fs.mkdirSync(path.dirname(storiesFile), { recursive: true });

const saved = fs.readdirSync(articlesDir).filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(fs.readFileSync(path.join(articlesDir, f), 'utf8')));
const today = saved.filter(a => zurichDay(new Date(a.publishedAt)) === date);
const needed = ARTICLES_PER_DAY - today.length;
if (needed <= 0) { console.log(`${date}: already have ${today.length} articles`); process.exit(0); }

let spent = 0;
const slugify = s => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);

// 1. Find stories, once a day. The list is saved, so a second run doesn't pay for it again.
let stories;
if (fs.existsSync(storiesFile)) {
  stories = JSON.parse(fs.readFileSync(storiesFile, 'utf8'));
} else {
  const recent = saved.filter(a => Date.now() - new Date(a.publishedAt) < 4 * 864e5).map(a => a.title);
  const found = await findStories({ date, count: ARTICLES_PER_DAY, recent });
  spent += found.usd;
  stories = found.stories;
  fs.writeFileSync(storiesFile, JSON.stringify(stories, null, 2));
  console.log(`found ${stories.length} stories ($${found.usd.toFixed(3)})`);
}
const done = new Set(today.map(a => a.story));
const todo = stories.filter(s => !done.has(s.story)).slice(0, needed);

// 2 and 3. Write and illustrate each story.
let written = 0;
for (const story of todo) {
  if (spent >= MAX_RUN_USD) { console.error(`stopping: this run has spent $${spent.toFixed(2)}`); break; }
  try {
    const { article, usd } = await writeArticle({ date, story });
    spent += usd;
    const id = `${date}-${slugify(article.headline)}`;
    const entry = {
      id, slug: id, story: story.story, category: story.category,
      title: article.headline.trim(), dek: article.summary.trim(),
      tags: [...new Set(article.tags.map(slugify).filter(Boolean))].slice(0, 4),
      body: article.body.trim(),
      sources: article.sources.filter(s => /^https?:\/\//.test(s.url)).slice(0, 5),
      publishedAt: new Date().toISOString(),
      models: MODELS,
    };
    if (process.env.PICTURES !== 'off') try {
      const drawn = await drawImage({ id, description: article.image.description, alt: article.image.alt });
      spent += drawn.usd;
      entry.image = drawn.image;
    } catch (err) { console.error(`  no picture for ${id}: ${err.message}`); }
    fs.writeFileSync(path.join(articlesDir, `${id}.json`), JSON.stringify(entry, null, 2));
    written++;
    console.log(`wrote ${id} ($${usd.toFixed(3)} for the text)`);
  } catch (err) {
    spent += err.usd || 0; // a failed answer still costs money
    console.error(`could not write "${story.story}": ${err.message}`);
  }
}
console.log(`${date}: wrote ${written} of ${needed}, spent $${spent.toFixed(2)}`);
if (written === 0) process.exit(1);
