# How to use Groundtruth, from first click to Devpost submission

This guide covers everything, in order: trying the app, using it for real, publishing it, recording the video, and submitting.

---

## 1. Try it in 60 seconds (no key, no install)

1. Unzip the project and double-click `index.html`. It opens in your browser.
2. Click **Try the sample, no key needed**.
3. **Gut check:** for each assumption, click *Probably true*, *Probably false* or *No idea*. Then click **Lock predictions and run**.
4. **Agent run:** watch the five interviews being read. Note the red **1 quote rejected**: the scripted model invented a quote and the verifier caught it. Scroll down to the **Interview coach**, then click **Open the checkpoint**.
5. **Checkpoint:** for each assumption, read the quotes, the computed rule and the red-team box. Then pick **Accept**, **Override** (choose a verdict and write why) or **Park it** (write why), and click **Save decision**.
6. When all are decided, click **Continue to the memo**, then **Draft the memo**.
7. Edit the memo if you like, tick **I have read and edited this memo…**, then **Download .md**, **Save as PDF** or **Audit log .json**.

Other controls:
- The sun/moon icon switches between the light and dark themes.
- The **?** icon opens the guide. The footer links open **Method** and **Privacy & AI policy**.
- Your session saves automatically. Reload the page and you land where you were. **New session** (or the circular-arrow icon on phones) clears everything.

---

## 2. Run it locally like a website

Some browser features, such as clipboard and printing, behave better over `http://` than from a file.

```bash
cd groundtruth
python3 -m http.server 8080        # or: npm start
# open http://localhost:8080
```

Tests (Node 18 or later, no installs):

```bash
node tests/run.js                  # 19 engine tests
```

---

## 3. Use it with a real free model

Sandbox mode only replays the two built-in samples. For your own interviews, use a free live model.

**Groq (recommended: fast, free, open-weight Llama)**
1. Go to https://console.groq.com/keys, sign in and click **Create API key**. Copy it.
2. In Groundtruth, open **Setup → Model → Live model**.
3. Provider: **Groq (free tier, open-weight Llama)**. Leave Model empty to use `llama-3.3-70b-versatile`.
4. Paste the key, then click **Test connection**. You should see *Connected*.
5. Continue as in section 1. A run makes about 8 calls and takes 1 to 3 minutes.

**Gemini (Google free tier):** key from https://aistudio.google.com/apikey. Provider **Google Gemini (free tier)**, default model `gemini-2.5-flash`.

**Fully local (Ollama, nothing leaves your machine):**
```bash
ollama pull llama3.1:8b
OLLAMA_ORIGINS=* ollama serve
```
Then choose Provider **Ollama**. No key needed. Small local models are weaker at structured output; the verifier will reject more quotes.

**Offline test of the live path:** run `npm run mock`. Then choose **Custom**, base URL `http://127.0.0.1:8787/v1`, model `mock`. This server deliberately returns rate-limit errors and malformed replies, and the app recovers.

> The key is kept only in the open tab. It is never saved, never committed, and never shown in exports. After a reload you paste it again.

---

## 4. Use it with your own interviews

**Format:** one speaker per line, `Name: what they said`.

```
Interviewer: Tell me about the last time a client paid you late.
Maya: Last month. A client sat on a 2,400 euro invoice for 47 days.
```

- The interviewer label can be `Interviewer`, `Q`, `Me`, `Founder`, `Moderator`, `Host`, or the French `Intervieweur`, `Enquêteur`, `Animateur`, `Fondateur`. Every other speaker counts as the customer.
- You can load up to 12 interviews per run, each under 6,000 words. Paste them, or upload `.txt` / `.md` files (several at once).
- Use synthetic or anonymised transcripts. Remove names, companies and contact details first.

**Writing assumptions that work:**
- Write 3 to 8 lines, one claim each, specific enough to be wrong. For example, write "Owners will pay €49 per month per location", not "People like it".
- Put the assumptions that would kill the company first.
- Fill in "Your startup in one line" so the memo has context.

**Reading the checkpoint:**

| Element | Meaning |
|---|---|
| Agent: Supported / Mixed / Contradicted / Untested | Verdict computed by code from evidence weights, not by the model |
| Confidence (small sample) | Capped at Moderate under 8 interviews |
| Surprise | Your locked prediction disagreed with the evidence |
| BEHAVIOR / OPINION / HYPOTHETICAL | Evidence type; weights 1.0 / 0.5 / 0.25 |
| led answer | The question suggested the answer, so its weight is halved |
| Red team | The strongest case that the verdict is wrong, plus the cheapest test |
| Your calibration | How many of your predictions the evidence confirmed |

---

## 5. Publish it so judges can use it (GitHub Pages, free)

```bash
cd groundtruth
git init
git add .
git commit -m "Groundtruth: customer-discovery auditor with human checkpoint"
git branch -M main
git remote add origin https://github.com/YOUR-TEAM/groundtruth.git
git push -u origin main
```

1. On GitHub, open the repository, then **Settings → Pages**.
2. Source: **Deploy from a branch**, branch **main**, folder **/ (root)**. Save.
3. After about a minute your link appears: `https://YOUR-TEAM.github.io/groundtruth/`.
4. Open `js/app.js` and set `const REPO_URL = 'https://github.com/YOUR-TEAM/groundtruth';` near the top. Commit and push. A "Source code" link appears in the footer.
5. Test the link on a phone, in a private window.

Before pushing, make sure no key was ever typed into a file: `git grep -n -i "gsk_\|AIza\|sk-or-"` should find nothing.

---

## 6. Record the 3-minute video

Follow `DEMO_VIDEO_SCRIPT.md`. Short version:
1. Do one practice run on the **live** Groq model, then **New session**.
2. Paste your key *before* you start recording, or blur it. Never show it.
3. Record at 1080p with browser zoom at 110% and notifications off.
4. Show: the landing page → gut check → the rejected quote → the coach → one Accept, one Override (show the short-reason refusal) and one Park → the memo, citation check, approve and export → `node tests/run.js`.
5. Upload to YouTube as **Unlisted** or Public, and keep it under 3:00.

---

## 7. Submit on Devpost

| Devpost field | Where to get it |
|---|---|
| Project text | `DEVPOST_SUBMISSION.md` (fill every `[BRACKET]` first) |
| Try it out link | Your GitHub Pages URL |
| Repository | Your GitHub repository URL |
| Video | Your YouTube or Vimeo link |
| Image gallery | `docs/architecture.png` and `docs/screenshots/*.png` |
| Built with | JavaScript, HTML, CSS, Groq, Llama, Gemini, Ollama, GitHub Pages |

Then go through `CHECKLIST.md` one last time.

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| "Network/CORS error" on a live model | Check the base URL. For Ollama, restart it with `OLLAMA_ORIGINS=*`. Some networks block API hosts; try another network. |
| "The provider rejected the API key" | The key was copied wrong or revoked. Create a new one. |
| "HTTP 429 … waiting" in the log | A normal free-tier rate limit. The app waits and retries automatically. |
| Model name rejected (HTTP 400/404) | Free model names change. Type the provider's current free model into **Model**. |
| Many quotes rejected | The model paraphrased. Use a larger model (70B-class), or check the transcript format. |
| Continue is greyed out with your own interviews | Sandbox only knows the samples. Switch to **Live model**. |
| After a reload, "Re-enter your API key" | Expected: keys are never saved. Paste it again in Setup. |
| Want to start fresh | **New session** in the header (or the circular-arrow icon on phones). |
