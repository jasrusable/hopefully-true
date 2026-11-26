// Step 1: find the day's stories (prompts/1-find-stories.md).
import { ask, normalizeUrl } from './xai.mjs';
import { prompt } from './prompt.mjs';
import { TOPICS, PLACES, joinList, MODELS } from './config.mjs';

const schema = {
  type: 'object', additionalProperties: false, required: ['stories'],
  properties: {
    stories: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['story', 'topic', 'place', 'sources'],
        properties: {
          story: { type: 'string', description: 'One plain sentence: what happened, who was involved and where.' },
          topic: { type: 'string', enum: TOPICS },
          place: { type: 'string', enum: PLACES },
          sources: { type: 'array', items: { type: 'string' }, description: 'One or two links to the specific news articles that report it (not homepages).' },
        },
      },
    },
  },
};

export async function findStories({ date, count, recent, promptFile = '1-find-stories.md' }) {
  const { answer, usd, seen } = await ask({
    model: MODELS.find, schema, search: ['web_search', 'x_search'], maxSearches: 12,
    prompt: prompt(promptFile, {
      date, count,
      places: joinList(PLACES),
      topics: joinList(TOPICS),
      recent_stories: recent.length ? recent.map(t => `- ${t}`).join('\n') : '- (none)',
    }),
  });
  // Keep only links the search really found; the writer searches for itself anyway.
  const stories = answer.stories.map(s => ({ ...s, sources: s.sources.filter(u => seen.has(normalizeUrl(u))) }));
  return { stories, usd };
}
