# Hopefully True

News that is hopefully true.

Read it at [hopefullytrue.com](https://hopefullytrue.com).

Every morning an AI (Grok, from xAI) looks at what happened in the world in the last 24 hours, picks five stories, reads the reporting, and writes each one up in plain words, with a small illustration. It ends the day with history: “On this day”, something worthwhile that happened on that date in an earlier year, and a moment from history: a real quote, the story behind it, and a painting in the style of its time and place. The result is a simple static website. It tries very hard to be right, and it links its sources so you can check.

The whole thing is driven by six short prompts. They are the heart of the project, so here they are in full.

## The prompts

These are copied straight from the [`prompts/`](prompts) folder. Words in `{{double braces}}` are filled in by the code.

### 1. Find the stories

<!-- prompt: 1-find-stories.md -->
```markdown
Today is {{date}}. You are the editor of Hopefully True, a small daily news site that aspires to hopefully be true.

Our reader is curious about the news in {{places}}, and likes clear, calm reporting more than political noise.

Find the {{count}} most popular stories from the last 24 hours in {{places}}: the ones most people there are reading and talking about. Each one must really have happened, as reported by a reputable news organisation, and should be simple and easy to understand without background knowledge. Skip niche, technical or insider stories. Search the web; you can also look at X to see what people are talking about.

Split the stories roughly evenly between those places, spread them across topics ({{topics}}), and include at least one hopeful or curious story.

Skip these, which we covered recently:
{{recent_stories}}
```
<!-- /prompt -->

### 2. Write the article

<!-- prompt: 2-write-article.md -->
```markdown
Today is {{date}}. You write for Hopefully True, a small daily news site that aspires to hopefully be true.

The story: {{story}}
Reported here: {{sources}}

Read the reporting to understand the story and the different takes on it. Then work out for yourself what is most likely true, checking further where you can, and write your own article: what is actually going on, and why it matters. If you can't be sure of something, say so rather than guess.

Our reader is a South African living in Switzerland, who is curious about the world and follows the news from South Africa, from Switzerland and from everywhere else. She likes clear, calm reporting more than political noise.

Your goal is to be as truthful as possible, hopefully true.

Use plain, simple language that anyone can follow.

At your discretion, you can weave in a touch of humor for a smile.
```
<!-- /prompt -->

### 3. Draw the illustration

<!-- prompt: 3-illustration.md -->
```markdown
A simple, flat editorial illustration with soft colours and plenty of calm space. Clearly a drawing, not a photo.

No real people or faces, no text or logos, nothing violent.

The picture: {{description}}
```
<!-- /prompt -->

### 4. From history

<!-- prompt: 4-from-history.md -->
```markdown
Today is {{date}}. You write the daily moment from history for Hopefully True, a small daily news site that aspires to hopefully be true.

Our reader is a South African living in Switzerland, who is curious about the world and follows the news from South Africa, from Switzerland and from everywhere else. She likes clear, calm reporting more than political noise.

Choose one person from history, philosophy or science, and one line of theirs worth thinking about. Move around the world and through the centuries from day to day.

The quote must be true: their own words, from their own book, letter or speech, and something a reader can check. Search the web and give the source, such as the sourced section of Wikiquote or the original text itself. Quote websites are not good enough.

Then write about what the line means and the person behind it, in plain, simple language. Take as long as it needs, up to about a three-minute read.

Finish with a short passage describing a painting to go with it: a landscape or scene painted in a style from the person's own time and place, not a portrait.

We covered these people recently, so choose someone else:
{{recent_people}}
```
<!-- /prompt -->

### 5. Paint the history picture

<!-- prompt: 5-history-painting.md -->
```markdown
A painting in the style of the time and place described below, such as a landscape or a scene from everyday life. It should look like a real painting from that tradition, not a photo.

Not a portrait or likeness of any real person, and no text or signatures.

The painting: {{description}}
```
<!-- /prompt -->
### 6. On this day

<!-- prompt: 6-on-this-day.md -->
```markdown
Today is {{date}}. You write "On this day" for Hopefully True, a small daily news site that aspires to hopefully be true.

Our reader is a South African living in Switzerland, who is curious about the world and follows the news from South Africa, from Switzerland and from everywhere else. She likes clear, calm reporting more than political noise.

Pick one worthwhile event, discovery or occasion that happened on {{day}} in an earlier year, anywhere in the world and in any century.

The date and the facts must be true and checkable. Search the web and give the sources you relied on.

Write it like a news story from that day: what happened, who was involved and where, in plain, simple language. Then end with a line or two on why it still matters.

We have covered these on this date before, so pick something else:
{{covered}}
```
<!-- /prompt -->

## How it works

1. **Find.** One call with web search (and X search, as a signal only) returns five stories, each with a sentence, a topic, a place and its sources.
2. **Write and draw.** For each story, the writer reads the reporting with web search and writes the article. Then the image model draws an illustration, captioned "Illustration generated by AI".
3. **On this day, and from history.** One call with web search finds a worthwhile event, discovery or occasion from this calendar date in an earlier year and writes it up like a news story from that day, with a line on why it still matters and a small illustration; it is told what it covered on this date before. If none of its sources is a page the search really returned, that day has no “On this day”. Then one more call with web search picks a person from history, philosophy or science, with a quote traced to their own book, letter or speech, writes about what it means and who they were (up to about a three-minute read), and describes a painting to go with it. The image model then paints that scene in a style from the person's own time and place, never a portrait. It is told the last 90 names so nobody repeats within three months. If no real source comes back, or anything goes wrong, that day simply has no moment from history; the news still publishes.
4. **Build.** A small script turns the saved articles into plain HTML pages, with places, topics, tags and search, plus an RSS feed, sitemaps and the titles, descriptions and structured data search engines and link previews read. They are published on Cloudflare Pages. The front page shows the last three days, each ending with “On this day” and its moment from history; each of those also has its own page, and the History page lists them all.

A Cloudflare Worker (`hopefully-true-daily`) starts the GitHub Actions workflow at 04:37 Europe/Zurich every morning, so the edition is ready around 05:00. GitHub's own cron is kept as a fallback, and it skips generation if today's edition is already in the repository. The workflow saves the new articles back into this repository (the repository is the archive), and only publishes if everything worked, so a bad run never replaces the previous edition.

## The code

```
prompts/              the six prompts above
src/
  xai.mjs             tiny xAI API client (text with search, and images)
  prompt.mjs          reads a prompt file and fills in its {{placeholders}}
  find-stories.mjs    step 1
  write-article.mjs   step 2
  draw-image.mjs      step 3 (saves small WebP images)
  on-this-day.mjs     step 4, On this day
  history-lesson.mjs  step 5, the daily moment from history (its painting is drawn by draw-image.mjs)
  daily.mjs           runs steps 1 to 5 for today, within a spending limit
  dry-run.mjs         local headlines / one-article dry-run of the same find and write steps
  archive.mjs         read-only helpers for the content archive
  env.mjs             loads .env.local without printing values
  build-site.mjs      builds the website into out/
  sync-readme.mjs     keeps the prompts in this README identical to prompts/
  config.mjs          settings: topics, places, models, articles per day, budget
static/               stylesheet, search script, fonts, Cloudflare headers
content/              articles, illustrations, the history pieces (onthisday/, lessons/) and each day's story list
worker/               Cloudflare Worker that starts the daily GitHub Actions workflow at 04:37 Zurich time
```

## Cost

About $2.50 to $3.40 a day, roughly $70 to $100 a month: finding the stories with `grok-4.7` costs about $0.20 to $0.40, writing about $0.15 to $0.35 per article, plus $0.04 for each picture with `grok-imagine-image-2.0`; “On this day” costs up to about $0.60 and the moment from history with its painting about $0.17 to $0.65. A run keeps to `MAX_DAILY_USD` (default $3.50). It holds back $1.35 for the two history pieces, and only starts another article if one more (allowing $0.40) still fits in the rest, which leaves about $2.15 for four or five articles; on an expensive day there are fewer articles, but the history pieces are always there. Hosting on Cloudflare Pages is free.

## Run it yourself

You need Node.js 20 or later and an [xAI API key](https://console.x.ai).

```sh
npm install
export XAI_API_KEY=...          # keep it secret; never commit it
# Or put the key in .env.local (gitignored); the scripts load it if the variable is not already set.
npm run daily                   # find, write and draw today's articles and the two history pieces into content/
npm run build                   # build the site into out/
npm run serve                   # open http://localhost:8787
```

To try a prompt change without a full run or a production deploy, the same find-stories and write-article code can be run on their own. Output goes to `dry-run/` (gitignored) and `content/` is never written. Images are skipped. Uncommitted edits in `prompts/` are used automatically; pass `--prompt` to compare another file. Each run records the prompt path and a SHA-256 of the file.

```sh
npm run headlines               # print numbered story headlines
npm run headlines -- --prompt path/to/alt-find.md
npm run article -- 3            # write the article for story 3 from the latest headlines run
npm run article -- 3 --prompt path/to/alt-write.md
```

To try a full daily run without touching the real archive, set `CONTENT_DIR=scratch` and `ARTICLES_PER_DAY=3` (add `PICTURES=off` to skip the illustrations).

## Scheduling

The daily run is started by the `hopefully-true-daily` Cloudflare Worker, which cron-fires at 02:37 and 03:37 UTC and only then calls GitHub's `workflow_dispatch` (with `generate=true`) when the time in Europe/Zurich is 04:xx. That is 04:37 all year, including across DST. The Worker lives in `worker/`. It needs a GitHub fine-grained personal access token stored as the `GITHUB_TOKEN` Worker secret (Actions: read and write, Contents: read, only this repository).

The GitHub workflow in `.github/workflows/daily.yml` keeps its own 02:37 and 03:37 UTC cron as a fallback, in case the Worker does not fire. Before generating, that fallback checks whether today's Zurich edition already exists in `content/stories/` or another run of this workflow has already started today, so two editions are never written on the same day. A `workflow_dispatch` from the Worker is not subject to the workflow's DST offset guard. To replace an edition that is already in `content/`, run the workflow with `generate=true` and `force=true`: that removes only today's stories, articles, history pieces and images, then generates a fresh edition. Scheduled runs never set `force`, so the daily skip guard is unchanged. Previous URLs for that day are dropped (they 404) so two editions do not sit side by side.

To deploy the Worker (from `worker/`, with [Wrangler](https://developers.cloudflare.com/workers/wrangler/) logged in):

```sh
wrangler deploy
```

To set or rotate the token without printing it, pipe it into Wrangler, for example from the clipboard after creating it on GitHub:

```sh
pbpaste | wrangler secret put GITHUB_TOKEN
```

A protected `POST /dispatch` on the Worker, authorised with `Authorization: Bearer <GITHUB_TOKEN>`, starts a rebuild-only run (`generate=false`). It cannot generate a new edition. You can also test the schedule locally with `wrangler dev --test-scheduled` and a request to `/cdn-cgi/local/scheduled`.

## Licence

MIT, see [LICENSE](LICENSE). The Inter and Newsreader fonts are under the SIL Open Font License (see `static/fonts/`).
