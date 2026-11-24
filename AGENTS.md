# Hopefully True

A small daily news site written by AI (xAI's Grok), built as plain static files.

## Layout

- `prompts/` – the six prompts, the source of truth. The README shows them; `npm run check` fails if it is out of sync (`npm run build` updates it).
- `src/xai.mjs` – tiny xAI API client (text with search, images, cost).
- `src/prompt.mjs` – reads a prompt file and fills in `{{placeholders}}`.
- `src/find-stories.mjs` – step 1: pick today's stories.
- `src/write-article.mjs` – step 2: write one article.
- `src/draw-image.mjs` – step 3: draw and save the illustration (WebP); also paints the history lesson's picture.
- `src/on-this-day.mjs` – step 4: “On this day”, one sourced event from this date in an earlier year.
- `src/history-lesson.mjs` – step 5: “From history”, one person, one sourced quote, a painting description.
- `src/daily.mjs` – runs steps 1–5 for today, idempotent, within the budget; a failed history piece never stops the news.
- `src/build-site.mjs` – builds the static site into `out/`.
- `src/sync-readme.mjs` – copies the prompts into the README.
- `src/config.mjs` – categories, models, articles per day, budget.
- `static/` – CSS, the small site script, fonts, Cloudflare `_headers`.
- `content/` – generated articles, images, history pieces (`onthisday/`, `lessons/`) and daily story lists (committed by CI).

## Commands

- `npm run daily` – generate today's articles and history pieces (needs `XAI_API_KEY`).
- `npm run build` – sync the README and build the site into `out/`.
- `npm run check` – verify the README matches `prompts/`.
- `npm run serve` – preview `out/` at http://localhost:8787.
- Cheap test: `CONTENT_DIR=scratch ARTICLES_PER_DAY=2 PICTURES=off npm run daily`.

## Principles

- Keep it simple: small plain code, no frameworks, no build tools.
- Minimal dependencies: Node built-ins only, plus `sharp` for images.
- Prompts live only in `prompts/`, never in code; output shapes live in the code's JSON schemas.
- Never commit secrets. Keys go in `.env.local` (gitignored) or CI secrets.
- Costs are capped per run by `MAX_DAILY_USD` ($3.50). The news never spends the history pieces' reserve (`HISTORY_RESERVE_USD`), so an expensive day gets fewer stories, never a missing history piece.
