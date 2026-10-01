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
    for i in range(8):
        a = -math.pi / 2 + i * 2 * math.pi / 8
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
IMG = lambda name, cls='', alt='': f'<img class="{cls}" src="../video/shots/{name}" alt="{alt}" loading="eager">'

def canteen_flow():
    """Where the scanners go in one school canteen: serve → scan → eat → scan → bin, data to the kitchen."""
    W, H = 1060, 420
    nodes = [(90, 'Serve', '🍱'), (300, 'Scan before', '📷'), (510, 'Eat', '🍽️'), (720, 'Scan after', '📷'), (930, 'Food bin', '♻️')]
    g = f'<path d="M90 150 H930" stroke="var(--line)" stroke-width="6" stroke-linecap="round"/><path d="M90 150 H930" stroke="var(--green)" stroke-width="6" stroke-linecap="round" data-a="draw" style="--d:.3s"/>'
    for i, (x, lab, ic) in enumerate(nodes):
        scan = 'Scan' in lab
        g += (f'<g data-a="pop" style="--d:{.2+i*.15:.2f}s"><circle cx="{x}" cy="150" r="{62 if scan else 52}" fill="{"var(--green)" if scan else "var(--card)"}" stroke="{"var(--mint)" if scan else "var(--line)"}" stroke-width="6"/>'
              f'<text x="{x}" y="166" text-anchor="middle" style="font-size:44px">{ic}</text></g>'
              f'<text x="{x}" y="252" text-anchor="middle" class="lbl">{lab}</text>')
    # both scans feed the kitchen and the student's app
    g += ('<path d="M300 215 C300 320 480 330 510 340" fill="none" stroke="var(--green)" stroke-width="3" stroke-dasharray="7 8" data-a="fade" style="--d:1s"/>'
          '<path d="M720 215 C720 320 540 330 510 340" fill="none" stroke="var(--green)" stroke-width="3" stroke-dasharray="7 8" data-a="fade" style="--d:1s"/>'
          '<g data-a="pop" style="--d:1.2s"><rect x="330" y="330" width="360" height="74" rx="20" fill="var(--ink)"/>'
          '<text x="510" y="376" text-anchor="middle" style="font:800 24px var(--font);fill:#fff">Kitchen dashboard + Loopi</text></g>')
    return svg(W, H, g)

def staircase():
    steps = [('1', 'One school canteen', 'Kitchen + Loopi'), ('2', 'The caterer’s canteens', 'one dashboard, many sites'),
             ('3', 'More schools and campuses', 'Loopi'), ('4', 'Hospitals', 'Loopi Care'), ('5', 'Offices', 'Loopi Work'), ('6', 'Everyone, everywhere', 'personal app · region')]
    return '<div class="stairs">' + ''.join(
        f'<div class="st-step" data-a style="--d:{.2+i*.12:.2f}s;--h:{190+i*56}px"><div class="st-top"><span>{n}</span><b>{t}</b><em>{a}</em></div><i></i></div>'
        for i, (n, t, a) in enumerate(steps)) + '</div>'

def reuse_table():
    cols = ['School', 'Caterer', 'Campus', 'Hospital', 'Office', 'Everyone']
    rows = [('Scanner', ['●'] * 5 + ['📱']), ('Kitchen dashboard', ['●'] * 5 + ['—']),
            ('App for the eater', ['Loopi', 'Loopi', 'Loopi', 'Loopi Care', 'Loopi Work', 'Personal app'])]
    head = '<tr><th></th>' + ''.join(f'<th>{c}</th>' for c in cols) + '</tr>'
    body = ''.join(f'<tr data-a style="--d:{.25+i*.15:.2f}s"><td class="rl">{r}</td>' + ''.join(f'<td class="{"dot" if v == "●" else ""}">{v}</td>' for v in vals) + '</tr>' for i, (r, vals) in enumerate(rows))
    return f'<table class="reuse">{head}{body}</table>'

S.append(slide('PlateLoop growth plan', f'''  <div class="title-grid">
    <div><div class="eyebrow" data-a>Growth plan</div>
      <h1 data-a style="--d:.1s;font-size:118px" class="t1">Start with<br><span>one canteen.</span></h1>
      <p class="lede" data-a style="--d:.3s;color:var(--night-ink2)">Then follow the tray: to every canteen a caterer runs, to more schools and campuses, then hospitals, offices and beyond.</p></div>
    <div class="hero-img" data-a="pop" style="--d:.2s"><img src="../apps/render_scanner_hero.png" alt="The PlateLoop scanner"></div>
  </div>''', True, 'This is how PlateLoop grows. We start with one school canteen, and then follow the tray: to every canteen a caterer runs, to more schools and campuses, then into hospitals and offices, and eventually beyond Singapore.'))

S.append(slide('What PlateLoop is', f'''  <div class="eyebrow" data-a>What PlateLoop is</div>
  <h2 data-a style="--d:.1s">An AI scanner that sees what’s eaten.</h2>
  <div class="what">
    <div class="what-img" data-a="pop" style="--d:.2s"><img src="../apps/render_scanner_hero.png" alt="The PlateLoop scanner"></div>
    <div class="what-r">
      <div class="m3" data-a style="--d:.3s"><i>🍱</i><div><b>Food type</b><span>recognises every dish</span></div></div>
      <div class="m3" data-a style="--d:.42s"><i>⚖️</i><div><b>Amount</b><span>grams served, left and eaten</span></div></div>
      <div class="m3" data-a style="--d:.54s"><i>🧪</i><div><b>Nutrients</b><span>energy, protein, carbs, fat, fibre, sodium</span></div></div>
      <div class="eqs" data-a style="--d:.7s"><span>620 g served</span><em>−</em><span>95 g left</span><em>=</em><b>525 g eaten</b></div>
    </div>
  </div>''', False, 'PlateLoop is an AI scanner for canteens. Every tray is scanned before and after the meal, and it works out three things: which foods are on the tray, how much of each was eaten, and the nutrients in it.'))

S.append(slide('How it works', f'''  <div class="eyebrow" data-a>How it works in a canteen</div>
  <h2 data-a style="--d:.1s">Two scans. Two people helped.</h2>
  <div class="flow-wrap">{canteen_flow()}</div>
  <div class="two-out">
    <div class="out-k" data-a style="--d:1.3s">{IMG('3-kitchen.jpg', 'kimg')}<div><b>The kitchen</b><span>cooks to what people really eat</span></div></div>
    <div class="out-k" data-a style="--d:1.45s">{IMG('4-loopi-lunch-phone.jpg', 'pimg')}<div><b>The person</b><span>sees their own meal and nutrients</span></div></div>
  </div>''', False, 'In a canteen, students take their food and scan the tray before eating, then again after, before scraping leftovers into the bin. Those two scans help two people: the kitchen, which plans tomorrow from what was really eaten, and the student, who sees their own meal in Loopi.'))

S.append(slide('The expansion path', f'''  <div class="eyebrow" data-a>The expansion path</div>
  <h2 data-a style="--d:.1s">Six steps. Same scanner.</h2>
  {staircase()}''', True, 'Here is the whole path in six steps. One school canteen first. Then every canteen that school\'s caterer runs. Then more schools and university campuses. Then hospitals with Loopi Care, offices with Loopi Work, and finally a personal app for everyone and other countries. The scanner stays the same at every step.'))

S.append(slide('Step 1: one school canteen', f'''  <div class="eyebrow" data-a>Step 1 · where we start</div>
  <h2 data-a style="--d:.1s">One school canteen.</h2>
  <div class="step-grid">
    <div class="step-l">
      <div class="m3" data-a style="--d:.2s"><i>📍</i><div><b>Set up</b><span>scanners where trays are collected and returned</span></div></div>
      <div class="m3" data-a style="--d:.3s"><i>🧑‍🍳</i><div><b>The canteen operator</b><span>uses the Kitchen dashboard every day</span></div></div>
      <div class="m3" data-a style="--d:.4s"><i>🧒</i><div><b>Students</b><span>feed their Loopi by scanning lunch</span></div></div>
      <div class="m3" data-a style="--d:.5s"><i>📊</i><div><b>We learn</b><span>real waste numbers, and whether it works day to day</span></div></div>
    </div>
    <div class="step-r shots2">{IMG('3-kitchen.jpg', 'kimg big', 'Kitchen dashboard')}{IMG('4-loopi-lunch-phone.jpg', 'pimg over', 'Loopi')}</div>
  </div>''', False, 'We start in one school canteen. Scanners go where trays are collected and returned. The canteen operator uses the Kitchen dashboard every day, and students feed their Loopi by scanning their lunch. This first canteen gives us real numbers and shows us how it works day to day.'))

S.append(slide('Step 2: the caterer’s canteens', f'''  <div class="eyebrow" data-a>Step 2</div>
  <h2 data-a style="--d:.1s">Then every canteen that caterer runs.</h2>
  <div class="hub-grid">
    <div>{hub()}</div>
    <div class="hub-side">
      <div class="m3" data-a style="--d:.3s"><i>🤝</i><div><b>One partner</b><span>a contract caterer already runs many school canteens</span></div></div>
      <div class="m3" data-a style="--d:.4s"><i>🖥️</i><div><b>One dashboard</b><span>all their canteens side by side</span></div></div>
      <div class="m3" data-a style="--d:.5s"><i>⚖️</i><div><b>A reason to act</b><span>caterers must now separate food waste</span><em>NEA, Resource Sustainability Act</em></div></div>
    </div>
  </div>''', False, 'Next, we go to the company behind that canteen. A contract caterer runs canteens in many schools, so one partnership brings PlateLoop to all of them, with one dashboard for every site. Caterers also now have to separate their food waste, which gives them a reason to measure it.'))

S.append(slide('Step 3: more schools and campuses', f'''  <div class="eyebrow" data-a>Step 3</div>
  <h2 data-a style="--d:.1s">More schools. Then university campuses.</h2>
  <div class="mk-grid">
    <div class="dots-wrap light">{school_dots()}</div>
    <div class="mk-side">
      {kpi('317', 'MOE primary and secondary schools, each with a canteen', 'MOE, 2024', .3)}
      {kpi('13.6%', 'of university students eat enough fruit and veg', 'Chew et al., 2017', .4)}
      <div class="m3" data-a style="--d:.5s"><i>🎓</i><div><b>Same Loopi app</b><span>for teens and uni students</span></div></div>
    </div>
  </div>''', False, 'Then we spread to more schools. There are 317 MOE primary and secondary schools, each with a canteen. University campuses come next: big dining halls, and students who mostly don\'t eat enough fruit and vegetables. They use the same Loopi app.'))

S.append(slide('Step 4: hospitals', f'''  <div class="eyebrow" data-a style="color:#1B6BD1">Step 4 · hospitals</div>
  <h2 data-a style="--d:.1s">Hospitals: Loopi Care.</h2>
  <div class="sector">
    <div class="sec-img" data-a="pop" style="--d:.2s">{IMG('5-care-phone.jpg', 'pimg', 'Loopi Care')}</div>
    <div class="sec-r">
      <div class="facts2">{kpi('29%', 'of inpatients malnourished', 'Lim et al., Clinical Nutrition 2012', .3, 'b')}{kpi('93%', 'of food charts incomplete', 'Palmer et al., 2015', .4, 'b')}</div>
      <div class="m3" data-a style="--d:.5s"><i>🛏️</i><div><b>What changes</b><span>every patient’s tray is scanned, so nobody fills in a food chart</span></div></div>
      <div class="m3" data-a style="--d:.6s"><i>🩺</i><div><b>Who it helps</b><span>nurses get an alert, with the patient’s reason, when meals go uneaten</span></div></div>
    </div>
  </div>''', False, 'In hospitals, the same scanner becomes Loopi Care. Almost three in ten inpatients in one Singapore study were malnourished, and most hand-written food charts are incomplete. Every patient\'s tray is scanned instead, and nurses get an alert with the patient\'s reason when meals go uneaten.'))

S.append(slide('Step 5: offices', f'''  <div class="eyebrow" data-a style="color:#5046C8">Step 5 · offices</div>
  <h2 data-a style="--d:.1s">Offices: Loopi Work.</h2>
  <div class="sector">
    <div class="sec-img" data-a="pop" style="--d:.2s">{IMG('7-work-phone.jpg', 'pimg', 'Loopi Work')}</div>
    <div class="sec-r">
      <div class="facts2">{kpi('6 in 10', 'Singaporeans eat out 4+ times a week', 'HPB, National Nutrition Survey', .3, 'i')}{kpi('12.7%', 'of residents are obese, and rising', 'MOH, NPHS 2024', .4, 'i')}</div>
      <div class="m3" data-a style="--d:.5s"><i>🍽️</i><div><b>What changes</b><span>workers pre-order a pick for their health goal</span></div></div>
      <div class="m3" data-a style="--d:.6s"><i>🔒</i><div><b>Who it helps</b><span>the kitchen cooks to orders; the company sees team totals, never names</span></div></div>
    </div>
  </div>''', False, 'In offices, it becomes Loopi Work. Six in ten Singaporeans eat out at least four times a week, and obesity is rising. Workers pre-order a lunch that fits their health goal, the kitchen cooks to the orders, and the company only ever sees team totals.'))

S.append(slide('Step 6: everyone, everywhere', f'''  <div class="eyebrow" data-a>Step 6</div>
  <h2 data-a style="--d:.1s">Everyone, everywhere.</h2>
  <div class="grid g2 mid">
    <div class="card big6" data-a style="--d:.2s"><i>📱</i><b>A personal app</b><span>Photograph a meal before and after, anywhere, to see what you ate and its nutrients.</span></div>
    <div class="card big6" data-a style="--d:.32s"><i>🌏</i><b>Beyond Singapore</b><span>Countries with big school-lunch programmes, like Japan and South Korea.</span></div>
  </div>''', False, 'Finally, everyone. A personal app lets anyone photograph a meal before and after eating, anywhere, to see what they ate and its nutrients. And the canteen system can go to countries with big school-lunch programmes, like Japan and South Korea.'))

S.append(slide('Same core at every step', f'''  <div class="eyebrow" data-a>Why it scales</div>
  <h2 data-a style="--d:.1s">Same core. A new app for each place.</h2>
  <div class="mid">{reuse_table()}</div>''', False, 'This is why it can grow. The scanner and the Kitchen dashboard are the same everywhere. Each new place only needs the app made for the people eating there: Loopi, Loopi Care or Loopi Work.'))

S.append(slide('It starts with one canteen', f'''  <div class="body" style="justify-content:center">
    <div class="eyebrow" data-a>First step</div>
    <h2 data-a style="--d:.1s;font-size:110px;line-height:.95;letter-spacing:-.05em">It starts with<br><span style="color:var(--glow)">one canteen.</span></h2>
    <p class="lede" data-a style="--d:.3s;color:var(--night-ink2)">PlateLoop: know what’s eaten. Waste less.</p>
  </div>''', True, 'It all starts with one canteen. PlateLoop: know what\'s eaten, waste less.'))

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
.hero-img{border-radius:30px;overflow:hidden;background:#F2F3F2;box-shadow:0 40px 80px -30px rgba(0,0,0,.8),0 0 0 2px rgba(61,220,115,.3)}
.hero-img img{display:block;width:100%;height:520px;object-fit:cover;object-position:46% 60%}
.what{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center;margin:auto 0}
.what-img{border-radius:30px;overflow:hidden;background:#F2F3F2;box-shadow:0 30px 60px -30px rgba(0,0,0,.4)}
.what-img img{display:block;width:100%;height:520px;object-fit:cover;object-position:46% 60%}
.what-r{display:flex;flex-direction:column;gap:16px}
.m3{display:flex;gap:20px;align-items:center;padding:18px 22px;border-radius:22px;background:var(--card);box-shadow:0 20px 40px -28px rgba(0,0,0,.25)}
.m3 > i{flex:none;font-style:normal;font-size:40px;width:64px;height:64px;border-radius:18px;display:grid;place-items:center;background:var(--mint)}
.m3 b{display:block;font-size:26px;letter-spacing:-.02em}.m3 span{display:block;margin-top:2px;font-size:19px;color:var(--ink2);line-height:1.35}
.m3 em{display:block;margin-top:4px;font-style:normal;font-size:13px;color:var(--ink3)}
.eqs{display:flex;align-items:center;gap:12px;margin-top:6px;font-size:22px;font-weight:700;color:var(--ink2)}
.eqs em{font-style:normal;color:var(--ink3)}.eqs b{padding:10px 18px;border-radius:14px;background:var(--green);color:#fff}
.two-out{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:-10px}
.out-k{display:flex;gap:22px;align-items:center;padding:16px 20px;border-radius:24px;background:var(--card);box-shadow:0 20px 40px -28px rgba(0,0,0,.25)}
.out-k b{display:block;font-size:26px}.out-k span{font-size:19px;color:var(--ink2)}
.kimg{width:200px;height:125px;object-fit:cover;object-position:top left;border-radius:12px;box-shadow:0 0 0 1px var(--line)}
.pimg{height:150px;width:auto;border-radius:18px}
.flow-wrap{width:1100px;margin:10px auto 0}
.two-out .pimg{height:110px}.two-out .kimg{width:170px;height:106px}
.stairs{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;align-items:end;margin-top:auto;height:560px}
.st-step{display:flex;flex-direction:column;justify-content:flex-start;height:var(--h);border-radius:22px 22px 8px 8px;background:linear-gradient(180deg,rgba(61,220,115,.22),rgba(61,220,115,.06));box-shadow:inset 0 0 0 1px rgba(61,220,115,.3);padding:18px}
.st-top span{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:var(--glow);color:#0B100D;font-weight:800;font-size:20px}
.st-top b{display:block;margin-top:12px;font-size:23px;letter-spacing:-.02em;line-height:1.15;color:#fff}
.st-top em{display:block;margin-top:6px;font-style:normal;font-size:16px;color:var(--glow);font-weight:700}
.step-grid{display:grid;grid-template-columns:1fr 1fr;gap:50px;align-items:center;margin:auto 0}
.step-l{display:flex;flex-direction:column;gap:14px}
.shots2{position:relative;height:540px}
.shots2 .big{position:absolute;left:0;top:30px;width:100%;height:auto;border-radius:18px;box-shadow:0 30px 60px -30px rgba(0,0,0,.5)}
.shots2 .over{position:absolute;right:-10px;bottom:-20px;height:420px;width:auto;filter:drop-shadow(0 30px 40px rgba(0,0,0,.45))}
.dots-wrap.light{width:690px;padding:24px;border-radius:26px;background:var(--night)}
.sector{display:grid;grid-template-columns:auto 1fr;gap:60px;align-items:center;margin:auto 0}
.sec-img .pimg{height:600px;filter:drop-shadow(0 30px 40px rgba(0,0,0,.35))}
.sec-r{display:flex;flex-direction:column;gap:16px}
.facts2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.kpi.b b{color:#1B6BD1}.kpi.i b{color:#5046C8}
.big6{display:flex;flex-direction:column;gap:12px;padding:40px}.big6 i{font-style:normal;font-size:64px}.big6 b{font-size:40px;letter-spacing:-.03em}.big6 span{font-size:22px;color:var(--ink2);line-height:1.45}
.reuse{width:100%;border-collapse:separate;border-spacing:10px}
.reuse th{font-size:20px;font-weight:800;color:var(--ink2);padding:0 0 6px}
.reuse td{height:100px;text-align:center;font-size:22px;font-weight:800;border-radius:18px;background:var(--card);box-shadow:0 20px 40px -28px rgba(0,0,0,.25)}
.reuse td.dot{color:var(--green);font-size:34px}
.reuse td.rl{text-align:left;padding:0 22px;background:var(--ink);color:#fff;font-size:22px;width:250px}
.reuse tr:last-child td:not(.rl){background:var(--mint);color:var(--green)}

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
