# Groundtruth: Devpost submission text

> Fields in [BRACKETS] need your input before you paste this into Devpost. Everything else is ready.

## Tagline
An agent that audits your customer interviews, argues against itself, and refuses to let you decide until you have challenged it.

## The business task
**Synthesising customer-discovery interviews into evidence-backed decisions.**
Founders run 5 to 20 interviews to test their riskiest assumptions, then spend hours re-reading transcripts, tagging quotes, clustering themes and writing a memo. Two things go wrong. It eats half a day. And confirmation bias quietly picks the quotes that flatter the idea: one enthusiastic "that sounds amazing", given in answer to a leading question, outweighs three people describing what they actually do.

Groundtruth automates the mechanical 80% (extraction, mapping, scoring, drafting) and forces the human to do the 20% that matters: challenging the evidence and making the call.

## What it does
0. **Two synthetic samples** (freelance invoicing, restaurant shift gaps) let anyone run the full flow in Sandbox mode with no key.
1. **Setup.** Paste or upload transcripts and list the assumptions to test.
2. **Gut check (human).** Before the agent runs, the founder predicts each assumption. This blocks anchoring on the agent's answer.
3. **Agent run.** Extract quotes per interview → **verify each quote word for word** against the interviewee's speech (fabrications are rejected and shown) → map evidence to assumptions → **code, not the model, computes the verdict** from weighted evidence → a red-team pass argues the strongest case that each verdict is wrong.
4. **Human checkpoint.** For every assumption the founder sees the supporting and contradicting quotes (with the question that was asked), the rule arithmetic, the model's reasoning, the red-team attack, and a "Surprise: you expected X" badge when their gut was wrong. They must accept, override with their own verdict, or park it, and give a written reason for any override or park.
Alongside the verdicts, an **interview coach** (pure code) scores each transcript on talk share, leading questions, future-tense questions and the share of concrete stories, so the founder interviews better next round. A **leave-one-out robustness check** (pure code) re-runs every verdict with each interviewee removed and flags verdicts that hinge on one person. A **calibration score** shows how many of the founder's committed predictions the evidence confirmed.

5. **Decision memo.** Locked until all assumptions are decided. The model drafts prose from the *human-final* verdicts only; every claim must cite a verified quote id; code checks the citations and appends an audit table. Export is locked until the founder ticks "this reflects my judgment".

## Architecture
See `docs/architecture.svg` (also in the repo README). Models propose, code verifies, the human decides. The app is static HTML/JS with no backend; the only network call goes to the founder's chosen free-tier or local model.

[Upload docs/architecture.png to the Devpost image gallery.]

## Human Judgment section
| The agent does | The human decides | Why the line is drawn there |
|---|---|---|
| Extracts candidate quotes, labels them behaviour / opinion / hypothetical | Nothing at this stage; quotes are verified by code | Fabricated evidence is a mechanical failure, so a mechanical check fixes it |
| Maps evidence to assumptions and proposes a verdict by weighted rules | Whether to **accept, override or park** each verdict, with a written reason | Only the founder knows context the transcripts lack (a client's reputation, a market shift, a gut read of tone) |
| Red-teams every verdict and proposes the cheapest disconfirming test | Whether the red-team objection is serious enough to change the verdict | Challenge is only useful if a human weighs it |
| Drafts a memo from decided verdicts | What the memo finally says, and whether to export it | The founder signs it; the agent must not speak for them |

Deliberate design choices that protect judgment:
- **Commit before reveal.** Predictions are locked before the agent speaks, so surprises are measurable instead of rationalised away.
- **No default selection.** No option is pre-ticked on any card; rubber-stamping needs a deliberate click.
- **Friction proportional to risk.** Accepting takes one click; overriding or parking requires a reason (minimum length enforced in code).
- **Predictions lock after the run.** The founder cannot rewrite their gut once they have seen the answer.
- **Hard gates.** The memo cannot be generated until all decisions exist, and cannot be exported until the founder confirms.
- **Nothing external happens automatically.** The agent never contacts interviewees, never sends anything, never decides to pivot.

## Responsible AI section
**Data used.** The bundled sample is entirely synthetic (fictional freelancers and a fictional startup, "NudgePay"). Users bring their own transcripts. We recommend anonymised or synthetic data only.

**Privacy.** No backend, no analytics, no accounts. Transcripts are processed in the browser and sent only to the model provider the user selects. API keys are held in memory in the page and never stored or logged. For sensitive material the user can select local Ollama, where nothing leaves the machine. Note that some hosted free tiers may use inputs to improve their products; the README warns users to check provider terms before pasting identifiable personal data. Exports (memo, audit log) are generated locally.

**Known limitations**
- The verifier proves a quote *exists*, not that it was *interpreted* correctly; a real quote can still be mislabelled. This is why every quote is shown next to its verdict and the human decides.
- Quotes are matched lexically after normalising case and punctuation. A model that paraphrases fluently gets rejected, so some valid evidence can be dropped (we prefer a false negative to a fabricated quote; the rejection count is displayed).
- Evidence weights (behaviour 1, opinion 0.5, hypothetical 0.25, led-by-question ×0.5) and the 2× verdict threshold are transparent heuristics based on customer-discovery practice, not statistically validated. Users see the arithmetic on every card.
- Five interviews is a small sample. The app caps confidence at Moderate under 8 interviews and says so.
- Leading-question detection is done by the model and verified against interviewer speech; it is tuned for English and may miss subtle leading in other languages.
- Local small models (for example an 8B model) produce weaker JSON and weaker mapping than 70B-class models; the repair retry and verifier limit the damage but do not remove it.
- Free tiers rate-limit; long transcripts (over 6,000 words) are refused rather than silently truncated.

**Bias and failure cases**
- *Selection bias* (who got interviewed) is outside the data; the memo's "Limits" section states sample size but cannot detect who is missing.
- *Interviewer bias.* Leading questions are flagged and their answers down-weighted, but the founder's framing of the assumptions themselves is not audited.
- *Model bias.* A model may over-read enthusiasm or mis-read non-native phrasing. The red-team pass and mandatory human review exist for this reason; the agent never takes an external action.
- *Over-trust.* A polished memo can feel authoritative. The memo opens with its own limits, cites verified quotes only, and ends with the founder's own decisions and reasons.
- *Failure handling.* Malformed JSON → one repair retry, then the interview is skipped and reported. Invented evidence ids are ignored and counted. If the model and the rules disagree, the card says so.

## AI Disclosure Statement

### Runtime models (what the agent runs on)
| Model | Provider | Role in the agent | Plan | Calls per live run |
|---|---|---|---|---|
| [PRIMARY DEMO MODEL, e.g. openai/gpt-oss-120b (open-weight)] | [Groq] | Steps 1 to 4: extract, label, red-team, memo | **Free tier** (open-weight model), no billing enabled | 8 |
| Gemini 2.5 Flash (alternative) | Google AI Studio | Same roles | **Free tier**, no billing enabled | 8 |
| Llama 3.1 8B (alternative, local) | Ollama on the user's machine | Same roles | Open-weight, local, free | 8 |
| OpenRouter `:free` models (alternative) | OpenRouter | Same roles | Free models only (non-`:free` blocked in code) | 8 |
| **Sandbox** | none | Scripted outputs authored by the team so judges can test with no key; **no model is called** | n/a | 0 |

Only one provider is needed per run. [Confirm which provider and model your demo video used and delete the rows you did not use.]

**Estimated tokens per live run** (5 interviews of about 250 words, 5 assumptions): about 8 calls and 12,000 to 16,000 tokens in total: extraction ≈ 1,000 each × 5, mapping ≈ 2,500, red-team ≈ 3,000, memo ≈ 2,500. The app shows the provider-reported token count after every run. [Replace this estimate with your measured number from a real run.] Sandbox mode uses 0.

**Where code, not AI, does the work:** transcript parsing, quote verification, JSON repair, evidence weighting, verdict and confidence, leave-one-out robustness, interview coach, calibration, the human gate, citation checking, audit-trail table, exports.

### AI-assisted building (declared)
Claude (Anthropic) was used as a coding and writing assistant to help design the workflow, write the JavaScript, tests, documentation and diagram, and to review the UI. [State the plan you used for this assistance, e.g. "Claude, accessed via a subscription".] All generated code was run and tested by the team (`node tests/run.js`, plus end-to-end browser runs). The Equal Access policy restricts the agent's **runtime** models, which are free-tier or open-weight as listed above; AI-assisted building is declared here as required.

### Other tools and components
Browser `fetch`, no third-party JavaScript libraries, no CDN assets, no analytics. Node.js ≥ 18 only to run the test file. Icons and fonts are system fonts and inline SVG.

### No secrets
No API keys or credentials exist in the repository, the video or any export. Keys are typed by the user into the page at run time.

## Time-Saved Report
**Task:** turn 5 discovery interviews into evidence-backed verdicts on 5 assumptions and a decision memo.

| Step | Before (manual) | After (Groundtruth) |
|---|---|---|
| Re-read and tag interviews | 100 min (20 per interview) | 0 (agent) |
| Map quotes to assumptions and check them | 35 min | 0 (agent + code verifier) |
| Cluster, challenge, find counter-evidence | 30 min | 0 (red-team pass) |
| Write the memo | 40 min | 8 min (edit and approve) |
| Setup, gut check, agent runtime | 0 | about 7 min (3 setup, 2 gut check, about 2 run on a free tier) |
| Review and decide on 5 verdicts | included above, done badly | about 20 min (4 per card, **deliberately kept human**) |
| **Total** | **about 205 min (3.4 h)** | **about 35 min** |

**Saving: about 170 minutes per synthesis, roughly 83%**, and it scales: the manual column grows by about 20 minutes per extra interview, the agent column by about 1 minute plus review time.

How this was estimated: the "before" column reflects typical founder practice (the team's own estimate, not a published benchmark). The app also shows a **measured** elapsed time for each session next to the manual estimate. [Before submitting, time yourselves doing the manual synthesis of the 5 sample interviews once with a stopwatch, replace the "before" figures with your real numbers, and keep the measured session time shown by the app for the "after".]

The review time is not compressed on purpose: the product is faster at everything except judgment, and that is the point.

## Judging criteria map
| Criterion (weight) | Where to look |
|---|---|
| Business value and time saved (25%) | Time-Saved Report; memo screen shows measured vs manual time |
| Human judgment by design (20%) | Gut check locked before the run, calibration score, fragile-verdict warnings, per-assumption accept / override / park with reasons, red team on every verdict, interview coach, two hard gates, Human Judgment table |
| Agent design and reliability (20%) | Quote verifier, rule-computed verdicts, repair retry, failure table in docs/ARCHITECTURE.md, 19 engine tests, 288 browser checks including a full live run against a fault-injecting free-tier mock |
| Frugality and accessibility (15%) | Free-tier / open-weight only, about 8 calls per run, sandbox needs no key, no backend, no build step, runs offline on Ollama |
| User experience (10%) | One-click demo, two samples, light and dark themes, five-step flow with clickable progress, autosave and resume, PDF export, in-app guide, method and privacy panels, WCAG 2.2 AA contrast measured on every screen, keyboard and screen-reader support, 44px touch targets, tested from 320px to 1440px |
| Documentation and responsible AI (10%) | This document, README, architecture diagram, limitations and bias section |

## How judges can test it at no cost
1. **Zero setup:** open https://mdifteeraiyan.github.io/groundtruth/ (after GitHub Pages is enabled) (or `index.html` from the repo) and click **Try the sample, no key needed**. Sandbox mode, no key, no cost.
2. **Real model, free:** choose **Live model**, pick Groq or Gemini, paste a free key (links in the app), and load a sample or your own synthetic transcripts. A full walkthrough is in HOW_TO_USE.md.
3. **Fully local:** run Ollama with `OLLAMA_ORIGINS=*`, choose the Ollama preset.
4. **Tests:** `node tests/run.js`.

## Résumé en français
**Groundtruth** est un agent IA qui audite les entretiens clients des fondateurs avant qu'ils ne prennent une décision.
- **Tâche automatisée :** la synthèse d'entretiens de découverte client, qui prend environ 3,4 h à la main et environ 35 min avec l'agent.
- **Fonctionnement :** l'agent extrait des citations, puis du code vérifie chacune mot pour mot ; les citations inventées sont rejetées. Des règles transparentes, et non le modèle, calculent le verdict de chaque hypothèse, et une passe « red team » argumente contre chaque verdict.
- **Point de contrôle humain :** le fondateur s'engage d'abord sur ses prédictions, verrouillées avant l'analyse. Il doit ensuite accepter, contredire (avec justification) ou mettre en attente chaque verdict.
- **Mémo :** il reste verrouillé tant que toutes les décisions ne sont pas prises, et l'export reste verrouillé tant que le fondateur ne l'a pas validé.
- **Modèles :** uniquement des offres gratuites ou des modèles open-weight (Groq, Gemini, OpenRouter « :free », Ollama). Aucune clé n'est stockée et aucune donnée n'est conservée côté serveur.
- **Robustesse :** chaque verdict est recalculé en retirant tour à tour chaque interviewé ; un verdict qui dépend d'une seule personne est signalé « fragile ».
- **Accessibilité :** thèmes clair et sombre, contraste WCAG 2.2 AA vérifié, utilisation complète au clavier et sur mobile.

## Links
- Repository: https://github.com/MdIfteeRaiyan/groundtruth
- Live demo: https://mdifteeraiyan.github.io/groundtruth/ (after GitHub Pages is enabled)
- Demo video (≤3 min): [YOUTUBE/VIMEO URL]

## Built with
JavaScript, HTML, CSS, Node.js (tests only), Gemini free tier / Groq free tier / OpenRouter free models / Ollama (open-weight Llama), GitHub Pages.
