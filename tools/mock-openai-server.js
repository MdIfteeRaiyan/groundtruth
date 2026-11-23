// Local OpenAI-compatible server for offline testing of the LIVE code path.
// It serves the team's scripted outputs and, with FAULTS=1, injects the failures free tiers produce:
// a 429 with Retry-After, a 400 rejecting JSON mode, and replies wrapped in ```json fences.
// Usage: FAULTS=1 node tools/mock-openai-server.js   then in the app choose
//        Live model -> Custom -> Base URL http://127.0.0.1:8787/v1 -> Model mock
global.self = global;
require('../js/sandbox.js');
const http = require('http');
const sb = global.createSandboxProvider();
const FAULTS = process.env.FAULTS === '1';
const PORT = +process.env.PORT || 8787;
let n = 0, rejectedJsonMode = false;
const stats = { requests: 0, r429: 0, r400: 0 };

http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS, GET', 'Access-Control-Expose-Headers': 'Retry-After' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  if (req.url === '/stats') { res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors)); return res.end(JSON.stringify(stats)); }
  if (req.method !== 'POST' || !/\/chat\/completions$/.test(req.url)) { res.writeHead(404, cors); return res.end('not found'); }
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', async () => {
    stats.requests++; n++;
    const j = JSON.parse(body);
    const sys = j.messages[0].content, user = j.messages[1].content;
    const send = (code, obj, extra) => { res.writeHead(code, Object.assign({ 'Content-Type': 'application/json' }, cors, extra || {})); res.end(JSON.stringify(obj)); };
    if (FAULTS && n === 2) { stats.r429++; return send(429, { error: { message: 'Rate limit reached (mock)' } }, { 'Retry-After': '1' }); }
    if (FAULTS && j.response_format && !rejectedJsonMode) { rejectedJsonMode = true; stats.r400++; return send(400, { error: { message: "Invalid parameter: 'response_format' is not supported for this model (mock)" } }); }
    const task = (sys.match(/^TASK:(\w+)/) || [])[1];
    let text;
    if (!task) text = 'OK';
    else {
      try { text = (await sb.chat({ task, user })).text; } catch (e) { return send(500, { error: { message: e.message } }); }
      if (FAULTS && task !== 'memo') text = 'Here is the JSON you asked for:\n```json\n' + text + '\n```';
    }
    const pt = Math.round((sys.length + user.length) / 4), ct = Math.round(text.length / 4);
    send(200, { id: 'mock-' + n, object: 'chat.completion', model: j.model, choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }], usage: { prompt_tokens: pt, completion_tokens: ct, total_tokens: pt + ct } });
  });
}).listen(PORT, '127.0.0.1', () => console.log('Mock OpenAI-compatible server on http://127.0.0.1:' + PORT + '/v1' + (FAULTS ? ' (fault injection on)' : '')));
