// Read-only helpers for the content archive, shared by the daily run and the local dry-run.
import fs from 'node:fs';
import path from 'node:path';

export function readAll(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().reverse()
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}

// Titles of articles published in the last four days, the same window the daily run feeds to findStories.
export function recentTitles(saved, now = Date.now()) {
  return saved.filter(a => now - new Date(a.publishedAt) < 4 * 864e5).map(a => a.title);
}
