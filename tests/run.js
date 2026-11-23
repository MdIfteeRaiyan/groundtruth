// Run: node tests/run.js   (zero dependencies)
global.self = global; global.window = global;
const assert = require('node:assert/strict');
const GT = require('../js/core.js');
require('../js/data.js');
require('../js/sandbox.js');
const { GT_SAMPLE, createSandboxProvider } = global;

let passed = 0;
const test = async (name, fn) => { try { await fn(); passed++; console.log('  ok  ' + name); } catch (e) { console.error('FAIL  ' + name + '\n' + (e.stack || e)); process.exitCode = 1; } };
const interviews = () => GT_SAMPLE.interviews.map((t, i) => GT.makeInterview('i' + (i + 1), t));
const assumptions = () => GT_SAMPLE.assumptions;

(async () => {
  console.log('Groundtruth tests');

  await test('transcript parsing assigns roles and names', () => {
    const iv = interviews()[0];
    assert.equal(iv.name, 'Maya');
    assert.equal(iv.turns.filter((t) => t.role === 'interviewer').length, 5);
    assert.equal(iv.turns.filter((t) => t.role === 'interviewee').length, 5);
  });

  await test('quote verification: exact, punctuation-tolerant, ellipsis, wrong speaker, fabricated', () => {
    const iv = interviews()[0];
    assert.ok(GT.findQuote('A branding client sat on a 2,400 euro invoice for 47 days.', iv.turns, 'interviewee') >= 0);
    assert.ok(GT.findQuote('the time isnt the problem', iv.turns, 'interviewee') >= 0, 'apostrophe/case tolerant');
    assert.ok(GT.findQuote('A branding client ... for 47 days', iv.turns, 'interviewee') >= 0, 'ellipsis within one turn');
    assert.equal(GT.findQuote('Tell me about the last time a client paid you late', iv.turns, 'interviewee'), -1, 'interviewer text is not evidence');
    assert.equal(GT.findQuote('I would never use any automated tool at all', iv.turns, 'interviewee'), -1);
    assert.equal(GT.findQuote('ten minutes in total ... sorts itself out', iv.turns, 'interviewee'), -1, 'fragments may not span turns');
    assert.equal(GT.findQuote('too short', iv.turns, 'interviewee'), -1, 'under 3 words is rejected');
  });

  await test('validateExtraction drops fabricated quotes, flags prompted answers, caps evidence', () => {
    const iv = interviews()[4];
    const v = GT.validateExtraction({
      evidence: [
        { quote: 'Yes, absolutely, that sounds amazing.', kind: 'hypothetical' },
        { quote: 'This was never said by anyone in the call.', kind: 'behavior' },
        { quote: 'Yes, absolutely, that sounds amazing.', kind: 'hypothetical' },
        { quote: "I'd say a third of invoices.", kind: 'weirdkind' },
      ],
      leading_questions: ["Wouldn't you love it if software handled those emails for you?", 'Invented leading question here please'],
    }, iv);
    assert.equal(v.evidence.length, 2, 'duplicate removed, fabricated removed');
    assert.equal(v.rejected.length, 2);
    assert.equal(v.evidence[0].prompted, true);
    assert.equal(v.evidence[1].kind, 'opinion', 'unknown kind falls back to opinion');
    assert.equal(v.leading.length, 1);
  });

  await test('parseJSON tolerates fences, prose and trailing commas', () => {
    assert.deepEqual(GT.parseJSON('```json\n{"a":1}\n```'), { a: 1 });
    assert.deepEqual(GT.parseJSON('Sure! Here you go: {"a":[1,2,],} thanks'), { a: [1, 2] });
    assert.throws(() => GT.parseJSON('no json here'));
  });

  await test('verdict rule and confidence cap', () => {
    assert.equal(GT.computeVerdict(4, 1, 4), 'supported');
    assert.equal(GT.computeVerdict(1, 4, 4), 'contradicted');
    assert.equal(GT.computeVerdict(1.6, 2, 3), 'mixed');
    assert.equal(GT.computeVerdict(3, 0, 1), 'untested', 'one interviewee is never enough');
    assert.equal(GT.computeVerdict(0.5, 0, 3), 'untested', 'too little weight');
    const mk = (id, iv, kind) => [id, { id, interview: iv, kind, prompted: false }];
    const evById = Object.fromEntries([mk('a', 'i1', 'behavior'), mk('b', 'i2', 'behavior'), mk('c', 'i3', 'behavior')]);
    assert.equal(GT.computeConfidence('supported', ['a', 'b', 'c'], evById, 10), 'Strong');
    assert.equal(GT.computeConfidence('supported', ['a', 'b', 'c'], evById, 5), 'Moderate', 'small sample caps at Moderate');
  });

  await test('a lying model cannot force a verdict: code recomputes it', () => {
    const evById = { 'i1-1': { id: 'i1-1', interview: 'i1', kind: 'behavior', prompted: false } };
    const s = GT.scoreAssessment({ assumption_id: 'A1', verdict: 'supported', supporting_ids: ['i1-1', 'i9-9', 'made-up'], contradicting_ids: [], reasoning: 'trust me' }, evById, 5);
    assert.equal(s.verdict, 'untested');
    assert.equal(s.model_verdict, 'supported');
    assert.equal(s.disagree, true);
    assert.equal(s.invalid_refs, 2);
  });

  await test('human gate blocks until every assumption is decided and overrides are justified', () => {
    const A = assumptions();
    assert.equal(GT.checkGate(A, {}).ok, false);
    const d = Object.fromEntries(A.map((a) => [a.id, { action: 'accept', final_verdict: 'supported' }]));
    assert.equal(GT.checkGate(A, d).ok, true);
    d.A3 = { action: 'override', final_verdict: 'supported', rationale: 'meh' };
    assert.equal(GT.checkGate(A, d).ok, false, 'override needs a reason');
    d.A3.rationale = 'Two interviewees would accept auto-send after approving the template.';
    assert.equal(GT.checkGate(A, d).ok, true);
    d.A2 = { action: 'park', final_verdict: 'mixed', rationale: '' };
    assert.equal(GT.checkGate(A, d).ok, false, 'parking needs a reason');
  });

  let state;
  await test('full pipeline on the sandbox: expected verdicts, verifier catches the fabricated quote', async () => {
    const events = [];
    state = await GT.runAgent({ provider: createSandboxProvider(), interviews: interviews(), assumptions: assumptions(), onEvent: (e) => events.push(e) });
    const v = Object.fromEntries(state.scored.map((s) => [s.assumption_id, s.verdict]));
    assert.deepEqual(v, { A1: 'supported', A2: 'mixed', A3: 'contradicted', A4: 'contradicted', A5: 'mixed' });
    assert.equal(state.rejected.length, 1, 'exactly the one fabricated quote is rejected');
    assert.match(state.rejected[0].quote, /never let an automated tool/);
    assert.equal(state.leading.length, 2);
    assert.equal(state.scored.reduce((n, s) => n + s.invalid_refs, 0), 0, 'every fixture id resolves to verified evidence');
    assert.equal(state.scored.filter((s) => s.disagree).length, 0);
    assert.ok(state.scored.every((s) => s.confidence !== 'Strong'), 'n=5 never yields Strong');
    assert.equal(state.usage.calls, 7, '5 extractions + assess + red-team');
    assert.ok(state.evById['i5-3'].prompted && state.evById['i1-4'].prompted, 'answers to leading questions are down-weighted');
    assert.equal(Object.keys(state.challenges).length, 5);
    assert.deepEqual(events.filter((e) => e.type === 'stage' && e.status === 'done').map((e) => e.stage), ['extract', 'assess', 'redteam']);
  });

  await test('memo is impossible before the checkpoint, then cites only real evidence', async () => {
    const A = assumptions(), gut = { A1: 'supported', A2: 'supported', A3: 'supported', A4: 'supported', A5: 'unsure' };
    await assert.rejects(() => GT.generateMemo({ provider: createSandboxProvider(), assumptions: A, state, decisions: {}, gut }), /checkpoint incomplete/);
    const decisions = Object.fromEntries(state.scored.map((s) => [s.assumption_id, { action: 'accept', final_verdict: s.verdict }]));
    decisions.A3 = { action: 'override', final_verdict: 'mixed', rationale: 'Conditional trust: all four accept auto-send once templates are approved.' };
    const memo = await GT.generateMemo({ provider: createSandboxProvider(), assumptions: A, state, decisions, gut });
    assert.deepEqual(memo.citations.unknown, []);
    assert.ok(memo.citations.cited.length >= 5);
    assert.match(memo.markdown, /Audit trail/);
    assert.match(memo.markdown, /\(overridden\)/);
    assert.match(memo.markdown, /you expected it to be true/);
    assert.match(memo.markdown, /landing page with a 19 euro/, 'next experiments come from the red team');
    const audit = GT.buildAuditJSON({ assumptions: A, state, decisions, gut, memo, provider: 'sandbox' });
    assert.equal(audit.assumptions.find((r) => r.id === 'A3').gut_surprise, true);
    assert.equal(audit.assumptions.find((r) => r.id === 'A5').gut_surprise, false);
  });

  await test('citation checker flags ids the model invented', () => {
    const r = GT.checkCitations('Users hate it [i1-1] and love it [i9-9].', state.evById);
    assert.deepEqual(r.unknown, ['i9-9']);
  });

  await test('malformed JSON triggers one repair retry; a failing interview is skipped, not fatal', async () => {
    const sb = createSandboxProvider(); let bad = 0;
    const flaky = { chat: async (a) => {
      if (a.task === 'extract' && /"interview_id":"i2"/.test(a.user) && bad === 0) { bad++; return { text: 'Sorry, here is prose', usage: {} }; }
      if (a.task === 'extract' && /"interview_id":"i3"/.test(a.user)) throw new Error('rate limited');
      return sb.chat(a);
    } };
    const st = await GT.runAgent({ provider: flaky, interviews: interviews(), assumptions: assumptions() });
    assert.ok(st.trace.some((e) => e.type === 'repair'));
    assert.ok(st.trace.some((e) => e.type === 'error' && /Chloé/.test(e.message)));
    assert.ok(st.evidence.some((e) => e.interview === 'i2'));
    assert.ok(!st.evidence.some((e) => e.interview === 'i3'));
  });

  await test('free-tier guard rejects paid OpenRouter models', () => {
    require('../js/llm.js');
    assert.equal(global.GT_LLM.freeGuard({ preset: 'openrouter', model: 'openai/gpt-4o' }).ok, false);
    assert.equal(global.GT_LLM.freeGuard({ preset: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' }).ok, true);
  });

  await test('sandbox stays consistent when an interview is removed', async () => {
    const ivs = interviews().filter((iv) => iv.name !== 'Tomás').map((iv, i) => GT.makeInterview('i' + (i + 1), iv.raw));
    const st = await GT.runAgent({ provider: createSandboxProvider(), interviews: ivs, assumptions: assumptions() });
    assert.equal(st.scored.reduce((n, s) => n + s.invalid_refs, 0), 0);
    assert.ok(st.scored.every((s) => [...s.supporting, ...s.contradicting].every((id) => st.evById[id] && st.evById[id].who !== 'Tomás')));
    assert.ok(st.evById['i2-1'].who === 'Chloé');
    assert.ok(st.scored.every((s) => !/Tomás/.test(s.reasoning)), 'no stale prose about removed people');
    assert.ok(Object.values(st.challenges).every((c) => !/Tomás/.test(JSON.stringify(c))));
  });

  await test('second sample (restaurant shifts) runs with sensible verdicts', async () => {
    const S2 = global.GT_SAMPLES[1];
    const ivs = S2.interviews.map((t, i) => GT.makeInterview('i' + (i + 1), t));
    const st = await GT.runAgent({ provider: createSandboxProvider(), interviews: ivs, assumptions: S2.assumptions });
    const v = Object.fromEntries(st.scored.map((s) => [s.assumption_id, s.verdict]));
    assert.deepEqual(v, { A1: 'supported', A2: 'mixed', A3: 'mixed', A4: 'contradicted' });
    assert.equal(st.rejected.length, 1);
    assert.match(st.rejected[0].quote, /refuses to pay/);
    assert.equal(st.leading.length, 1);
    assert.equal(st.scored.reduce((n, s) => n + s.invalid_refs, 0), 0);
  });

  await test('sandbox refuses unknown transcripts with a clear message', async () => {
    const iv = GT.makeInterview('i1', 'Interviewer: Hi?\nZed: I run a bakery and we struggle with flour prices every single week.');
    await assert.rejects(() => GT.runAgent({ provider: createSandboxProvider(), interviews: [iv], assumptions: assumptions() }), /No verifiable evidence/);
    await assert.rejects(() => createSandboxProvider().chat({ task: 'extract', user: 'INPUT_JSON:\n' + JSON.stringify({ speaker_labels: ['Interviewer', 'Zed'] }) }), /Switch to Live model/);
  });

  await test('interview coach flags talk ratio, leading and hypothetical questions', () => {
    const coach = GT.interviewCoach(state.interviews, state);
    const tom = coach.find((c) => c.name === 'Tomás'), pri = coach.find((c) => c.name === 'Priya');
    assert.equal(tom.hypothetical_questions, 2);
    assert.ok(tom.tips.some((t) => /imagined future/.test(t)));
    assert.equal(pri.leading, 1);
    assert.ok(coach.every((c) => c.talk_ratio > 0 && c.talk_ratio < 1));
    const iv = GT.makeInterview('i9', 'Interviewer: ' + 'blah '.repeat(80) + '\nBo: Yes we did it last week.');
    assert.ok(GT.interviewCoach([iv], { leading: [], evidence: [] })[0].tips.some((t) => /You spoke/.test(t)));
  });

  await test('calibration counts matched predictions and ignores unsure', () => {
    const c = GT.calibration({ A1: 'supported', A2: 'supported', A3: 'contradicted', A5: 'unsure' }, state.scored);
    assert.deepEqual(c, { predicted: 3, matched: 2, unsure: 2, total: 5 });
  });

  await test('French speaker labels are recognised as the interviewer', () => {
    const iv = GT.makeInterview('i1', 'Intervieweur: Racontez-moi la dernière fois.\nCamille: Le mois dernier, un client a payé avec 40 jours de retard.');
    assert.equal(iv.name, 'Camille');
    assert.ok(GT.findQuote('un client a payé avec 40 jours de retard', iv.turns, 'interviewee') >= 0);
  });

  await test('robustness flags verdicts that hinge on one interviewee', () => {
    const ev = (id, iv, kind) => [id, { id, interview: iv, who: iv.toUpperCase(), kind, prompted: false }];
    const evById = Object.fromEntries([ev('a', 'i1', 'behavior'), ev('b', 'i1', 'behavior'), ev('c', 'i2', 'opinion'), ev('d', 'i3', 'opinion')]);
    const s = GT.scoreAssessment({ assumption_id: 'X', supporting_ids: ['a', 'b', 'c'], contradicting_ids: ['d'] }, evById, 5);
    assert.equal(s.verdict, 'supported');
    assert.equal(s.robustness.stable, false);
    assert.deepEqual(s.robustness.flips.map((f) => f.who), ['I1']);
    assert.ok(state.scored.every((x) => x.robustness && Array.isArray(x.robustness.flips)));
    const rows = GT.memoRows(assumptions(), state, Object.fromEntries(state.scored.map((x) => [x.assumption_id, { action: 'accept', final_verdict: x.verdict }])), {});
    assert.ok(rows.every((r) => Array.isArray(r.fragile_without)));
  });

  console.log('\n' + passed + ' tests passed' + (process.exitCode ? ' (with failures)' : ''));
})();
