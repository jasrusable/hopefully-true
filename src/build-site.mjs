// Step 5: build the static site from the saved articles and history lessons into a folder (default: out).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, CONTENT, TOPICS, PLACES, classify, dimsLabel } from './config.mjs';

const STYLE_V = String(Date.now()).slice(-8); // cache-busts style.css and search.js on every build
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'out'));
const SITE = process.env.SITE_URL || 'https://hopefullytrue.com';
const NAME = 'Hopefully True';
const TAGLINE = "News written by AI, hopefully true. Don't\u00a0panic."; // non-breaking space keeps "Don't panic." together
const PAGE = 30;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const tz = { timeZone: 'Europe/Zurich' };
const fmtDate = d => new Date(d).toLocaleDateString('en-GB', { ...tz, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtShort = d => new Date(d).toLocaleDateString('en-GB', { ...tz, day: 'numeric', month: 'short' });
const fmtLong = d => new Date(d).toLocaleDateString('en-GB', { ...tz, weekday: 'long', day: 'numeric', month: 'long' });
const dayKey = d => new Intl.DateTimeFormat('en-CA', tz).format(new Date(d));
const words = s => s.split(/\s+/).filter(Boolean).length;
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const isWeb = u => /^https?:\/\//i.test(u);

// Tiny, safe Markdown: paragraphs, ## headings, **bold**, *italic*. Everything is escaped first.
function md(src) {
  const inline = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>');
  return src.replace(/\r/g, '').split(/\n{2,}/).map(b => b.trim()).filter(Boolean).map(b => {
    const h = b.match(/^#{2,4}\s+([^\n]*)(?:\n([\s\S]*))?$/); // a heading, maybe with its paragraph straight after it
    if (h) return `<h2>${inline(h[1])}</h2>${h[2] ? `<p>${inline(h[2].replace(/\n/g, ' '))}</p>` : ''}`;
    if (/^[-*]\s/.test(b)) return `<ul>${b.split('\n').map(l => `<li>${inline(l.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`;
    return `<p>${inline(b.replace(/\n/g, ' '))}</p>`;
  }).join('\n');
}

const articles = fs.readdirSync(path.join(CONTENT, 'articles')).filter(f => f.endsWith('.json'))
  .map(f => {
    const raw = JSON.parse(fs.readFileSync(path.join(CONTENT, 'articles', f), 'utf8'));
    return { ...raw, ...classify(raw) };
  })
  .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
const url = a => `/a/${a.slug}/`;
const usedTopics = TOPICS.filter(c => articles.some(a => a.topic === c));
// World and US were old categories; keep their listing URLs so existing links still work, but they are not in the nav.
const retiredCats = ['World', 'US'].filter(c => articles.some(a => a.category === c));
const tagCounts = {};
for (const a of articles) for (const t of a.tags) tagCounts[t] = (tagCounts[t] || 0) + 1;
const tagLabel = t => t.replace(/-/g, ' ');

// History pieces: one file per day each, content/onthisday/ and content/lessons/YYYY-MM-DD.json.
const readDir = d => (fs.existsSync(path.join(CONTENT, d)) ? fs.readdirSync(path.join(CONTENT, d)).filter(f => f.endsWith('.json')) : [])
  .map(f => JSON.parse(fs.readFileSync(path.join(CONTENT, d, f), 'utf8')))
  .sort((a, b) => b.date.localeCompare(a.date));
const lessons = readDir('lessons');
const onThisDay = readDir('onthisday');
const lessonUrl = l => `/history/${l.slug}/`;
const otdUrl = o => `/on-this-day/${o.slug}/`;
const yearLabel = y => y < 0 ? `${-y} BC` : String(y);
const noon = day => `${day}T12:00:00Z`; // a "YYYY-MM-DD" day as a time that is that same day in Zurich
const years = l => l.died ? `${l.born}–${l.died}` : `born ${l.born}`;

// What search engines and link previews see. Pages without their own picture share the site card.
const SITE_IMAGE = { src: '/og-default.png', width: 1200, height: 630, alt: `${NAME}: news written by AI, hopefully true.` };
const picture = x => x.image ? { ...x.image.hero, alt: x.image.alt } : SITE_IMAGE;
const ORG = { '@type': 'Organization', name: NAME, url: `${SITE}/`, logo: { '@type': 'ImageObject', url: `${SITE}/icon-512.png`, width: 512, height: 512 } };
const AI_NOTE = "Written automatically by AI (xAI's Grok) from published reporting. Each piece links its sources.";
// Structured data (schema.org JSON-LD). The writer is an AI, so the author is the site itself, and it says so.
const articleLd = ({ type = 'NewsArticle', headline, description, path, published, image, section, keywords = [], sources = [] }) => ({
  '@context': 'https://schema.org', '@type': type, headline: headline.slice(0, 110), description,
  url: SITE + path, mainEntityOfPage: SITE + path, datePublished: published, dateModified: published,
  inLanguage: 'en-GB', image: [SITE + image.src], ...(section && { articleSection: section }),
  ...(keywords.length && { keywords: keywords.join(', ') }),
  author: { ...ORG, description: AI_NOTE }, publisher: ORG, isBasedOn: sources.filter(isWeb),
});
const ldScript = data => `\n<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`; // \u003c: no "</script>" can end it early

function layout({ title, desc, body, canonical, active = '', type = 'website', image = SITE_IMAGE, published = '', jsonld = null, noindex = false }) {
  const nav = [['All', '/', ''], ...PLACES.map(p => [p, `/place/${slug(p)}/`, p]), ...usedTopics.map(c => [c, `/category/${slug(c)}/`, c]), ['History', '/history/', 'History']]
    .map(([l, h, k]) => `<a href="${h}"${k === active ? ' aria-current="page"' : ''}>${esc(l)}</a>`).join('');
  return `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${SITE}${canonical}">`}
<meta property="og:site_name" content="${NAME}"><meta property="og:locale" content="en_GB"><meta property="og:type" content="${type}">
<meta property="og:url" content="${SITE}${canonical}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE}${image.src}"><meta property="og:image:width" content="${image.width}"><meta property="og:image:height" content="${image.height}"><meta property="og:image:alt" content="${esc(image.alt)}">
${published ? `<meta property="article:published_time" content="${published}">` : ''}<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48"><link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest">
<link rel="alternate" type="application/rss+xml" title="${NAME}" href="/feed.xml">
<link rel="preload" href="/fonts/inter-latin-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/newsreader-latin-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/newsreader-latin-var-italic.woff2" as="font" type="font/woff2" crossorigin>
<meta name="color-scheme" content="light dark">
<link rel="stylesheet" href="/style.css?v=${STYLE_V}">${jsonld ? ldScript(jsonld) : ''}
</head><body>
<a class="skip" href="#main">Skip to content</a>
<header class="masthead"><div class="wrap top">
<div class="brandbox"><a class="brand" href="/">${NAME}</a><p class="tagline">${TAGLINE}</p></div>
<button type="button" class="search-open" aria-label="Search" aria-expanded="false" aria-controls="search-form"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg></button>
<form id="search-form" class="search" action="/" role="search"><label for="q" class="sr-only">Search stories</label><input id="q" type="search" name="q" placeholder="Search" autocomplete="off" aria-controls="search-results"><button type="button" class="search-close" aria-label="Close search"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg></button></form>
</div><nav class="cats wrap" aria-label="Sections">${nav}</nav></header>
<main id="main" class="wrap"><p id="search-status" class="search-status" role="status" aria-live="polite" hidden></p><div id="search-results" hidden></div><div id="page-content">${body}</div></main>
<footer class="wrap foot"><p>Written by AI, and hopefully true.</p><p><a href="/about/">About</a> · <a href="/history/">History</a> · <a href="/prompts/">Prompts</a> · <a href="/tags/">Tags</a> · <a href="/feed.xml">RSS</a></p></footer>
<script src="/site.js?v=${STYLE_V}" defer></script>
</body></html>`;
}

const hero = a => a.image ? `<figure class="hero"><img src="${a.image.hero.src}" width="${a.image.hero.width}" height="${a.image.hero.height}" alt="${esc(a.image.alt)}" fetchpriority="high" decoding="async"><figcaption>Illustration generated by AI</figcaption></figure>` : '';
const thumb = (a, href = url(a)) => a.image ? `<a class="thumb" href="${href}" tabindex="-1" aria-hidden="true"><img src="${a.image.thumb.src}" width="${a.image.thumb.width}" height="${a.image.thumb.height}" alt="" loading="lazy" decoding="async"></a>` : '';
const dimLinks = a => [a.place && `<a href="/place/${slug(a.place)}/">${esc(a.place)}</a>`, a.topic && `<a href="/category/${slug(a.topic)}/">${esc(a.topic)}</a>`].filter(Boolean);
const kicker = a => { const dims = dimLinks(a); return `<p class="kicker">${dims.length ? dims.join(' · ') + ' · ' : ''}<time datetime="${a.publishedAt}">${fmtShort(a.publishedAt)}</time></p>`; };

const card = (a, h = 'h2') => `<article class="card">
<div class="text">${kicker(a)}
<${h}><a href="${url(a)}">${esc(a.title)}</a></${h}>
<p class="dek">${esc(a.dek)}</p>
</div>${thumb(a)}
</article>`;
const sourcesList = list => { const web = list.filter(s => isWeb(s.url)); return web.length ? `<section class="sources"><h2>Sources and further reading</h2><ul>${web.map(s => `<li><a href="${esc(s.url)}" rel="noopener nofollow" target="_blank">${esc(s.title || host(s.url))}</a> <small>${esc(host(s.url))}</small></li>`).join('')}</ul></section>` : ''; };
// The top story gets the one big picture.
const lead = (a, h = 'h2') => `<article class="lead">${a.image ? `<a href="${url(a)}" tabindex="-1" aria-hidden="true"><img src="${a.image.hero.src}" width="${a.image.hero.width}" height="${a.image.hero.height}" alt="" fetchpriority="high" decoding="async"></a>` : ''}
${kicker(a)}<${h}><a href="${url(a)}">${esc(a.title)}</a></${h}>
<p class="dek">${esc(a.dek)}</p>
</article>`;
// The quote preview: the quote is the link to the whole piece, then who said it and the first few lines,
// with the painting as a thumbnail like an article's. No source link here.
const byline = l => `<span aria-hidden="true">– </span>${esc(l.name)} <span class="years">(${esc(years(l))})</span>`;
const lessonCard = l => `<article class="card lesson">
<div class="text"><blockquote class="lq"><p><a href="${lessonUrl(l)}">“${esc(l.quote)}”<span class="sr-only"> (${esc(l.name)})</span></a></p></blockquote>
<p class="by">${byline(l)}</p>
<p class="excerpt">${esc(l.about.split(/\n{2,}/)[0].replace(/[#*]/g, '').trim())}</p>
</div>${thumb(l, lessonUrl(l))}
</article>`;
// "On this day": an article-style card with its own small kicker and a thumbnail.
const otdCard = (o, h = 'h3') => `<article class="card">
<div class="text"><p class="kicker">On this day · <time datetime="${o.date}">${fmtShort(noon(o.date))}</time> ${esc(yearLabel(o.year))}</p>
<${h}><a href="${otdUrl(o)}">${esc(o.title)}</a></${h}>
<p class="dek">${esc(o.dek)}</p>
</div>${thumb(o, otdUrl(o))}
</article>`;
// The end of a day: one "From history" section with "On this day", then the quote.
// On the History page the page itself is "From history", so it needs no label there.
const historyEnd = (d, labelled = true) => {
  const o = onThisDay.find(x => x.date === d), l = lessons.find(x => x.date === d);
  if (!o && !l) return '';
  const items = `${o ? otdCard(o, labelled ? 'h4' : 'h3') : ''}${l ? lessonCard(l) : ''}`;
  return labelled ? `<section class="fromhistory" aria-labelledby="fh-${d}"><h3 class="kicker fh-label" id="fh-${d}">From history</h3>\n${items}</section>` : items;
};
// A day heading starts each new day; the lead story's own day needs none.
function feed(list, first = false) {
  let html = '', day = '';
  if (first && list.length) { const top = list.shift(); html = lead(top) + '<section class="day">'; day = dayKey(top.publishedAt); }
  for (const a of list) {
    const k = dayKey(a.publishedAt);
    if (k !== day) { html += `${day ? '</section>' : ''}<section class="day"><h3 class="dayhead">${fmtDate(a.publishedAt)}</h3>`; day = k; }
    html += card(a);
  }
  return html + (day ? '</section>' : '') || '<p class="note">Nothing here yet. The universe is, briefly, quiet.</p>';
}

const files = new Map();
const put = (p, s) => files.set(p, s);

function listing(list, base, title, heading, desc, active) {
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  for (let i = 0; i < pages; i++) {
    const p = i === 0 ? base : `${base}page/${i + 1}/`;
    const pager = pages > 1 ? `<nav class="pager">${i > 0 ? `<a href="${i === 1 ? base : `${base}page/${i}/`}">← Newer</a>` : '<span></span>'}<span>Page ${i + 1} of ${pages}</span>${i < pages - 1 ? `<a href="${base}page/${i + 2}/">Older →</a>` : '<span></span>'}</nav>` : '';
    put(`${p}index.html`, layout({ title, desc, canonical: p, active,
      body: `${heading ? `<h1 class="listhead">${heading}</h1>` : ''}${feed(list.slice(i * PAGE, (i + 1) * PAGE), i === 0)}${pager}` }));
  }
}

// The front page: the last three days, newest first, each with its articles and then its two history pieces.
const days = [...new Set([...articles.map(a => dayKey(a.publishedAt)), ...onThisDay.map(o => o.date), ...lessons.map(l => l.date)])].sort().reverse().slice(0, 3);
const editions = days.map((d, i) => {
  const list = articles.filter(a => dayKey(a.publishedAt) === d);
  return `<section class="edition" aria-labelledby="day-${d}"><h2 class="edhead" id="day-${d}">${fmtLong(noon(d))}</h2>
${list.map((a, j) => i === 0 && j === 0 ? lead(a, 'h3') : card(a, 'h3')).join('\n')}${historyEnd(d)}</section>`;
}).join('\n');
const homeDesc = 'Plain-language daily news, written by AI from the day\'s reporting, with its sources linked.';
put('/index.html', layout({ title: `${NAME}: ${TAGLINE}`, desc: homeDesc, canonical: '/',
  jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', name: NAME, url: `${SITE}/`, description: homeDesc, inLanguage: 'en-GB', publisher: ORG },
  body: `<h1 class="sr-only">${NAME}: today's news, written by AI</h1><p class="greeting" id="greeting">Hello</p>${editions || '<p class="note">Nothing here yet. The universe is, briefly, quiet.</p>'}
<p class="note older">Older stories are in the sections above, and in search.</p>` }));
for (const place of PLACES) listing(articles.filter(a => a.place === place), `/place/${slug(place)}/`, `${place} · ${NAME}`, esc(place), `News from ${place}, in plain words, written by AI from the day's reporting.`, place);
for (const c of usedTopics) listing(articles.filter(a => a.topic === c), `/category/${slug(c)}/`, `${c} · ${NAME}`, esc(c), `${c} news in plain words, written by AI from the day's reporting.`, c);
for (const c of retiredCats) listing(articles.filter(a => a.category === c), `/category/${slug(c)}/`, `${c} · ${NAME}`, esc(c), `${c} news in plain words, written by AI from the day's reporting.`, '');

for (const t of Object.keys(tagCounts)) listing(articles.filter(a => a.tags.includes(t)), `/tag/${t}/`, `#${tagLabel(t)} · ${NAME}`, `#${esc(tagLabel(t))}`, `Articles tagged ${tagLabel(t)}.`, '');

const tagIndex = Object.entries(tagCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
put('/tags/index.html', layout({ title: `Tags · ${NAME}`, desc: `Every tag on ${NAME}, with how many stories have it.`, canonical: '/tags/',
  body: `<h1 class="listhead">All tags</h1><p class="tagcloud">${tagIndex.map(([t, n]) => `<a href="/tag/${t}/">#${esc(tagLabel(t))} <small>${n}</small></a>`).join(' ')}</p>` }));

for (const a of articles) {
  const related = articles.filter(b => b !== a && ((a.place && b.place === a.place) || (a.topic && b.topic === a.topic) || b.tags.some(t => a.tags.includes(t)))).slice(0, 3);
  put(`${url(a)}index.html`, layout({ title: `${a.title} · ${NAME}`, desc: a.dek, canonical: url(a), active: a.place || a.topic || '',
    type: 'article', published: a.publishedAt, image: picture(a),
    jsonld: articleLd({ headline: a.title, description: a.dek, path: url(a), published: a.publishedAt, image: picture(a),
      section: dimsLabel(a) || undefined, keywords: a.tags.map(tagLabel), sources: a.sources.map(x => x.url) }),
    body: `<article class="story">
<p class="kicker">${dimLinks(a).join(' · ')}${dimLinks(a).length ? ' · ' : ''}<time datetime="${a.publishedAt}">${fmtShort(a.publishedAt)}</time> · ${Math.max(1, Math.round(words(a.body) / 220))} min read</p>
<h1>${esc(a.title)}</h1>
<p class="lede">${esc(a.dek)}</p>
${hero(a)}
<div class="body">${md(a.body)}</div>
<p class="tags">Tags: ${a.tags.map(t => `<a href="/tag/${t}/">#${esc(tagLabel(t))}</a>`).join(' ')}</p>
${sourcesList(a.sources)}
<p class="disclaimer">Written by AI from the sources above. If something looks wrong, it may well be: please check the sources.</p>
</article>
${related.length ? `<section class="related"><h2>Related</h2>${related.map(a => card(a, 'h3')).join('')}</section>` : ''}` }));
}

// The History page lists every day's two history pieces, newest first; each piece also has its own page.
const historyDays = [...new Set([...onThisDay.map(o => o.date), ...lessons.map(l => l.date)])].sort().reverse();
put('/history/index.html', layout({ title: `From history · ${NAME}`, desc: 'Each day, a moment from history and one voice from the past, in their own words.', canonical: '/history/', active: 'History',
  body: `<h1 class="listhead">From history</h1>
<p class="lede">Each day, a moment from history and one voice from the past, in their own words.</p>
${historyDays.map(d => `<section class="edition" aria-labelledby="day-${d}"><h2 class="edhead" id="day-${d}">${fmtLong(noon(d))}</h2>
${historyEnd(d, false)}</section>`).join('\n') || '<p class="note">Nothing here yet.</p>'}` }));
for (const l of lessons) {
  put(`${lessonUrl(l)}index.html`, layout({ title: `${l.name} · From history · ${NAME}`, desc: `“${l.quote}” ${l.name}, ${years(l)}`, canonical: lessonUrl(l), active: 'History',
    type: 'article', published: l.publishedAt, image: picture(l),
    jsonld: articleLd({ type: 'Article', headline: `${l.name}: “${l.quote}”`, description: `“${l.quote}” ${l.name}, ${years(l)}`, path: lessonUrl(l),
      published: l.publishedAt, image: picture(l), section: 'From history', sources: [l.source] }),
    body: `<article class="story lesson-page">
<p class="kicker"><a href="/history/">From history</a> · <time datetime="${l.date}">${fmtShort(noon(l.date))}</time> · ${Math.max(1, Math.round(words(`${l.about} ${l.painting || ''}`) / 220))} min read</p>
${l.image ? `<figure class="hero"><img src="${l.image.hero.src}" width="${l.image.hero.width}" height="${l.image.hero.height}" alt="${esc(l.image.alt)}" fetchpriority="high" decoding="async"><figcaption>Painting generated by AI</figcaption></figure>` : ''}
<blockquote class="quote"><p>“${esc(l.quote)}”</p></blockquote>
<h1 class="by">${byline(l)}</h1>
<div class="body">${md(l.about)}${l.painting ? `\n<p class="painting">${esc(l.painting)}</p>` : ''}</div>
${isWeb(l.source) ? `<section class="sources"><h2>Source of the quote</h2><ul><li><a href="${esc(l.source)}" rel="noopener nofollow" target="_blank">${esc(host(l.source))}</a></li></ul></section>` : ''}
<p class="disclaimer">Chosen and written by AI. Quotes are easy to get wrong, so please check the source.</p>
</article>
<p class="note"><a href="/history/">More from history</a></p>` }));
}

for (const o of onThisDay) {
  put(`${otdUrl(o)}index.html`, layout({ title: `${o.title} · On this day · ${NAME}`, desc: o.dek, canonical: otdUrl(o), active: 'History',
    type: 'article', published: o.publishedAt, image: picture(o),
    jsonld: articleLd({ type: 'Article', headline: o.title, description: o.dek, path: otdUrl(o), published: o.publishedAt,
      image: picture(o), section: 'On this day', sources: o.sources.map(x => x.url) }),
    body: `<article class="story">
<p class="kicker"><a href="/history/">On this day</a> · <time datetime="${o.date}">${fmtShort(noon(o.date))}</time> ${esc(yearLabel(o.year))} · ${Math.max(1, Math.round(words(o.body) / 220))} min read</p>
<h1>${esc(o.title)}</h1>
<p class="lede">${esc(o.dek)}</p>
${hero(o)}
<div class="body">${md(o.body)}</div>
${sourcesList(o.sources)}
<p class="disclaimer">Written by AI from the sources above. If something looks wrong, it may well be: please check the sources.</p>
</article>
<p class="note"><a href="/history/">More from history</a></p>` }));
}

put('/about/index.html', layout({ title: `About · ${NAME}`, desc: `What ${NAME} is: a small daily news site written by AI from the day's reporting, with its sources and prompts public.`, canonical: '/about/',
  body: `<article class="story"><h1>About ${NAME}</h1><div class="body">
<p>Hopefully True is a small experiment: a daily news site written entirely by AI (xAI's Grok). Each morning it picks about five stories from the last day, reads what reporters are saying, checks further where it can, and writes its own plain account of what is most likely true and why it matters. Where it isn't sure, it says so.</p>
<p>Now and then it allows itself a small smile, because the universe is frequently ridiculous.</p>
<p>Each day ends with a moment from history: a real quote from history, and the story behind it. Just before it, “On this day” retells something that happened on that date in an earlier year.</p>
<p>The pictures are simple AI illustrations, never photos, and never show real people.</p>
<p>An AI can still get things wrong, so each article links the reports it drew on. For anything important, check those. The instructions it follows are short and public: <a href="/prompts/">read all of them here</a>.</p>
<p>It's open source: <a href="https://github.com/jasrusable/hopefully-true">see the code on GitHub</a>.</p>
</div></article>` }));

// The prompts, exactly as the AI receives them (words in {{braces}} are filled in each day).
const promptFiles = fs.readdirSync(path.join(ROOT, 'prompts')).filter(f => f.endsWith('.md')).sort();
put('/prompts/index.html', layout({ title: `Prompts · ${NAME}`, desc: 'The instructions the AI follows, word for word.', canonical: '/prompts/',
  body: `<article class="story"><h1>The prompts</h1>
<p class="lede">These are the instructions the AI follows each day, word for word; words in {{braces}} are filled in for each story.</p>
${promptFiles.map(f => `<h2 class="prompt-title">${esc(f.replace(/\.md$/, '').replace(/^(\d+)-/, '$1. ').replace(/-/g, ' ').replace(/\. (\w)/, (m, c) => '. ' + c.toUpperCase()))}</h2>
<pre class="prompt">${esc(fs.readFileSync(path.join(ROOT, 'prompts', f), 'utf8').trim())}</pre>`).join('\n')}
</article>` }));

put('/404.html', layout({ title: `Not found · ${NAME}`, desc: 'Not found.', canonical: '/404.html', noindex: true,
  body: '<h1 class="listhead">Page not found</h1><p>This page has wandered off, as things do. <a href="/">Back to the front page</a>.</p>' }));

put('/search.json', JSON.stringify(articles.map(a => ({ t: a.title, d: a.dek, c: dimsLabel(a), place: a.place || '', topic: a.topic || '', g: a.tags, u: url(a), p: a.publishedAt, i: a.image?.thumb.src || '',
  x: a.body.replace(/[#*]/g, '').slice(0, 1500) })).concat(onThisDay.map(o => ({ t: o.title, d: o.dek, c: 'On this day', g: [], u: otdUrl(o), p: o.publishedAt, i: o.image?.thumb.src || '', x: o.body.replace(/[#*]/g, '').slice(0, 1500) })), lessons.map(l => ({ t: l.name, d: `“${l.quote}”`, c: 'From history', g: [], u: lessonUrl(l), p: l.publishedAt, i: l.image?.thumb.src || '', x: l.about.replace(/[#*]/g, '').slice(0, 1500) })))));

const rssItems = articles.slice(0, 50).map(a => `<item><title>${esc(a.title)}</title><link>${SITE}${url(a)}</link><guid>${SITE}${url(a)}</guid><pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate>${[a.place, a.topic].filter(Boolean).map(c => `<category>${esc(c)}</category>`).join('')}<description>${esc(a.dek)}</description></item>`).join('');
const latest = list => list.map(x => x.publishedAt).sort().pop();
put('/feed.xml', `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${NAME}</title><link>${SITE}/</link><description>${TAGLINE}</description><language>en-gb</language>${articles.length ? `<lastBuildDate>${new Date(latest(articles)).toUTCString()}</lastBuildDate>` : ''}<atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>${rssItems}</channel></rss>`);
// Every page worth finding, with when it last changed. Tag pages are left out: they only repeat the articles.
const sitemapPages = [['/', latest(articles)], ...PLACES.map(p => [`/place/${slug(p)}/`, latest(articles.filter(a => a.place === p))]), ...usedTopics.map(c => [`/category/${slug(c)}/`, latest(articles.filter(a => a.topic === c))]), ...retiredCats.map(c => [`/category/${slug(c)}/`, latest(articles.filter(a => a.category === c))]),
  ...articles.map(a => [url(a), a.publishedAt]), ['/history/', latest([...onThisDay, ...lessons])],
  ...onThisDay.map(o => [otdUrl(o), o.publishedAt]), ...lessons.map(l => [lessonUrl(l), l.publishedAt]), ['/about/'], ['/prompts/'], ['/tags/']];
put('/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapPages.map(([u, t]) => `<url><loc>${SITE}${u}</loc>${t ? `<lastmod>${t}</lastmod>` : ''}</url>`).join('')}</urlset>`);
// Google News sitemap: only articles from the last two days, as Google asks.
const fresh = articles.filter(a => Date.now() - new Date(a.publishedAt) < 2 * 86400e3);
put('/news-sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${fresh.map(a => `<url><loc>${SITE}${url(a)}</loc><news:news><news:publication><news:name>${NAME}</news:name><news:language>en</news:language></news:publication><news:publication_date>${a.publishedAt}</news:publication_date><news:title>${esc(a.title)}</news:title></news:news></url>`).join('')}</urlset>`);
put('/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\nSitemap: ${SITE}/news-sitemap.xml\n`);

// Write everything, plus static assets.
fs.rmSync(OUT, { recursive: true, force: true });
for (const [p, s] of files) { const f = path.join(OUT, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); }
fs.cpSync(path.join(ROOT, 'static'), OUT, { recursive: true });
if (fs.existsSync(path.join(CONTENT, 'images'))) fs.cpSync(path.join(CONTENT, 'images'), path.join(OUT, 'img'), { recursive: true });
console.log(`built ${files.size} files, ${articles.length} articles, ${onThisDay.length} on this day, ${lessons.length} from history -> ${OUT}`);
