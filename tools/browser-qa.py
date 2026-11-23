# Browser QA (optional): pip install playwright && playwright install chromium
# Run: python3 -m http.server 8080 & FAULTS=1 node tools/mock-openai-server.js & python3 tools/browser-qa.py
# Set CHROME=/path/to/chrome to use a system Chrome.
import asyncio, json, urllib.request, sys
from playwright.async_api import async_playwright
URL='http://127.0.0.1:8080/index.html'
R=[]
def ok(n,c,detail=''):
    R.append((n,bool(c)))
    if not c: print('FAIL',n,detail)

AUDIT_JS = r'''
() => {
  const out = {names:[], labels:[], dupIds:[], targets:[], contrast:[], overflow: document.documentElement.scrollWidth > window.innerWidth + 1};
  const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0 && r.height>0 && s.visibility!=='hidden' && s.display!=='none' && !el.closest('[hidden]') && !el.closest('.sr-only') && !el.closest('dialog:not([open])') && !el.closest('details:not([open]) > :not(summary)'); };
  for (const el of document.querySelectorAll('button, a[href], [role=button]')) {
    if (!vis(el)) continue;
    const name = (el.getAttribute('aria-label') || el.textContent || '').trim();
    if (!name) out.names.push(el.outerHTML.slice(0,80));
    const r = el.getBoundingClientRect();
    const inline = el.closest('p, .cta-note') && !el.classList.contains('btn');
    if (!inline && (r.width < 24 || r.height < 24)) out.targets.push((el.textContent||el.getAttribute('aria-label')||'').trim().slice(0,30)+' '+Math.round(r.width)+'x'+Math.round(r.height));
  }
  for (const el of document.querySelectorAll('input, select, textarea')) {
    if (el.type === 'hidden' || el.hidden || !vis(el)) continue;
    const lab = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || (el.id && document.querySelector('label[for="'+el.id+'"]')) || el.closest('label');
    if (!lab) out.labels.push(el.outerHTML.slice(0,80));
  }
  const ids = {}; for (const el of document.querySelectorAll('[id]')) { ids[el.id] = (ids[el.id]||0)+1; }
  out.dupIds = Object.keys(ids).filter(k => ids[k] > 1);
  // contrast for every visible text-bearing element
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0],p[1],p[2], p.length>3 ? p[3] : 1]; };
  const lum = ([r,g,b]) => { const f = v => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }; return .2126*f(r)+.7152*f(g)+.0722*f(b); };
  const blend = (top, bot) => [0,1,2].map(i => top[i]*top[3] + bot[i]*(1-top[3])).concat(1);
  const bgOf = el => { const stack=[]; for (let e=el; e; e=e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c[3]>0) { stack.push(c); if (c[3]>=1) break; } } let base = [0,0,0,1]; if (!stack.length || stack[stack.length-1][3] < 1) base = parse(getComputedStyle(document.body).backgroundColor) || [255,255,255,1]; for (let i=stack.length-1;i>=0;i--) base = blend(stack[i], base); return base; };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const t = walker.currentNode; if (!t.textContent.trim()) continue;
    const el = t.parentElement; if (seen.has(el) || !vis(el)) continue; seen.add(el);
    if (el.closest('[disabled], [aria-disabled=true], #printArea, .preview .cite, input, option')) continue;
    if (el.closest('.btn:disabled')) continue;
    const s = getComputedStyle(el); const fg = parse(s.color); if (!fg) continue;
    const bg = bgOf(el); const f = blend(fg, bg);
    const L1 = lum(f), L2 = lum(bg); const cr = (Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);
    const size = parseFloat(s.fontSize), bold = parseInt(s.fontWeight) >= 700;
    const need = (size >= 24 || (bold && size >= 18.66)) ? 3 : 4.5;
    const op = parseFloat(s.opacity); if (op < 1) continue;
    if ((s.webkitBackgroundClip || s.backgroundClip) === 'text') continue; // gradient text: colours verified in tools/contrast-check.py
    if (cr < need - 0.01) out.contrast.push(t.textContent.trim().slice(0,40) + ' → ' + cr.toFixed(2));
  }
  return out;
}
'''
async def audit(pg, label):
    a = await pg.evaluate(AUDIT_JS)
    for k in ['names','labels','dupIds','targets','contrast']:
        ok(f'[{label}] a11y {k}', not a[k], a[k][:6])
    ok(f'[{label}] no horizontal overflow', not a['overflow'])

async def sandbox_to_memo(pg, sample='nudgepay'):
    await pg.click(f'[data-action=quick][data-id={sample}]')
    n = await pg.locator('.gut').count()
    for i in range(1,n+1):
        await pg.click(f'[data-action=gut][data-id=A{i}][data-v={"supported" if i<n else "unsure"}]')
    await pg.click('[data-action=run]')
    await pg.wait_for_selector('.btn[data-action=goto][data-n="4"]', timeout=60000)
    return n

async def decide(pg, n):
    for i in range(1,n+1):
        if await pg.locator(f'#card-A{i} .done-line').count(): continue
        if i==3:
            await pg.click('#card-A3 label.opt:has(input[data-v=override])')
            opts = await pg.locator('#ov-A3 option').all_inner_texts()
            await pg.select_option('#ov-A3', label=[o for o in opts if o!='Choose…'][0])
            await pg.fill('#rat-A3','Conditional: they accept automation once the template is approved.')
        elif i==n:
            await pg.click(f'#card-A{i} label.opt:has(input[data-v=park])'); await pg.fill(f'#rat-A{i}','Need more evidence from a proper ranking exercise.')
        else:
            await pg.click(f'#card-A{i} label.opt:has(input[data-v=accept])')
        await pg.click(f'#card-A{i} [data-action=save]')

async def main():
    async with async_playwright() as p:
        import os
        b = await p.chromium.launch(**({'executable_path': os.environ['CHROME']} if os.environ.get('CHROME') else {}), args=['--no-sandbox'])
        errs=[]
        def hook(pg):
            pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'status of 4' not in m.text else None)
            pg.on('pageerror', lambda e: errs.append('PAGEERROR '+str(e)))
            pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))

        # ===== 1. Full desktop flow in DARK, with keyboard decisions =====
        ctx = await b.new_context(viewport={'width':1440,'height':900}, accept_downloads=True, color_scheme='dark')
        pg = await ctx.new_page(); hook(pg)
        await pg.goto(URL); await pg.click('[data-action=theme]'); await pg.wait_for_timeout(250); await audit(pg,'dark landing 1440'); await pg.screenshot(path='/tmp/gt-qa-d-landing.png')
        n = await sandbox_to_memo(pg)
        await pg.screenshot(path='/tmp/gt-qa-d-run.png', full_page=True); await audit(pg,'dark run')
        ok('coach rendered', await pg.locator('.coach .c').count()==5)
        await pg.click('.btn[data-action=goto][data-n="4"]'); await pg.wait_for_selector('.acard')
        await audit(pg,'dark checkpoint'); await pg.screenshot(path='/tmp/gt-qa-d-checkpoint.png')
        ok('calibration shown', '/' in await pg.inner_text('.side .big'))
        # keyboard: decide A1 with keyboard only
        await pg.focus('input[name=act-A1][data-v=accept]'); await pg.keyboard.press('Space'); await pg.wait_for_timeout(100)
        await pg.focus('#card-A1 [data-action=save]'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200)
        ok('keyboard-only decision works', await pg.locator('#card-A1 .done-line').count()==1)
        await decide(pg, n)  # re-decides A1 harmlessly? A1 already decided -> skip handled below
        ok('all decided', await pg.locator('.ov.done').count()==n)
        await pg.click('.side [data-action=goto][data-n="5"]'); await pg.click('[data-action=genmemo]'); await pg.wait_for_selector('#memoText')
        ok('memo cites valid', 'All' in await pg.inner_text('#citeStatus'))
        await pg.click('input[data-action=approve]'); await audit(pg,'dark memo'); await pg.screenshot(path='/tmp/gt-qa-d-memo.png')
        async with pg.expect_download() as d: await pg.click('[data-action=dlaudit]')
        audit_json = json.load(open(await (await d.value).path()))
        ok('audit has coach+calibration', 'interview_coach' in audit_json and audit_json['calibration']['total']==n)
        # dialogs
        await pg.click('[data-action=dlg][data-k=method]'); await pg.wait_for_selector('dialog[open]'); await audit(pg,'dark dialog')
        await pg.screenshot(path='/tmp/gt-qa-d-dialog.png'); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(150)
        ok('Esc closes dialog', await pg.locator('dialog[open]').count()==0)
        ok('focus returns after dialog', await pg.evaluate("document.activeElement.dataset.k==='method'"))
        # theme toggle + persistence
        await pg.click('[data-action=theme]'); ok('theme toggles to light', await pg.evaluate("document.documentElement.dataset.theme")=='light')
        await pg.reload(); await pg.wait_for_selector('#memoText')
        ok('theme persists + session resumes on memo', await pg.evaluate("document.documentElement.dataset.theme")=='light')
        await audit(pg,'light memo'); await pg.screenshot(path='/tmp/gt-qa-l-memo.png')
        await pg.click('.step[data-n="4"]'); await pg.wait_for_selector('.acard'); await audit(pg,'light checkpoint'); await pg.screenshot(path='/tmp/gt-qa-l-checkpoint.png')
        await pg.click('.step[data-n="3"]'); await audit(pg,'light run'); await pg.screenshot(path='/tmp/gt-qa-l-run.png', full_page=True)
        await pg.click('.step[data-n="2"]'); await audit(pg,'light gut (locked)'); await pg.screenshot(path='/tmp/gt-qa-l-gut.png')
        await pg.click('.step[data-n="1"]'); await audit(pg,'light setup'); await pg.screenshot(path='/tmp/gt-qa-l-setup.png')
        await ctx.close()

        # ===== 2. Second sample + removing an interview, light theme =====
        ctx = await b.new_context(viewport={'width':1280,'height':860}, color_scheme='light'); pg = await ctx.new_page(); hook(pg)
        await pg.goto(URL); ok('light is the default theme', await pg.evaluate("document.documentElement.dataset.theme")=='light')
        await audit(pg,'light landing'); await pg.screenshot(path='/tmp/gt-qa-l-landing.png')
        await pg.select_option('#sampleSel','shiftfill'); await pg.click('[data-action=rmiv][data-i="1"]')
        ok('3 interviews after removal', await pg.locator('.item').count()==3)
        await pg.click('[data-action=togut]')
        for i in range(1,5): await pg.click(f'[data-action=gut][data-id=A{i}][data-v=contradicted]')
        await pg.click('[data-action=run]'); await pg.wait_for_selector('.btn[data-action=goto][data-n="4"]', timeout=60000)
        await pg.click('.btn[data-action=goto][data-n="4"]'); await pg.wait_for_selector('.acard')
        txt = await pg.inner_text('#app'); ok('removed interviewee absent', 'Marcus' not in txt.split('Run integrity')[0])
        # sandbox block on own data
        await pg.click('[data-action=newsession]'); await pg.click('[data-action=confirmnew]'); await pg.wait_for_timeout(200)
        await pg.fill('#newIv','Interviewer: How do you price?\nZoe: We charge 40 euros per hour and clients rarely complain about it.')
        await pg.click('[data-action=addiv]'); await pg.click('[data-action=adda]'); await pg.fill('#as-0','Clients accept hourly pricing.')
        ok('sandbox blocks own data', await pg.is_disabled('[data-action=togut]') and await pg.locator('.notice.amber').count()==1)
        await pg.click('[data-action=mode][data-v=live]'); await pg.select_option('#preset','custom')
        await pg.fill('#model','mock'); await pg.fill('#base','http://127.0.0.1:8787/v1')
        ok('live unblocks own data', not await pg.is_disabled('[data-action=togut]'))
        await ctx.close()

        # ===== 3. Live path through fault-injecting mock =====
        ctx = await b.new_context(viewport={'width':1280,'height':860}); pg = await ctx.new_page(); hook(pg)
        await pg.goto(URL); await pg.select_option('#sampleSel','nudgepay')
        await pg.click('[data-action=mode][data-v=live]'); await pg.select_option('#preset','openrouter'); await pg.select_option('#modelSel','__other'); await pg.fill('#model','openai/gpt-4o'); await pg.fill('#key','x')
        await pg.click('[data-action=togut]'); ok('paid model blocked', await pg.locator('.gut').count()==0)
        await pg.select_option('#preset','custom'); await pg.fill('#model','mock'); await pg.fill('#base','http://127.0.0.1:8787/v1')
        await pg.fill('#model','typo-model'); await pg.click('[data-action=test]'); await pg.wait_for_selector('[data-action=usemodel]', timeout=15000)
        ok('wrong model offers real alternatives', await pg.locator('[data-action=usemodel]').count()==2 and 'whisper' not in await pg.inner_text('#testOut'))
        await pg.click('[data-action=usemodel][data-m=mock]'); await pg.wait_for_selector('#testOut .ok', timeout=15000)
        await pg.click('[data-action=togut]')
        for i in range(1,6): await pg.click(f'[data-action=gut][data-id=A{i}][data-v=supported]')
        await pg.click('[data-action=run]'); await pg.wait_for_selector('.btn[data-action=goto][data-n="4"]', timeout=120000)
        ok('429 handled live', 'HTTP 429' in await pg.inner_text('.log'))
        await pg.click('.btn[data-action=goto][data-n="4"]'); await pg.wait_for_selector('.acard')
        v=[await pg.inner_text(f'#card-A{i} .badge:first-child') for i in range(1,6)]
        ok('live verdicts', v==['Agent: Supported','Agent: Mixed','Agent: Contradicted','Agent: Contradicted','Agent: Mixed'], v)
        await decide(pg,5); await pg.click('.side [data-action=goto][data-n="5"]'); await pg.click('[data-action=genmemo]'); await pg.wait_for_selector('#memoText', timeout=30000)
        ok('live memo valid', 'All' in await pg.inner_text('#citeStatus'))
        st=json.loads(urllib.request.urlopen('http://127.0.0.1:8787/stats').read()); ok('mock faults exercised', st['r429']>=1 and st['r400']>=1, st)
        await ctx.close()

        # ===== 4. Devices x themes =====
        for w,h,name in [(320,640,'320'),(390,844,'390'),(768,1024,'768'),(1024,768,'1024')]:
            for th in ['dark','light']:
                ctx = await b.new_context(viewport={'width':w,'height':h}, color_scheme=th, has_touch=w<1024, is_mobile=w<768); pg = await ctx.new_page(); hook(pg)
                await pg.goto(URL)
                if th=='dark': await pg.click('[data-action=theme]'); await pg.wait_for_timeout(250)
                await audit(pg,f'{th} {name} landing')
                if name in ('390','768'): await pg.screenshot(path=f'/tmp/gt-qa-{th[0]}-{name}-landing.png')
                n = await sandbox_to_memo(pg); await audit(pg,f'{th} {name} run')
                await pg.click('.btn[data-action=goto][data-n="4"]'); await pg.wait_for_selector('.acard'); await audit(pg,f'{th} {name} checkpoint')
                if name in ('390',): await pg.screenshot(path=f'/tmp/gt-qa-{th[0]}-{name}-checkpoint.png')
                await decide(pg,n); await pg.click('.side [data-action=goto][data-n="5"]'); await pg.click('[data-action=genmemo]'); await pg.wait_for_selector('#memoText')
                await pg.click('input[data-action=approve]'); await audit(pg,f'{th} {name} memo')
                if name=='390': await pg.screenshot(path=f'/tmp/gt-qa-{th[0]}-{name}-memo.png')
                if w < 768:
                    small = await pg.evaluate("[...document.querySelectorAll('.btn,.seg button,.ov,.iconbtn')].filter(e=>e.offsetParent&&e.getBoundingClientRect().height<43.5).map(e=>e.textContent.trim().slice(0,20))")
                    ok(f'[{th} {name}] 44px touch targets', not small, small[:5])
                await ctx.close()
        # new-session confirm dialog: cancel keeps data, confirm clears
        ctx = await b.new_context(viewport={'width':1280,'height':860}); pg = await ctx.new_page(); hook(pg)
        await pg.goto(URL); await pg.select_option('#sampleSel','nudgepay')
        await pg.click('[data-action=newsession]'); await pg.wait_for_selector('dialog[open]'); await pg.click('dialog [data-action=closedlg] >> nth=-1')
        ok('cancel keeps session', await pg.locator('.item').count()==5)
        await pg.click('[data-action=newsession]'); await pg.click('[data-action=confirmnew]'); await pg.wait_for_timeout(200)
        ok('confirm clears session', await pg.locator('.item').count()==0 and await pg.locator('dialog[open]').count()==0)
        await ctx.close()
        # robustness surfaced in the UI
        ctx = await b.new_context(viewport={'width':1280,'height':860}); pg = await ctx.new_page(); hook(pg)
        await pg.goto(URL); await sandbox_to_memo(pg, 'shiftfill'); await pg.click('.btn[data-action=goto][data-n="4"]'); await pg.wait_for_selector('.acard')
        ok('fragile badges shown', await pg.locator('.badge.fragile').count()==3 and await pg.locator('.badge.robust').count()==1)
        ok('fragile explanation names the person', 'without Sofia' in await pg.inner_text('#card-A3'))
        await ctx.close()
        ok('no console/page errors', not errs, errs[:5])
        await b.close()
    passed=sum(r for _,r in R); print(f'\n{passed}/{len(R)} checks passed')
asyncio.run(main())
