# WCAG AA contrast check for both Groundtruth palettes. Run: python3 tools/contrast-check.py
def hx(h):
    h=h.lstrip('#'); return tuple(int(h[i:i+2],16)/255 for i in (0,2,4))
def lum(c):
    f=lambda v: v/12.92 if v<=0.03928 else ((v+0.055)/1.055)**2.4
    r,g,b=map(f,c); return .2126*r+.7152*g+.0722*b
def mix(fg,a,bg): return tuple(fg[i]*a+bg[i]*(1-a) for i in range(3))
def cr(a,b):
    la,lb=lum(a),lum(b); return (max(la,lb)+.05)/(min(la,lb)+.05)
T={
 'light':dict(bg='#FFFFFF',panel='#FFFFFF',panel2='#F8FAFC',sunk='#F8FAFC',text='#0F172A',muted='#475569',faint='#5B6B80',brand='#4338CA',brandfill='#0F172A',onbrand='#FFFFFF',
   ok='#047857',bad='#B91C1C',warn='#92400E',info='#1D4ED8',neutral='#475569',paper='#FFFFFF',papertext='#1E293B',paperh2='#3730A3',paperfaint='#475569',okSolid='#047857',onok='#FFFFFF',
   band='#0F172A',onband='#F1F5F9',onbandmuted='#A9B6C9',mint='#10B981'),
 'dark':dict(bg='#0B1120',panel='#111A2E',panel2='#162036',sunk='#0E1628',text='#F1F5F9',muted='#B4C0D1',faint='#94A3B8',brand='#A5B4FC',brandfill='#F1F5F9',onbrand='#0F172A',
   ok='#6EE7B7',bad='#FCA5A5',warn='#FCD34D',info='#93C5FD',neutral='#CBD5E1',paper='#FFFFFF',papertext='#1E293B',paperh2='#3730A3',paperfaint='#475569',okSolid='#34D399',onok='#052E1C',
   band='#111A2E',onband='#F1F5F9',onbandmuted='#A9B6C9',mint='#34D399'),
}
fail=0
for name,t in T.items():
    c={k:hx(v) for k,v in t.items()}
    checks=[]
    for surf in ['bg','panel','panel2','sunk']:
        for fg in ['text','muted','faint','brand','ok','bad','warn','info','neutral']:
            checks.append((fg+' on '+surf, cr(c[fg],c[surf]), 4.5))
    checks+= [('onbrand on brandfill',cr(c['onbrand'],c['brandfill']),4.5),('papertext on paper',cr(c['papertext'],c['paper']),4.5),('paperh2 on paper',cr(c['paperh2'],c['paper']),4.5),('paperfaint on paper',cr(c['paperfaint'],c['paper']),4.5),('onok on okSolid',cr(c['onok'],c['okSolid']),3),('onband on band',cr(c['onband'],c['band']),4.5),('onbandmuted on band',cr(c['onbandmuted'],c['band']),4.5),('mint on band',cr(c['mint'],c['band']),4.5)]
    # tinted badge backgrounds (10% tint over panel)
    for fg in ['ok','bad','warn','info','neutral']:
        bgc = mix(c[fg],0.10,c['panel']) if name=='dark' else mix(c[fg],0.07,c['panel'])
        checks.append((fg+' on its tint',cr(c[fg],bgc),4.5))
    low=[x for x in checks if x[1]<x[2]]
    fail+=len(low)
    print(f"{name}: {len(checks)} pairs, min {min(x[1] for x in checks):.2f}, failing {[(a,round(b,2)) for a,b,_ in low]}")
print('ALL AA PASS' if not fail else 'FAILURES')
