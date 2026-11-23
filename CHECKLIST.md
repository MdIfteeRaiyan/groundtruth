# Before you submit (deadline: 18 Dec 2026, 17:00 Paris time)

What is finished: the app (light and dark themes, two samples, coach, calibration), 19 engine tests, 288 browser checks, the architecture diagram, screenshots, README, HOW_TO_USE.md, and the full Devpost text including a French summary.

What only you can do:

- [ ] **Run it once on a real free model.** The live path is fully tested against a local server that mimics free-tier failures (429s, JSON-mode rejection, fenced replies), but not yet against a real provider: browser CORS and current model names can only be confirmed for real. Paste a free Groq or Gemini key, run the sample, and check it finishes. If a model name is rejected, change it in the Model field. If JSON quality is poor on a small model, use a 70B-class model. Fix anything odd and tell me, I'll help.
- [ ] **Record the real token count** the app shows after the run and put it in the AI Disclosure (replaces the estimate).
- [ ] **Time yourselves** doing the manual synthesis once with a stopwatch; update the Time-Saved Report with your real figures.
- [ ] **Record the 3-minute video** (script in DEMO_VIDEO_SCRIPT.md), upload to YouTube or Vimeo.
- [ ] **Publish the repo** (public) and enable GitHub Pages: see HOW_TO_USE.md section 5. Then set `REPO_URL` in `js/app.js`. Check that `git grep -n -i "gsk_\|AIza\|sk-or-"` finds nothing.
- [ ] **Fill every [BRACKET]** in DEVPOST_SUBMISSION.md (team, URLs, which model you used, your Claude plan).
- [ ] **Delete AI-disclosure rows** for providers you did not actually use.
- [ ] Confirm team of 2 to 4, everyone 18+ and enrolled; each person on only one team.
- [ ] Upload gallery images from `docs/screenshots/` and `docs/architecture.png`.
- [ ] Test the deployed link in a private window on a phone.
- [ ] Submit before the deadline and keep a copy of everything for a possible live-demo request.
