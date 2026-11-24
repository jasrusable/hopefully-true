// The daily run: find today's stories, write each one up and illustrate it, then add the two history pieces.
// Safe to run again: it only tops today up to ARTICLES_PER_DAY, and it keeps to MAX_DAILY_USD,
// holding back HISTORY_RESERVE_USD so "On this day" and "From history" always fit.
import fs from 'node:fs';
import path from 'node:path';
import { CONTENT, ARTICLES_PER_DAY, MAX_RUN_USD, STORY_USD, ON_THIS_DAY_USD, LESSON_USD, HISTORY_RESERVE_USD, MODELS, zurichDay } from './config.mjs';
import { findStories } from './find-stories.mjs';
import { writeArticle } from './write-article.mjs';
import { drawImage } from './draw-image.mjs';
import { onThisDay } from './on-this-day.mjs';
import { historyLesson } from './history-lesson.mjs';

const date = zurichDay();
const articlesDir = path.join(CONTENT, 'articles');
const onThisDayDir = path.join(CONTENT, 'onthisday');
const lessonsDir = path.join(CONTENT, 'lessons');
const storiesFile = path.join(CONTENT, 'stories', `${date}.json`);
for (const d of [articlesDir, onThisDayDir, lessonsDir, path.dirname(storiesFile)]) fs.mkdirSync(d, { recursive: true });

let spent = 0;
const slugify = s => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
const readAll = dir => fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().reverse()
  .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));

const newsOk = await news();
// After the news, which may not touch their reserve.
await historyPiece('on this day', onThisDayDir, ON_THIS_DAY_USD, makeOnThisDay);
await historyPiece('from history', lessonsDir, LESSON_USD, makeLesson);
console.log(`${date}: spent $${spent.toFixed(2)} in all`);
if (!newsOk) process.exit(1);

// A picture for an article or history piece; without one the piece still publishes.
async function picture(id, description, alt, promptFile) {
  if (process.env.PICTURES === 'off') return undefined;
  try {
    const drawn = await drawImage({ id, description, alt, promptFile });
    spent += drawn.usd;
    return drawn.image;
  } catch (err) { console.error(`  no picture for ${id}: ${err.message}`); }
}

// 1 to 3: today's articles. Returns false only if it had articles to write and wrote none.
async function news() {
  const saved = readAll(articlesDir);
  const today = saved.filter(a => zurichDay(new Date(a.publishedAt)) === date);
  const needed = ARTICLES_PER_DAY - today.length;
  if (needed <= 0) { console.log(`${date}: already have ${today.length} articles`); return true; }

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
    // Start another story only if it fits in what's left once the history pieces' share is held back.
    if (spent + STORY_USD > MAX_RUN_USD - HISTORY_RESERVE_USD) { console.error(`no more stories: $${spent.toFixed(2)} spent, the rest is kept for the history pieces`); break; }
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
        image: await picture(id, article.image.description, article.image.alt),
      };
      fs.writeFileSync(path.join(articlesDir, `${id}.json`), JSON.stringify(entry, null, 2));
      written++;
      console.log(`wrote ${id} ($${usd.toFixed(3)} for the text)`);
    } catch (err) {
      spent += err.usd || 0; // a failed answer still costs money
      console.error(`could not write "${story.story}": ${err.message}`);
    }
  }
  console.log(`${date}: wrote ${written} of ${needed} articles`);
  return written > 0;
}

// 4 and 5: a history piece, once a day. Any failure just means no piece today; it never stops the news.
async function historyPiece(name, dir, share, make) {
  const file = path.join(dir, `${date}.json`);
  if (fs.existsSync(file)) return console.log(`${date}: already have ${name}`);
  if (spent + share > MAX_RUN_USD) return console.error(`no ${name}: this run has spent $${spent.toFixed(2)}`);
  try {
    const entry = await make(dir);
    if (!entry) return;
    fs.writeFileSync(file, JSON.stringify({ id: entry.slug, slug: entry.slug, date, ...entry, publishedAt: new Date().toISOString(), model: MODELS.history }, null, 2));
    console.log(`${name}: ${entry.slug}`);
  } catch (err) {
    spent += err.usd || 0;
    console.error(`no ${name}: ${err.message}`);
  }
}

async function makeOnThisDay(dir) {
  const covered = readAll(dir).filter(o => o.date.slice(5) === date.slice(5)).map(o => o.title); // this date, earlier years
  const { story, usd } = await onThisDay({ date, covered });
  spent += usd;
  console.log(`  on this day: $${usd.toFixed(3)} for the text`);
  if (!story) return console.log('  no sourced event found today');
  const slug = `${date}-${slugify(story.title)}`;
  const { image, ...rest } = story;
  return { slug, ...rest, image: await picture(slug, image.description, image.alt) };
}

async function makeLesson(dir) {
  const recent = readAll(dir).slice(0, 90).map(l => l.name); // nobody twice within about three months
  const { lesson, usd } = await historyLesson({ date, recent });
  spent += usd;
  console.log(`  from history: $${usd.toFixed(3)} for the text`);
  if (!lesson) return console.log('  no sourced quote found today');
  const slug = `${date}-${slugify(lesson.name)}`;
  const { imageAlt, ...rest } = lesson;
  return { slug, ...rest, image: await picture(slug, lesson.painting, imageAlt, '5-history-painting.md') };
}
