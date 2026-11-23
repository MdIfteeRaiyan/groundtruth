# 3-minute demo video: shot list and voiceover

Target length is 2:50. Record at 1080p with browser zoom at 110% and notifications off. Use the **live Groq model** if you can; keep Sandbox as the fallback. The video must show a complete run including the checkpoint.

Before you record: do one practice run, click **New session**, paste your key into Setup, and choose the light or dark theme (dark reads better on YouTube).

| Time | On screen | Say |
|---|---|---|
| 0:00–0:15 | Landing page | "Founders run customer interviews to test their riskiest assumptions, then spend half a day turning them into a story. Usually the story they hoped for. Groundtruth audits the interviews, and won't let you decide until you've challenged it." |
| 0:15–0:30 | Load the freelance sample → Live model (Groq) → Continue → gut check; mark A3 "Probably true" | "First, I commit to what I believe, before the agent speaks. I'm sure freelancers will trust automatic reminders. These predictions lock once it runs." |
| 0:30–1:00 | Agent run: interviews filling in, the **rejected** tile, then the Interview coach | "The model extracts quotes, then plain code checks each one word for word against what the customer said. Fabricated or paraphrased quotes are thrown out. The model labels evidence, but code computes the verdict. Eight free-tier calls. And the coach tells me I asked leading and hypothetical questions; that's how I'll interview better next time." |
| 1:00–1:45 | Checkpoint: A3 card, **Surprise** badge, quotes with "led answer" pill, the rule box, red team, calibration card | "Now the agent stops. A3: the evidence says no, because four of five want to approve messages first. I expected the opposite, so it's flagged as a surprise. My gut matched the evidence on one of four predictions. The red team argues the verdict may be too strong: trust is conditional." |
| 1:45–2:15 | Override A3 to Mixed; type "meh" → refused; type a real reason; save. Park A5 with a reason. Show "Continue" unlocking | "I override to Mixed, because the trust is conditional. A one-word reason is refused. I park A5, because I need a ranking exercise. The memo stays locked until every assumption has a decision." |
| 2:15–2:40 | Memo: "All citations match", hover a citation, audit table, tick approval, Save as PDF | "The memo is drafted only from my decisions. Every claim cites a verified quote, and code checks every citation. Export unlocks only when I confirm the memo is mine. [X] minutes for this session, against about three and a half hours by hand." |
| 2:40–2:55 | Theme toggle; phone view; terminal `node tests/run.js` (18 passing); architecture image | "Light and dark, phone-ready, accessible, free-tier only, no keys in the repo. Groundtruth: faster at everything except judgment, because judgment is yours." |

## Recording checklist
- Never show the API key or the provider dashboard.
- Say which model and provider you used; it must match the AI Disclosure.
- Keep it under 3:00. Upload to YouTube or Vimeo as Public or Unlisted.
