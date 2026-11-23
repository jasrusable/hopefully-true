// A tiny client for the xAI API: text (with optional search tools) and images.
// Every call returns what it cost in US dollars, so the daily run can keep to its budget.
const API = 'https://api.x.ai/v1';
const usd = usage => (usage?.cost_in_usd_ticks || 0) / 1e10; // xAI reports cost in 1/10,000,000,000 dollars

async function post(endpoint, body) {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error('Set XAI_API_KEY first');
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`${API}/${endpoint}`, {
        method: 'POST', signal: AbortSignal.timeout(300_000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`xAI ${res.status}: ${JSON.stringify(json.error || json).slice(0, 300)}`);
      return json;
    } catch (err) {
      if (attempt === 3) throw err;
      console.error(`  xAI call failed (${err.message}), retrying`);
      await new Promise(r => setTimeout(r, 5000 * attempt));
    }
  }
}

// Ask a model a question and get JSON back in the given shape.
export async function ask({ model, prompt, schema, search = [], maxSearches = 5 }) {
  const tools = search.map(type => ({ type })); // 'web_search', 'x_search'
  const json = await post('responses', {
    model, input: [{ role: 'user', content: prompt }],
    ...(tools.length && { tools, max_tool_calls: maxSearches, include: ['web_search_call.action.sources'] }),
    text: { format: { type: 'json_schema', name: 'answer', schema, strict: true } },
  });
  // Reasoning models also send 'reasoning' items (encrypted, never needed here); read only the message.
  const text = json.output.filter(o => o.type === 'message').flatMap(o => o.content).map(c => c.text || '').join('');
  // Every page the search tools actually returned, so callers can drop any link the model made up.
  const seen = new Set(json.output.flatMap(o => [
    ...(o.action?.sources || []).map(x => x.url),
    ...(o.content || []).flatMap(c => (c.annotations || []).map(a => a.url)),
  ]).filter(Boolean).map(normalizeUrl));
  return { answer: JSON.parse(text), usd: usd(json.usage), seen };
}

// "https://www.example.com/a/b/?utm=1" and "http://example.com/a/b" are the same page.
export const normalizeUrl = u => String(u).replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();

// Draw one picture and get it back as JPEG bytes.
export async function draw({ model, prompt }) {
  const json = await post('images/generations', { model, prompt, n: 1, aspect_ratio: '16:9', response_format: 'b64_json' });
  return { bytes: Buffer.from(json.data[0].b64_json, 'base64'), usd: usd(json.usage) };
}
