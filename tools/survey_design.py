"""
The designed outputs of the survey kit: a dashboard-style Excel workbook and a one-page findings infographic.
Used by tools/build_survey.py (which owns the questions and the demo data).
"""
from decimal import Decimal, ROUND_HALF_UP
from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.chart.layout import Layout, ManualLayout
from openpyxl.chart.shapes import GraphicalProperties
from openpyxl.comments import Comment
from openpyxl.formatting.rule import DataBarRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

MAXROW = 1000
FONT = 'Arial'
INK, INK2, INK3, LINE, BG = '1B2420', '4E5A54', '8A938E', 'E2E6E3', 'F6F7F6'
THEME = {  # group: (main colour, light tint, short name, PlateLoop app)
    'Students': ('1E7A44', 'E6F4EC', 'Students', 'Loopi'),
    'Kitchen': ('C2671A', 'FBEEDF', 'Kitchen staff', 'Kitchen dashboard'),
    'Hospital': ('2A5FB0', 'E4ECF8', 'Hospital staff', 'Loopi Care'),
    'Office': ('5145C4', 'ECEAFA', 'Office workers', 'Loopi Work'),
}

SHORT = {'S3': 'Main reason for leaving food', 'K2': 'How quantities are decided', 'H5': 'When a poor eater is noticed', 'O8': 'Share meal data with employer?'}
FEATURE = {'Students': 'S3', 'Kitchen': 'K2', 'Hospital': 'H5', 'Office': 'O8'}  # the question charted for each group

def F(size=10, bold=False, color=INK, italic=False):
    return Font(name=FONT, size=size, bold=bold, color=color, italic=italic)
fill = lambda c: PatternFill('solid', fgColor=c)
CENTER = Alignment(horizontal='center', vertical='center', wrap_text=True)
LEFT = Alignment(horizontal='left', vertical='center', wrap_text=True)
TOP = Alignment(horizontal='left', vertical='top', wrap_text=True)
bottom_line = Border(bottom=Side(style='thin', color=LINE))

def P(v):
    return f'{int(Decimal(str(v * 100)).quantize(Decimal(0), rounding=ROUND_HALF_UP))}%'

def sheet_ref(G, code):
    cols = ['ID'] + [q[0] for q in G['qs']]
    c = get_column_letter(cols.index(code) + 1)
    return f"'{G['sheet']}'!${c}$2:${c}${MAXROW}"

def setup(ws, widths):
    ws.sheet_view.showGridLines = False
    ws.sheet_view.zoomScale = 100
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w

def merge_write(ws, rng, value, font, align=CENTER, fill_c=None):
    ws.merge_cells(rng)
    c = ws[rng.split(':')[0]]
    c.value = value; c.font = font; c.alignment = align
    if fill_c:
        for row in ws[rng]:
            for x in row: x.fill = fill(fill_c)
    return c

def tile(ws, top, col, width, number, label, colour, tint, fmt=None, big=26):
    """A KPI tile: big number on a tinted block, label underneath."""
    a, b = get_column_letter(col), get_column_letter(col + width - 1)
    c = merge_write(ws, f'{a}{top}:{b}{top}', number, F(big, True, colour), CENTER, tint)
    if fmt: c.number_format = fmt
    merge_write(ws, f'{a}{top+1}:{b}{top+1}', label, F(9, False, INK2), CENTER, tint)

def bar_chart(ws, cats, vals, title, colour, pct=True, width=15, height=7.5, top=0.17):
    ch = BarChart(); ch.type = 'bar'; ch.style = 10; ch.title = title; ch.legend = None
    ch.add_data(vals, titles_from_data=False); ch.set_categories(cats)
    ch.varyColors = False
    s = ch.series[0]; s.graphicalProperties = GraphicalProperties(solidFill=colour); s.graphicalProperties.line.solidFill = colour
    ch.dataLabels = DataLabelList(); ch.dataLabels.showVal = True
    for k in ('showSerName', 'showCatName', 'showLegendKey', 'showPercent'): setattr(ch.dataLabels, k, False)
    ch.x_axis.delete = False; ch.y_axis.delete = True
    ch.x_axis.scaling.orientation = 'maxMin'; ch.y_axis.majorGridlines = None
    if pct: ch.y_axis.numFmt = '0%'; ch.y_axis.scaling.min = 0; ch.y_axis.scaling.max = 1.15  # headroom so a 100% label is not clipped
    ch.gapWidth = 55; ch.width = width; ch.height = height
    ch.plot_area.layout = Layout(manualLayout=ManualLayout(x=0.01, y=top, w=0.95, h=0.97 - top, xMode='edge', yMode='edge'))
    return ch

# ================================================================ group sheets
def group_sheet(wb, G, A):
    colour, tint, name, app = THEME[G['key']]
    ws = wb.create_sheet(G['key'])
    setup(ws, [2] + [11] * 14)
    ws.sheet_properties.tabColor = colour
    merge_write(ws, 'B1:O1', name, F(22, True, colour), LEFT)
    n_cell = 'B2'
    ws['B2'] = f"=COUNTA('{G['sheet']}'!$A$2:$A${MAXROW})&\" responses · DEMO DATA · PlateLoop answer: {app}\""
    ws['B2'].font = F(10, False, INK3); ws.row_dimensions[1].height = 34
    A[(G['key'], 'n')] = f"COUNTA('{G['sheet']}'!$A$2:$A${MAXROW})"
    tiles_row = 4; ws.row_dimensions[tiles_row].height = 44; ws.row_dimensions[tiles_row + 1].height = 30
    r = 8
    first_cat = None; lik = []
    for code, text, typ, opts, _ in G['qs']:
        R = sheet_ref(G, code)
        if typ == 'cat':
            merge_write(ws, f'B{r}:H{r}', f'{code}  ·  {text}', F(11, True), LEFT)
            ws.row_dimensions[r].height = 22 if len(text) < 62 else 32
            for j, h in enumerate(['Answer', '', '', 'People', 'Share', '', ''], 2):
                c = ws.cell(r + 1, j, h); c.font = F(9, True, 'FFFFFF'); c.fill = fill(colour); c.alignment = LEFT if j == 2 else CENTER
            ws.merge_cells(f'B{r+1}:D{r+1}'); ws.merge_cells(f'G{r+1}:H{r+1}')
            top = r + 2
            for k, o in enumerate(opts):
                rr = top + k
                merge_write(ws, f'B{rr}:D{rr}', o, F(10), LEFT)
                ws.cell(rr, 5, f'=COUNTIF({R},B{rr})').font = F(10); ws.cell(rr, 5).alignment = CENTER
                c = ws.cell(rr, 6, f'=IFERROR(E{rr}/SUM($E${top}:$E${top+len(opts)-1}),0)'); c.font = F(10, True, colour); c.alignment = CENTER; c.number_format = '0%'
                merge_write(ws, f'G{rr}:H{rr}', f'=F{rr}', F(10), LEFT).number_format = '0%'
                for j in range(2, 9): ws.cell(rr, j).border = bottom_line
                if k % 2:
                    for j in range(2, 9): ws.cell(rr, j).fill = fill(BG)
                A[(code, o)] = f"'{G['key']}'!$F${rr}"
                A[(code, o, 'n')] = f"'{G['key']}'!$E${rr}"
            ws.conditional_formatting.add(f'G{top}:G{top+len(opts)-1}', DataBarRule(start_type='num', start_value=0, end_type='num', end_value=1, color=colour, showValue=False))
            A[(code, 'range')] = (f"'{G['key']}'!$B${top}:$B${top+len(opts)-1}", f"'{G['key']}'!$F${top}:$F${top+len(opts)-1}")
            if code == FEATURE[G['key']]: first_cat = (code, text, top, len(opts))
            r = top + len(opts) + 2
        elif typ == 'num':
            merge_write(ws, f'B{r}:H{r}', f'{code}  ·  {text}', F(11, True), LEFT); ws.row_dimensions[r].height = 22 if len(text) < 62 else 32
            for k, (lab, f) in enumerate([('Average', f'=IFERROR(AVERAGE({R}),0)'), ('Median', f'=IFERROR(MEDIAN({R}),0)'), ('Lowest', f'=IFERROR(MIN({R}),0)'), ('Highest', f'=IFERROR(MAX({R}),0)')]):
                col = 2 + k * 2
                c = merge_write(ws, f'{get_column_letter(col)}{r+1}:{get_column_letter(col+1)}{r+1}', f, F(16, True, colour), CENTER, tint); c.number_format = '0.0'
                merge_write(ws, f'{get_column_letter(col)}{r+2}:{get_column_letter(col+1)}{r+2}', lab, F(9, False, INK2), CENTER, tint)
                A[(code, lab if lab != 'Lowest' else 'Minimum')] = f"'{G['key']}'!${get_column_letter(col)}${r+1}"
            A[(code, 'Average')] = f"'{G['key']}'!$B${r+1}"
            ws.row_dimensions[r + 1].height = 30
            r += 4
        elif typ == 'lik':
            lik.append((code, text, R))
    # scale questions
    if lik:
        merge_write(ws, f'B{r}:H{r}', 'Scale questions  ·  1 = disagree / not useful, 5 = agree / very useful', F(11, True), LEFT); ws.row_dimensions[r].height = 22
        for j, h in [(2, 'Statement'), (6, 'Average'), (7, 'Agree (4–5)'), (8, '')]:
            c = ws.cell(r + 1, j, h); c.font = F(9, True, 'FFFFFF'); c.fill = fill(colour); c.alignment = LEFT if j == 2 else CENTER
        for j in (3, 4, 5): ws.cell(r + 1, j).fill = fill(colour)
        ws.merge_cells(f'B{r+1}:E{r+1}')
        top = r + 2
        for k, (code, text, R) in enumerate(lik):
            rr = top + k
            merge_write(ws, f'B{rr}:E{rr}', f'{code}  {text}', F(9.5), LEFT); ws.row_dimensions[rr].height = 30
            c = ws.cell(rr, 6, f'=IFERROR(AVERAGE({R}),0)'); c.font = F(10, True); c.number_format = '0.0'; c.alignment = CENTER
            c = ws.cell(rr, 7, f'=IFERROR(COUNTIF({R},">=4")/COUNT({R}),0)'); c.font = F(10, True, colour); c.alignment = CENTER; c.number_format = '0%'
            c = ws.cell(rr, 8, f'=G{rr}'); c.number_format = '0%'
            for j in range(2, 9): ws.cell(rr, j).border = bottom_line
            A[(code, 'avg')] = f"'{G['key']}'!$F${rr}"; A[(code, 'agree')] = f"'{G['key']}'!$G${rr}"
        ws.conditional_formatting.add(f'H{top}:H{top+len(lik)-1}', DataBarRule(start_type='num', start_value=0, end_type='num', end_value=1, color=colour, showValue=False))
        ch = bar_chart(ws, Reference(ws, min_col=2, min_row=top, max_row=top + len(lik) - 1), Reference(ws, min_col=7, min_row=top, max_row=top + len(lik) - 1), None, colour, height=max(6, 1.25 * len(lik) + 2))
        ch.plot_area.layout = None
        ws.add_chart(ch, 'J24')
        r = top + len(lik) + 1
    if first_cat:
        code, text, top, n = first_cat
        ch = bar_chart(ws, Reference(ws, min_col=2, min_row=top, max_row=top + n - 1), Reference(ws, min_col=6, min_row=top, max_row=top + n - 1), SHORT[code], colour, height=7.5)
        ws.add_chart(ch, 'J8')
    ws.freeze_panes = 'A7'
    return ws, tiles_row

# headline numbers per group: (label, formula builder, format)
def kpis(G, A):
    k = G['key']
    if k == 'Students':
        lb, sh = A[('S3', 'range')]
        return [(f'=INDEX({lb},MATCH(MAX({sh}),{sh},0))', 'top reason for leaving food', None, 13),
                (f'=MAX({sh})', 'chose that reason', '0%', 26),
                (f"={A[('S7','Food groups')]}", 'prefer food groups to calories', '0%', 26),
                (f"={A[('S8','avg')]}", 'interest in the Loopi pet (out of 5)', '0.0', 26)]
    if k == 'Kitchen':
        return [(f"={A[('K2','Past experience')]}+{A[('K2','Headcount × standard portion')]}", 'plan by experience or headcount', '0%', 26),
                (f"={A[('K4','Yes, accurately')]}", 'know which dishes come back', '0%', 26),
                (f"={A[('K3','Average')]}/100", 'of cooked food thrown away (estimate)', '0%', 26),
                (f"={A[('K7','agree')]}", 'want waste shown by dish', '0%', 26)]
    if k == 'Hospital':
        return [(f"={A[('H3','agree')]}", 'trust their intake records', '0%', 26),
                (f"={A[('H4','Average')]}", 'minutes a shift on intake records', '0', 26),
                (f"={A[('H5','Same day')]}", 'poor eaters noticed the same day', '0%', 26),
                (f"={A[('H7','agree')]}", 'want automatic intake records', '0%', 26)]
    return [(f"={A[('O4','agree')]}", 'know the nutrients in their lunch', '0%', 26),
            (f"={A[('O5','Often')]}+{A[('O5','Daily')]}", 'afternoon energy dip often or daily', '0%', 26),
            (f"={A[('O6','Yes')]}", 'would pre-order to skip the queue', '0%', 26),
            (f"={A[('O8','Only anonymous totals')]}+{A[('O8','No')]}", 'want meal data private or anonymous', '0%', 26)]

MEANS = {
    'Students': 'rewards the right portion, shows food groups instead of calories, and the pet gives students a reason to scan.',
    'Kitchen': 'shows waste by dish and suggests tomorrow’s order from what was eaten, with no forms to fill in.',
    'Hospital': 'records every tray automatically and alerts nurses the same day a patient eats poorly.',
    'Office': 'shows the nutrients in each lunch, offers pre-ordering, and keeps meal data private by default.',
}

# ================================================================ workbook
def build(groups, data, findings_fn, path, seed):
    wb = Workbook(); A = {}
    dash = wb.active; dash.title = 'Dashboard'
    # data sheets first (formulas refer to them), moved to the back at the end
    for G in groups:
        d = wb.create_sheet(G['sheet']); df = data[G['key']]; colour = THEME[G['key']][0]
        d.sheet_properties.tabColor = 'B9C0BB'
        for j, h in enumerate(df.columns, 1):
            c = d.cell(1, j, h); c.font = F(10, True, 'FFFFFF'); c.alignment = CENTER
            q = next((x[1] for x in G['qs'] if x[0] == h), 'Respondent ID'); c.comment = Comment(q, 'PlateLoop')
        for i, row in enumerate(df.itertuples(index=False), 2):
            for j, v in enumerate(row, 1):
                c = d.cell(i, j, v); c.font = F(10, False, '0000FF'); c.alignment = LEFT
        last = get_column_letter(len(df.columns))
        t = Table(displayName=f"{G['key']}Responses", ref=f'A1:{last}{len(df)+1}')
        t.tableStyleInfo = TableStyleInfo(name='TableStyleMedium4' if G['key'] != 'Kitchen' else 'TableStyleMedium3', showRowStripes=True)
        d.add_table(t)
        for j in range(1, len(df.columns) + 1): d.column_dimensions[get_column_letter(j)].width = 9 if j == 1 else 22
        d.freeze_panes = 'B2'; d.sheet_view.showGridLines = False
    # group sheets
    tiles_rows = {}
    for G in groups:
        ws, tr = group_sheet(wb, G, A); tiles_rows[G['key']] = (ws, tr)
    for G in groups:
        ws, tr = tiles_rows[G['key']]; colour, tint, *_ = THEME[G['key']]
        for i, (f, lab, fmt, size) in enumerate(kpis(G, A)):
            tile(ws, tr, 2 + i * 3, 3, f, lab, colour, tint, fmt, size)
    # ---- dashboard
    setup(dash, [2] + [10.5] * 16)
    merge_write(dash, 'B1:Q1', 'PlateLoop survey · results at a glance', F(24, True), LEFT); dash.row_dimensions[1].height = 40
    merge_write(dash, 'B2:Q2', 'DEMO DATA: synthetic responses for demonstration only. Not real survey results.', F(10, True, 'B42318'), LEFT, 'FDECEA')
    dash.row_dimensions[2].height = 22
    # response counts
    dash.row_dimensions[4].height = 40; dash.row_dimensions[5].height = 22
    merge_write(dash, 'B4:D4', f"={'+'.join(A[(G['key'],'n')] for G in groups)}", F(26, True, 'FFFFFF'), CENTER, INK)
    merge_write(dash, 'B5:D5', 'responses in total', F(9, False, 'FFFFFF'), CENTER, INK)
    for i, G in enumerate(groups):
        colour, tint, name, _ = THEME[G['key']]
        a, b = get_column_letter(5 + i * 3), get_column_letter(7 + i * 3)
        merge_write(dash, f'{a}4:{b}4', f"={A[(G['key'],'n')]}", F(26, True, 'FFFFFF'), CENTER, colour)
        merge_write(dash, f'{a}5:{b}5', name, F(9, True, 'FFFFFF'), CENTER, colour)
    r = 8
    for G in groups:
        colour, tint, name, app = THEME[G['key']]
        merge_write(dash, f'B{r}:Q{r}', f'  {name}', F(14, True, 'FFFFFF'), LEFT, colour); dash.row_dimensions[r].height = 28
        for i, (f, lab, fmt, size) in enumerate(kpis(G, A)):
            tile(dash, r + 2, 2 + i * 3, 3, f, lab, colour, tint, fmt, size)
        dash.row_dimensions[r + 2].height = 44; dash.row_dimensions[r + 3].height = 30
        merge_write(dash, f'B{r+5}:M{r+5}', f'→ {app}: {MEANS[G["key"]]}', F(10, True, colour), LEFT)
        dash.row_dimensions[r + 5].height = 30
        r += 8
    # one chart per group on the right of the dashboard
    for i, G in enumerate(groups):
        code = FEATURE[G['key']]
        lb, sh = A.get((code, 'range'))
        sheet = G['key']; colour = THEME[sheet][0]
        ws = wb[sheet]
        top = int(lb.split('$B$')[1].split(':')[0]); bot = int(lb.split('$B$')[2])
        text = next(q[1] for q in G['qs'] if q[0] == code)
        ch = bar_chart(ws, Reference(ws, min_col=2, min_row=top, max_row=bot), Reference(ws, min_col=6, min_row=top, max_row=bot), None, colour, width=9.6, height=4.5)
        ch.plot_area.layout = None
        c = dash.cell(9 + i * 8, 14, SHORT[code]); c.font = F(10, True, colour)
        dash.add_chart(ch, f'N{10 + i*8}')
    dash.freeze_panes = 'A7'
    # ---- key findings
    findings = findings_fn(A)
    k = wb.create_sheet('Key findings', 1)
    setup(k, [2, 16, 78, 52])
    merge_write(k, 'B1:D1', 'Key findings', F(22, True), LEFT); k.row_dimensions[1].height = 36
    merge_write(k, 'B2:D2', 'DEMO DATA: calculated live from the responses; not real survey results.', F(10, True, 'B42318'), LEFT, 'FDECEA')
    for j, h in enumerate(['Group', 'What the survey shows', 'What PlateLoop does about it'], 2):
        c = k.cell(4, j, h); c.font = F(10, True, 'FFFFFF'); c.fill = fill(INK); c.alignment = LEFT
    k.row_dimensions[4].height = 24
    for i, (grp, f, mean) in enumerate(findings, 5):
        colour, tint, name, _ = THEME[grp]
        c = k.cell(i, 2, name); c.font = F(10, True, 'FFFFFF'); c.fill = fill(colour); c.alignment = CENTER
        c = k.cell(i, 3, f.replace('="{}"&', '=')); c.font = F(10.5); c.alignment = LEFT; c.fill = fill(tint)
        c = k.cell(i, 4, mean); c.font = F(10, True, colour); c.alignment = LEFT; c.fill = fill(tint)
        for j in (2, 3, 4): k.cell(i, j).border = Border(bottom=Side(style='medium', color='FFFFFF'))
        k.row_dimensions[i].height = 44
    k.freeze_panes = 'A5'
    # ---- questionnaire + about
    q = wb.create_sheet('Questionnaires')
    setup(q, [2, 18, 8, 64, 14, 58])
    merge_write(q, 'B1:F1', 'Questionnaires', F(20, True), LEFT); q.row_dimensions[1].height = 32
    for j, h in enumerate(['Group', 'Code', 'Question', 'Type', 'Answers'], 2):
        c = q.cell(3, j, h); c.font = F(10, True, 'FFFFFF'); c.fill = fill(INK)
    r = 4
    for G in groups:
        colour, tint, name, _ = THEME[G['key']]
        for code, text, typ, opts, _ in G['qs']:
            o = '; '.join(opts) if typ == 'cat' else (f'1 = {opts[0]} … 5 = {opts[1]}' if typ == 'lik' else 'Number' if typ == 'num' else 'Free text')
            vals = [name, code, text, {'cat': 'Single choice', 'lik': 'Scale 1–5', 'num': 'Number', 'text': 'Open'}[typ], o]
            for j, v in enumerate(vals, 2):
                c = q.cell(r, j, v); c.font = F(10, j == 2, colour if j == 2 else INK); c.alignment = TOP; c.border = bottom_line
            r += 1
    q.freeze_panes = 'A4'
    ab = wb.create_sheet('About')
    setup(ab, [2, 26, 100])
    merge_write(ab, 'B1:C1', 'About this workbook', F(20, True), LEFT); ab.row_dimensions[1].height = 32
    rows = [('Demo data', f'Every response is synthetic, generated with a fixed seed ({seed}) to show how the analysis works. Not real survey results.'),
            ('Dashboard', 'Headline numbers and one chart per group.'), ('Key findings', 'Findings written as live formulas, each matched to a PlateLoop feature.'),
            ('Group sheets', 'Students, Kitchen, Hospital, Office: every question as a table with in-cell bars, plus charts.'),
            ('Data sheets', 'One row per respondent (blue text = input). To use real data, paste responses into these tables (same columns, up to row 1000) — every other sheet updates.'),
            ('Questionnaires', 'All questions, codes and answer options. Online version: https://8jiwoo.github.io/plateloop/survey/'),
            ('Scale questions', '1 = strongly disagree / not useful … 5 = strongly agree / very useful. "Agree" = share answering 4 or 5.')]
    for i, (a, b) in enumerate(rows, 3):
        c = ab.cell(i, 2, a); c.font = F(10, True, 'B42318' if i == 3 else INK); c.alignment = TOP
        c = ab.cell(i, 3, b); c.font = F(10); c.alignment = TOP; ab.row_dimensions[i].height = 30
    # order: Dashboard, Key findings, groups, data, questionnaires, about
    order = ['Dashboard', 'Key findings'] + [G['key'] for G in groups] + [G['sheet'] for G in groups] + ['Questionnaires', 'About']
    wb._sheets = [wb[n] for n in order]
    wb.active = 0
    for ws in wb.worksheets: ws.sheet_view.tabSelected = ws.title == 'Dashboard'
    wb.save(path)
    return A

# ================================================================ one-page infographic
def infographic(groups, data):
    S, K, H, O = (data[k] for k in ('Students', 'Kitchen', 'Hospital', 'Office'))
    sh = lambda df, c, o: (df[c] == o).mean(); ag = lambda df, c: (df[c] >= 4).mean()
    reasons = S.S3.value_counts(normalize=True); order = groups[0]['qs'][2][3]
    top = max(order, key=lambda o: reasons.get(o, 0))
    half = lambda v: f'{Decimal(str(v)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)}'
    whole = lambda v: f'{Decimal(str(v)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)}'
    def bars(items, colour):
        mx = max(v for _, v in items) or 1; rh = 19; lw = 8 + 5.4 * max(len(l) for l, _ in items); W = lw + 140
        g = ''.join(f'<text x="0" y="{i*rh+13}" font-size="9.5" fill="#4E5A54">{lab}</text><rect x="{lw}" y="{i*rh+3}" width="{(W-lw-34)*v/mx:.1f}" height="12" rx="3" fill="#{colour}" opacity="{1 if i == 0 else .55}"/><text x="{lw+(W-lw-34)*v/mx+5:.1f}" y="{i*rh+13}" font-size="9.5" font-weight="700" fill="#1B2420">{P(v)}</text>' for i, (lab, v) in enumerate(items))
        return f'<svg viewBox="0 0 {W} {len(items)*rh}" width="100%" font-family="Inter, Arial">{g}</svg>'
    def ranked(df, code, opts):
        return sorted([(o, sh(df, code, o)) for o in opts], key=lambda x: -x[1])
    q = lambda G, code: next(x for x in G['qs'] if x[0] == code)
    gs = {G['key']: G for G in groups}
    bands = [
        ('Students', len(S), [(P(sh(S, 'S3', top)), f'leave food mainly because: <b>{top.lower()}</b>'), (P(sh(S, 'S7', 'Food groups')), 'would rather see <b>food groups</b> than calories'), (half(S.S8.mean()), 'out of 5: interest in the <b>Loopi pet</b>')],
         'Main reason for leaving food', ranked(S, 'S3', order)),
        ('Kitchen', len(K), [(P(sh(K, 'K4', 'Yes, accurately')), 'know accurately <b>which dishes come back</b>'), (f'{whole(K.K3.mean())}%', 'of cooked food is <b>thrown away</b> (their estimate)'), (P(ag(K, 'K7')), 'want <b>waste shown by dish</b>')],
         'How quantities are decided', ranked(K, 'K2', q(gs['Kitchen'], 'K2')[3])),
        ('Hospital', len(H), [(P(ag(H, 'H3')), '<b>trust</b> their intake records'), (whole(H.H4.mean()), '<b>minutes a shift</b> on intake records'), (P(ag(H, 'H7')), 'want <b>automatic intake</b> records')],
         'When a patient who stops eating is noticed', [(o, sh(H, 'H5', o)) for o in q(gs['Hospital'], 'H5')[3]]),
        ('Office', len(O), [(P(sh(O, 'O5', 'Often') + sh(O, 'O5', 'Daily')), 'feel an <b>afternoon energy dip</b> often or daily'), (P(ag(O, 'O4')), '<b>know the nutrients</b> in their lunch'), (P(sh(O, 'O6', 'Yes')), 'would <b>pre-order</b> to skip the queue')],
         'Share meal data with employer?', [(o, sh(O, 'O8', o)) for o in q(gs['Office'], 'O8')[3]]),
    ]
    total = sum(b[1] for b in bands)
    html_bands = ''
    for key, n, stats, ctitle, items in bands:
        colour, tint, name, app = THEME[key]
        st = ''.join(f'<div class="st"><b style="color:#{colour}">{v}</b><span>{lab}</span></div>' for v, lab in stats)
        html_bands += f'''<section class="band" style="--c:#{colour};--t:#{tint}">
          <div class="who"><b>{name}</b><span>{n} responses</span></div>
          <div class="stats">{st}</div>
          <div class="mini"><small>{ctitle}</small>{bars(items, colour)}</div>
          <div class="so">→ <b>{app}</b>: {MEANS[key]}</div></section>'''
    return f'''<!doctype html><html><head><meta charset="utf-8"><title>PlateLoop survey: what we heard (demo)</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap">
<style>
@page{{size:A4;margin:12mm}}*{{box-sizing:border-box}}
body{{margin:0;font-family:Inter,Arial,sans-serif;color:#1B2420;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.head{{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:12px}}
h1{{margin:0;font-size:30pt;font-weight:900;letter-spacing:-.03em;line-height:1}}
.sub{{margin:6px 0 0;font-size:10.5pt;color:#4E5A54}}
.demo{{flex:none;padding:6px 12px;border-radius:99px;background:#FDECEA;color:#B42318;font-size:8.5pt;font-weight:800;letter-spacing:.05em}}
.count{{display:grid;grid-template-columns:1.2fr repeat(4,1fr);gap:6px;margin:14px 0 18px}}
.count div{{border-radius:10px;padding:8px 10px;color:#fff}}.count b{{display:block;font-size:18pt;font-weight:900;line-height:1}}.count span{{font-size:8pt;font-weight:600;opacity:.9}}
.band{{display:grid;grid-template-columns:92px 1fr 236px;grid-template-rows:auto auto;gap:6px 14px;padding:15px 16px 12px;margin-bottom:12px;border-radius:14px;background:var(--t);border-left:6px solid var(--c);page-break-inside:avoid}}
.who b{{display:block;font-size:12pt;font-weight:800;color:var(--c);line-height:1.15}}.who span{{font-size:8pt;color:#8A938E}}
.stats{{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}}
.st>b{{display:block;font-size:24pt;font-weight:900;letter-spacing:-.03em;line-height:1}}
.st span{{display:block;margin-top:4px;font-size:8.5pt;line-height:1.3;color:#4E5A54}}.st span b{{font-size:inherit;color:#1B2420;font-weight:700}}
.mini small{{display:block;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#8A938E;margin-bottom:4px}}
.so{{grid-column:2/4;font-size:9pt;color:#4E5A54;padding-top:6px;border-top:1px solid rgba(0,0,0,.07)}}.so b{{color:var(--c)}}
.foot{{margin-top:6px;font-size:7.5pt;color:#8A938E}}
</style></head><body>
<div class="head"><div><h1>What we heard</h1><p class="sub">PlateLoop survey · students, school kitchen staff, hospital staff and office workers</p></div><span class="demo">DEMO DATA</span></div>
<div class="count"><div style="background:#1B2420"><b>{total}</b><span>responses</span></div>{''.join(f'<div style="background:#{THEME[k][0]}"><b>{n}</b><span>{THEME[k][2]}</span></div>' for k, n, *_ in bands)}</div>
{html_bands}
<p class="foot">Demo data: synthetic responses generated to demonstrate the analysis; not real survey results. With groups this small, one response moves a percentage by several points. Full analysis: plateloop-survey-analysis-DEMO.xlsx.</p>
</body></html>'''
