// Step 5: "On this day", one true event from this calendar date in an earlier year (prompts/6-on-this-day.md).
import { ask, normalizeUrl } from './xai.mjs';
import { prompt } from './prompt.mjs';
import { MODELS } from './config.mjs';

const schema = {
  type: 'object', additionalProperties: false,
  required: ['year', 'headline', 'summary', 'body', 'sources', 'image'],
  properties: {
    year: { type: 'integer', description: 'The year it happened; negative for BC.' },
    headline: { type: 'string', description: 'A plain news headline in sentence case, at most 12 words, written as if on the day. No dates.' },
    summary: { type: 'string', description: 'One sentence, at most 30 words, saying what happened.' },
    body: { type: 'string', description: '200 to 400 words of Markdown in short paragraphs, ending with why it still matters. No headings, links or sign-off.' },
    sources: {
      type: 'array', description: 'The pages you actually relied on for the date and the facts.',
      items: { type: 'object', additionalProperties: false, required: ['title', 'url'], properties: { title: { type: 'string' }, url: { type: 'string' } } },
    },
    image: {
      type: 'object', additionalProperties: false, required: ['description', 'alt'],
      properties: {
        description: { type: 'string', description: 'One sentence describing a calm, symbolic illustration: objects, places or symbols, never real people.' },
        alt: { type: 'string', description: 'Short alt text for people who cannot see the picture.' },
      },
    },
  },
};

// covered: headlines from this calendar date in earlier years, so it never repeats itself.
export async function onThisDay({ date, covered }) {
  const day = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long' });
  const { answer, usd, seen } = await ask({
    model: MODELS.history, schema, search: ['web_search'], maxSearches: 4,
    prompt: prompt('6-on-this-day.md', { date, day, covered: covered.length ? covered.map(t => `- ${t}`).join('\n') : '- (none)' }),
  });
  const clean = s => s.replace(/\s*<grok\b[^>]*\/>/g, '').trim(); // drop grok-4.7's inline citation tags
  // Publish only sources the search really returned, never a link the model made up.
  const sources = answer.sources.filter(s => /^https?:\/\//i.test(s.url) && seen.has(normalizeUrl(s.url))).slice(0, 5);
  const story = { year: answer.year, title: clean(answer.headline), dek: clean(answer.summary), body: clean(answer.body), sources, image: answer.image };
  // Quietly nothing today unless it has a real source and happened in an earlier year.
  const ok = sources.length && story.title && story.body && Number.isInteger(story.year) && story.year < Number(date.slice(0, 4));
  return { story: ok ? story : null, usd };
}
