// Step 4: the daily moment from history, one person and one sourced quote (prompts/4-from-history.md).
import { ask, normalizeUrl } from './xai.mjs';
import { prompt } from './prompt.mjs';
import { MODELS } from './config.mjs';

const schema = {
  type: 'object', additionalProperties: false,
  required: ['name', 'born', 'died', 'quote', 'about', 'painting', 'image_alt', 'source_url'],
  properties: {
    name: { type: 'string', description: 'The name they are best known by.' },
    born: { type: 'string', description: 'Year of birth, e.g. "1867" or "c. 470 BC".' },
    died: { type: 'string', description: 'Year of death, or an empty string if they are alive.' },
    quote: { type: 'string', description: 'The quote, word for word as the source gives it (in English), without quotation marks.' },
    about: { type: 'string', description: 'What the line means and the person behind it: plain paragraphs separated by blank lines, up to about 600 words. No headings, links or lists.' },
    painting: { type: 'string', description: 'One paragraph of 50 to 90 words describing the accompanying painting to the reader: its style, period and scene, and how it echoes the quote.' },
    image_alt: { type: 'string', description: 'Short alt text for the painting, for people who cannot see it.' },
    source_url: { type: 'string', description: 'The page where the quote and where it comes from can be checked. An empty string if there is none.' },
  },
};

// recent: names of the last lessons, so nobody comes back within a few months.
export async function historyLesson({ date, recent }) {
  const { answer, usd, seen } = await ask({
    model: MODELS.history, schema, search: ['web_search'], maxSearches: 4,
    prompt: prompt('4-from-history.md', { date, recent_people: recent.length ? recent.map(n => `- ${n}`).join('\n') : '- (none)' }),
  });
  const clean = s => s.replace(/\s*<grok\b[^>]*\/>/g, '').trim(); // drop grok-4.7's inline citation tags
  const lesson = {
    name: clean(answer.name), born: clean(answer.born), died: clean(answer.died),
    quote: clean(answer.quote).replace(/^["“”‘’']+|["“”‘’']+$/g, ''), about: clean(answer.about),
    painting: clean(answer.painting), imageAlt: clean(answer.image_alt), source: answer.source_url.trim(),
  };
  // Quietly no lesson unless there is a quote, a web link the search really returned, and a name we haven't had lately.
  const ok = lesson.name && lesson.quote && lesson.about && /^https?:\/\//i.test(lesson.source)
    && seen.has(normalizeUrl(lesson.source)) && !recent.some(n => n.toLowerCase() === lesson.name.toLowerCase());
  return { lesson: ok ? lesson : null, usd };
}
