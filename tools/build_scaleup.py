"""
Build the scale-up plan deck (pitch/scale-up.html) from data, with every chart drawn as inline SVG.

  python tools/build_scaleup.py

It reuses the pitch deck's design and slide engine (pitch/index.html). Edit the DATA section to update numbers.
"""
import math, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ================================================================ DATA (sources in the slide footers)
WASTE = [  # NEA: food waste generated, recycled ('000 t)
    (2021, 817, 154), (2022, 813, 146), (2023, 755, 132), (2024, 784, 138), (2025, 790, 140)]
SITES = [('Now', 1), ('Year 1', 10), ('Year 2', 50), ('Year 3', 150)]
PRICE, HW, RUN = 470, 3000, 80          # S$/month Pro plan; hardware per site; our running cost per site per month (estimates)
SAVE_MONTH = 28500 / 12                  # one 800-meal school: S$28,500 a year
FOOD_T, CO2_T, MONEY = 5.7, 14.25, 28500 # per site per year
SCHOOLS = 317                            # MOE 2024: 177 primary + ~140 secondary
BUDGET = [('Two scanners', 6000, 'var(--green)'), ('Installation', 1000, '#2F7FD9'), ('Cloud and software', 1000, '#5046C8'), ('Contingency and comms', 2000, '#8A918C')]
RISKS = [  # (label, likelihood 1-3, impact 1-3, fix)
    ('Mixed dishes', 3, 2, 'Known menu + weighing platform'),
    ('Forgot to scan', 2, 2, 'Loopi only eats if you scan'),
    ('Slow queue', 1, 3, '~2 s scan, 1 scanner per 400'),
    ('Privacy worries', 2, 3, 'No photos leave the scanner'),
    ('Smaller savings', 2, 3, 'Pilot measures first; price below'),
]

money = lambda v: f'S${v:,.0f}'

# ================================================================ chart helpers (1600 × 900 slides)
def svg(w, h, body, cls='chart'):
    return f'<svg class="{cls}" viewBox="0 0 {w} {h}" width="100%" role="img" aria-hidden="true">{body}</svg>'

def ring(pct, size=150, stroke=16, color='var(--green)', track='rgba(16,21,18,.08)', d=0):
    r = (size - stroke) / 2; c = 2 * math.pi * r; off = c * (1 - pct)
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}" aria-hidden="true"><circle cx="{size/2}" cy="{size/2}" r="{r}" fill="none" stroke="{track}" stroke-width="{stroke}"/>'
            f'<circle data-a="ring" style="--c:{c:.1f};--d:{d}s" cx="{size/2}" cy="{size/2}" r="{r}" fill="none" stroke="{color}" stroke-width="{stroke}" stroke-linecap="round" stroke-dasharray="{c:.1f}" stroke-dashoffset="{off:.1f}" transform="rotate(-90 {size/2} {size/2})"/></svg>')

def waste_bars():
    W, H, l, b, t = 1400, 470, 70, 50, 40
    iw, ih, mx = W - l - 20, H - b - t, 900
    bw = iw / len(WASTE) * .52
    g = ''.join(f'<line x1="{l}" x2="{W-20}" y1="{t+ih-v/mx*ih:.1f}" y2="{t+ih-v/mx*ih:.1f}" stroke="rgba(255,255,255,.08)"/><text x="{l-14}" y="{t+ih-v/mx*ih+5:.1f}" text-anchor="end" class="ax">{v}k</text>' for v in (0, 300, 600, 900))
    for i, (yr, tot, rec) in enumerate(WASTE):
        x = l + iw / len(WASTE) * (i + .5) - bw / 2
        hd, hr = (tot - rec) / mx * ih, rec / mx * ih
        y0 = t + ih
        g += (f'<g data-a="gy" style="--d:{.15+i*.1:.2f}s"><rect x="{x:.1f}" y="{y0-hd-hr:.1f}" width="{bw:.1f}" height="{hd:.1f}" rx="6" fill="#4B5450"/>'
              f'<rect x="{x:.1f}" y="{y0-hr:.1f}" width="{bw:.1f}" height="{hr:.1f}" fill="var(--glow)"/></g>'
              f'<text x="{x+bw/2:.1f}" y="{y0-hd-hr-14:.1f}" text-anchor="middle" class="vl" data-a="fade" style="--d:{.6+i*.1:.2f}s">{tot}k t</text>'
              f'<text x="{x+bw/2:.1f}" y="{y0-hr/2+7:.1f}" text-anchor="middle" class="in">{round(rec/tot*100)}%</text>'
              f'<text x="{x+bw/2:.1f}" y="{H-14}" text-anchor="middle" class="ax">{yr}</text>')
    return svg(W, H, g)

def growth_curve(dark=False, small=False):
    W, H = (520, 220) if small else (1400, 430)
    l, r, t, b = (10, 10, 20, 10) if small else (60, 60, 40, 60)
    iw, ih = W - l - r, H - t - b
    pts = [(l + iw * i / (len(SITES) - 1), t + ih - v / 150 * ih) for i, (_, v) in enumerate(SITES)]
    path = 'M' + ' C'.join(f'{x:.1f},{y:.1f}' if i == 0 else f'{pts[i-1][0]+(x-pts[i-1][0])*.55:.1f},{pts[i-1][1]:.1f} {x-(x-pts[i-1][0])*.45:.1f},{y:.1f} {x:.1f},{y:.1f}' for i, (x, y) in enumerate(pts))
    col = 'var(--glow)'
    g = f'<defs><linearGradient id="gf{int(small)}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3DDC73" stop-opacity=".35"/><stop offset="1" stop-color="#3DDC73" stop-opacity="0"/></linearGradient></defs>'
    g += f'<path d="{path} L{pts[-1][0]:.1f},{t+ih} L{pts[0][0]:.1f},{t+ih} Z" fill="url(#gf{int(small)})" data-a="fade" style="--d:.5s"/>'
    g += f'<path d="{path}" fill="none" stroke="{col}" stroke-width="{4 if small else 6}" stroke-linecap="round" data-a="draw" style="--d:.2s"/>'
    if not small:
        for i, ((lab, v), (x, y)) in enumerate(zip(SITES, pts)):
            g += (f'<circle cx="{x:.1f}" cy="{y:.1f}" r="11" fill="{col}" stroke="var(--paper)" stroke-width="5" data-a="pop" style="--d:{.4+i*.2:.1f}s"/>'
                  f'<text x="{x:.1f}" y="{y-26:.1f}" text-anchor="{"start" if i == 0 else "end" if i == 3 else "middle"}" class="big" data-a="fade" style="--d:{.5+i*.2:.1f}s">{v}<tspan class="unit"> {"site" if v == 1 else "sites"}</tspan></text>'
                  f'<text x="{x:.1f}" y="{H-18}" text-anchor="{"start" if i == 0 else "end" if i == 3 else "middle"}" class="ax2">{lab}</text>')
    return svg(W, H, g)

def school_dots():
    cols, gap, rad = 23, 30, 11
    rows = math.ceil(SCHOOLS / cols)
    W, H = cols * gap, rows * gap
    tiers = [(1, 'var(--glow)', 1), (10, '#2BB45A', .9), (50, '#1E8C46', .75), (150, '#17663A', .7)]
    g = ''
    for i in range(SCHOOLS):
        x, y = gap / 2 + (i % cols) * gap, gap / 2 + (i // cols) * gap
        col = next((c for n, c, _ in tiers if i < n), 'rgba(255,255,255,.12)')
        d = .1 + (i // cols) * .03
        g += f'<circle cx="{x}" cy="{y}" r="{rad}" fill="{col}" data-a="pop" style="--d:{d:.2f}s"/>'
    return svg(W, H, g, 'chart dots')

def gantt():
    W, H, l, wk = 1400, 300, 230, 12
    iw = W - l - 10; cw = iw / wk
    rows = [('Install + consent', 0, 1, '#8A918C'), ('Baseline: scan only', 1, 3, '#D9730D'), ('PlateLoop live', 3, 11, 'var(--green)'), ('Results report', 11, 12, '#1B6BD1')]
    g = ''.join(f'<text x="{l+cw*i+cw/2:.1f}" y="22" text-anchor="middle" class="ax">W{i+1}</text><line x1="{l+cw*i:.1f}" x2="{l+cw*i:.1f}" y1="34" y2="{H}" stroke="var(--line)"/>' for i in range(wk))
    for j, (lab, a, b, col) in enumerate(rows):
        y = 50 + j * 62
        g += (f'<text x="0" y="{y+30}" class="lbl">{lab}</text>'
              f'<rect data-a="gx" style="--d:{.2+j*.15:.2f}s" x="{l+cw*a+3:.1f}" y="{y}" width="{cw*(b-a)-6:.1f}" height="44" rx="12" fill="{col}"/>'
              f'<text x="{l+cw*a+18:.1f}" y="{y+29}" class="inb" data-a="fade" style="--d:{.5+j*.15:.2f}s">{b-a} wk{"s" if b-a > 1 else ""}</text>')
    return svg(W, H, g)

def hub():
    W, H, cx, cy, R = 760, 560, 380, 280, 220
    g = ''
    for i in range(10):
        a = -math.pi / 2 + i * 2 * math.pi / 10
        x, y = cx + R * math.cos(a), cy + R * math.sin(a)
        g += (f'<line x1="{cx}" y1="{cy}" x2="{x:.1f}" y2="{y:.1f}" stroke="var(--green)" stroke-width="3" stroke-dasharray="8 8" data-a="fade" style="--d:{.3+i*.05:.2f}s"/>'
              f'<g data-a="pop" style="--d:{.4+i*.06:.2f}s"><circle cx="{x:.1f}" cy="{y:.1f}" r="38" fill="var(--card)" stroke="var(--mint)" stroke-width="4"/>'
              f'<path d="M{x-16:.1f} {y+12:.1f}v-16l16-12 16 12v16z" fill="none" stroke="var(--green)" stroke-width="3.5" stroke-linejoin="round"/><path d="M{x-5:.1f} {y+12:.1f}v-9h10v9" fill="none" stroke="var(--green)" stroke-width="3"/></g>')
    g += (f'<g data-a="pop" style="--d:.1s"><circle cx="{cx}" cy="{cy}" r="92" fill="var(--green)"/>'
          f'<text x="{cx}" y="{cy-6}" text-anchor="middle" class="hubt">1 caterer</text><text x="{cx}" y="{cy+28}" text-anchor="middle" class="hubs">one contract</text></g>')
    return svg(W, H, g)

def payback():
    W, H, l, r, t, b = 820, 470, 90, 30, 30, 60
    iw, ih = W - l - r, H - t - b
    months = 24; lo, hi = -3500, 7000
    X = lambda m: l + m / months * iw; Y = lambda v: t + ih - (v - lo) / (hi - lo) * ih
    net = PRICE - RUN; be = HW / net
    pts = [(m, -HW + net * m) for m in range(months + 1)]
    g = ''.join(f'<line x1="{l}" x2="{W-r}" y1="{Y(v):.1f}" y2="{Y(v):.1f}" stroke="var(--line)"/><text x="{l-12}" y="{Y(v)+5:.1f}" text-anchor="end" class="ax">{("−" if v < 0 else "") + money(abs(v)) if v else "0"}</text>' for v in (-3000, 0, 3000, 6000))
    g += f'<line x1="{l}" x2="{W-r}" y1="{Y(0):.1f}" y2="{Y(0):.1f}" stroke="var(--ink3)" stroke-width="2"/>'
    d = 'M' + ' L'.join(f'{X(m):.1f},{Y(v):.1f}' for m, v in pts)
    g += f'<path d="{d}" fill="none" stroke="var(--green)" stroke-width="6" stroke-linecap="round" data-a="draw" style="--d:.2s"/>'
    g += (f'<circle cx="{X(be):.1f}" cy="{Y(0):.1f}" r="12" fill="var(--green)" stroke="var(--paper)" stroke-width="5" data-a="pop" style="--d:1s"/>'
          f'<text x="{X(be)+20:.1f}" y="{Y(0)+42:.1f}" class="lblg" data-a="fade" style="--d:1.1s">Break-even: month {be:.0f}</text>'
          f'<text x="{X(0)+8:.1f}" y="{Y(-HW)-14:.1f}" class="lbl2">−{money(HW)} scanner</text>'
          f'<text x="{X(24)-6:.1f}" y="{Y(pts[-1][1])-18:.1f}" text-anchor="end" class="lblg">+{money(pts[-1][1])}</text>')
    g += ''.join(f'<text x="{X(m):.1f}" y="{H-20}" text-anchor="middle" class="ax">{m} mo</text>' for m in (0, 6, 12, 18, 24))
    return svg(W, H, g)

def revenue():
    W, H, l, r, t, b = 1400, 450, 40, 40, 70, 60
    iw, ih = W - l - r, H - t - b
    n = len(SITES); bw = iw / n * .42
    g = ''
    for i, (lab, s) in enumerate(SITES):
        cx = l + iw / n * (i + .5); arr = s * PRICE * 12
        h = max(8, arr / (150 * PRICE * 12) * ih)
        g += (f'<rect data-a="gy" style="--d:{.2+i*.15:.2f}s" x="{cx-bw/2:.1f}" y="{t+ih-h:.1f}" width="{bw:.1f}" height="{h:.1f}" rx="14" fill="var(--green)"/>'
              f'<text x="{cx:.1f}" y="{t+ih-h-46:.1f}" text-anchor="middle" class="big2" data-a="fade" style="--d:{.5+i*.15:.2f}s">{money(arr) if arr < 1e6 else f"S${arr/1e6:.2f}M"}</text>'
              f'<text x="{cx:.1f}" y="{t+ih-h-16:.1f}" text-anchor="middle" class="ax">a year · {s} site{"s" if s > 1 else ""}</text>'
              f'<text x="{cx:.1f}" y="{H-18}" text-anchor="middle" class="ax2">{lab}</text>')
    return svg(W, H, g)

def impact_bars():
    W, H, l, t, b = 900, 430, 20, 70, 56
    iw, ih = W - 40, H - t - b
    data = [(lab, s * FOOD_T) for lab, s in SITES]
    n = len(data); bw = iw / n * .5
    g = ''
    for i, (lab, v) in enumerate(data):
        cx = l + iw / n * (i + .5); h = max(8, v / data[-1][1] * ih)
        lab_v = f'{v:,.1f} t' if v < 10 else f'{v:,.0f} t'
        g += (f'<rect data-a="gy" style="--d:{.2+i*.15:.2f}s" x="{cx-bw/2:.1f}" y="{t+ih-h:.1f}" width="{bw:.1f}" height="{h:.1f}" rx="12" fill="var(--glow)"/>'
              f'<text x="{cx:.1f}" y="{t+ih-h-16:.1f}" text-anchor="middle" class="big2w" data-a="fade" style="--d:{.5+i*.15:.2f}s">{lab_v}</text>'
              f'<text x="{cx:.1f}" y="{H-16}" text-anchor="middle" class="axw">{lab}</text>')
    return svg(W, H, g)

def budget_bar():
    tot = sum(v for _, v, _ in BUDGET)
    segs = ''.join(f'<div data-a="grow" style="--d:{.15+i*.12:.2f}s;flex:{v};background:{c}"><b>{money(v)}</b><span>{lab}</span></div>' for i, (lab, v, c) in enumerate(BUDGET))
    return f'<div class="budget">{segs}</div><div class="fund"><div class="fund-a" data-a="grow" style="--d:.9s"><b>{money(tot*.8)}</b><span>NEA 3R Fund (80%)</span></div><div class="fund-b" data-a="grow" style="--d:1.05s"><b>{money(tot*.2)}</b><span>we raise</span></div></div>'

def risk_matrix():
    W, H, l, t = 640, 560, 70, 20
    cw, ch = (W - l - 10) / 3, (H - t - 60) / 3
    g = ''
    for li in range(3):
        for im in range(3):
            sev = li + im
            col = ['#E3F5E7', '#E3F5E7', '#FDEEDC', '#FBD9C9', '#F7C2B6'][sev]
            g += f'<rect x="{l+im*cw+3:.1f}" y="{t+(2-li)*ch+3:.1f}" width="{cw-6:.1f}" height="{ch-6:.1f}" rx="16" fill="{col}"/>'
    placed = {}
    for k, (lab, li, im, _) in enumerate(RISKS):
        n = placed.get((li, im), 0); placed[(li, im)] = n + 1
        x = l + (im - 1) * cw + cw / 2 + (n * 60 - (30 if (li, im) in [(2, 3)] else 0))
        y = t + (3 - li) * ch + ch / 2
        g += f'<g data-a="pop" style="--d:{.3+k*.12:.2f}s"><circle cx="{x:.1f}" cy="{y:.1f}" r="26" fill="var(--ink)"/><text x="{x:.1f}" y="{y+8:.1f}" text-anchor="middle" class="rnum">{k+1}</text></g>'
    g += f'<text x="{l+(W-l)/2:.1f}" y="{H-16}" text-anchor="middle" class="ax2">Impact →</text><text x="22" y="{t+(H-t-60)/2:.1f}" text-anchor="middle" class="ax2" transform="rotate(-90 22 {t+(H-t-60)/2:.1f})">Likelihood →</text>'
    return svg(W, H, g)

# ================================================================ slides
def slide(title, body, dark=False, notes=''):
    return f'<section class="slide{" dark" if dark else ""}" data-title="{title}">\n{body}\n  <aside class="notes">{notes}</aside>\n</section>\n'

def kpi(big, label, src='', d=0, cls=''):
    return f'<div class="kpi {cls}" data-a style="--d:{d}s"><b>{big}</b><span>{label}</span>{f"<em>{src}</em>" if src else ""}</div>'

S = []
S.append(slide('Scaling PlateLoop', f'''  <div class="title-grid">
    <div><div class="eyebrow" data-a>Scale-up plan · 2026–2029</div>
      <h1 data-a style="--d:.1s" class="t1">1 canteen<br><span>→ 150.</span></h1>
      <div class="trio" data-a style="--d:.3s"><div><b>3</b><span>years</span></div><div><b>4</b><span>phases</span></div><div><b>855 t</b><span>food saved a year</span></div></div></div>
    <div class="t-chart" data-a="fade" style="--d:.2s">{growth_curve(small=True)}</div>
  </div>''', True, 'Our plan takes PlateLoop from one canteen to 150 in three years, in four phases. At full scale, that saves about 855 tonnes of food every year.'))

S.append(slide('The problem is growing', f'''  <div class="eyebrow" data-a>The problem</div>
  <h2 data-a style="--d:.1s">Singapore’s food waste isn’t falling.</h2>
  <div class="chart-wrap" data-a="fade" style="--d:.15s">{waste_bars()}</div>
  <div class="legend"><span><i style="background:#4B5450"></i>Thrown away</span><span><i style="background:var(--glow)"></i>Recycled</span><span class="pill">Recycling stuck at 18–19%</span></div>
  <div class="src">NEA, food waste statistics 2021–2025.</div>''', True, 'Singapore\'s food waste is not falling: 790,000 tonnes in 2025, up from 755,000 in 2023, and the share recycled has been stuck at 18 to 19 percent for five years. Recycling alone isn\'t solving it; we need less waste in the first place.'))

S.append(slide('Measuring works', f'''  <div class="eyebrow" data-a>The evidence</div>
  <h2 data-a style="--d:.1s">Measuring waste cuts it.</h2>
  <div class="ev-grid">
    <div class="ev-bars" data-a style="--d:.2s">
      <div class="evb"><span>Before</span><i data-a="grow" style="--d:.3s;width:100%"></i><b>100</b></div>
      <div class="evb g"><span>After 1 year</span><i data-a="grow" style="--d:.5s;width:64%"></i><b>64</b></div>
      <div class="ev-big"><b>−36%</b><span>food waste at 86 catering sites</span></div>
    </div>
    <div class="rings">
      <div class="rg" data-a style="--d:.3s">{ring(.64, d=.4)}<b>64%</b><span>paid back in year 1</span></div>
      <div class="rg" data-a style="--d:.4s">{ring(.79, d=.5)}<b>79%</b><span>spent under US$10k</span></div>
      <div class="rg" data-a style="--d:.5s"><div class="ratio">6:1</div><span>return on investment</span></div>
      <div class="rg" data-a style="--d:.6s">{ring(.89, color='#1B6BD1', d=.7)}<b>89%</b><span>foods recognised by tray scans</span></div>
    </div>
  </div>
  <div class="src">Champions 12.3 (WRAP &amp; WRI), Business Case for Reducing Food Loss and Waste: Catering, 2018 · Pfisterer et al., JMIR Aging 2022.</div>''', False, 'The evidence that this works: 86 catering sites that started measuring their waste cut it by 36% in a year. 64% paid back their investment in the first year, most spent under 10,000 US dollars, and the average return was six to one. And tray-scanning systems like ours already recognise about 89% of foods.'))

S.append(slide('The market', f'''  <div class="eyebrow" data-a>The opportunity</div>
  <h2 data-a style="--d:.1s">317 school canteens. 150 in 3 years.</h2>
  <div class="mk-grid">
    <div class="dots-wrap">{school_dots()}</div>
    <div class="mk-side">
      <div class="lg"><span><i style="background:var(--glow)"></i>Pilot · 1</span><span><i style="background:#2BB45A"></i>Year 1 · 10</span><span><i style="background:#1E8C46"></i>Year 2 · 50</span><span><i style="background:#17663A"></i>Year 3 · 150</span></div>
      {kpi('177 + ~140', 'primary + secondary schools', 'MOE, 2024', .3, 'w')}
      {kpi('2024→25', 'caterers must separate food waste', 'NEA, Resource Sustainability Act', .4, 'w')}
      {kpi('80%', 'of project costs co-funded', 'NEA 3R Fund', .5, 'w')}
    </div>
  </div>''', True, 'Each dot is one of Singapore\'s 317 MOE primary and secondary schools, and each has a canteen. We aim to reach 150 of them in three years. The timing is right: caterers now have to separate their food waste, and NEA\'s 3R Fund co-funds up to 80% of projects like ours.'))

S.append(slide('Roadmap', f'''  <div class="eyebrow" data-a>Roadmap</div>
  <h2 data-a style="--d:.1s">Prove. Partner. Expand. Scale.</h2>
  <div class="chart-wrap">{growth_curve()}</div>
  <div class="phases"><div><b>Prove</b><span>1 school pilot</span></div><div><b>Partner</b><span>1 caterer’s canteens</span></div><div><b>Expand</b><span>+ hospital + office</span></div><div><b>Scale</b><span>+ region · B2C app</span></div></div>''', False, 'Four phases. Prove it in one school. Partner with a caterer to reach ten canteens. Expand to fifty sites including a hospital ward and an office canteen. Then scale to 150 and into the region.'))

S.append(slide('Phase 1: pilot', f'''  <div class="eyebrow" data-a>Phase 1 · the pilot</div>
  <h2 data-a style="--d:.1s">12 weeks. 6 targets.</h2>
  <div class="chart-wrap" style="margin-top:20px">{gantt()}</div>
  <div class="targets">
    {kpi('−20%', 'plate waste', '', .3)}{kpi('−10%', 'food cooked', '', .38)}{kpi('90%', 'trays scanned', '', .46)}{kpi('≤3 s', 'per scan', '', .54)}{kpi('85%', 'dishes recognised', '', .62)}{kpi('4/5', 'liked it', '', .7)}
  </div>''', False, 'The pilot runs for 12 weeks in one school canteen. Two weeks of baseline, scanning only, tell us today\'s waste. Then eight weeks of full PlateLoop. Success means 20% less plate waste, 10% less food cooked, nine in ten trays scanned, under three seconds a scan, 85% of dishes recognised, and people liking it.'))

S.append(slide('Phase 2: caterers', f'''  <div class="eyebrow" data-a>Phase 2 · year 1</div>
  <h2 data-a style="--d:.1s">1 contract. 10 canteens.</h2>
  <div class="hub-grid">
    <div>{hub()}</div>
    <div class="hub-side">
      {kpi('10×', 'reach per partnership', '', .3)}
      {kpi('6:1', 'return for caterers who measure waste', 'Champions 12.3, 2018', .4)}
      {kpi('Required', 'food waste separation for caterers', 'NEA, from 2024–25', .5)}
    </div>
  </div>''', False, 'In year one we grow through a contract caterer, because one contract opens about ten canteens. Caterers that measure waste see a six-to-one return, and they are now required to separate their food waste.'))

S.append(slide('Phase 3: new sectors', f'''  <div class="eyebrow" data-a>Phase 3 · year 2</div>
  <h2 data-a style="--d:.1s">Same scanner. 3 new markets.</h2>
  <div class="sect">
    <div class="sc" data-a style="--d:.2s;--c:#1B6BD1"><small>Hospitals</small><div class="rgw">{ring(.30, 180, 18, '#1B6BD1', d=.3)}<b>30%</b></div><span>hospital food left on the plate</span><em>median of 32 studies</em></div>
    <div class="sc" data-a style="--d:.32s;--c:#5046C8"><small>Offices</small><div class="rgw">{ring(.6, 180, 18, '#5046C8', d=.4)}<b>6 in 10</b></div><span>eat out 4+ times a week</span><em>HPB, 2010</em></div>
    <div class="sc" data-a style="--d:.44s;--c:var(--green)"><small>Universities</small><div class="rgw">{ring(.136, 180, 18, 'var(--green)', d=.5)}<b>13.6%</b></div><span>students eat enough fruit and veg</span><em>Chew et al., 2017</em></div>
  </div>''', False, 'In year two the same scanner enters three new markets. Hospitals leave about 30% of food on the plate. Six in ten Singaporeans eat out at least four times a week. And only 13.6% of university students eat enough fruit and vegetables.'))

S.append(slide('Unit economics', f'''  <div class="eyebrow" data-a>Unit economics · one 800-meal site</div>
  <h2 data-a style="--d:.1s">5× for them. Break-even in 8 months for us.</h2>
  <div class="ue">
    <div class="ue-l">
      <div class="cmpbar"><span>Customer saves</span><i data-a="grow" style="--d:.2s;width:100%"></i><b>{money(SAVE_MONTH)}/mo</b></div>
      <div class="cmpbar o"><span>Customer pays</span><i data-a="grow" style="--d:.35s;width:{PRICE/SAVE_MONTH*100:.1f}%"></i><b>{money(PRICE)}/mo</b></div>
      <div class="ue-big" data-a style="--d:.5s"><b>5×</b><span>return for the customer</span></div>
    </div>
    <div class="ue-r" data-a="fade" style="--d:.2s">{payback()}<p class="cap">PlateLoop’s cash per site: −{money(HW)} scanner, then +{money(PRICE-RUN)} a month</p></div>
  </div>
  <div class="src">Estimates: 800 meals × 190 days, 25% wasted, a 30% cut, S$2.50 of ingredients a meal; scanner ~S$3,000 and ~S$80/month to run. To confirm in the pilot.</div>''', False, 'For the customer, a school saves about 2,375 dollars a month and pays 470: a five-times return. For us, each scanner costs about 3,000 dollars, and after running costs each site brings in about 390 a month, so we break even in month eight.'))

S.append(slide('Revenue', f'''  <div class="eyebrow" data-a>Revenue · Pro plan, per year</div>
  <h2 data-a style="--d:.1s">From {money(PRICE*12)} to {money(150*PRICE*12)} a year.</h2>
  <div class="chart-wrap">{revenue()}</div>
  <div class="src">Illustrative: sites × S${PRICE}/month × 12. Add-on programmes (Loopi, Loopi Care, Loopi Work) not included.</div>''', False, 'At our Pro price, one pilot site is worth about 5,600 dollars a year, ten sites 56,000, fifty sites 282,000, and 150 sites about 846,000 dollars a year, before add-on programmes.'))

S.append(slide('Impact at scale', f'''  <div class="eyebrow" data-a>Impact · per year</div>
  <h2 data-a style="--d:.1s">855 tonnes of food saved a year.</h2>
  <div class="imp">
    <div class="chart-wrap" data-a="fade" style="--d:.1s">{impact_bars()}</div>
    <div class="imp-side">
      {kpi(f'{150*FOOD_T*1000/0.5/1e6:.1f}M', 'meals’ worth of food', '', .3, 'w')}
      {kpi(f'{150*CO2_T:,.0f} t', 'CO₂e avoided', '', .4, 'w')}
      {kpi(f'S${150*MONEY/1e6:.1f}M', 'ingredients saved', '', .5, 'w')}
    </div>
  </div>
  <div class="src">Per site: 5.7 t food, 14 t CO₂e, S$28,500 a year (estimate, 0.5 kg per meal, 2.5 kg CO₂e per kg). The pilot sets the real number.</div>''', True, 'At 150 sites we save about 855 tonnes of food a year. That\'s 1.7 million meals\' worth, over 2,100 tonnes of CO2, and about 4.3 million dollars of ingredients.'))

S.append(slide('Funding', f'''  <div class="eyebrow" data-a>Pilot budget</div>
  <h2 data-a style="--d:.1s">A {money(sum(v for _, v, _ in BUDGET))} pilot. We raise {money(sum(v for _, v, _ in BUDGET)*.2)}.</h2>
  <div class="bud-wrap">{budget_bar()}</div>
  <div class="team">
    <div data-a style="--d:1.1s"><i>🎓</i><b>Now</b><span>our student team</span></div>
    <div data-a style="--d:1.2s"><i>🔧</i><b>Next</b><span>hardware engineer</span></div>
    <div data-a style="--d:1.3s"><i>🧠</i><b>Next</b><span>ML engineer</span></div>
    <div data-a style="--d:1.4s"><i>🤝</i><b>Then</b><span>partnerships lead</span></div>
    <div data-a style="--d:1.5s"><i>🩺</i><b>Then</b><span>dietitian adviser</span></div>
  </div>
  <div class="src">NEA 3R Fund: up to 80% of qualifying costs (cap S$1M), food waste prioritised. Budget is an estimate.</div>''', False, 'The pilot costs about 10,000 dollars, mostly the two scanners. NEA\'s 3R Fund can cover 80%, so we need to raise about 2,000. Next we add a hardware engineer and a machine-learning engineer, then a partnerships lead and a dietitian adviser.'))

risk_rows = ''.join(f'<div class="rk" data-a style="--d:{.3+k*.1:.2f}s"><span>{k+1}</span><div><b>{lab}</b><em>{fix}</em></div></div>' for k, (lab, _, _, fix) in enumerate(RISKS))
S.append(slide('Risks', f'''  <div class="eyebrow" data-a>Risks</div>
  <h2 data-a style="--d:.1s">5 risks. 5 fixes.</h2>
  <div class="risk-grid"><div>{risk_matrix()}</div><div class="rks">{risk_rows}</div></div>''', False, 'Five risks, each with a fix: mixed dishes are handled by the known menu and the weighing platform; Loopi only eats if students scan; scans take about two seconds; no photos leave the scanner; and the pilot measures savings before we set prices.'))

S.append(slide('Our ask', f'''  <div class="body" style="justify-content:center">
    <div class="eyebrow" data-a>Our ask</div>
    <h2 data-a style="--d:.1s;font-size:110px;line-height:.95;letter-spacing:-.05em">1 canteen.<br><span style="color:var(--glow)">12 weeks.</span></h2>
    <div class="ask3">
      <div data-a style="--d:.3s"><i>🏫</i><b>1 canteen</b><span>to host 2 scanners</span></div>
      <div data-a style="--d:.4s"><i>📝</i><b>1 co-applicant</b><span>for NEA’s 3R Fund</span></div>
      <div data-a style="--d:.5s"><i>🤝</i><b>1 introduction</b><span>to a contract caterer</span></div>
    </div>
  </div>''', True, 'Our ask: one canteen for twelve weeks to host two scanners, a partner to co-apply for NEA\'s 3R Fund, and an introduction to a contract caterer.'))

CSS = '''
/* ---- scale-up deck: visual components */
.chart{display:block;overflow:visible}
.chart .ax{font:600 17px var(--font);fill:var(--ink3)} .dark .chart .ax{fill:var(--night-ink2)}
.chart .ax2{font:700 20px var(--font);fill:var(--ink2)}
.chart .vl{font:800 26px var(--font);fill:#fff;letter-spacing:-.02em}
.chart .in{font:800 20px var(--font);fill:#0B100D}
.chart .big{font:800 44px var(--font);fill:var(--ink);letter-spacing:-.03em}.chart .big .unit{font-size:20px;fill:var(--ink3);letter-spacing:0}
.chart .big2{font:800 40px var(--font);fill:var(--ink);letter-spacing:-.03em}
.chart .big2w{font:800 36px var(--font);fill:#fff;letter-spacing:-.03em}
.chart .axw{font:700 19px var(--font);fill:var(--night-ink2)}
.chart .lbl{font:700 21px var(--font);fill:var(--ink)}
.chart .lbl2{font:700 18px var(--font);fill:var(--ink2)}
.chart .lblg{font:800 22px var(--font);fill:var(--green)}
.chart .inb{font:800 19px var(--font);fill:#fff}
.chart .hubt{font:800 28px var(--font);fill:#fff}.chart .hubs{font:600 17px var(--font);fill:rgba(255,255,255,.85)}
.chart .rnum{font:800 24px var(--font);fill:#fff}
.slide.on [data-a="gy"]{animation:gy 1s cubic-bezier(.2,.8,.2,1) var(--d,0s) both;transform-box:fill-box;transform-origin:bottom}
.slide.on [data-a="gx"]{animation:gx 1s cubic-bezier(.2,.8,.2,1) var(--d,0s) both;transform-box:fill-box;transform-origin:left}
.slide.on [data-a="draw"]{stroke-dasharray:3000;animation:draw 1.6s cubic-bezier(.4,0,.2,1) var(--d,0s) both}
.slide.on [data-a="ring"]{animation:ringin 1.2s cubic-bezier(.2,.8,.2,1) var(--d,0s) both}
[data-a="ring"],[data-a="draw"],[data-a="gy"],[data-a="gx"]{opacity:1}
@keyframes gy{from{transform:scaleY(0)}}@keyframes gx{from{transform:scaleX(0)}}
@keyframes draw{from{stroke-dashoffset:3000}to{stroke-dashoffset:0}}
@keyframes ringin{from{stroke-dashoffset:var(--c)}}
.chart-wrap{margin-top:auto;margin-bottom:auto}
.legend{display:flex;gap:26px;align-items:center;margin-top:10px;font-size:18px;font-weight:600;color:var(--night-ink2)}
.legend i,.lg i{display:inline-block;width:16px;height:16px;border-radius:5px;margin-right:8px;vertical-align:-2px}
.legend .pill{margin-left:auto;padding:10px 18px;border-radius:99px;background:rgba(61,220,115,.15);color:var(--glow);font-weight:800}
.title-grid{display:grid;grid-template-columns:1.1fr 1fr;gap:50px;align-items:center;flex:1}
.t1{font-size:170px;font-weight:800;letter-spacing:-.06em;line-height:.88;margin:14px 0 0}.t1 span{color:var(--glow)}
.trio{display:flex;gap:44px;margin-top:40px}.trio b{display:block;font-size:56px;font-weight:800;letter-spacing:-.04em;line-height:1;color:#fff}.trio span{font-size:18px;color:var(--night-ink2)}
.t-chart{padding:30px;border-radius:30px;background:rgba(255,255,255,.04);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
.ev-grid{display:grid;grid-template-columns:1fr 1.15fr;gap:60px;align-items:center;margin:auto 0}
.ev-bars{display:flex;flex-direction:column;gap:18px}
.evb{display:grid;grid-template-columns:150px 1fr 70px;gap:16px;align-items:center}
.evb span{font-size:20px;font-weight:700;color:var(--ink2)}
.evb i{display:block;height:56px;border-radius:14px;background:#C9CEC9;transform-origin:left}
.evb.g i{background:var(--green)}.evb b{font-size:30px;font-weight:800}
.ev-big{margin-top:16px}.ev-big b{display:block;font-size:120px;font-weight:800;letter-spacing:-.06em;line-height:1;color:var(--green)}.ev-big span{font-size:22px;color:var(--ink2)}
.rings{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.rg{position:relative;display:flex;flex-direction:column;align-items:center;gap:10px;padding:26px 16px 22px;border-radius:26px;background:var(--card);box-shadow:0 20px 40px -28px rgba(0,0,0,.25)}
.rg b{position:absolute;top:83px;left:50%;transform:translate(-50%,-50%);font-size:36px;font-weight:800;letter-spacing:-.03em}
.rg span{font-size:17px;font-weight:600;color:var(--ink2);text-align:center}
.rg .ratio{display:grid;place-items:center;width:150px;height:150px;border-radius:50%;background:var(--mint);color:var(--green);font-size:54px;font-weight:800;letter-spacing:-.04em}
.mk-grid{display:grid;grid-template-columns:auto 1fr;gap:56px;align-items:center;margin:auto 0}
.dots-wrap{width:700px}
.mk-side{display:flex;flex-direction:column;gap:16px}
.lg{display:grid;grid-template-columns:1fr 1fr;gap:10px 20px;font-size:18px;font-weight:700;color:var(--night-ink);margin-bottom:8px}
.kpi{border-radius:24px;padding:20px 24px;background:var(--card);box-shadow:0 20px 40px -28px rgba(0,0,0,.25)}
.kpi b{display:block;font-size:52px;font-weight:800;letter-spacing:-.045em;line-height:1;color:var(--green)}
.kpi span{display:block;margin-top:8px;font-size:18px;font-weight:600;color:var(--ink2)}
.kpi em{display:block;margin-top:6px;font-style:normal;font-size:13px;color:var(--ink3)}
.kpi.w{background:rgba(255,255,255,.06);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}.kpi.w b{color:var(--glow)}.kpi.w span{color:var(--night-ink)}.kpi.w em{color:var(--night-ink2)}
.phases{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
.phases div{border-top:4px solid var(--green);padding-top:14px}.phases b{display:block;font-size:30px;letter-spacing:-.02em}.phases span{font-size:19px;color:var(--ink2)}
.targets{display:grid;grid-template-columns:repeat(6,1fr);gap:16px;margin-top:auto}
.targets .kpi b{font-size:46px}
.hub-grid{display:grid;grid-template-columns:auto 1fr;gap:40px;align-items:center;margin:auto 0}
.hub-grid > div:first-child{width:640px}
.hub-side{display:flex;flex-direction:column;gap:18px}
.sect{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;margin:auto 0}
.sc{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;padding:30px 24px;border-radius:28px;background:var(--card);box-shadow:0 20px 40px -28px rgba(0,0,0,.25)}
.sc small{font-size:16px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--c)}
.rgw{position:relative}.rgw b{position:absolute;inset:0;display:grid;place-items:center;font-size:40px;font-weight:800;letter-spacing:-.04em;color:var(--c)}
.sc span{font-size:21px;font-weight:700}.sc em{font-style:normal;font-size:14px;color:var(--ink3)}
.ue{display:grid;grid-template-columns:1fr 1fr;gap:50px;align-items:center;margin:auto 0}
.cmpbar{display:grid;grid-template-columns:170px 1fr 170px;gap:14px;align-items:center;margin-bottom:16px}
.cmpbar span{font-size:20px;font-weight:700;color:var(--ink2)}
.cmpbar i{display:block;height:58px;border-radius:14px;background:var(--green);transform-origin:left}
.cmpbar.o i{background:var(--orange)}.cmpbar b{font-size:28px;font-weight:800;letter-spacing:-.02em}
.ue-big b{display:block;font-size:130px;font-weight:800;letter-spacing:-.06em;line-height:1;color:var(--green)}.ue-big span{font-size:22px;color:var(--ink2)}
.cap{margin:8px 0 0;font-size:17px;color:var(--ink3);text-align:center}
.imp{display:grid;grid-template-columns:1.4fr 1fr;gap:50px;align-items:center;margin:auto 0}
.imp-side{display:flex;flex-direction:column;gap:18px}
.bud-wrap{margin:auto 0 0}
.budget{display:flex;gap:6px;height:130px}
.budget div{border-radius:16px;padding:16px 18px;color:#fff;display:flex;flex-direction:column;justify-content:flex-end;min-width:0;transform-origin:left}
.budget b{font-size:28px;font-weight:800;letter-spacing:-.02em}.budget span{font-size:15px;font-weight:600;opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fund{display:flex;gap:6px;height:84px;margin-top:10px}
.fund-a{flex:8;border-radius:16px;background:var(--mint);color:var(--green);display:flex;align-items:center;gap:16px;padding:0 22px;transform-origin:left}
.fund-b{flex:2;border-radius:16px;background:var(--ink);color:#fff;display:flex;align-items:center;gap:10px;padding:0 18px;transform-origin:left}
.fund b{font-size:30px;font-weight:800}.fund span{font-size:17px;font-weight:700}
.team{display:grid;grid-template-columns:repeat(5,1fr);gap:16px;margin:30px 0 auto}
.team div{display:flex;flex-direction:column;align-items:center;gap:4px;padding:18px 10px;border-radius:22px;background:var(--card);box-shadow:0 20px 40px -28px rgba(0,0,0,.25)}
.team i{font-style:normal;font-size:40px}.team b{font-size:15px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--green)}.team span{font-size:18px;font-weight:600}
.risk-grid{display:grid;grid-template-columns:auto 1fr;gap:50px;align-items:center;margin:auto 0}
.risk-grid > div:first-child{width:600px}
.rks{display:flex;flex-direction:column;gap:14px}
.rk{display:flex;gap:18px;align-items:center;padding:16px 20px;border-radius:20px;background:var(--card);box-shadow:0 20px 40px -28px rgba(0,0,0,.25)}
.rk > span{flex:none;display:grid;place-items:center;width:46px;height:46px;border-radius:50%;background:var(--ink);color:#fff;font-weight:800;font-size:20px}
.rk b{display:block;font-size:22px}.rk em{font-style:normal;font-size:18px;color:var(--green);font-weight:700}
.ask3{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:50px}
.ask3 div{padding:28px;border-radius:28px;background:rgba(255,255,255,.06);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
.ask3 i{font-style:normal;font-size:44px}.ask3 b{display:block;margin-top:10px;font-size:38px;font-weight:800;letter-spacing:-.03em;color:#fff}.ask3 span{font-size:20px;color:var(--night-ink2)}
'''

def build():
    src = open(os.path.join(ROOT, 'pitch', 'index.html'), encoding='utf-8').read()
    lines = src.split('\n')
    first = next(i for i, l in enumerate(lines) if l.startswith('<section'))
    last = max(i for i, l in enumerate(lines) if l.startswith('</section>'))
    head, foot = '\n'.join(lines[:first]), '\n'.join(lines[last + 1:])
    head = head.replace('</style>', CSS + '\n</style>', 1)
    head = re.sub(r'<title>.*?</title>', '<title>PlateLoop · Scale-up plan</title>', head, count=1)
    a, b = foot.index('  // hardware: swap the render'), foot.index('  go(Math.max(0, (parseInt(location.hash')
    foot = (foot[:a] + foot[b:]).replace('· PlateLoop Pitch`', '· PlateLoop Scale-up`')
    out = os.path.join(ROOT, 'pitch', 'scale-up.html')
    open(out, 'w', encoding='utf-8', newline='\n').write(head + '\n' + ''.join(S) + foot)
    print('wrote', out, len(S), 'slides')

if __name__ == '__main__':
    build()
