// Settings shared by every step. Most can be overridden with environment variables.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CONTENT = path.resolve(ROOT, process.env.CONTENT_DIR || 'content');

export const CATEGORIES = ['World', 'Politics', 'Business', 'Technology', 'Science', 'Health', 'Environment', 'Sport', 'Culture', 'US', 'Switzerland', 'South Africa'];

export const ARTICLES_PER_DAY = Number(process.env.ARTICLES_PER_DAY || 5);
export const MAX_RUN_USD = Number(process.env.MAX_DAILY_USD || 1.5); // stop spending once a run reaches this

export const MODELS = {
  find: process.env.FIND_MODEL || 'grok-4.7',
  write: process.env.WRITE_MODEL || 'grok-4.7',
  draw: process.env.IMAGE_MODEL || 'grok-imagine-image-2.0',
};

// The day in Zurich, e.g. "2026-11-23". A day's edition is everything published on that date.
export const zurichDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(d);
