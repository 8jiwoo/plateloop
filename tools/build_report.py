"""
Build the PlateLoop expansion report (docs/growth-report.html) and its PDF (docs/plateloop-growth-report.pdf).

  python tools/build_report.py

A4 portrait, vector text. Every figure in it comes from the sources listed at the end; nothing is projected.
"""
import base64, os, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
G, G2, INK, INK2, INK3, LINE, ORANGE, BLUE = '#1E7A44', '#7CC79A', '#16201A', '#4B5550', '#8A928D', '#E3E6E3', '#C9741C', '#2E64B0'

# ---------------------------------------------------------------- data (with reference numbers)
WASTE = [(2021, 817, 154), (2022, 813, 146), (2023, 755, 132), (2024, 784, 138), (2025, 790, 140)]  # [1]
INDICATORS = [  # (label, value %, display, ref)
    ('Food charts filled in by staff that were incomplete (hospital)', 93, '93%', 5),
    ('Singapore residents eating out 4+ times a week', 60, '6 in 10', 7),
    ('Hospital food left on the plate, median of 32 studies', 30, '30%', 6),
    ('Inpatients malnourished on admission (Singapore hospital)', 29, '29%', 4),
    ('University students meeting fruit and vegetable guidance', 13.6, '13.6%', 8),
    ('Singapore residents with obesity, 2023–24', 12.7, '12.7%', 9),
]
STAGES = ['1. One school canteen', '2. The caterer’s canteens', '3. More schools and campuses', '4. Hospitals', '5. Offices', '6. Personal app']
PARTS = [  # component: stages where it is used (1-based)
    ('Tray scanner', {1, 2, 3, 4, 5}), ('Kitchen dashboard', {1, 2, 3, 4, 5}), ('Multi-site view', {2, 3, 4, 5}),
    ('Loopi (students)', {1, 2, 3}), ('Loopi Care (patients, nurses)', {4}), ('Loopi Work (office workers)', {5}), ('Phone camera app', {6})]

def svg(w, h, body):
    return f'<svg viewBox="0 0 {w} {h}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Inter, Arial, sans-serif">{body}</svg>'

def fig_waste():
    W, H, l, b, t = 640, 270, 44, 30, 22
    iw, ih, mx = W - l - 10, H - b - t, 900
    s = ''
    for v in (0, 300, 600, 900):
        y = t + ih - v / mx * ih
        s += f'<line x1="{l}" x2="{W-10}" y1="{y:.1f}" y2="{y:.1f}" stroke="{LINE}"/><text x="{l-8}" y="{y+4:.1f}" font-size="10" fill="{INK3}" text-anchor="end">{v}</text>'
    bw = iw / len(WASTE) * .5
    for i, (yr, tot, rec) in enumerate(WASTE):
        x = l + iw / len(WASTE) * (i + .5) - bw / 2
        hd, hr = (tot - rec) / mx * ih, rec / mx * ih
        s += (f'<rect x="{x:.1f}" y="{t+ih-hd-hr:.1f}" width="{bw:.1f}" height="{hd:.1f}" fill="#B9C0BB"/>'
              f'<rect x="{x:.1f}" y="{t+ih-hr:.1f}" width="{bw:.1f}" height="{hr:.1f}" fill="{G}"/>'
              f'<text x="{x+bw/2:.1f}" y="{t+ih-hd-hr-6:.1f}" font-size="11" font-weight="700" fill="{INK}" text-anchor="middle">{tot}</text>'
              f'<text x="{x+bw/2:.1f}" y="{t+ih-hr/2+4:.1f}" font-size="9.5" font-weight="700" fill="#fff" text-anchor="middle">{round(rec/tot*100)}%</text>'
              f'<text x="{x+bw/2:.1f}" y="{H-10}" font-size="10.5" fill="{INK2}" text-anchor="middle">{yr}</text>')
    s += f'<text x="{l}" y="12" font-size="10" fill="{INK3}">thousand tonnes</text>'
    return svg(W, H, s)

def fig_evidence():
    W, H = 640, 150
    rows = [('Food waste, baseline', 100, '#B9C0BB', '100'), ('Food waste after one year of measuring', 64, G, '64 (−36%)')]
    s = ''
    for i, (lab, v, c, txt) in enumerate(rows):
        y = 18 + i * 50
        s += (f'<text x="0" y="{y+14}" font-size="11" fill="{INK2}">{lab}</text>'
              f'<rect x="240" y="{y}" width="{v*3.2:.1f}" height="22" fill="{c}"/><text x="{246+v*3.2:.1f}" y="{y+15}" font-size="11" font-weight="700" fill="{INK}">{txt}</text>')
    s += f'<text x="0" y="{H-8}" font-size="9.5" fill="{INK3}">Index, average across 86 catering sites in six countries including Singapore [2]</text>'
    return svg(W, H, s)

def fig_indicators():
    W = 640; rh = 34; H = len(INDICATORS) * rh + 26; bx, bw = 330, 250
    s = ''.join(f'<line x1="{bx+bw*v/100:.1f}" x2="{bx+bw*v/100:.1f}" y1="0" y2="{H-22}" stroke="{LINE}"/><text x="{bx+bw*v/100:.1f}" y="{H-8}" font-size="9.5" fill="{INK3}" text-anchor="middle">{v}%</text>' for v in (0, 25, 50, 75, 100))
    for i, (lab, v, disp, ref) in enumerate(INDICATORS):
        y = 4 + i * rh
        s += (f'<text x="0" y="{y+15}" font-size="10.5" fill="{INK2}">{lab} [{ref}]</text>'
              f'<rect x="{bx}" y="{y+3}" width="{bw*v/100:.1f}" height="18" fill="{G if i % 2 == 0 else G2}"/>'
              f'<text x="{bx+bw*v/100+6:.1f}" y="{y+16}" font-size="11" font-weight="700" fill="{INK}">{disp}</text>')
    return svg(W, H, s)

def fig_matrix():
    W = 640; l = 170; cw = (W - l) / len(STAGES); rh = 20; H = 58 + len(PARTS) * rh
    s = ''
    for j, st in enumerate(STAGES):
        x = l + cw * j + cw / 2
        num, name = st.split('. ', 1)
        s += f'<text x="{x:.1f}" y="18" font-size="10" font-weight="700" fill="{INK}" text-anchor="middle">Stage {num}</text>'
        words = name.split(' '); half = (len(words) + 1) // 2
        s += f'<text x="{x:.1f}" y="32" font-size="9" fill="{INK3}" text-anchor="middle">{" ".join(words[:half])}</text><text x="{x:.1f}" y="43" font-size="9" fill="{INK3}" text-anchor="middle">{" ".join(words[half:])}</text>'
    for i, (part, used) in enumerate(PARTS):
        y = 52 + i * rh
        s += f'<text x="0" y="{y+13}" font-size="10" fill="{INK2}">{part}</text>'
        for j in range(len(STAGES)):
            on = (j + 1) in used
            s += f'<rect x="{l+cw*j+3:.1f}" y="{y+2}" width="{cw-6:.1f}" height="{rh-6}" fill="{G if on else "#F1F3F1"}"/>'
    return svg(W, H, s)

def fig_flow():
    W, H = 640, 120
    boxes = [(0, 'Serve', 'food portioned', '#F1F3F1', INK), (130, 'Scan 1', 'before eating', G, '#fff'), (260, 'Eat', '', '#F1F3F1', INK), (390, 'Scan 2', 'after eating', G, '#fff'), (520, 'Records', 'kitchen + person', INK, '#fff')]
    s = ''
    for i, (x, t1, t2, fill, col) in enumerate(boxes):
        s += f'<rect x="{x}" y="20" width="118" height="56" fill="{fill}"/><text x="{x+59}" y="{46 if t2 else 53}" font-size="13" font-weight="700" fill="{col}" text-anchor="middle">{t1}</text>'
        if t2: s += f'<text x="{x+59}" y="63" font-size="10" fill="{col}" text-anchor="middle" opacity=".85">{t2}</text>'
        if i < 4: s += f'<path d="M{x+120} 48 h8" stroke="{INK3}" stroke-width="2"/><path d="M{x+128} 44 l4 4 -4 4" fill="none" stroke="{INK3}" stroke-width="2"/>'
    s += f'<text x="0" y="104" font-size="10" fill="{INK3}">Scan 1 − Scan 2 = what was eaten, per dish (e.g. 620 g served − 95 g left = 525 g eaten)</text>'
    return svg(W, H, s)

REFS = [
    'National Environment Agency (NEA). Food waste management: food waste statistics 2021–2025. nea.gov.sg',
    'Champions 12.3 (WRAP and WRI). The Business Case for Reducing Food Loss and Waste: Catering. June 2018.',
    'Pfisterer K.J. et al. Automated Food Imaging and Nutrient Intake Tracking (AFINI-T) in long-term care. JMIR Aging, 2022. Lu Y. et al. An AI-based system to assess nutrient intake for hospitalised patients, 2020.',
    'Lim S.L. et al. Malnutrition and its impact on cost of hospitalization, length of stay, readmission and 3-year mortality. Clinical Nutrition, 2012.',
    'Palmer M., Miller K., Noble S. Accuracy of food intake charts completed by nursing staff, 2015.',
    'Williams P., Walton K. Plate waste in hospitals and strategies for change. e-SPEN, 2011.',
    'Health Promotion Board. National Nutrition Survey 2010, as cited in HPB’s Healthier Dining Programme release.',
    'Chew W.C. et al. Are university students in Singapore meeting fruit and vegetable recommendations? Asia Pacific Journal of Public Health, 2017.',
    'Ministry of Health. National Population Health Survey 2024.',
    'Ministry of Education. School counts, 2024 (177 primary; about 140 secondary).',
    'NEA. Resource Sustainability Act: food waste segregation for large commercial and industrial premises (new premises from 2024; existing premises from 2025).',
]

def html():
    stage_rows = [
        ('1', 'One school canteen', 'Canteen operator; students', 'Kitchen dashboard; Loopi', 'Measure real waste and test daily use at one site'),
        ('2', 'The caterer’s other canteens', 'Contract caterer', 'Kitchen dashboard (multi-site)', 'One agreement covers many canteens; caterers must now separate food waste [11]'),
        ('3', 'More schools; university campuses', 'Students; campus food services', 'Loopi', '317 MOE primary and secondary schools [10]; 13.6% of university students meet fruit and vegetable guidance [8]'),
        ('4', 'Hospitals', 'Patients; nurses; dietitians', 'Loopi Care', '29% of inpatients malnourished [4]; 93% of food charts incomplete [5]; 30% median plate waste [6]'),
        ('5', 'Offices', 'Office workers; canteen operator', 'Loopi Work', '6 in 10 residents eat out 4+ times a week [7]; obesity 12.7% [9]'),
        ('6', 'Everyone', 'Individuals', 'Phone camera app', 'Before and after photos of any meal, outside canteens'),
    ]
    trows = ''.join(f'<tr><td class="n">{a}</td><td><b>{b}</b></td><td>{c}</td><td>{d}</td><td>{e}</td></tr>' for a, b, c, d, e in stage_rows)
    risks = [('Mixed dishes are harder to recognise', 'Known daily menu, compartment trays, weighing platform check.'),
             ('Trays not scanned after eating', 'Scanner at the tray return; dashboard flags trays still out.'),
             ('Queues slow down', 'About 2 s per scan; second scanner for large canteens.'),
             ('Privacy concerns', 'No photos leave the scanner; consent first; face sign-in optional.'),
             ('Results differ from published studies', 'Stage 1 measures before and after at one site first.')]
    rrows = ''.join(f'<tr><td><b>{a}</b></td><td>{b}</td></tr>' for a, b in risks)
    refs = ''.join(f'<li>{r}</li>' for r in REFS)
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>PlateLoop expansion plan</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
<style>
@page{{size:A4;margin:18mm 17mm 18mm}}
*{{box-sizing:border-box}}
body{{margin:0;font-family:Inter,Arial,sans-serif;color:{INK};font-size:10.5pt;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
@media screen{{body{{background:#E8EAE8;padding:30px 0}}.page{{width:210mm;margin:0 auto 20px;background:#fff;padding:18mm 17mm;box-shadow:0 2px 12px rgba(0,0,0,.12)}}}}
@media print{{.page{{page-break-after:always}}.page:last-child{{page-break-after:auto}}}}
.head{{display:flex;justify-content:space-between;border-bottom:2px solid {INK};padding-bottom:8px;margin-bottom:22px;font-size:8.5pt;color:{INK3};letter-spacing:.04em;text-transform:uppercase}}
.head b{{color:{G}}}
h1{{font-size:26pt;line-height:1.1;letter-spacing:-.02em;margin:0 0 8px}}
.sub{{font-size:12pt;color:{INK2};margin:0 0 18px}}
h2{{font-size:13pt;margin:22px 0 8px;padding-top:4px;border-top:1px solid {LINE}}}
h2 span{{color:{G};margin-right:8px}}
p{{margin:0 0 8px}}
.kf{{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid {LINE};margin:14px 0 18px}}
.kf div{{padding:12px 14px;border-right:1px solid {LINE}}}.kf div:last-child{{border-right:0}}
.kf b{{display:block;font-size:20pt;letter-spacing:-.02em;color:{G};line-height:1.1}}
.kf span{{display:block;font-size:8.5pt;color:{INK2};line-height:1.35;margin-top:4px}}
.fig{{margin:10px 0 6px}}
.cap{{font-size:8.5pt;color:{INK3};margin:4px 0 14px}}
.cap b{{color:{INK2}}}
table{{width:100%;border-collapse:collapse;font-size:8.7pt;margin:6px 0 10px}}
th{{text-align:left;font-size:8pt;text-transform:uppercase;letter-spacing:.04em;color:{INK3};border-bottom:1.5px solid {INK};padding:6px 6px}}
td{{border-bottom:1px solid {LINE};padding:5px 6px;vertical-align:top;color:{INK2}}}
td b{{color:{INK}}}
td.n{{font-weight:800;color:{G};width:18px}}
.legend{{font-size:8.5pt;color:{INK2};display:flex;gap:16px;margin-top:2px}}
.legend i{{display:inline-block;width:10px;height:10px;margin-right:5px;vertical-align:-1px}}
ol.refs{{font-size:8.5pt;color:{INK2};padding-left:18px;margin:6px 0 0}}
ol.refs li{{margin-bottom:4px}}
.two{{display:grid;grid-template-columns:1fr 1fr;gap:18px}}
.note{{font-size:8.5pt;color:{INK3}}}
</style></head><body>

<section class="page">
  <div class="head"><span><b>PlateLoop</b> · Expansion plan</span><span>October 2026</span></div>
  <h1>PlateLoop: expansion plan</h1>
  <p class="sub">How a canteen tray scanner grows from one school to hospitals, offices and individual users.</p>
  <p>PlateLoop is a tray scanner for canteens. It records each tray before and after a meal, identifies the dishes and works out how much of each was eaten and the nutrients it contained. Kitchens use the records to plan how much food to prepare; the people eating receive their own intake and nutrition feedback through an app designed for their setting.</p>
  <p>This report sets out the order in which PlateLoop would expand, the setting and users at each stage, and the published evidence for each. It contains no financial projections.</p>
  <div class="kf">
    <div><b>790,000 t</b><span>food waste generated in Singapore, 2025 [1]</span></div>
    <div><b>18%</b><span>of food waste recycled, 2025 [1]</span></div>
    <div><b>−36%</b><span>food waste after catering sites began measuring it, year one [2]</span></div>
    <div><b>317</b><span>MOE primary and secondary schools [10]</span></div>
  </div>

  <h2><span>1</span>What PlateLoop does</h2>
  <div class="fig">{fig_flow()}</div>
  <div class="cap"><b>Figure 1.</b> Each tray is scanned twice. The difference between the scans is what was eaten.</div>
  <table>
    <tr><th style="width:24%">Each scan records</th><th style="width:38%">How</th><th>Used by</th></tr>
    <tr><td><b>Food type</b></td><td>Overhead colour and depth camera, matched against the day’s menu</td><td>Kitchen: which dishes are eaten or left</td></tr>
    <tr><td><b>Amount</b></td><td>Food volume from the depth camera, checked by a weighing platform</td><td>Kitchen: how much to prepare and order</td></tr>
    <tr><td><b>Nutrients</b></td><td>Grams of each dish matched to the kitchen’s recipes</td><td>Person: energy, protein, carbohydrate, fat, fibre, sodium</td></tr>
  </table>
</section>

<section class="page">
  <div class="head"><span><b>PlateLoop</b> · Expansion plan</span><span>2</span></div>
  <h2 style="margin-top:0;border-top:0"><span>2</span>The problem</h2>
  <p>Singapore generated 790,000 tonnes of food waste in 2025, more than in 2023, and the share recycled has stayed at 18–19% since 2021 [1]. Canteens plan food by headcount and experience because they have no record of what each diner eats.</p>
  <div class="fig">{fig_waste()}</div>
  <div class="legend"><span><i style="background:#B9C0BB"></i>Disposed</span><span><i style="background:{G}"></i>Recycled (share shown in bar)</span></div>
  <div class="cap"><b>Figure 2.</b> Food waste generated in Singapore, 2021–2025, thousand tonnes. Source: NEA [1].</div>

  <h2><span>3</span>Evidence for the approach</h2>
  <p>Measuring food waste reduces it. Across 86 catering sites in six countries, including Singapore, sites that measured their food waste reduced it by 36% by weight within a year; 64% recovered their investment in the first year and 79% spent less than US$10,000 [2].</p>
  <div class="fig">{fig_evidence()}</div>
  <div class="cap"><b>Figure 3.</b> Food waste before and after one year of measurement, indexed to 100. Source: Champions 12.3 [2].</div>
  <p>Recognising food from tray images is also established. A system using overhead depth images of plated meals identified foods with 88.9% accuracy, and nutrient estimates from food volume closely matched estimates from weight (r² 0.92–0.99) [3].</p>
</section>

<section class="page">
  <div class="head"><span><b>PlateLoop</b> · Expansion plan</span><span>3</span></div>
  <h2 style="margin-top:0;border-top:0"><span>4</span>Expansion plan</h2>
  <p>PlateLoop expands in six stages. Each stage keeps the same scanner and kitchen dashboard and adds the app for the people eating in that setting.</p>
  <table>
    <tr><th></th><th style="width:20%">Setting</th><th style="width:20%">Users</th><th style="width:18%">App</th><th>Reason for this stage</th></tr>
    {trows}
  </table>
  <div class="fig" style="margin-top:14px">{fig_matrix()}</div>
  <div class="cap"><b>Figure 4.</b> Components used at each stage. The scanner and kitchen dashboard are shared by stages 1–5; each sector adds one app.</div>

  <h2><span>5</span>Risks</h2>
  <table><tr><th style="width:34%">Risk</th><th>Response</th></tr>{rrows}</table>
</section>

<section class="page">
  <div class="head"><span><b>PlateLoop</b> · Expansion plan</span><span>4</span></div>
  <h2 style="margin-top:0;border-top:0"><span>6</span>Indicators for each setting</h2>
  <p>The figures below are the published indicators behind stages 3–5. Each describes a problem that per-tray records address: unmeasured intake in hospitals, high plate waste, and diets that diners cannot see.</p>
  <div class="fig">{fig_indicators()}</div>
  <div class="cap"><b>Figure 5.</b> Selected indicators by setting. Reference numbers in brackets.</div>

  <h2><span>7</span>References</h2>
  <ol class="refs">{refs}</ol>
</section>
</body></html>'''

def main():
    out_html = os.path.join(ROOT, 'docs', 'growth-report.html')
    open(out_html, 'w', encoding='utf-8', newline='\n').write(html())
    sys.path.insert(0, os.path.join(ROOT, 'tools'))
    from capture import serve, PORT
    from selenium import webdriver
    h = serve(); o = webdriver.ChromeOptions(); o.add_argument('--headless=new')
    d = webdriver.Chrome(options=o)
    try:
        d.get(f'http://127.0.0.1:{PORT}/docs/growth-report.html'); time.sleep(3)
        pdf = d.execute_cdp_cmd('Page.printToPDF', {'printBackground': True, 'preferCSSPageSize': True})
        out = os.path.join(ROOT, 'docs', 'plateloop-growth-report.pdf')
        open(out, 'wb').write(base64.b64decode(pdf['data']))
        print('wrote', out_html, 'and', out)
    finally:
        d.quit(); h.shutdown()

if __name__ == '__main__':
    main()
