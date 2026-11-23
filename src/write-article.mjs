// Step 2: read the reporting and write one article (prompts/2-write-article.md).
import { ask, normalizeUrl } from './xai.mjs';
import { prompt } from './prompt.mjs';
import { MODELS } from './config.mjs';

const schema = {
  type: 'object', additionalProperties: false,
  required: ['headline', 'summary', 'tags', 'body', 'sources', 'image'],
  properties: {
    headline: { type: 'string', description: 'A plain news headline in sentence case (capitals only for the first word and for names), at most 12 words. No dates, jokes or clickbait.' },
    summary: { type: 'string', description: 'One sentence, at most 30 words, saying what happened.' },
    tags: { type: 'array', items: { type: 'string' }, description: 'Two to four short lowercase tags: places, people, organisations or themes.' },
    body: { type: 'string', description: '350 to 500 words of Markdown in paragraphs of two to four sentences, optionally one or two ## subheadings. Say what happened, why it matters and what happens next. No links, headline or sign-off.' },
    sources: {
      type: 'array', description: 'The articles you actually relied on.',
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

export async function writeArticle({ date, story }) {
  const { answer, usd, seen } = await ask({
    model: MODELS.write, schema, search: ['web_search'], maxSearches: 4,
    prompt: prompt('2-write-article.md', {
      date, story: story.story, sources: story.sources.join(' and ') || '(search for it)',
    }),
  });
  // Publish only sources the search really returned, never a link the model made up.
  answer.sources = answer.sources.filter(s => seen.has(normalizeUrl(s.url)));
  // grok-4.7 marks citations inline as <grok type="render_inline_citation" ... />; the sources list covers them.
  for (const key of ['headline', 'summary', 'body']) answer[key] = answer[key].replace(/\s*<grok\b[^>]*\/>/g, '');
  return { article: answer, usd };
}
