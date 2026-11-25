/* OpenAI-compatible chat client for free-tier / open-weight providers. Runs in the browser; the API key
   never leaves the user's machine except in the Authorization header sent to the provider they chose. */
(function (root) {
  const PRESETS = {
    groq: { label: 'Groq (free tier, open-weight)', baseUrl: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b', models: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.6-27b'], needsKey: true, gapMs: 2500, keyHelp: 'https://console.groq.com/keys' },
    gemini: { label: 'Google Gemini (free tier)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-flash-latest', models: ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'], needsKey: true, gapMs: 1500, keyHelp: 'https://aistudio.google.com/apikey' },
    openrouter: { label: 'OpenRouter (":free" models only)', baseUrl: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct:free', models: ['meta-llama/llama-3.3-70b-instruct:free', 'openai/gpt-oss-20b:free'], needsKey: true, gapMs: 3000, keyHelp: 'https://openrouter.ai/keys' },
    ollama: { label: 'Ollama (local, open-weight)', baseUrl: 'http://localhost:11434/v1', model: 'llama3.1:8b', models: ['llama3.1:8b', 'llama3.2:3b', 'qwen2.5:7b'], needsKey: false, gapMs: 0, keyHelp: 'https://ollama.com' },
    custom: { label: 'Custom OpenAI-compatible endpoint', baseUrl: '', model: '', needsKey: false, gapMs: 1000, keyHelp: '' },
  };

  // Free-tier guard: refuse the one case we can detect locally (OpenRouter paid models).
  function freeGuard(cfg) {
    if (cfg.preset === 'ollama' && cfg.baseUrl && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/v1\/?$/.test(cfg.baseUrl)) return { ok: false, msg: 'Ollama must use a local loopback endpoint.' };
    if (cfg.preset === 'openrouter' && !/:free$/.test(cfg.model || '')) return { ok: false, msg: 'OpenRouter models must end in ":free" to comply with the Equal Access AI Policy.' };
    return { ok: true, msg: '' };
  }

  function apiMsg(t) { try { const j = JSON.parse(t); const m = (j.error && (j.error.message || j.error)) || j.message || (Array.isArray(j) && j[0] && j[0].error && j[0].error.message); return String(m || '').replace(/\s+/g, ' ').slice(0, 200); } catch (e) { return String(t || '').replace(/\s+/g, ' ').slice(0, 200); } }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function createProvider(cfg, hooks) {
    const guard = freeGuard(cfg);
    if (!guard.ok) throw new Error(guard.msg);
    const preset = PRESETS[cfg.preset] || PRESETS.custom;
    const base = ((cfg.preset === 'custom' || cfg.preset === 'ollama') ? (cfg.baseUrl || preset.baseUrl) : preset.baseUrl).replace(/\/+$/, '');
    let last = 0, jsonModeOk = true, effortOk = true;

    async function chat({ system, user, json }) {
      const gap = preset.gapMs - (Date.now() - last);
      if (gap > 0) await sleep(gap);
      let attempt = 0, delay = 4000;
      for (;;) {
        attempt++;
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 90000);
        try {
          const body = { model: cfg.model || preset.model, temperature: 0.2, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
          if (json && jsonModeOk) body.response_format = { type: 'json_object' };
          if (effortOk && cfg.preset === 'groq' && /gpt-oss/.test(body.model)) body.reasoning_effort = 'low';
          const headers = { 'Content-Type': 'application/json' };
          if (cfg.key) headers.Authorization = 'Bearer ' + cfg.key;
          last = Date.now();
          const res = await fetch(base + '/chat/completions', { method: 'POST', headers, body: JSON.stringify(body), signal: ctl.signal });
          if (res.ok) {
            const data = await res.json();
            const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
            if (typeof text !== 'string') throw new Error('Provider returned no text');
            return { text, usage: data.usage || {} };
          }
          const detail = (await res.text().catch(() => '')).slice(0, 300);
          if (res.status === 404 && /model/i.test(detail)) throw Object.assign(new Error('The provider says model “' + (cfg.model || preset.model) + '” is not available to your key. Press “Test connection” to see the models your key can use. (' + apiMsg(detail) + ')'), { fatal: true, modelNotFound: true });
          if (res.status === 400 && effortOk && /reasoning/i.test(detail)) { effortOk = false; continue; }
          if (res.status === 400 && json && jsonModeOk && /response_format|json/i.test(detail)) { jsonModeOk = false; continue; }
          if (res.status === 413) throw Object.assign(new Error('The request is too large for this free tier (HTTP 413). Use shorter transcripts, fewer interviews at once, or pick a different model.'), { fatal: true });
          if (/free tier is not available|set up billing/i.test(detail)) throw Object.assign(new Error('This provider’s free tier is not available for your account or region, and paid plans are not allowed in this hackathon. Switch to Groq (free) or OpenRouter (:free models).'), { fatal: true, freeTier: true });
          if (res.status === 401 || res.status === 403) throw Object.assign(new Error('The provider rejected the request (HTTP ' + res.status + '): ' + (apiMsg(detail) || 'no detail') + ' Check that the key belongs to this provider and is active.'), { fatal: true, auth: true });
          if ((res.status === 429 || res.status >= 500) && attempt < 5) {
            const ra = parseFloat(res.headers.get('retry-after'));
            const wait = Number.isFinite(ra) ? Math.max(0, Math.min(ra * 1000, 30000)) : Math.min(delay, 30000);
            if (hooks && hooks.onRetry) hooks.onRetry('HTTP ' + res.status + ': waiting ' + Math.round(wait / 1000) + 's (free-tier rate limit), retry ' + attempt + '/4');
            await sleep(wait); delay *= 2; continue;
          }
          throw Object.assign(new Error('Provider error HTTP ' + res.status + ': ' + detail), { fatal: true });
        } catch (err) {
          if (err.fatal) throw err;
          if (err.name === 'AbortError') err = new Error('The provider timed out after 90s.');
          else if (err instanceof TypeError) err = new Error('Network/CORS error reaching ' + base + '. For Ollama set OLLAMA_ORIGINS=* and restart it.');
          if (attempt < 3 && !/rejected the request/.test(err.message)) { await sleep(delay); delay *= 2; continue; }
          throw err;
        } finally { clearTimeout(timer); }
      }
    }
    return { label: preset.label + ' · ' + (cfg.model || preset.model), isSandbox: false, chat };
  }

  // Ask the provider which models this key can actually use (OpenAI-compatible GET /models).
  const SKIP = /whisper|guard|tts|embed|playai|orpheus|moderation|image|vision|audio|transcri|rerank|safeguard/i;
  const PREFER = [/gpt-oss-120b/, /llama-3\.3-70b/, /llama-3\.1-70b/, /gemini-2\.5-flash$/, /gemini-2\.5-flash-lite/, /gpt-oss-20b/, /llama-3\.1-8b/, /llama/i, /gemini/i];
  async function listModels(cfg) {
    const preset = PRESETS[cfg.preset] || PRESETS.custom;
    const base = ((cfg.preset === 'custom' || cfg.preset === 'ollama') ? (cfg.baseUrl || preset.baseUrl) : preset.baseUrl).replace(/\/+$/, '');
    const headers = cfg.key ? { Authorization: 'Bearer ' + cfg.key } : {};
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
    try {
      const res = await fetch(base + '/models', { headers, signal: ctl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json(); const arr = Array.isArray(j) ? j : (j.data || j.models || []);
      let ids = arr.map((m) => String((m && (m.id || m.name)) || '').replace(/^models\//, '')).filter((x) => x && !SKIP.test(x));
      if (cfg.preset === 'openrouter') ids = ids.filter((x) => /:free$/.test(x));
      return [...new Set(ids)];
    } finally { clearTimeout(t); }
  }
  function rankModels(ids) {
    const score = (m) => { const i = PREFER.findIndex((r) => r.test(m)); return i < 0 ? 99 : i; };
    return ids.slice().sort((a, b) => score(a) - score(b) || a.localeCompare(b));
  }
  root.GT_LLM = { PRESETS, createProvider, freeGuard, listModels, rankModels };
})(typeof self !== 'undefined' ? self : this);
