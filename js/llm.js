/* OpenAI-compatible chat client for free-tier / open-weight providers. Runs in the browser; the API key
   never leaves the user's machine except in the Authorization header sent to the provider they chose. */
(function (root) {
  const PRESETS = {
    gemini: { label: 'Google Gemini (free tier)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'], needsKey: true, gapMs: 1500, keyHelp: 'https://aistudio.google.com/apikey' },
    groq: { label: 'Groq (free tier, open-weight Llama)', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'], needsKey: true, gapMs: 2500, keyHelp: 'https://console.groq.com/keys' },
    openrouter: { label: 'OpenRouter (":free" models only)', baseUrl: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct:free', models: ['meta-llama/llama-3.3-70b-instruct:free', 'openai/gpt-oss-20b:free'], needsKey: true, gapMs: 3000, keyHelp: 'https://openrouter.ai/keys' },
    ollama: { label: 'Ollama (local, open-weight)', baseUrl: 'http://localhost:11434/v1', model: 'llama3.1:8b', models: ['llama3.1:8b', 'llama3.2:3b', 'qwen2.5:7b'], needsKey: false, gapMs: 0, keyHelp: 'https://ollama.com' },
    custom: { label: 'Custom OpenAI-compatible endpoint', baseUrl: '', model: '', needsKey: false, gapMs: 1000, keyHelp: '' },
  };

  // Free-tier guard: refuse the one case we can detect locally (OpenRouter paid models).
  function freeGuard(cfg) {
    if (cfg.preset === 'openrouter' && !/:free$/.test(cfg.model || '')) return { ok: false, msg: 'OpenRouter models must end in ":free" to comply with the Equal Access AI Policy.' };
    return { ok: true, msg: '' };
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function createProvider(cfg, hooks) {
    const guard = freeGuard(cfg);
    if (!guard.ok) throw new Error(guard.msg);
    const preset = PRESETS[cfg.preset] || PRESETS.custom;
    const base = (cfg.baseUrl || preset.baseUrl).replace(/\/+$/, '');
    let last = 0, jsonModeOk = true;

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
          if (res.status === 404 && /model/i.test(detail)) throw Object.assign(new Error('The provider says model “' + (cfg.model || preset.model) + '” is not available to your key. Press “Test connection” to see the models your key can use. (' + detail.replace(/\s+/g, ' ').slice(0, 160) + ')'), { fatal: true, modelNotFound: true });
          if (res.status === 400 && json && jsonModeOk && /response_format|json/i.test(detail)) { jsonModeOk = false; continue; }
          if (res.status === 413) throw Object.assign(new Error('The request is too large for this free tier (HTTP 413). Use shorter transcripts, fewer interviews at once, or pick a different model.'), { fatal: true });
          if (res.status === 401 || res.status === 403) throw Object.assign(new Error('The provider rejected the API key (HTTP ' + res.status + ').'), { fatal: true });
          if ((res.status === 429 || res.status >= 500) && attempt < 5) {
            const ra = parseFloat(res.headers.get('retry-after'));
            const wait = Number.isFinite(ra) ? ra * 1000 : delay;
            if (hooks && hooks.onRetry) hooks.onRetry('HTTP ' + res.status + ': waiting ' + Math.round(wait / 1000) + 's (free-tier rate limit), retry ' + attempt + '/4');
            await sleep(wait); delay *= 2; continue;
          }
          throw Object.assign(new Error('Provider error HTTP ' + res.status + ': ' + detail), { fatal: true });
        } catch (err) {
          if (err.fatal) throw err;
          if (err.name === 'AbortError') err = new Error('The provider timed out after 90s.');
          else if (err instanceof TypeError) err = new Error('Network/CORS error reaching ' + base + '. For Ollama set OLLAMA_ORIGINS=* and restart it.');
          if (attempt < 3 && !/rejected the API key/.test(err.message)) { await sleep(delay); delay *= 2; continue; }
          throw err;
        } finally { clearTimeout(timer); }
      }
    }
    return { label: preset.label + ' · ' + (cfg.model || preset.model), isSandbox: false, chat };
  }

  // Ask the provider which models this key can actually use (OpenAI-compatible GET /models).
  const SKIP = /whisper|guard|tts|embed|playai|orpheus|moderation|image|vision|audio|transcri|rerank|safeguard/i;
  const PREFER = [/llama-3\.3-70b/, /gpt-oss-120b/, /llama-3\.1-70b/, /gemini-2\.5-flash$/, /gemini-2\.5-flash-lite/, /gpt-oss-20b/, /llama-3\.1-8b/, /llama/i, /gemini/i];
  async function listModels(cfg) {
    const preset = PRESETS[cfg.preset] || PRESETS.custom;
    const base = (cfg.baseUrl || preset.baseUrl).replace(/\/+$/, '');
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
