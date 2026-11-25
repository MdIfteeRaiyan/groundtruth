/* Groundtruth UI. Vanilla JS, no build step, no backend. */
(function () {
  'use strict';
  const GT = window.GT, LLM = window.GT_LLM, SAMPLES = window.GT_SAMPLES;

  // Set this to your public repository URL before deploying; a "Source" link then appears in the footer.
  const REPO_URL = 'https://github.com/MdIfteeRaiyan/groundtruth';

  const STORE = 'groundtruth.session.v1', THEME = 'groundtruth.theme';
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LABEL = { supported: 'Supported', contradicted: 'Contradicted', mixed: 'Mixed', untested: 'Untested' };
  const GUT = { supported: 'Probably true', contradicted: 'Probably false', unsure: 'No idea' };
  const STEPS = ['Setup', 'Gut check', 'Agent run', 'Checkpoint', 'Decision memo'];
  const ICON = {
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>',
  };

  const S = {
    v: 1, step: 1, interviews: [], assumptions: [], startup: '', sampleId: '',
    cfg: { mode: 'sandbox', preset: 'groq', model: '', baseUrl: '', key: '' },
    gut: {}, run: null, decisions: {}, draft: {}, memo: null, memoApproved: false,
    t0: Date.now(), tMemo: null, open: {},
  };
  let provider = null, busy = false, restored = false;

  /* ---------- persistence (the API key is never saved) ---------- */
  try {
    const d = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (d && d.v === 1 && (d.interviews || []).length) {
      Object.assign(S, d); S.cfg = Object.assign({ mode: 'sandbox', preset: 'groq', model: '', baseUrl: '' }, d.cfg, { key: '' });
      if (/^(llama-3\.3-70b-versatile|llama-3\.1-8b-instant)$/.test(S.cfg.model || '')) { S.cfg.model = ''; S.cfg.modelOther = false; } // retired by Groq on 16 Aug 2026
      if (S.run && !S.run.done) { S.run = null; S.step = Math.min(S.step, 2); }
      if (S.step > 1 && !setupValid()) S.step = 1;
      restored = true;
    }
  } catch (_) { /* storage unavailable: the app still works, without resume */ }
  let saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORE, JSON.stringify(Object.assign({}, S, { cfg: Object.assign({}, S.cfg, { key: '' }) }))); } catch (_) { /* quota or private mode */ }
    }, 250);
  }

  /* ---------- helpers ---------- */
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.remove('show'), 3600); }
  function announce(msg) { const r = $('#sr'); r.textContent = ''; setTimeout(() => { r.textContent = msg; }, 60); }
  function download(name, text, mime) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  function setPath(obj, path, val) { const p = path.split('.'); let o = obj; while (p.length > 1) o = o[p.shift()]; o[p[0]] = val; }
  const fmtMin = (ms) => { const m = ms / 60000; return m < 1 ? Math.max(1, Math.round(ms / 1000)) + ' sec' : (m < 10 ? m.toFixed(1) : Math.round(m)) + ' min'; };
  const isOpen = (k, def) => (k in S.open ? S.open[k] : def);
  const gate = () => GT.checkGate(S.assumptions, S.decisions);
  function setupValid() { return S.interviews.length > 0 && S.interviews.length <= 12 && S.interviews.every(t => typeof t === 'string' && t.trim() && t.trim().split(/\s+/).length <= 6000 && GT.makeInterview('i0', t).turns.some(x => x.role === 'interviewee' && x.text.trim())) && new Set(S.interviews.map(t => t.trim())).size === S.interviews.length && S.assumptions.length > 0 && S.assumptions.length <= 8 && S.assumptions.every(a => a.text.trim()); }
  const presetOf = () => LLM.PRESETS[S.cfg.preset] || LLM.PRESETS.custom;
  const sampleTexts = new Set(SAMPLES.flatMap((s) => s.interviews));
  const onlySampleData = () => S.interviews.length > 0 && S.interviews.every((t) => sampleTexts.has(t));
  const theme = () => document.documentElement.getAttribute('data-theme') || 'dark';
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

  function getProvider() {
    if (provider) return provider;
    provider = S.cfg.mode === 'sandbox' ? window.createSandboxProvider() : LLM.createProvider(S.cfg, { onRetry: (m) => logLine(m, 'w') });
    return provider;
  }
  const needsKeyMissing = () => S.cfg.mode === 'live' && presetOf().needsKey && !S.cfg.key;
  const sandboxBlocked = () => S.cfg.mode === 'sandbox' && S.interviews.length > 0 && !onlySampleData();

  function invalidate(quiet) {
    if (!S.run) return;
    S.run = null; S.reviewId = ''; S.decisions = {}; S.draft = {}; S.memo = null; S.memoApproved = false; S.tMemo = null; S.open = {};
    if (!quiet) toast('Setup changed, so the previous results were cleared.');
  }
  function available(n) {
    if (n === 1) return true;
    if (n === 2) return setupValid();
    if (n === 3) return !!S.run;
    if (n === 4) return !!(S.run && S.run.done);
    return !!(S.run && S.run.done && gate().ok);
  }

  /* ---------- markdown: escape first, then a small safe subset ---------- */
  function md(src, evById) {
    const inline = (t) => t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[(i\d+-\d+)\]/g, (m, id) => { const e = evById[id]; return e ? '<span class="cite" title="' + esc(e.who + ' (' + e.kind + '): ' + e.quote) + '">' + id + '</span>' : '<span class="cite bad" title="Not in the verified evidence">' + id + '</span>'; });
    let out = '', list = null, tbl = [];
    const closeList = () => { if (list) { out += '</' + list + '>'; list = null; } };
    const flushTbl = () => {
      if (!tbl.length) return;
      const rows = tbl.filter((r) => !/^\|\s*-/.test(r)).map((r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
      out += '<table><thead><tr>' + rows[0].map((c) => '<th scope="col">' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' + rows.slice(1).map((r) => '<tr>' + r.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
      tbl = [];
    };
    for (const l of esc(src).split('\n')) {
      if (/^\|/.test(l)) { closeList(); tbl.push(l); continue; }
      flushTbl();
      let m;
      if ((m = l.match(/^(#{1,3})\s+(.*)/))) { closeList(); out += '<h' + m[1].length + '>' + inline(m[2]) + '</h' + m[1].length + '>'; }
      else if ((m = l.match(/^[-*]\s+(.*)/))) { if (list !== 'ul') { closeList(); out += '<ul>'; list = 'ul'; } out += '<li>' + inline(m[1]) + '</li>'; }
      else if ((m = l.match(/^\d+\.\s+(.*)/))) { if (list !== 'ol') { closeList(); out += '<ol>'; list = 'ol'; } out += '<li>' + inline(m[1]) + '</li>'; }
      else if (!l.trim()) closeList();
      else { closeList(); out += '<p>' + inline(l) + '</p>'; }
    }
    closeList(); flushTbl();
    return out;
  }

  /* ---------- chrome ---------- */
  function renderChrome() {
    const live = S.cfg.mode === 'live', p = presetOf(), dark = theme() === 'dark';
    $('#tools').innerHTML =
      '<span class="chip ' + (live ? 'live' : 'sandbox') + '"><i aria-hidden="true"></i>' + (live ? esc(p.label.split(' (')[0]) + ' · ' + esc(S.cfg.model || p.model || 'custom') : 'Sandbox mode') + '</span>' +
      (S.interviews.length ? '<button class="btn sm ghost hide-sm" data-action="newsession">New session</button><button class="iconbtn show-sm" data-action="newsession" aria-label="New session" title="New session">' + ICON.reset + '</button>' : '') +
      '<button class="iconbtn" data-action="dlg" data-k="guide" aria-label="How to use Groundtruth" title="How to use">' + ICON.help + '</button>' +
      '<button class="iconbtn" data-action="theme" aria-label="Switch to ' + (dark ? 'light' : 'dark') + ' theme" title="Switch to ' + (dark ? 'light' : 'dark') + ' theme">' + (dark ? ICON.sun : ICON.moon) + '</button>';
    $('#stepper').innerHTML = STEPS.map((name, i) => {
      const n = i + 1, now = n === S.step, can = !now && available(n), locked = !now && !can, done = n < S.step || (!now && (n < 5 ? available(n + 1) : S.memoApproved));
      const cls = ['step', done && !now ? 'done' : '', now ? 'now' : '', can ? 'go' : '', locked ? 'lock' : '', n === 4 ? 'gate' : ''].join(' ');
      const label = name + (now ? ', current step' : done ? ', completed' : can ? '' : ', locked, select to see what is needed');
      return '<button class="' + cls + '" ' + (now ? '' : 'data-action="goto" data-n="' + n + '"') + (locked ? ' aria-disabled="true"' : '') + (now ? ' aria-current="step"' : '') + ' aria-label="Step ' + n + ': ' + label + '"><b aria-hidden="true">' + (done && !now ? '✓' : n) + '</b><span aria-hidden="true">' + name + '</span></button>';
    }).join('');
    const pb = $('#progBar'); if (pb) pb.style.width = (S.step / STEPS.length * 100) + '%';
    $('#repoLink').innerHTML = REPO_URL ? '<a class="linkbtn" href="' + esc(REPO_URL) + '" target="_blank" rel="noopener">Source code</a>' : '';
  }

  let enterNext = true;
  function render() {
    const y = window.scrollY, active = document.activeElement, focusKey = active && active.id;
    renderChrome();
    $('#app').innerHTML = [null, viewSetup, viewGut, viewRun, viewReview, viewMemo][S.step]();
    window.scrollTo(0, y);
    if (enterNext) { enterNext = false; playEnter(); }
    if (focusKey && active !== document.body) { const el = document.getElementById(focusKey); if (el && el !== active) el.focus({ preventScroll: true }); }
    save();
  }
  function go(n) {
    S.step = n; enterNext = true; render(); window.scrollTo({ top: 0 });
    const h = $('#app h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    document.title = STEPS[n - 1] + ' · Groundtruth';
  }

  function modelFieldHtml(pr) {
    const list = pr.models || [], cur = S.cfg.model || '';
    const other = !list.length || (cur ? !list.includes(cur) : S.cfg.modelOther === S.cfg.preset);
    const sel = list.length ? `<label class="f" for="modelSel">Model</label><select id="modelSel">${list.map((m) => `<option value="${esc(m)}" ${!other && (cur === m || (!cur && m === list[0])) ? 'selected' : ''}>${esc(m)}${m === list[0] ? ' (recommended)' : ''}</option>`).join('')}<option value="__other" ${other ? 'selected' : ''}>Other…</option></select>` : '';
    const txt = other ? `<label class="f" for="model">${list.length ? 'Model name' : 'Model'}</label><input type="text" id="model" data-bind="cfg.model" value="${esc(cur)}" placeholder="${esc(pr.model || 'model name')}" autocomplete="off" spellcheck="false">` : '';
    return sel + txt;
  }
  function lockReason(n) {
    if (n === 2) return !S.interviews.length ? 'Add an interview first, or load a sample.' : 'Fill in at least one assumption first.';
    if (n === 5) return S.run && S.run.done ? 'Decide every assumption at the checkpoint first (accept, override or park).' : 'Run the agent and decide each assumption first.';
    return setupValid() ? 'Press “Run the agent” on the gut-check step first.' : 'Finish Setup first.';
  }

  /* ---------- key sanity hints ---------- */
  function keyWarnHtml() {
    const k = (S.cfg.key || '').trim(), p = S.cfg.preset;
    if (/^xai-/i.test(k)) return '<div class="notice amber">This looks like an <b>xAI Grok</b> key. xAI is a paid API, so it does not meet the hackathon’s free-tier rule. For your submission use a free <b>Groq</b> key (starts with <code>gsk_</code>, a different company). You can still try it locally via <i>Custom endpoint</i> with <code>https://api.x.ai/v1</code>.</div>';
    if (/^gsk_/.test(k) && p !== 'groq') return '<div class="notice amber">This is a Groq key. Choose <b>Groq</b> as the provider above.</div>';
    if (/^AIza/.test(k) && p !== 'gemini') return '<div class="notice amber">This is a Google key. Choose <b>Google Gemini</b> as the provider above.</div>';
    return '';
  }

  /* ---------- section motion: runs only when a step is entered ---------- */
  const calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function playEnter() {
    if (calm || !('IntersectionObserver' in window)) return;
    const els = [...document.querySelectorAll('#app .hero, #app .head, #app .flow, #app section.card, #app .acard, #app .notice')].filter((e, i, a) => !a.some((o) => o !== e && o.contains(e)));
    const vh = window.innerHeight; let n = 0;
    const io = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    els.forEach((el) => {
      el.classList.add('rv');
      if (el.getBoundingClientRect().top < vh) el.style.setProperty('--i', Math.min(n++, 6));
      io.observe(el);
    });
    setTimeout(() => els.forEach((el) => el.classList.add('in')), 1600); // safety net: never leave content hidden
  }

  /* ---------- 1. setup ---------- */
  function viewSetup() {
    const P = LLM.PRESETS, live = S.cfg.mode === 'live', pr = presetOf();
    const total = S.interviews.reduce((n, t) => n + t.split(/\s+/).filter(Boolean).length, 0);
    const first = !S.interviews.length;
    const intro = first ? `
      <section class="hero" aria-labelledby="heroTitle">
        <div class="badge-top">Evidence-based · free-tier models only</div>
        <h1 id="heroTitle">Know what your interviews <em>actually prove.</em></h1>
        <p>Paste your customer interviews and the assumptions your startup depends on. Groundtruth verifies every quote, scores each assumption with transparent rules, attacks its own verdicts, and stops until you make the call.</p>
        <div class="cta"><button class="btn primary lg" data-action="quick" data-id="nudgepay">Try the sample, no key needed</button><button class="btn lg" data-action="dlg" data-k="guide">How it works</button></div>
        <p class="cta-note">Two synthetic samples included: freelance invoicing, or <button data-action="quick" data-id="shiftfill">restaurant shift gaps</button>.</p>
        <div class="peek" aria-hidden="true">
          <div class="peek-bar"><i></i><i></i><i></i><span>Checkpoint · what the evidence says</span></div>
          <div class="peek-row"><span class="pid">A1</span><span class="pt">Freelancers are paid late regularly (at least once a month).</span><span class="badge supported">Supported</span><span class="badge robust">Robust</span></div>
          <div class="peek-row"><span class="pid">A3</span><span class="pt">Freelancers will trust software to send payment reminders in their own name.</span><span class="badge contradicted">Contradicted</span><span class="badge fragile">Fragile</span></div>
          <div class="peek-row"><span class="pid">A2</span><span class="pt">Chasing late payments is time-consuming enough to automate.</span><span class="badge mixed">Mixed</span><span class="badge">Awaiting you</span></div>
          <div class="peek-foot"><b>✓ 11 quotes verified word for word</b><span>1 invented quote rejected</span></div>
        </div>
      </section>
      <ol class="flow" aria-label="The five steps">
        <li><b>Setup</b>Paste interviews, list assumptions</li>
        <li class="h"><b>Gut check</b>Predict before you look</li>
        <li><b>Agent run</b>Extract, verify, weigh, attack</li>
        <li class="h"><b>Checkpoint</b>Accept, override or park</li>
        <li class="h"><b>Memo</b>Edit, approve, export</li>
      </ol>
      <h2 class="sr-only">Set up your own analysis</h2>` : `
      <div class="head"><div class="kicker">Step 1 of 5</div><h1>Set up the analysis</h1><p>Interviews, the assumptions you want to test, and the model. Your work saves in this browser as you go.</p></div>`;
    return intro + `
    <div class="grid2">
      <section class="card" aria-labelledby="ivTitle">
        <div class="row sp wrap"><h2 id="ivTitle">Interview transcripts</h2>
          <label class="sr-only" for="sampleSel">Load a sample</label>
          <select id="sampleSel" style="width:auto;padding-top:6px;padding-bottom:6px;font-size:13px"><option value="">Load a sample…</option>${SAMPLES.map((s) => `<option value="${s.id}">${esc(s.title)}</option>`).join('')}</select></div>
        <p class="sub">One speaker per line, e.g. <code>Interviewer: …</code> then <code>Maya: …</code>. Use synthetic or anonymised data.</p>
        ${S.interviews.length ? '<ul class="ilist" style="padding:0;margin-top:0">' + S.interviews.map((t, i) => { const iv = GT.makeInterview('i' + (i + 1), t); const ok = iv.turns.some((x) => x.role === 'interviewee'); return `<li class="item iv"><details data-key="iv${i}" ${S.open['iv' + i] ? 'open' : ''}><summary><span class="av" aria-hidden="true">${esc(iv.name.slice(0, 1).toUpperCase())}</span><span class="meta"><b>${esc(iv.name)}</b><small>Interview ${i + 1} · ${iv.words} words · ${iv.turns.length} turns${ok ? '' : ' · <span class="warn">no interviewee lines found</span>'}<span class="show"> · read or edit</span></small></span></summary><label class="sr-only" for="iv-${i}">Transcript of interview ${i + 1}</label><textarea id="iv-${i}" data-iv="${i}" spellcheck="false">${esc(t)}</textarea></details><button class="btn sm ghost" data-action="rmiv" data-i="${i}" aria-label="Remove interview with ${esc(iv.name)}">Remove</button></li>`; }).join('') + '</ul>' : ''}
        <label class="f" for="newIv">${S.interviews.length ? 'Add another interview' : 'Paste an interview'}</label>
        <textarea id="newIv" placeholder="Interviewer: Tell me about the last time…&#10;Maya: Last month actually…" aria-describedby="ivCount"></textarea>
        <div class="row wrap" style="margin-top:10px"><button class="btn sm" data-action="addiv">Add interview</button>
          <button class="btn sm ghost" data-action="upload">${ICON.up}Upload .txt / .md</button><input type="file" id="file" accept=".txt,.md,text/plain,text/markdown" multiple hidden>
          <span class="hint grow right" id="ivCount" style="margin:0">${plural(S.interviews.length, 'interview')} · ${total.toLocaleString()} words</span></div>
      </section>
      <div class="stack">
        <section class="card" aria-labelledby="aTitle">
          <h2 id="aTitle">What you are testing</h2>
          <label class="f" for="startup" style="margin-top:8px">Your startup in one line <span class="hint">(optional, gives the memo context)</span></label>
          <input type="text" id="startup" data-bind="startup" value="${esc(S.startup)}" placeholder="e.g. An app that chases late invoices for freelancers">
          <label class="f" id="aLbl">Riskiest assumptions, phrased so they could turn out false</label>
          <div role="group" aria-labelledby="aLbl">
          ${S.assumptions.map((a, i) => `<div class="aitem"><span class="id" aria-hidden="true">${esc(a.id)}</span><input type="text" id="as-${i}" data-bind-a="${i}" value="${esc(a.text)}" placeholder="e.g. Customers will pay at least €15 a month" aria-label="Assumption ${esc(a.id)}"><button class="btn sm ghost" data-action="rma" data-i="${i}" aria-label="Remove assumption ${esc(a.id)}">✕</button></div>`).join('') || '<div class="empty" style="margin-bottom:10px">No assumptions yet.</div>'}
          </div>
          <div class="row"><button class="btn sm" data-action="adda" ${S.assumptions.length >= 8 ? 'disabled' : ''}>Add assumption</button><span class="hint grow right" style="margin:0">${S.assumptions.length} of 8</span></div>
        </section>
        <section class="card" aria-labelledby="mTitle">
          <h2 id="mTitle">Model</h2><p class="sub">Free-tier or open-weight models only. Your key stays in this tab and is never saved.</p>
          <div class="seg" role="group" aria-label="Model mode"><button aria-pressed="${!live}" data-action="mode" data-v="sandbox">Sandbox</button><button aria-pressed="${live}" data-action="mode" data-v="live">Live model</button></div>
          ${live ? `
            <label class="f" for="preset">Provider</label>
            <select id="preset" data-bind="cfg.preset">${Object.keys(P).map((k) => `<option value="${k}" ${k === S.cfg.preset ? 'selected' : ''}>${esc(P[k].label)}</option>`).join('')}</select>
            ${modelFieldHtml(pr)}
            ${S.cfg.preset === 'custom' || S.cfg.preset === 'ollama' ? `<label class="f" for="base">Base URL</label><input type="url" id="base" data-bind="cfg.baseUrl" value="${esc(S.cfg.baseUrl)}" placeholder="${esc(pr.baseUrl || 'https://…/v1')}" autocomplete="off" spellcheck="false">` : ''}
            ${pr.needsKey ? `<label class="f" for="key">Free API key</label><input type="password" id="key" data-bind="cfg.key" value="${esc(S.cfg.key)}" autocomplete="off" spellcheck="false" placeholder="Paste key" aria-describedby="keyHelp keyWarn"><div id="keyWarn" role="status">${keyWarnHtml()}</div>${pr.keyHelp ? `<p class="hint" id="keyHelp">Get one free at <a href="${esc(pr.keyHelp)}" target="_blank" rel="noopener">${esc(pr.keyHelp.replace('https://', ''))}</a>. Never saved.</p>` : ''}` : ''}
            ${S.cfg.preset === 'ollama' ? '<p class="hint">Start Ollama with <code>OLLAMA_ORIGINS=*</code> so the page may call it. Nothing leaves your machine.</p>' : ''}
            <div class="row wrap" style="margin-top:12px"><button class="btn sm" data-action="test">Test connection</button><span class="hint" id="testOut" role="status" style="margin:0"></span></div>
          ` : '<p class="hint" style="margin-top:12px">Sandbox replays model outputs scripted by the team for the two built-in samples, so you can try the full flow with no key. Verification, scoring and the checkpoint run the real code.</p>'}
        </section>
        ${sandboxBlocked() ? '<div class="notice amber" role="note">These are your own interviews. Sandbox only knows the built-in samples, so switch to <b>Live model</b> to analyse them (free).</div>' : ''}
      </div>
    </div>    <div class="setupbar" role="region" aria-label="Setup progress">
      <ul class="checks">
        <li class="${S.interviews.length ? 'ok' : ''}"><i aria-hidden="true">${S.interviews.length ? '✓' : '1'}</i>Interviews</li>
        <li class="${S.assumptions.some((a) => a.text.trim()) ? 'ok' : ''}"><i aria-hidden="true">${S.assumptions.some((a) => a.text.trim()) ? '✓' : '2'}</i>Assumptions</li>
        <li class="${!needsKeyMissing() && !sandboxBlocked() ? 'ok' : ''}"><i aria-hidden="true">${!needsKeyMissing() && !sandboxBlocked() ? '✓' : '3'}</i>Model</li>
      </ul>
      <span class="hint grow" style="margin:0">${!S.interviews.length ? 'Add an interview, or <button class="linkbtn" data-action="loadsample">load the sample now</button>.' : !S.assumptions.length ? 'Add at least one assumption.' : needsKeyMissing() ? 'Paste your free API key, or switch to Sandbox.' : S.interviews.length < 5 ? '<span class="warn">Fewer than 5 interviews gives weak verdicts. The app will say so.</span>' : 'Ready when you are.'}</span>
      <button class="btn primary" data-action="togut" ${setupValid() && !sandboxBlocked() ? '' : 'disabled'}>Continue</button>
    </div>`;
  }

  /* ---------- 2. gut check ---------- */
  function ctxLine() { return S.startup ? `<div class="ctx">Testing <b>${esc(S.startup.split(':')[0])}</b></div>` : ''; }
  function viewGut() {
    const locked = !!(S.run && !S.run.error);
    const done = S.assumptions.every((a) => S.gut[a.id]);
    return `
    <div class="head"><div class="kicker">Step 2 of 5 · before the agent speaks</div><h1>Commit to what you believe</h1>
    <p>People anchor on the first answer they see. Lock in a prediction for each assumption now. At the checkpoint you'll see exactly where the evidence surprised you, and how well calibrated your gut is.</p>${ctxLine()}</div>
    ${locked ? '<div class="notice amber" role="note" style="margin-bottom:14px">Predictions are locked because the agent has already run; changing them now would defeat the point. Edit the setup to start a fresh run.</div>' : ''}
    <div class="gutlist">
      ${S.assumptions.map((a) => `<div class="gut"><p><span class="id">${esc(a.id)}</span>${esc(a.text)}</p>
        <div class="seg" role="group" aria-label="Your prediction for ${esc(a.id)}">${Object.keys(GUT).map((v) => `<button data-action="gut" data-id="${esc(a.id)}" data-v="${v}" aria-pressed="${S.gut[a.id] === v}" ${locked ? 'disabled' : ''}>${GUT[v]}</button>`).join('')}</div></div>`).join('')}
    </div>
    <div class="row sp wrap" style="margin-top:20px"><button class="btn" data-action="goto" data-n="1">Back</button>
      <div class="row wrap"><span class="hint" style="margin:0" role="status">${S.assumptions.filter((a) => S.gut[a.id]).length} of ${S.assumptions.length} predicted</span>
      ${locked ? '<button class="btn primary" data-action="goto" data-n="' + (S.run.done ? 4 : 3) + '">Back to results</button>' : `<button class="btn primary" data-action="run" ${done ? '' : 'disabled'}>Lock predictions and run</button>`}</div></div>`;
  }

  /* ---------- 3. run ---------- */
  async function startRun() {
    if (busy || (S.run && !S.run.done && !S.run.error)) return;
    if (!setupValid()) { toast('Check transcript format, length and duplicates, and complete assumptions.'); go(1); return; }
    if (!S.assumptions.every(a => Object.hasOwn(GUT, S.gut[a.id]))) { toast('Complete every gut prediction first.'); go(2); return; }
    if (needsKeyMissing()) { toast('Paste your free API key in Setup, or switch to Sandbox.'); go(1); return; }
    if (sandboxBlocked()) { toast('Sandbox only knows the built-in samples. Switch to Live model.'); go(1); return; }
    try { provider = null; getProvider(); } catch (e) { toast(e.message); return; }
    S.reviewId = ''; S.decisions = {}; S.draft = {}; S.memo = null; S.memoApproved = false; S.tMemo = null; S.open = {};
    const interviews = S.interviews.map((t, i) => GT.makeInterview('i' + (i + 1), t));
    S.run = { stages: { extract: '', assess: '', redteam: '' }, per: {}, names: interviews.map((iv) => [iv.id, iv.name]), log: [], stats: { calls: 0, tokens: 0, verified: 0, rejected: 0 }, done: false, error: '', state: null, provider: provider.label, started: Date.now(), ms: 0 };
    go(3);
    announce('Agent started.');
    logLine('Run started · ' + provider.label);
    const activeRun = S.run;
    try {
      const state = await GT.runAgent({ provider, interviews, assumptions: S.assumptions.map(a => ({...a})), onEvent: e => { if (S.run === activeRun) onAgentEvent(e); } });
      if (S.run !== activeRun) return;
      delete state.trace;
      S.run.state = state; S.run.done = true; S.run.ms = Date.now() - S.run.started;
      Object.assign(S.run.stats, { calls: state.usage.calls, tokens: state.usage.prompt + state.usage.completion, verified: state.evidence.length, rejected: state.rejected.length });
      logLine('Finished in ' + fmtMin(S.run.ms) + '. The agent now stops and hands over to you.');
      announce('Agent finished. ' + state.evidence.length + ' quotes verified, ' + state.rejected.length + ' rejected. The checkpoint is ready.');
    } catch (e) { if (S.run !== activeRun) return; S.run.error = e.message || String(e); logLine(S.run.error, 'e'); announce('The run stopped: ' + S.run.error); }
    if (S.step === 3) render(); else save();
  }
  function logLine(msg, cls) { if (!S.run) return; S.run.log.push({ msg, cls: cls || '' }); if (S.step === 3) render(); }
  function onAgentEvent(e) {
    const R = S.run;
    if (e.type === 'stage') { R.stages[e.stage] = e.status; }
    if (e.type === 'call') { R.stats.calls++; R.log.push({ msg: '→ model call: ' + e.task }); }
    if (e.type === 'repair') R.log.push({ msg: 'Reply was not valid JSON; asked once more', cls: 'w' });
    if (e.type === 'interview') {
      R.per[e.id] = e; R.stats.verified += e.verified; R.stats.rejected += e.rejected;
      R.log.push({ msg: '✓ ' + e.name + ': ' + e.verified + ' quotes verified' + (e.rejected ? ', ' + e.rejected + ' rejected' : ''), cls: e.rejected ? 'w' : '' });
    }
    if (e.type === 'error') { if (e.id) R.per[e.id] = { error: e.message }; R.log.push({ msg: e.message, cls: 'e' }); }
    if (S.step === 3) render();
  }
  function coachHtml(st) {
    return '<div class="coach">' + GT.interviewCoach(st.interviews, st).map((c) => `<div class="c"><header><b>${esc(c.name)}</b><span class="badge ${c.grade === 'Strong' ? 'supported' : c.grade === 'Good' ? 'untested' : 'mixed'}">${c.grade}</span></header>
      <div class="stat"><span>Customer talk share</span><span>${Math.round(c.talk_ratio * 100)}%</span></div><div class="meter" role="img" aria-label="Customer spoke ${Math.round(c.talk_ratio * 100)} percent of the words"><i style="width:${Math.round(c.talk_ratio * 100)}%"></i></div>
      <div class="stat"><span>Concrete stories</span><span>${Math.round(c.behavior_share * 100)}% of quotes</span></div>
      ${c.tips.length ? '<ul>' + c.tips.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul>' : '<p class="hint">Clean interview: open questions, customer talking, real stories.</p>'}</div>`).join('') + '</div>';
  }
  function viewRun() {
    const R = S.run, st = R.stats, sandbox = /^Sandbox/.test(R.provider || '');
    const stage = (k, title, sub, extra) => { const s = R.stages[k]; return `<li class="stage ${s}"><span class="ic" aria-hidden="true">${s === 'done' ? '✓' : ''}</span><div><b>${title}<span class="sr-only">: ${s === 'done' ? 'done' : s === 'active' ? 'in progress' : 'waiting'}</span></b><small>${sub}</small>${extra || ''}</div></li>`; };
    const pips = '<div class="pips">' + R.names.map(([id, name]) => { const p = R.per[id]; if (!p) return '<span class="pip">' + esc(name) + '</span>'; if (p.error) return '<span class="pip rej">' + esc(name) + ' · skipped</span>'; return `<span class="pip ok">${esc(name)} · ${p.verified} verified</span>${p.rejected ? `<span class="pip rej">${p.rejected} rejected</span>` : ''}`; }).join('') + '</div>';
    return `
    <div class="head"><div class="kicker">Step 3 of 5 · agent at work</div><h1>${R.done ? 'Done. Your turn now.' : R.error ? 'The run stopped' : 'Reading and checking every quote…'}</h1>
    <p>The model proposes evidence. Code verifies every quote against the transcript and computes the verdicts. A second pass attacks them.</p></div>
    <section class="card" aria-label="Run progress">
      <div class="tiles">
        <div class="tile"><b>${st.calls}</b><span>model calls</span></div>
        <div class="tile"><b>${sandbox ? '0' : R.done ? st.tokens.toLocaleString() : '…'}</b><span>tokens${sandbox ? ' (sandbox)' : ''}</span></div>
        <div class="tile"><b>${st.verified}</b><span>quotes verified</span></div>
        <div class="tile"><b class="${st.rejected ? 'err' : ''}">${st.rejected}</b><span>quotes rejected</span></div>
      </div>
      <ol class="stages" style="padding:0;margin:0">
        ${stage('extract', 'Extract and verify evidence', 'One interview at a time. Only word-for-word quotes from the customer survive.', pips)}
        ${stage('assess', 'Weigh evidence against each assumption', 'The model labels; rules decide. Behaviour 1.0, opinion 0.5, hypothetical 0.25, led answers halved.')}
        ${stage('redteam', 'Red-team every verdict', 'A second pass argues the strongest case that the agent is wrong.')}
      </ol>
      ${R.error ? `<div class="notice red" role="alert" style="margin-top:14px">${esc(R.error)}</div><div class="row" style="margin-top:12px"><button class="btn" data-action="goto" data-n="1">Check setup</button><button class="btn primary" data-action="run">Try again</button></div>` : ''}
      <details data-key="runlog" ${isOpen('runlog', !R.done) ? 'open' : ''} style="margin-top:14px"><summary class="hint" style="margin:0">Technical log</summary><div class="log">${R.log.map((l) => `<div class="${l.cls}">${esc(l.msg)}</div>`).join('')}</div></details>
    </section>
    ${R.done ? `<section class="card" style="margin-top:16px" aria-labelledby="coachTitle"><h2 id="coachTitle">Interview coach</h2><p class="sub">Computed by code from your transcripts: how to get stronger evidence in your next round of interviews.</p>${coachHtml(R.state)}</section>
      <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn primary lg" data-action="goto" data-n="4">Open the checkpoint</button></div>` : ''}`;
  }

  /* ---------- 4. checkpoint ---------- */
  function evCard(e) {
    return `<div class="quote"><q>${esc(e.quote)}</q><div class="by"><b>${esc(e.who)}</b><span class="pill ${e.kind}">${e.kind}</span>${e.prompted ? '<span class="pill prompt" title="The interviewer suggested this answer, so it counts half">led answer</span>' : ''}<span>· weight ${GT.evWeight(e).toFixed(2)}</span></div>${e.question ? `<details><summary>Show the question asked</summary>${esc(e.question)}</details>` : ''}</div>`;
  }
  function evList(ids, evById, key, emptyMsg) {
    if (!ids.length) return '<div class="none">' + emptyMsg + '</div>';
    const head = ids.slice(0, 3).map((id) => evCard(evById[id])).join('');
    if (ids.length <= 3) return head;
    return head + `<details class="more" data-key="${key}" ${isOpen(key, false) ? 'open' : ''}><summary>Show ${ids.length - 3} more</summary>${ids.slice(3).map((id) => evCard(evById[id])).join('')}</details>`;
  }
  function draftOf(id) {
    if (!S.draft[id]) { const d = S.decisions[id]; S.draft[id] = { action: d ? d.action : '', verdict: d && d.action === 'override' ? d.final_verdict : '', rationale: d ? d.rationale || '' : '', editing: false }; }
    return S.draft[id];
  }
  function calibrationText(cal) {
    if (!cal.predicted) return 'You answered “No idea” to everything, so there is nothing to score.';
    return `Your gut matched the evidence on ${cal.matched} of ${cal.predicted} predictions` + (cal.unsure ? ` (${cal.unsure} marked “No idea”).` : '.');
  }
  function viewReview() {
    const st = S.run.state, g = gate(), nDone = S.assumptions.length - g.missing.length, cal = GT.calibration(S.gut, st.scored);
    const active = st.scored.find(s => s.assumption_id === S.reviewId) || st.scored.find(s => !S.decisions[s.assumption_id]) || st.scored[0];
    const cards = st.scored.filter(s => s === active).map((s) => {
      const id = s.assumption_id, a = S.assumptions.find((x) => x.id === id) || { text: s.statement }, ch = st.challenges[id], d = S.decisions[id], dr = draftOf(id), gut = S.gut[id];
      const others = GT.VERDICTS.filter((v) => v !== s.verdict);
      const decided = d && !dr.editing;
      const rob = s.robustness || GT.robustness(s, st.evById);
      return `<article class="card acard ${d ? 'decided' : ''}" id="card-${esc(id)}" aria-labelledby="h-${esc(id)}">
        <div class="ahead"><h3 id="h-${esc(id)}"><code>${esc(id)}</code><span>${esc(a.text)}</span></h3>
          <div class="badges"><span class="badge ${s.verdict}">Agent: ${LABEL[s.verdict]}</span><span class="badge">${s.confidence} confidence${s.small_sample && s.confidence !== 'Insufficient' ? ' (small sample)' : ''}</span><span class="badge">You predicted: ${GUT[gut] || '—'}</span>${GT.gutSurprise(gut, s.verdict) ? '<span class="badge surprise">Surprise</span>' : ''}${rob.stable ? (s.verdict === 'untested' ? '' : '<span class="badge robust" title="The verdict holds when any single interviewee is removed">Robust</span>') : '<span class="badge fragile" title="Removing one interviewee changes the verdict">Fragile</span>'}</div></div>
        <div class="abody">
          <div class="two">
            <div class="col s"><h4><span>Supports</span><span aria-label="weight ${s.support_weight}">${s.support_weight}</span></h4>${evList(s.supporting, st.evById, 'ms-' + id, 'No supporting evidence.')}</div>
            <div class="col c"><h4><span>Contradicts</span><span aria-label="weight ${s.contra_weight}">${s.contra_weight}</span></h4>${evList(s.contradicting, st.evById, 'mc-' + id, 'No contradicting evidence.')}</div>
          </div>
          <div class="rule"><b>How the verdict was computed.</b> Supported if support ≥ 2× contradiction, contradicted if the reverse, otherwise mixed; at least two interviewees required. Here ${s.support_weight} vs ${s.contra_weight} from ${plural(s.interviewees, 'interviewee')}.${s.reasoning ? ' <b>Model’s note:</b> ' + esc(s.reasoning) : ''}</div>
          ${s.verdict === 'untested' ? '' : rob.stable ? '<div class="rule"><b>Robustness check.</b> The verdict holds when any single interviewee’s evidence is removed.</div>' : `<div class="notice amber" role="note"><span><b>Fragile verdict.</b> It changes if you drop one person: ${rob.flips.map((f) => 'without ' + esc(f.who) + ' it becomes ' + LABEL[f.becomes]).join('; ')}. Interview more people before acting on it.</span></div>`}
          ${s.disagree ? `<div class="notice amber" role="note">The model said “${LABEL[s.model_verdict]}” but the evidence weights say “${LABEL[s.verdict]}”. The rules win; check the quotes yourself.</div>` : ''}
          ${s.invalid_refs ? `<div class="notice amber" role="note">${plural(s.invalid_refs, 'evidence reference')} from the model pointed at nothing and ${s.invalid_refs === 1 ? 'was' : 'were'} ignored.</div>` : ''}
          ${ch ? `<details class="rt" data-key="rt-${esc(id)}" ${isOpen('rt-' + id, true) ? 'open' : ''}><summary>Red team: why this might be wrong</summary><dl><div><dt>Counter-argument</dt><dd>${esc(ch.counter_argument)}</dd></div><div><dt>Blind spot</dt><dd>${esc(ch.blind_spot)}</dd></div><div><dt>Cheapest test that could overturn it</dt><dd>${esc(ch.disconfirming_test)}</dd></div></dl></details>` : '<div class="none">The red-team pass returned nothing for this assumption.</div>'}
        </div>
        <div class="decide">
          ${decided ? `<div class="done-line"><span class="ok">✓ You decided <b>${LABEL[d.final_verdict]}</b> · ${d.action === 'accept' ? 'accepted the agent' : d.action === 'park' ? 'parked for more evidence' : 'overrode the agent'}${d.rationale ? ' — “' + esc(d.rationale) + '”' : ''}</span><button class="btn sm" data-action="edit" data-id="${esc(id)}" aria-label="Change decision for ${esc(id)}">Change</button></div>` : `
          <fieldset class="opts"><legend class="sr-only">Your decision for ${esc(id)}</legend>
            <label class="opt"><input type="radio" name="act-${esc(id)}" data-action="act" data-id="${esc(id)}" data-v="accept" ${dr.action === 'accept' ? 'checked' : ''}><span>Accept: ${LABEL[s.verdict]}<small>The evidence and the red team convince me.</small></span></label>
            <label class="opt"><input type="radio" name="act-${esc(id)}" data-action="act" data-id="${esc(id)}" data-v="override" ${dr.action === 'override' ? 'checked' : ''}><span>Override<small>I know something the transcripts don’t show.</small></span></label>
            <label class="opt"><input type="radio" name="act-${esc(id)}" data-action="act" data-id="${esc(id)}" data-v="park" ${dr.action === 'park' ? 'checked' : ''}><span>Park it<small>Not enough evidence yet. Keep it open.</small></span></label>
          </fieldset>
          ${dr.action === 'override' ? `<label class="f" for="ov-${esc(id)}">Your verdict</label><select id="ov-${esc(id)}" data-draft="verdict" data-id="${esc(id)}"><option value="">Choose…</option>${others.map((v) => `<option value="${v}" ${dr.verdict === v ? 'selected' : ''}>${LABEL[v]}</option>`).join('')}</select>` : ''}
          ${dr.action === 'override' || dr.action === 'park' ? `<label class="f" for="rat-${esc(id)}">Why? Required, at least ${GT.MIN_RATIONALE} characters</label><textarea id="rat-${esc(id)}" data-draft="rationale" data-id="${esc(id)}" placeholder="What do you know, or what is missing, that changes the verdict?" style="min-height:72px">${esc(dr.rationale)}</textarea>` : ''}
          <div class="row" style="margin-top:12px"><button class="btn primary" data-action="save" data-id="${esc(id)}" ${dr.action ? '' : 'disabled'}>Save decision</button>${d ? `<button class="btn ghost" data-action="canceledit" data-id="${esc(id)}">Cancel</button>` : ''}</div>`}
        </div>
      </article>`;
    }).join('');
    const ov = st.scored.map((s) => { const d = S.decisions[s.assumption_id]; const v = d ? d.final_verdict : s.verdict; return `<button class="ov ${d ? 'done' : ''}" data-action="jump" data-id="${esc(s.assumption_id)}" aria-label="${esc(s.assumption_id)}: ${LABEL[v]}, ${d ? 'decided' : 'not decided yet'}"><code>${esc(s.assumption_id)}</code><span class="dot ${v}" aria-hidden="true"></span>${d ? '✓ ' : ''}${LABEL[v]}</button>`; }).join('');
    return `
    <div class="head"><div class="kicker">Step 4 of 5 · human checkpoint</div><h1>Make the call, one assumption at a time.</h1><p>Review the evidence, consider the counterargument, then choose what you believe. Your judgment—not the AI—determines the final memo.</p>${ctxLine()}</div>
    <div class="ovbar"><p class="t" role="status"><b>${nDone} of ${S.assumptions.length} decided.</b> ${g.ok ? 'You can draft the memo.' : 'Choose an assumption, review it, then save your decision.'}</p><div class="ovs">${ov}</div></div>
    <div class="reviewgrid focused-review"><div><p class="hint review-step">Assumption ${st.scored.indexOf(active)+1} of ${st.scored.length} · Review evidence → Challenge → Decide</p>${cards}</div>
      <aside class="side" aria-label="Run summary">
        <section class="card"><h2>Your calibration</h2><p class="big">${cal.predicted ? cal.matched + '<span class="hint" style="font-size:16px"> / ' + cal.predicted + '</span>' : '—'}</p><p class="hint">${calibrationText(cal)} Surprises are where the learning is.</p></section>
        <section class="card"><h2>Run integrity</h2>
          <div class="kv"><span>Interviews</span><b>${st.interviews.length}</b></div>
          <div class="kv"><span>Quotes verified</span><b>${st.evidence.length}</b></div>
          <div class="kv"><span>Quotes rejected</span><b class="${st.rejected.length ? 'err' : ''}">${st.rejected.length}</b></div>
          <div class="kv"><span>Leading questions</span><b>${st.leading.length}</b></div>
          <div class="kv"><span>Model calls</span><b>${st.usage.calls}</b></div>
          <div class="kv"><span>Fragile verdicts</span><b class="${st.scored.some((x) => !(x.robustness || GT.robustness(x, st.evById)).stable) ? 'warn' : ''}">${st.scored.filter((x) => !(x.robustness || GT.robustness(x, st.evById)).stable).length}</b></div>
          ${st.rejected.length ? `<details data-key="side-rej" ${isOpen('side-rej', false) ? 'open' : ''}><summary>What was rejected and why</summary>${st.rejected.map((r) => `<div class="rejq">“${esc(r.quote)}”</div><div class="hint" style="margin:2px 0 0">${esc(r.reason)}</div>`).join('')}</details>` : ''}
          ${st.leading.length ? `<details data-key="side-lead" ${isOpen('side-lead', false) ? 'open' : ''}><summary>Leading questions found</summary>${st.leading.map((l) => `<div class="lq">“${esc(l.text)}”</div>`).join('')}</details>` : ''}
          ${st.interviews.length < GT.MIN_INTERVIEWS_FOR_STRONG ? `<p class="hint" style="margin-top:10px">With ${st.interviews.length} interviews, confidence is capped at Moderate until you reach ${GT.MIN_INTERVIEWS_FOR_STRONG}.</p>` : ''}
        </section>
        ${st.insight ? `<section class="card"><h2>A pattern none of your assumptions covers</h2><p class="hint" style="font-size:13.5px;color:var(--muted)">${esc(st.insight)}</p></section>` : ''}
        <button class="btn primary lg block" data-action="goto" data-n="5" ${g.ok ? '' : 'disabled'}>${g.ok ? 'Continue to the memo' : 'Decide all ' + S.assumptions.length + ' to continue'}</button>
      </aside></div>`;
  }

  /* ---------- 5. memo ---------- */
  const manualMin = (n) => 20 * n + 105;
  function canExport() { return !!(S.memoApproved && S.memo && S.run?.done && gate().ok && !GT.checkCitations(S.memo.markdown, S.run.state.evById).unknown.length && (!S.run.state.evidence.length || GT.checkCitations(S.memo.markdown, S.run.state.evById).cited.length)); }
  function citeStatus() {
    const c = GT.checkCitations(S.memo.markdown, S.run.state.evById);
    return !c.cited.length ? '<span class="err">No evidence citations yet. Add a verified reference before export.</span>' : c.unknown.length ? `<span class="err">${plural(c.unknown.length, 'citation')} point at nothing: ${esc(c.unknown.join(', '))}</span>` : `<span class="ok">✓ All ${c.cited.length} citations match verified quotes</span>`;
  }
  function viewMemo() {
    const M = S.memo, n = S.run.state.interviews.length, cal = GT.calibration(S.gut, S.run.state.scored);
    const head = `<div class="head"><div class="kicker">Step 5 of 5 · your decision memo</div><h1>A memo built only from your decisions</h1><p>The model drafts prose from your final verdicts and reasons. Every claim must cite a verified quote; code checks each citation and appends the audit trail itself.</p>${ctxLine()}</div>`;
    if (!M) return head + `<section class="card"><div class="row sp wrap"><p class="sub" style="margin:0">All ${S.assumptions.length} assumptions decided. Drafting takes one model call.</p><div class="row wrap"><button class="btn" data-action="goto" data-n="4">Back to checkpoint</button><button class="btn primary" data-action="genmemo" ${busy ? 'disabled' : ''}>${busy ? 'Drafting…' : 'Draft the memo'}</button></div></div></section>`;
    const elapsed = (S.tMemo || Date.now()) - S.t0;
    const ex = canExport() ? '' : 'disabled';
    return head + `
    <section class="card" style="margin-bottom:16px" aria-label="Time saved"><div class="timebox">
      <div><big class="acc">${fmtMin(elapsed)}</big><span class="hint">this session, measured</span></div>
      <div><big>≈ ${(manualMin(n) / 60).toFixed(1)} h</big><span class="hint">manual synthesis of ${plural(n, 'interview')} (estimate)</span></div>
      <div><big>${cal.predicted ? cal.matched + '/' + cal.predicted : '—'}</big><span class="hint">predictions the evidence confirmed</span></div>
      <p class="hint" style="margin:0">Your time went on judging evidence and making ${S.assumptions.length} decisions, not on re-reading transcripts.</p></div></section>
    <section class="card" aria-labelledby="citeStatus">
      <div class="row sp wrap" style="margin-bottom:12px"><h2 id="citeStatus" role="status">${citeStatus()}</h2><div class="row"><button class="btn sm ghost" data-action="goto" data-n="4">Back to checkpoint</button><button class="btn sm" data-action="genmemo" ${busy ? 'disabled' : ''}>${busy ? 'Drafting…' : 'Re-draft'}</button></div></div>
      <div class="memo">
        <div><label class="f" for="memoText" style="margin-top:0">Edit (markdown)</label><textarea id="memoText" data-memo="1" spellcheck="true">${esc(M.markdown)}</textarea></div>
        <div><p class="f" style="margin-top:0" id="pvLbl">Preview · hover a citation to read the quote</p><div class="preview" id="preview" role="region" aria-labelledby="pvLbl" tabindex="0">${md(M.markdown, S.run.state.evById)}</div></div>
      </div>
      <label class="check" style="margin-top:16px"><input type="checkbox" data-action="approve" ${S.memoApproved ? 'checked' : ''}><span><b>I have read and edited this memo, and it reflects my judgment.</b><br><span class="hint">Exports unlock once you confirm. Editing the memo locks them again.</span></span></label>
      <div class="row wrap" style="margin-top:14px">
        <button class="btn primary" data-action="dlmemo" ${ex}>Download .md</button>
        <button class="btn" data-action="pdf" ${ex}>Save as PDF</button>
        <button class="btn" data-action="dlaudit" ${ex}>Audit log .json</button>
        <button class="btn ghost" data-action="copy" ${ex}>Copy</button>
      </div>
    </section>`;
  }
  async function genMemo() {
    if (needsKeyMissing()) { toast('Re-enter your free API key in Setup to draft the memo (keys are never saved).'); return; }
    busy = true; render(); announce('Drafting the memo.');
    try { S.memo = await GT.generateMemo({ provider: getProvider(), assumptions: S.assumptions, state: S.run.state, decisions: S.decisions, gut: S.gut, startup: S.startup }); S.tMemo = Date.now(); S.memoApproved = false; announce('Memo ready. Review and edit it, then confirm to unlock exports.'); }
    catch (e) { toast(e.message); }
    busy = false; render();
  }
  function lockExports() {
    S.memoApproved = false;
    const cb = $('[data-action=approve]'); if (cb) cb.checked = false;
    document.querySelectorAll('[data-action=dlmemo],[data-action=dlaudit],[data-action=copy],[data-action=pdf]').forEach((b) => { b.disabled = true; });
  }

  /* ---------- dialogs ---------- */
  const DLG = {
    guide: ['How to use Groundtruth', `
      <h3>In five steps</h3>
      <ol>
        <li><b>Setup.</b> Paste or upload your interview transcripts (one speaker per line), write the 3 to 8 assumptions your startup depends on, and pick a model. Sandbox needs no key; Live uses a free key.</li>
        <li><b>Gut check.</b> Before the agent runs, predict whether each assumption is true. Predictions lock once the agent starts.</li>
        <li><b>Agent run.</b> The agent extracts quotes, verifies each against the transcript, weighs them, and red-teams every verdict. About 8 model calls. Read the Interview coach while you are there.</li>
        <li><b>Checkpoint.</b> For each assumption, read the quotes and the counter-argument, then accept, override or park. Overriding or parking needs a written reason.</li>
        <li><b>Memo.</b> Draft the memo, edit it, tick the confirmation, then download it as Markdown or PDF, plus the audit log.</li>
      </ol>
      <h3>Transcript format</h3>
      <pre>Interviewer: Tell me about the last time a client paid you late.
Maya: Last month. A client sat on a 2,400 euro invoice for 47 days.</pre>
      <p>The interviewer label can be Interviewer, Q, Me, Founder, Moderator, or the French equivalents. Anyone else is treated as the customer.</p>
      <h3>Writing good assumptions</h3>
      <ul><li>One claim per line, specific enough to be wrong: “Owners will pay €49 per month per location”, not “People like it”.</li><li>Start with the assumptions that would kill the company if false.</li></ul>
      <h3>Getting a free key</h3>
      <p>Groq (not Grok/xAI): console.groq.com/keys. Gemini: aistudio.google.com/apikey. Or run Ollama locally with no key. Keys stay in this tab and are never saved.</p>`],
    method: ['Method: how verdicts are computed', `
      <p>The model never decides a verdict. It proposes evidence and labels it; plain, testable code does the rest.</p>
      <h3>1. Quote verification</h3>
      <p>Every quote must appear word for word (ignoring case and punctuation) inside a single turn spoken by the customer. Paraphrases, merged turns and the interviewer’s own words are rejected and shown to you.</p>
      <h3>2. Evidence weights</h3>
      <table><thead><tr><th scope="col">Evidence</th><th scope="col">Weight</th><th scope="col">Why</th></tr></thead><tbody>
        <tr><td>Behaviour (what they did)</td><td>1.0</td><td>Past actions are the best predictor</td></tr>
        <tr><td>Opinion (what they think)</td><td>0.5</td><td>Cheap to say, often polite</td></tr>
        <tr><td>Hypothetical (what they would do)</td><td>0.25</td><td>Notoriously unreliable</td></tr>
        <tr><td>Answer to a leading question</td><td>× 0.5</td><td>The interviewer suggested it</td></tr></tbody></table>
      <h3>3. Verdict</h3>
      <p><b>Supported</b> if supporting weight is at least twice the contradicting weight; <b>Contradicted</b> if the reverse; otherwise <b>Mixed</b>. Evidence from fewer than two interviewees, or under 1.0 total weight, is <b>Untested</b>.</p>
      <h3>4. Confidence</h3>
      <p><b>Strong</b> needs 3+ interviewees and 2+ unprompted behavioural quotes, and is capped at <b>Moderate</b> below 8 interviews. <b>Moderate</b> needs 3+ interviewees, or 2 with a behavioural quote. Otherwise <b>Weak</b>.</p>
      <h3>5. Robustness (leave-one-out)</h3>
      <p>For each verdict, code recomputes the rule once per interviewee with that person’s evidence removed. If any single removal changes the verdict, it is flagged <b>Fragile</b> and the memo says who it hinges on.</p>
      <h3>6. Red team, coach, calibration</h3>
      <p>A second model pass argues each verdict is wrong and proposes the cheapest test that could overturn it. The interview coach (pure code) scores talk share, leading and hypothetical questions. Calibration compares your committed predictions with the evidence.</p>
      <p>These weights are transparent heuristics from customer-discovery practice, not a statistical model. That is exactly why you make the final call.</p>`],
    privacy: ['Privacy and AI policy', `
      <h3>Your data</h3>
      <ul><li>No backend, no accounts, no analytics. Everything runs in your browser.</li>
      <li>Transcripts are sent only to the model provider you choose. In Sandbox mode nothing is sent anywhere.</li>
      <li>Your session autosaves in this browser’s local storage so a refresh doesn’t lose work. The API key is never saved. “New session” clears everything.</li>
      <li>Some hosted free tiers may use inputs to improve their products. For sensitive transcripts, anonymise them or use local Ollama, where nothing leaves your machine.</li></ul>
      <h3>Models (Equal Access AI Policy)</h3>
      <ul><li>Only free-tier or open-weight models: Groq free tier (open-weight Llama), Google Gemini free tier, OpenRouter “:free” models (paid ones are blocked in code), or local Ollama.</li>
      <li>A live run makes about 8 model calls. Sandbox makes none.</li></ul>
      <h3>Known limits</h3>
      <ul><li>The verifier proves a quote exists, not that it was understood correctly.</li><li>Small samples cannot give strong conclusions, and the app says so.</li><li>The agent never takes an external action. Every decision, and every word of the memo, is yours.</li></ul>
      <p class="hint">Sample interviews are synthetic: fictional people and fictional startups.</p>`],
  };
  let lastFocus = null;
  DLG.newsession = ['Start a new session?', `
      <p>Your interviews, predictions, decisions and memo will be cleared from this browser. Download anything you want to keep first.</p>
      <div class="row wrap" style="margin-top:18px;justify-content:flex-end"><button class="btn" data-action="closedlg">Cancel</button><button class="btn primary" data-action="confirmnew">Clear and start over</button></div>`];
  function openDlg(k) {
    const d = $('#dlg'), [title, body] = DLG[k];
    d.innerHTML = `<div class="dlg-head"><h2 id="dlgTitle">${title}</h2><button class="iconbtn" data-action="closedlg" aria-label="Close">${ICON.close}</button></div><div class="dlg-body">${body}</div>`;
    lastFocus = document.activeElement;
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    d.scrollTop = 0;
  }
  function closeDlg() { const d = $('#dlg'); if (d.open) d.close(); }
  $('#dlg').addEventListener('close', () => { if (lastFocus && lastFocus.focus && document.body.contains(lastFocus)) lastFocus.focus({ preventScroll: true }); });
  $('#dlg').addEventListener('click', (e) => { if (e.target.id === 'dlg') closeDlg(); });

  /* ---------- actions ---------- */
  function loadSample(id) {
    const smp = SAMPLES.find((x) => x.id === id) || SAMPLES[0];
    invalidate(true);
    S.interviews = smp.interviews.slice(); S.assumptions = smp.assumptions.map((a) => Object.assign({}, a));
    S.startup = smp.startup; S.sampleId = smp.id; S.gut = {}; S.t0 = Date.now();
  }
  function addInterviewText(txt, name) {
    txt = String(txt || '').replace(/\r\n/g, '\n').trim();
    if (!txt) { toast('Paste an interview first.'); return false; }
    if (S.interviews.length >= 12) { toast('Up to 12 interviews per run, to stay within free-tier limits.'); return false; }
    if (txt.split(/\s+/).length > 6000) { toast((name || 'This interview') + ' is over 6,000 words. Split it into parts.'); return false; }
    if (!GT.makeInterview('i0', txt).turns.some((t) => t.role === 'interviewee')) { toast((name || 'This text') + ' has no “Name: text” lines from a customer.'); return false; }
    if (S.interviews.includes(txt)) { toast('That interview is already loaded.'); return false; }
    invalidate();
    if (!S.interviews.length) S.t0 = Date.now();
    S.interviews.push(txt);
    return true;
  }
  function renumber() { S.assumptions.forEach((x, i) => { x.id = 'A' + (i + 1); }); S.gut = {}; }
  function saveDecision(id) {
    const s = S.run.state.scored.find((x) => x.assumption_id === id), dr = draftOf(id);
    const rec = { action: dr.action, final_verdict: dr.action === 'accept' ? s.verdict : dr.action === 'park' ? 'untested' : dr.verdict, rationale: String(dr.rationale || '').trim(), at: new Date().toISOString() };
    const chk = GT.checkGate([{ id }], { [id]: rec });
    if (!chk.ok) { toast(chk.missing[0].reason + '.'); const t = (!rec.final_verdict && document.getElementById('ov-' + id)) || document.getElementById('rat-' + id); if (t) t.focus(); return; }
    S.decisions[id] = rec; dr.editing = false;
    S.reviewId = (S.assumptions.find(a => !S.decisions[a.id]) || {id}).id;
    S.memo = null; S.memoApproved = false;
    render();
    const left = S.assumptions.filter((a) => !S.decisions[a.id]).length;
    toast(id + ' saved.' + (left ? ' ' + left + ' to go.' : ' All decided.'));
    announce(id + ' saved. ' + (left ? left + ' left to decide.' : 'All decided. You can continue to the memo.'));
    const next = S.assumptions.find((a) => !S.decisions[a.id]);
    if (next) setTimeout(() => { const c = document.getElementById('card-' + next.id); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 200);
  }
  async function testConnection() {
    const out = $('#testOut'); out.textContent = 'Testing…';
    provider = null;
    // 1. Ask the provider which models this key can use, so a wrong or retired model name is caught early.
    let ids = [];
    try { ids = LLM.rankModels(await LLM.listModels(S.cfg)); } catch (e) { ids = []; }
    const want = S.cfg.model || presetOf().model;
    if (ids.length && !ids.includes(want)) {
      out.innerHTML = '<span class="err">“' + esc(want) + '” is not available to this key.</span> Pick one it can use: ' + ids.slice(0, 6).map((m) => '<button class="btn sm" data-action="usemodel" data-m="' + esc(m) + '">' + esc(m) + '</button>').join(' ');
      return;
    }
    try {
      const r = await getProvider().chat({ task: 'ping', system: 'Reply with the single word OK.', user: 'ping', json: false });
      out.innerHTML = '<span class="ok">Connected · ' + esc(want) + ' replied “' + esc(String(r.text).trim().slice(0, 16)) + '”</span>';
    } catch (e) { provider = null; out.innerHTML = '<span class="err">' + esc(e.message) + '</span>' + (e.freeTier ? ' <button class="btn sm primary" data-action="usepreset" data-p="groq">Switch to Groq</button> <button class="btn sm" data-action="usepreset" data-p="openrouter">Use OpenRouter</button>' : ''); }
  }
  function printMemo() {
    $('#printArea').innerHTML = md($('#memoText').value, S.run.state.evById) + '<p style="margin-top:18pt;font:8pt Helvetica,Arial,sans-serif;color:#666">Generated with Groundtruth on ' + new Date().toLocaleDateString() + '. Every [i…] citation is a verified verbatim quote; see the audit log.</p>';
    window.print();
  }
  function newSession() {
    try { localStorage.removeItem(STORE); } catch (_) { /* ignore */ }
    Object.assign(S, { step: 1, interviews: [], assumptions: [], startup: '', sampleId: '', gut: {}, run: null, decisions: {}, draft: {}, memo: null, memoApproved: false, t0: Date.now(), tMemo: null, open: {} });
    provider = null; go(1); toast('New session started.');
  }

  document.addEventListener('click', async (ev) => {
    const el = ev.target.closest('[data-action]');
    if (!el || el.tagName === 'INPUT') return;
    const a = el.dataset.action, id = el.dataset.id;
    if (el.tagName === 'A') ev.preventDefault();
    if (['dlmemo','pdf','dlaudit','copy'].includes(a) && !canExport()) { toast('Approve a memo with valid evidence citations first.'); return; }
    switch (a) {
      case 'home': if (S.interviews.length && S.step !== 1) go(1); else window.scrollTo({ top: 0, behavior: 'smooth' }); break;
      case 'loadsample': loadSample('nudgepay'); render(); toast('Sample loaded. Press Continue.'); break;
      case 'quick': loadSample(id); S.cfg.mode = 'sandbox'; provider = null; go(2); break;
      case 'theme': { const t = theme() === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem(THEME, t); } catch (_) { /* ignore */ } renderChrome(); $('[data-action=theme]').focus(); announce(t + ' theme'); break; }
      case 'dlg': openDlg(el.dataset.k); break;
      case 'closedlg': closeDlg(); break;
      case 'newsession': openDlg('newsession'); break;
      case 'confirmnew': lastFocus = null; closeDlg(); newSession(); break;
      case 'goto': {
        const n = +el.dataset.n;
        if (n === 2 && S.step === 1 && S.cfg.mode === 'live') { const g = LLM.freeGuard(S.cfg); if (!g.ok) { toast(g.msg); break; } }
        if (available(n)) go(n); else toast(lockReason(n)); break;
      }
      case 'mode': S.cfg.mode = el.dataset.v; provider = null; render(); break;
      case 'upload': $('#file').click(); break;
      case 'rmiv': invalidate(); S.interviews.splice(+el.dataset.i, 1); render(); toast('Interview removed.'); break;
      case 'addiv': if (addInterviewText($('#newIv').value)) { render(); toast('Interview added.'); } break;
      case 'adda': invalidate(); S.assumptions.push({ id: 'A' + (S.assumptions.length + 1), text: '' }); render(); { const ins = document.querySelectorAll('[data-bind-a]'); if (ins.length) ins[ins.length - 1].focus(); } break;
      case 'rma': invalidate(); S.assumptions.splice(+el.dataset.i, 1); renumber(); render(); break;
      case 'test': await testConnection(); break;
      case 'usepreset': S.cfg.preset = el.dataset.p; S.cfg.baseUrl = ''; S.cfg.model = ''; S.cfg.modelOther = false; S.cfg.key = ''; provider = null; render(); toast('Now paste your ' + presetOf().label.split(' (')[0] + ' key and test again.'); break;
      case 'usemodel': { const m = el.dataset.m; const list = presetOf().models || []; S.cfg.model = m; S.cfg.modelOther = list.includes(m) ? false : S.cfg.preset; provider = null; render(); await testConnection(); break; }
      case 'togut': {
        if (S.cfg.mode === 'live') { const g = LLM.freeGuard(S.cfg); if (!g.ok) { toast(g.msg); break; } }
        go(2); break;
      }
      case 'gut': S.gut[id] = el.dataset.v; render(); break;
      case 'run': startRun(); break;
      case 'jump': { S.reviewId = id; render(); const c = document.getElementById('card-' + id); if (c) { c.scrollIntoView({ behavior: 'smooth', block: 'start' }); const f = c.querySelector('input,button.btn'); if (f) setTimeout(() => f.focus({ preventScroll: true }), 350); } break; }
      case 'edit': { const d = S.decisions[id]; S.draft[id] = { action: d.action, verdict: d.action === 'override' ? d.final_verdict : '', rationale: d.rationale || '', editing: true }; render(); const r = document.querySelector('input[name="act-' + id + '"]:checked'); if (r) r.focus(); break; }
      case 'canceledit': draftOf(id).editing = false; render(); break;
      case 'save': saveDecision(id); break;
      case 'genmemo': genMemo(); break;
      case 'dlmemo': download('decision-memo.md', $('#memoText').value, 'text/markdown'); toast('Memo downloaded.'); break;
      case 'pdf': printMemo(); break;
      case 'dlaudit': download('groundtruth-audit-log.json', JSON.stringify(GT.buildAuditJSON({ assumptions: S.assumptions, state: S.run.state, decisions: S.decisions, gut: S.gut, memo: S.memo, provider: S.run.provider }), null, 2), 'application/json'); toast('Audit log downloaded.'); break;
      case 'copy': try { await navigator.clipboard.writeText($('#memoText').value); toast('Memo copied.'); } catch (_) { toast('Your browser blocked copying. Use Download instead.'); } break;
    }
  });

  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.id === 'file') {
      const files = [...el.files];
      Promise.all(files.map((f) => f.text().then((t) => addInterviewText(t, f.name)))).then((r) => { el.value = ''; render(); const n = r.filter(Boolean).length; if (n) toast(plural(n, 'interview') + ' added.'); });
      return;
    }
    if (el.id === 'sampleSel') { if (el.value) { loadSample(el.value); render(); toast('Sample loaded: ' + SAMPLES.find((x) => x.id === el.value).title + '.'); } return; }
    if (el.dataset.action === 'act') { const d = draftOf(el.dataset.id); d.action = el.dataset.v; if (d.action !== 'override') d.verdict = ''; render(); return; }
    if (el.dataset.action === 'approve') { S.memoApproved = el.checked; if (el.checked && !canExport()) { S.memoApproved = false; toast('Add valid evidence citations before approving.'); } render(); if (S.memoApproved) announce('Exports unlocked.'); return; }
    if (el.dataset.iv != null) { render(); return; }
    if (el.id === 'modelSel') { if (el.value === '__other') { S.cfg.modelOther = S.cfg.preset; S.cfg.model = ''; } else { S.cfg.modelOther = false; S.cfg.model = el.value; } provider = null; render(); return; }
    if (el.dataset.bind === 'cfg.preset') { S.cfg.preset = el.value; S.cfg.key = ''; S.cfg.model = ''; S.cfg.modelOther = false; S.cfg.baseUrl = ''; provider = null; render(); return; }
    if (el.dataset.draft) draftOf(el.dataset.id)[el.dataset.draft] = el.value;
  });

  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.dataset.iv != null) { if (S.run) { invalidate(); renderChrome(); } S.interviews[+el.dataset.iv] = el.value; const b = $('[data-action=togut]'); if (b) b.disabled = !setupValid() || sandboxBlocked(); save(); return; }
    if (el.dataset.bindA != null) {
      if (S.run) { invalidate(); renderChrome(); }
      S.assumptions[+el.dataset.bindA].text = el.value;
      const b = $('[data-action=togut]'); if (b) b.disabled = !setupValid() || sandboxBlocked();
      renderChrome(); save();
    } else if (el.dataset.bind) { setPath(S, el.dataset.bind, el.value); if (el.id === 'key') { const w = $('#keyWarn'); if (w) w.innerHTML = keyWarnHtml(); } if (el.dataset.bind.startsWith('cfg.')) { provider = null; if (el.dataset.bind === 'cfg.baseUrl') S.cfg.key = ''; } renderChrome(); save(); }
    else if (el.dataset.draft) draftOf(el.dataset.id)[el.dataset.draft] = el.value;
    else if (el.dataset.memo) {
      S.memo.markdown = el.value;
      S.memo.citations = GT.checkCitations(el.value, S.run.state.evById);
      $('#preview').innerHTML = md(el.value, S.run.state.evById);
      $('#citeStatus').innerHTML = citeStatus();
      if (S.memoApproved) lockExports();
      save();
    }
  });
  document.addEventListener('toggle', (ev) => { const d = ev.target; if (d.dataset && d.dataset.key) { S.open[d.dataset.key] = d.open; save(); } }, true);
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey) && ev.target.id === 'newIv') { ev.preventDefault(); if (addInterviewText(ev.target.value)) { render(); toast('Interview added.'); } }
  });

  render();
  document.title = (S.step === 1 && !S.interviews.length ? 'Groundtruth · Audit your customer interviews' : STEPS[S.step - 1] + ' · Groundtruth');
  if (restored) setTimeout(() => toast('Welcome back. Your last session was restored.'), 300);
})();
