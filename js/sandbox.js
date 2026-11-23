/* Sandbox provider: NO model is called. It replays outputs scripted by the team for the two built-in
   samples, so anyone can walk through the whole workflow (including the human checkpoint) with no key.
   Each sample contains one deliberately bad quote so you can watch the verifier reject it.
   Fixtures are keyed by interviewee name, so removing an interview still produces consistent results.
   Verification, scoring, gating and citation checks are the real code paths. */
(function (root) {
  const E = (quote, kind, topic) => ({ quote, kind, topic });
  const UNKNOWN = 'Sandbox mode only replays the two built-in samples. Switch to Live model (free) to analyse your own interviews.';

  const DATASETS = {
    nudgepay: {
      extract: {
      'Maya': { evidence: [
        E('A branding client sat on a 2,400 euro invoice for 47 days.', 'behavior', 'late payment'),
        E("Honestly maybe ten minutes in total. The time isn't the problem.", 'behavior', 'time cost'),
        E('What kills me is the knot in my stomach before I hit send.', 'behavior', 'emotional cost'),
        E('I mean, sure, in theory.', 'hypothetical', 'automation appeal'),
        E("I wouldn't want a robot signing off as me.", 'opinion', 'trust'),
        E("A Notion table. I check it on Mondays. It's free and it works fine.", 'behavior', 'current tool'),
        E('Finding the next client, honestly.', 'opinion', 'biggest problem'),
      ], leading_questions: ['Wouldn\'t it be great if an app just chased clients automatically for you?'] },
      'Tomás': { evidence: [
        E('Probably two invoices out of every five.', 'behavior', 'late payment'),
        E("I've got a recurring calendar reminder to check my bank account every Friday, and then I chase by email.", 'behavior', 'chasing effort'),
        E('I pay 12 euros a month for an invoicing tool already, Indy', 'behavior', 'current spend'),
        E('Fifteen a month feels like my ceiling.', 'hypothetical', 'price'),
        E('Only if I could see every message before it goes out.', 'opinion', 'trust'),
        E('I had one automated email go wrong once and it embarrassed me in front of a client.', 'behavior', 'trust'),
        E('Chasing money is number one, no contest.', 'opinion', 'biggest problem'),
      ], leading_questions: [] },
      'Chloé': { evidence: [
        E('Maybe one in twelve invoices is late.', 'behavior', 'late payment'),
        E('When it happens I forward the invoice to their finance contact and it sorts itself out. Takes two minutes.', 'behavior', 'chasing effort'),
        E("I'd rather pay for something that helps me find consultancy projects.", 'opinion', 'biggest problem'),
        E("I'd resist adding another subscription.", 'opinion', 'price'),
        // Deliberately fabricated by the scripted "model" to demonstrate the verifier:
        E('I would never let an automated tool touch my client relationships.', 'opinion', 'trust'),
      ], leading_questions: [] },
      'Jonas': { evidence: [
        E('But corporate shoots, constantly.', 'behavior', 'late payment'),
        E('I keep putting it off because I hate the awkward conversation.', 'behavior', 'emotional cost'),
        E("I'd honestly pay someone to do the nagging for me.", 'hypothetical', 'automation appeal'),
        E("Yes, if it kept the tone friendly, and I'd want to approve the template first.", 'opinion', 'trust'),
        E('Twenty a month if it actually got me paid.', 'hypothetical', 'price'),
        E('Top two. Bookings in winter are the other one.', 'opinion', 'biggest problem'),
      ], leading_questions: [] },
      'Priya': { evidence: [
        E("I'd say a third of invoices.", 'behavior', 'late payment'),
        E('I once waited 90 days to chase a 1,100 euro invoice because I was dreading it.', 'behavior', 'emotional cost'),
        E('Yes, absolutely, that sounds amazing.', 'hypothetical', 'automation appeal'),
        E("I'd want to read it first, my voice is my brand.", 'opinion', 'trust'),
        E("I'd pay maybe 10 euros if it was really good.", 'hypothetical', 'price'),
      ], leading_questions: ["Wouldn't you love it if software handled those emails for you?"] },
    },
      assess: { assessments: [
      { assumption_id: 'A1', verdict: 'supported', supporting_ids: ['Maya-1', 'Tomás-1', 'Jonas-1', 'Priya-1'], contradicting_ids: ['Chloé-1'],
        reasoning: 'Maya, Tomás, Jonas and Priya all describe late payment as routine; only Chloé, who works with mid-size firms, rarely sees it.',
        emerging_insight: 'The pain is the awkwardness of asking, not the minutes spent: Maya, Jonas and Priya all describe dread or procrastination before chasing.' },
      { assumption_id: 'A2', verdict: 'mixed', supporting_ids: ['Tomás-2', 'Jonas-3', 'Priya-3'], contradicting_ids: ['Maya-2', 'Chloé-2'],
        reasoning: 'Tomás has a manual routine and Jonas would hand it off, but Maya and Chloé say the task itself takes minutes. Priya’s enthusiasm followed a leading question.' },
      { assumption_id: 'A3', verdict: 'contradicted', supporting_ids: [], contradicting_ids: ['Maya-5', 'Tomás-5', 'Tomás-6', 'Jonas-4', 'Priya-4'],
        reasoning: 'Four of five want to see or approve messages first; Tomás was already burned by an automated email.' },
      { assumption_id: 'A4', verdict: 'contradicted', supporting_ids: ['Tomás-4', 'Jonas-5'], contradicting_ids: ['Maya-6', 'Tomás-3', 'Chloé-4', 'Priya-5'],
        reasoning: 'Stated willingness clusters at 10-15 euros; only Jonas said 20, and that was hypothetical. Maya uses a free tool and Chloé resists new subscriptions.' },
      { assumption_id: 'A5', verdict: 'mixed', supporting_ids: ['Tomás-7', 'Jonas-6'], contradicting_ids: ['Maya-7', 'Chloé-3'],
        reasoning: 'Tomás ranks it first and Jonas top two, while Maya and Chloé name finding clients as the bigger worry.' },
    ] },
      redteam: { challenges: [
      { assumption_id: 'A1', counter_argument: 'Four of five is a convenience sample of freelancers who already agreed to talk about money. Chloé suggests client type, not freelancing itself, drives lateness.',
        blind_spot: 'No interviewee was asked how many invoices they send per month, so "regularly" is untested for low-volume freelancers.', disconfirming_test: 'Survey 30 freelancers in two client segments (agencies vs corporates) on invoices sent and invoices paid late last quarter.' },
      { assumption_id: 'A2', counter_argument: 'The agent treats "ten minutes" as proof the task is not time-consuming, yet the same people delayed chasing for weeks or months. The cost may be delay, not duration.',
        blind_spot: 'The assumption bundles time cost and desire to automate. The evidence speaks to emotional cost, which the assumption does not cover.', disconfirming_test: 'Ask 5 freelancers to log every minute spent on one overdue invoice, including time spent avoiding it.' },
      { assumption_id: 'A3', counter_argument: 'Everyone accepts automation if they approve the content first, so "contradicted" may be too strong. The real finding is conditional trust.',
        blind_spot: 'Almost all statements are opinions; only Tomás offers behavioural evidence of an automation failure.', disconfirming_test: 'Show 8 freelancers a clickable mock where the app drafts a reminder in their voice and ask them to approve it. Count how many would let it auto-send after 3 approvals.' },
      { assumption_id: 'A4', counter_argument: 'Price statements in interviews are notoriously unreliable. Jonas’s 20 euros and Priya’s 10 euros are both hypothetical. The real test is a payment.',
        blind_spot: 'Nobody was shown a concrete product, and the value was never framed as money recovered.', disconfirming_test: 'Run a landing page with a 19 euro/month pre-order button and 15 euro/month alternative; measure card-entry starts.' },
      { assumption_id: 'A5', counter_argument: 'Rankings come from different mental frames: Tomás just lived through a cash crunch, Maya and Chloé are in a quiet pipeline. Recency may be driving answers.',
        blind_spot: 'Seasonality (Jonas’s winter bookings) means the "biggest problem" probably changes through the year.', disconfirming_test: 'Ask 10 freelancers to rank five business problems by money lost in the last 12 months.' },
    ] },
    },
    shiftfill: {
      extract: {
        'Ana': { evidence: [
          E('Two baristas texted me at 6am, both sick, same flu.', 'behavior', 'sick calls'),
          E('That happens most weeks in winter.', 'behavior', 'frequency'),
          E('Then I messaged three people directly because nobody answered the group.', 'behavior', 'current process'),
          E('It took about forty minutes before Léa said yes.', 'behavior', 'time cost'),
          E("They'd rather see the open shifts and grab them.", 'opinion', 'staff preference'),
          E('Our scheduling app is 30 euros a month and he still complains about it.', 'behavior', 'price'),
          // Deliberate paraphrase by the scripted "model" to demonstrate the verifier:
          E('The owner refuses to pay for any new software at all.', 'opinion', 'price'),
        ], leading_questions: [] },
        'Marcus': { evidence: [
          E('Maybe twice a month.', 'behavior', 'frequency'),
          E("We overstaff Fridays on purpose so one no-show doesn't hurt.", 'behavior', 'workaround'),
          E('I call my two most reliable cooks.', 'behavior', 'current process'),
          E('Five minutes, done.', 'behavior', 'time cost'),
          E('Sure, I guess so.', 'hypothetical', 'automation appeal'),
          E('We already use 7shifts and it has a shift-swap feature nobody uses.', 'behavior', 'competitor'),
          E("I'm not buying a second tool for the same thing.", 'opinion', 'price'),
        ], leading_questions: ["Wouldn't it be easier if an app did that for you?"] },
        'Sofia': { evidence: [
          E('Last month one site ran a whole dinner service two people short because the manager gave up after a few calls.', 'behavior', 'gap impact'),
          E('We comped about 600 euros of food after complaints, plus a bad review.', 'behavior', 'cost'),
          E('When we trialled a group chat for open shifts, fills went up, but managers kept bypassing it.', 'behavior', 'staff adoption'),
          E("If it worked across all six sites I'd sign off on 300 a month without asking anyone.", 'hypothetical', 'price'),
          E('Per location, 49 is fine if it saves one disaster.', 'hypothetical', 'price'),
        ], leading_questions: [] },
        'Dev': { evidence: [
          E('I ended up on the grill myself, which is normal for me', 'behavior', 'frequency'),
          E('I texted maybe six people one by one.', 'behavior', 'current process'),
          E('I spend more time chasing people than cooking some weeks.', 'behavior', 'time cost'),
          E('Only if I choose who gets offered what.', 'opinion', 'control'),
          E('Forty-nine a location is a lot when margins are three percent.', 'opinion', 'price'),
        ], leading_questions: [] },
      },
      assess: { assessments: [
        { assumption_id: 'A1', supporting_ids: ['Ana-1', 'Ana-2', 'Sofia-1', 'Dev-1'], contradicting_ids: ['Marcus-1', 'Marcus-2'],
          reasoning: 'Ana, Sofia and Dev describe frequent gaps; Marcus sees about two a month and overstaffs to prevent them.',
          emerging_insight: 'The real buyer may be the multi-site operator, not the single-site manager: Sofia is the only one who counts failed fills as a cost she pays, and the only one ready to pay.' },
        { assumption_id: 'A2', supporting_ids: ['Ana-3', 'Ana-4', 'Dev-2', 'Dev-3'], contradicting_ids: ['Marcus-3', 'Marcus-4', 'Marcus-2'],
          reasoning: 'Ana and Dev message people one by one and lose a lot of time; Marcus fills gaps in five minutes with a reliable core team.' },
        { assumption_id: 'A3', supporting_ids: ['Ana-5', 'Sofia-3'], contradicting_ids: ['Marcus-6', 'Dev-4'],
          reasoning: 'Ana and Sofia report staff preferring visible open shifts, but Marcus’s existing shift-swap feature goes unused and Dev wants to control who is offered what.' },
        { assumption_id: 'A4', supporting_ids: ['Sofia-4', 'Sofia-5'], contradicting_ids: ['Ana-6', 'Marcus-7', 'Dev-5'],
          reasoning: 'Only Sofia, buying for six sites, accepts 49 euros, and hypothetically. Ana’s owner resents 30 euros, Marcus refuses a second tool, Dev’s margins are thin.' },
      ] },
      redteam: { challenges: [
        { assumption_id: 'A1', counter_argument: 'Ana’s “most weeks” is seasonal (winter flu) and Marcus engineers the problem away by overstaffing. Weekly gaps may only hold in winter or for lean teams.',
          blind_spot: 'Nobody gave a count over a full month: frequency is remembered, not logged.', disconfirming_test: 'Ask 10 managers to log every last-minute gap for two weeks in a shared sheet.' },
        { assumption_id: 'A2', counter_argument: 'The one-by-one process is confirmed, but the 30-minute cost is not: Marcus fills gaps in five minutes.',
          blind_spot: 'Speed may not be the real cost. Sofia’s lost dinner service suggests failed fills matter more than slow ones.', disconfirming_test: 'Shadow 3 managers during a sick call and time each step, including failed attempts.' },
        { assumption_id: 'A3', counter_argument: 'Every statement about staff comes from managers. Marcus’s unused shift-swap feature is real behaviour pointing the other way.',
          blind_spot: 'No staff member was interviewed, so the people who must adopt the app have no voice in this evidence.', disconfirming_test: 'Post 5 real open shifts in a simple mobile form to staff at 2 sites and measure how many are claimed within an hour.' },
        { assumption_id: 'A4', counter_argument: 'Sofia’s yes is hypothetical and she buys for six sites; single-site buyers anchor on 20 to 30 euros.',
          blind_spot: 'Price was never tied to the cost of a failed shift, which Sofia put at 600 euros.', disconfirming_test: 'Offer a paid pilot at 49 euros per location to 5 multi-site operators and count signatures.' },
      ] },
    },
  };
  const BY_NAME = {};
  for (const [k, d] of Object.entries(DATASETS)) for (const n of Object.keys(d.extract)) BY_NAME[n] = k;

  function readInput(user) { return JSON.parse(user.slice(user.indexOf('INPUT_JSON:\n') + 12).split('\n\nYour previous')[0]); }
  function datasetOf(evidence) { for (const e of evidence || []) if (BY_NAME[e.who]) return BY_NAME[e.who]; return null; }
  function resolve(refs, prefix) {
    return (refs || []).map((r) => { const m = /^(.+)-(\d+)$/.exec(r); return m && prefix[m[1]] ? prefix[m[1]] + '-' + m[2] : null; }).filter(Boolean);
  }

  function memoFromRows(p) {
    const rows = p.rows;
    const cites = (r) => r.evidence.slice(0, 4).map((e) => '[' + e.id + ']').join(' ');
    const lines = [];
    const kept = rows.filter((r) => r.human_verdict === 'supported').length;
    lines.push('## Bottom line');
    lines.push('Across ' + p.n_interviews + ' interviews, ' + kept + ' of ' + rows.length + ' assumptions stand as supported after your review. ' + (p.emerging_insight ? p.emerging_insight : 'No additional pattern was flagged.') + ' Treat every verdict as provisional: the sample is small.');
    lines.push('\n## What we learned');
    for (const r of rows) {
      const tag = r.action === 'accept' ? 'you accepted the agent’s call' : r.action === 'park' ? 'you parked it pending more data' : 'you overrode the agent (' + r.agent_verdict + ')';
      lines.push('- **' + r.id + ' ' + r.human_verdict + '** (' + tag + '; agent confidence: ' + r.confidence + '): ' + r.statement + ' ' + cites(r));
    }
    lines.push('\n## Where your gut and the evidence disagreed');
    const sur = rows.filter((r) => r.gut && r.gut !== 'unsure' && r.gut !== r.agent_verdict);
    if (!sur.length) lines.push('No disagreements: your predictions matched the agent’s verdicts.');
    for (const r of sur) lines.push('- **' + r.id + '**: you expected it to be ' + (r.gut === 'supported' ? 'true' : 'false') + '; the evidence reads "' + r.agent_verdict + '". ' + cites(r));
    lines.push('\n## Next 3 experiments');
    const open = rows.filter((r) => r.human_verdict !== 'supported').slice(0, 3);
    (open.length ? open : rows.slice(0, 3)).forEach((r, i) => lines.push((i + 1) + '. **' + r.id + '**: ' + (r.suggested_test || 'Design a one-week test that could overturn this verdict.')));
    lines.push('\n## Limits of this analysis');
    const fragile = rows.filter((r) => r.fragile_without && r.fragile_without.length);
    if (fragile.length) lines.push('- Fragile verdicts: ' + fragile.map((r) => r.id + ' hinges on ' + r.fragile_without.join(', ')).join('; ') + '. Interview more people before acting on them.');
    else lines.push('- Every verdict survives removing any single interviewee (leave-one-out check).');
    lines.push('- ' + p.n_interviews + ' interviews cap confidence at Moderate. ' + p.leading_questions + ' leading question(s) were detected and down-weighted; ' + p.rejected_quotes + ' unverifiable quote(s) were rejected before analysis.');
    return lines.join('\n');
  }

  root.createSandboxProvider = function () {
    return {
      label: 'Sandbox (scripted, no model called)', isSandbox: true,
      async chat({ task, user }) {
        await new Promise((r) => setTimeout(r, 380 + Math.random() * 320));
        const p = readInput(user);
        const usage = { prompt_tokens: 0, completion_tokens: 0 };
        if (task === 'extract') {
          const name = (p.speaker_labels || []).find((n) => BY_NAME[n]);
          if (!name) throw new Error(UNKNOWN);
          return { text: JSON.stringify(DATASETS[BY_NAME[name]].extract[name]), usage };
        }
        if (task === 'assess' || task === 'redteam') {
          const ds = datasetOf(p.evidence);
          if (!ds) throw new Error(UNKNOWN);
          // If the user removed interviews from a sample, drop scripted prose that names people who are no longer there.
          const present = new Set(p.evidence.map((e) => e.who));
          const absent = Object.keys(DATASETS[ds].extract).filter((n) => !present.has(n));
          const stale = (t) => absent.some((n) => String(t || '').includes(n));
          if (task === 'redteam') return { text: JSON.stringify({ challenges: DATASETS[ds].redteam.challenges.filter((c) => !stale(c.counter_argument + c.blind_spot + c.disconfirming_test)) }), usage };
          const prefix = {};
          for (const e of p.evidence) prefix[e.who] = e.id.split('-')[0];
          const out = DATASETS[ds].assess.assessments.map((a) => Object.assign({}, a, { supporting_ids: resolve(a.supporting_ids, prefix), contradicting_ids: resolve(a.contradicting_ids, prefix), reasoning: stale(a.reasoning) ? '' : a.reasoning, emerging_insight: stale(a.emerging_insight) ? '' : a.emerging_insight }));
          return { text: JSON.stringify({ assessments: out }), usage };
        }
        if (task === 'memo') return { text: memoFromRows(p), usage };
        throw new Error('Unknown sandbox task ' + task);
      },
    };
  };
  root.GT_SANDBOX_DATASETS = DATASETS;
})(typeof self !== 'undefined' ? self : this);
