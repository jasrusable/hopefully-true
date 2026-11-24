// Settings shared by every step. Most can be overridden with environment variables.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CONTENT = path.resolve(ROOT, process.env.CONTENT_DIR || 'content');

export const CATEGORIES = ['World', 'Politics', 'Business', 'Technology', 'Science', 'Health', 'Environment', 'Sport', 'Culture', 'US', 'Switzerland', 'South Africa'];

export const ARTICLES_PER_DAY = Number(process.env.ARTICLES_PER_DAY || 5);
export const MAX_RUN_USD = Number(process.env.MAX_DAILY_USD || 3.5); // a run never plans to spend more than this
export const STORY_USD = 0.4;        // the most one article and its picture should cost (text has peaked at $0.35)
export const ON_THIS_DAY_USD = 0.65; // the most "On this day" and its picture should cost (the first cost $0.59)
export const LESSON_USD = 0.7;       // the most "From history" and its painting should cost (so far $0.17 to $0.63)
// The news may not touch the history pieces' share, so every day gets both; on an expensive day it gets fewer stories.
export const HISTORY_RESERVE_USD = ON_THIS_DAY_USD + LESSON_USD;

export const MODELS = {
  find: process.env.FIND_MODEL || 'grok-4.7',
  write: process.env.WRITE_MODEL || 'grok-4.7',
  draw: process.env.IMAGE_MODEL || 'grok-imagine-image-2.0',
  history: process.env.HISTORY_MODEL || 'grok-4.7',
};

// The day in Zurich, e.g. "2026-11-23". A day's edition is everything published on that date.
export const zurichDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(d);
