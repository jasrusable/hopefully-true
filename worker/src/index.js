// Kick off the daily edition at 04:37 Europe/Zurich by dispatching
// .github/workflows/daily.yml on jasrusable/hopefully-true.
// Cron triggers are UTC, so both 02:37 and 03:37 fire; we only dispatch
// when Zurich local time is 04:xx. The HTTP path is a protected test hook
// that can only dispatch generate=false (rebuild and deploy, no new articles).
import { isZurich0437Hour, zurichParts } from './time.js';

const REPO = 'jasrusable/hopefully-true';
const WORKFLOW = 'daily.yml';
const BRANCH = 'main';

export default {
  async scheduled(controller, env) {
    const when = new Date(controller.scheduledTime);
    const local = zurichParts(when);
    if (!isZurich0437Hour(when)) {
      console.log(`skip cron ${controller.cron}: Zurich is ${local.date} ${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}, not 04:xx`);
      return;
    }
    const result = await dispatch(env, true);
    console.log(`dispatch generate=true at Zurich ${local.date} 04:xx: ${JSON.stringify(result)}`);
    if (!result.ok) throw new Error(result.error || `GitHub dispatch failed (${result.status})`);
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/') {
      return json({ ok: true, service: 'hopefully-true-daily', hint: 'POST /dispatch with Authorization: Bearer <GITHUB_TOKEN> to run generate=false' });
    }
    if (request.method === 'POST' && url.pathname === '/dispatch') {
      const expected = env.GITHUB_TOKEN;
      const auth = request.headers.get('Authorization') || '';
      if (!expected || auth !== `Bearer ${expected}`) {
        return json({ ok: false, error: 'unauthorized' }, 401);
      }
      // The HTTP path can never generate an edition.
      const result = await dispatch(env, false);
      return json(result, result.ok ? 200 : 502);
    }
    return json({ ok: false, error: 'not found' }, 404);
  },
};

async function dispatch(env, generate) {
  const token = env.GITHUB_TOKEN;
  if (!token) return { ok: false, error: 'GITHUB_TOKEN is not set' };
  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'hopefully-true-daily',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref: BRANCH,
      inputs: { generate: generate ? 'true' : 'false' },
    }),
  });
  if (res.status === 204) return { ok: true, generate, status: 204 };
  const text = await res.text();
  return { ok: false, generate, status: res.status, error: text.slice(0, 500) };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
