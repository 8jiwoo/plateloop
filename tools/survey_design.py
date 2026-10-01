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
from openpyxl.formatting.rule import ColorScaleRule, DataBarRule
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
    ws['B2'] = f"=COUNTA('{G['sheet']}'!$A$2:$A${MAXROW})&\" responses · illustrative data · PlateLoop answer: {app}\""
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

# headline number for each key finding, in the same order as findings_formulas(): (formula, format, bar scale)
def headlines(A):
    lb, sh = A[('S3', 'range')]
    return [(f'=MAX({sh})', '0%', 1), (f"={A[('S7','Food groups')]}", '0%', 1), (f"={A[('S8','avg')]}", '0.0" /5"', 5),
            (f"={A[('S10','agree')]}", '0%', 1), (f"={A[('K2','Past experience')]}+{A[('K2','Headcount × standard portion')]}", '0%', 1),
            (f"={A[('K3','Average')]}/100", '0%', 1), (f"={A[('K7','agree')]}", '0%', 1), (f"={A[('H3','agree')]}", '0%', 1),
            (f"={A[('H5','Same day')]}", '0%', 1), (f"={A[('H7','agree')]}", '0%', 1), (f"={A[('O5','Often')]}+{A[('O5','Daily')]}", '0%', 1),
            (f"={A[('O6','Yes')]}", '0%', 1), (f"={A[('O8','Yes')]}", '0%', 1)]

# ================================================================ workbook
def build(groups, data, findings_fn, path, seed):
    wb = Workbook(); A = {}
    dash = wb.active; dash.title = 'Dashboard'
    # data sheets first (formulas refer to them), moved to the back at the end
    for G in groups:
        d = wb.create_sheet(G['sheet']); df = data[G['key']]; colour = THEME[G['key']][0]
        d.sheet_properties.tabColor = 'B9C0BB'
        qtype = {x[0]: x[2] for x in G['qs']}
        for j, h in enumerate(df.columns, 1):
            q = next((x for x in G['qs'] if x[0] == h), None)
            label = 'ID' if q is None else f"{h}  {q[1]}" + ('  (1–5)' if q[2] == 'lik' else '')
            c = d.cell(1, j, label); c.font = F(9.5, True, 'FFFFFF'); c.fill = fill(colour); c.alignment = Alignment(horizontal='left', vertical='top', wrap_text=True)
            if q is not None and q[2] == 'lik': c.comment = Comment(f'1 = {q[3][0]}, 5 = {q[3][1]}', 'PlateLoop')
            t = qtype.get(h)
            d.column_dimensions[get_column_letter(j)].width = 8 if t is None else 15 if t in ('lik', 'num') else 66 if t == 'text' else 28
        d.row_dimensions[1].height = max(66, 13 * max(-(-len(str(c.value)) // 15) for c in d[1] if c.value) + 8)
        for i, row in enumerate(df.itertuples(index=False), 2):
            for j, v in enumerate(row, 1):
                t = qtype.get(df.columns[j - 1])
                c = d.cell(i, j, v); c.font = F(10, False, '0000FF'); c.border = bottom_line
                c.alignment = Alignment(horizontal='center' if t in ('lik', 'num') or t is None else 'left', vertical='center')
                if i % 2: c.fill = fill(BG)
            d.row_dimensions[i].height = 20
        for j, h in enumerate(df.columns, 1):
            if qtype.get(h) == 'lik':
                col = get_column_letter(j)
                d.conditional_formatting.add(f'{col}2:{col}{MAXROW}', ColorScaleRule(start_type='num', start_value=1, start_color='F8C9C4',
                                                                                   mid_type='num', mid_value=3, mid_color='F2F2F2', end_type='num', end_value=5, end_color='A9DFBF'))
        d.auto_filter.ref = f'A1:{get_column_letter(len(df.columns))}{len(df) + 1}'
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
    merge_write(dash, 'B2:Q2', NOTE, F(9, False, INK3, True), LEFT)
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
    setup(k, [2, 15, 11, 14, 74, 50])
    merge_write(k, 'B1:F1', 'Key findings', F(22, True), LEFT); k.row_dimensions[1].height = 36
    merge_write(k, 'B2:F2', 'Calculated live from the responses. ' + NOTE, F(9, False, INK3, True), LEFT)
    for j, h in enumerate(['Group', 'Headline', '', 'What the survey shows', 'What PlateLoop does about it'], 2):
        c = k.cell(4, j, h); c.font = F(10, True, 'FFFFFF'); c.fill = fill(INK); c.alignment = LEFT
    k.row_dimensions[4].height = 24
    heads = headlines(A)
    for i, ((grp, f, mean), (hf, fmt, scale)) in enumerate(zip(findings, heads), 5):
        colour, tint, name, _ = THEME[grp]
        c = k.cell(i, 2, name); c.font = F(10, True, 'FFFFFF'); c.fill = fill(colour); c.alignment = CENTER
        c = k.cell(i, 3, hf); c.font = F(18, True, colour); c.alignment = CENTER; c.number_format = fmt; c.fill = fill(tint)
        c = k.cell(i, 4, f'=C{i}/{scale}' if scale != 1 else f'=C{i}'); c.number_format = '0%'; c.fill = fill(tint)
        c = k.cell(i, 5, f.replace('="{}"&', '=')); c.font = F(10.5); c.alignment = LEFT; c.fill = fill(tint)
        c = k.cell(i, 6, mean); c.font = F(10, True, colour); c.alignment = LEFT; c.fill = fill(tint)
        for j in range(2, 7): k.cell(i, j).border = Border(bottom=Side(style='medium', color='FFFFFF'))
        k.row_dimensions[i].height = 46
        k.conditional_formatting.add(f'D{i}', DataBarRule(start_type='num', start_value=0, end_type='num', end_value=1, color=colour, showValue=False))
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
    rows = [('Illustrative data', f'The responses are sample answers generated with a fixed seed ({seed}) to show how the analysis works. They were not collected from real people. Replace them with real responses before drawing conclusions.'),
            ('Dashboard', 'Headline numbers and one chart per group.'), ('Key findings', 'Findings written as live formulas, each matched to a PlateLoop feature.'),
            ('Group sheets', 'Students, Kitchen, Hospital, Office: every question as a table with in-cell bars, plus charts.'),
            ('Data sheets', 'One row per respondent (blue text = input). To use real data, paste responses into these tables (same columns, up to row 1000) — every other sheet updates.'),
            ('Questionnaires', 'All questions, codes and answer options. Online version: https://8jiwoo.github.io/plateloop/survey/'),
            ('Scale questions', '1 = strongly disagree / not useful … 5 = strongly agree / very useful. "Agree" = share answering 4 or 5.')]
    for i, (a, b) in enumerate(rows, 3):
        c = ab.cell(i, 2, a); c.font = F(10, True); c.alignment = TOP
        c = ab.cell(i, 3, b); c.font = F(10); c.alignment = TOP; ab.row_dimensions[i].height = 30
    # order: Dashboard, Key findings, groups, data, questionnaires, about
    order = ['Dashboard', 'Key findings'] + [G['key'] for G in groups] + [G['sheet'] for G in groups] + ['Questionnaires', 'About']
    wb._sheets = [wb[n] for n in order]
    wb.active = 0
    for ws in wb.worksheets: ws.sheet_view.tabSelected = ws.title == 'Dashboard'
    wb.save(path)
    return A

# ================================================================ findings infographic (web: animated on scroll, PDF: still, 2 x A4)
BRAND = {'Students': '#30D158', 'Kitchen': '#FF9F0A', 'Hospital': '#0A84FF', 'Office': '#7D7AFF'}
NOTE = 'Illustrative data: sample responses created to show how the analysis works, not collected from real people.'
SHORTQ = {'S6': 'See what I ate', 'S8': 'Scan to feed the pet', 'S9': 'Class waste competition', 'S10': 'Face sign-in is OK',
          'K6': 'Suggested order', 'K7': 'Waste shown by dish', 'K8': 'Monthly carbon report', 'K10': 'Worried about workload',
          'H3': 'Records are accurate', 'H7': 'Automatic intake records', 'H8': 'Alert with the reason',
          'O4': 'Know lunch nutrients', 'O7': 'Daily lunch suggestion'}

def loopi_svg(expr='happy', size=96):
    """Loopi, the PlateLoop mascot (same drawing as apps/js/visual.js)."""
    if expr == 'cheer':
        eye = lambda x: f'<path d="M{x-7} 67q7-8 14 0" fill="none" stroke="#1F2A1D" stroke-width="3.4" stroke-linecap="round"/>'
        mouth = '<path d="M49 80q11 16 22 0Z" fill="#1F2A1D"/><path d="M54 86q6 5 12 0" fill="#FF8FA0"/>'
    else:
        eye = lambda x: f'<g class="lp-eye"><ellipse cx="{x}" cy="66" rx="7" ry="8.5" fill="#fff"/><circle cx="{x}" cy="67.6" r="4" fill="#1F2A1D"/><circle cx="{x+1.6}" cy="65.6" r="1.4" fill="#fff"/></g>'
        mouth = '<path d="M50 80q10 10 20 0" fill="none" stroke="#1F2A1D" stroke-width="3.2" stroke-linecap="round"/>'
    arm = lambda d, c='': f'<path class="{c}" d="{d}" fill="none" stroke="#6CC25C" stroke-width="8" stroke-linecap="round"/>'
    arms = {'cheer': arm('M26 76q-12-8-13-22') + arm('M94 76q12-8 13-22'),
            'wave': arm('M26 82q-9 7-10 16') + arm('M94 76q13-6 14-22', 'lp-wave')}.get(expr, arm('M26 82q-9 7-10 16') + arm('M94 82q9 7 10 16'))
    return (f'<svg class="loopi lp-{expr}" width="{size}" height="{size*1.08:.0f}" viewBox="0 0 120 130" role="img" aria-label="Loopi">'
            '<ellipse cx="60" cy="124" rx="30" ry="4" fill="rgba(0,0,0,.25)"/><g class="lp-body">'
            '<ellipse cx="47" cy="119" rx="9" ry="5" fill="#4FA844"/><ellipse cx="73" cy="119" rx="9" ry="5" fill="#4FA844"/>' + arms +
            '<path d="M60 30c27 0 43 20 43 47s-17 42-43 42-43-15-43-42 16-47 43-47Z" fill="#8FDB7E"/>'
            '<path d="M18 84c5 21 21 35 42 35s37-14 42-35c-8 13-23 21-42 21s-34-8-42-21Z" fill="#76C866"/>'
            '<ellipse cx="60" cy="94" rx="21" ry="15" fill="#D6F5CB"/><path d="M60 31c-1-7 0-12 2-16" fill="none" stroke="#3E9B4A" stroke-width="4" stroke-linecap="round"/>'
            '<path class="lp-leaf" d="M62 16c6-10 19-10 23-5-4 8-15 10-23 5Z" fill="#4DB35B"/><path d="M60 18c-6-8-17-8-21-3 4 7 14 8 21 3Z" fill="#62C76F"/>'
            '<circle cx="38" cy="78" r="6" fill="#FF9AA8" opacity=".55"/><circle cx="82" cy="78" r="6" fill="#FF9AA8" opacity=".55"/>'
            + eye(47) + eye(73) + mouth + '</g></svg>')

LOOPI_CSS = """.loopi{display:block;overflow:visible;flex:none}
.loopi .lp-body{animation:lpbob 3.2s ease-in-out infinite;transform-origin:60px 120px}
.loopi .lp-eye{animation:lpblink 5.5s infinite;transform-box:fill-box;transform-origin:center}
.loopi .lp-wave{animation:lpwave 1.1s ease-in-out infinite;transform-box:fill-box;transform-origin:0% 100%}
.loopi .lp-leaf{animation:lpleaf 2.6s ease-in-out infinite;transform-box:fill-box;transform-origin:0% 100%}
.lp-cheer .lp-body{animation:lpjump 1.4s ease-in-out infinite}
@keyframes lpbob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes lpjump{0%,100%{transform:translateY(0)}30%{transform:translateY(-8px)}55%{transform:translateY(0)}}
@keyframes lpblink{0%,94%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
@keyframes lpwave{0%,100%{transform:rotate(0)}50%{transform:rotate(-18deg)}}
@keyframes lpleaf{0%,100%{transform:rotate(0)}50%{transform:rotate(-8deg)}}"""

# ---------------------------------------------------------------- small SVG visuals
def v_ring(p):
    r, C = 25, 2 * 3.14159 * 25
    return (f'<svg viewBox="0 0 64 64" class="vis"><circle cx="32" cy="32" r="{r}" class="trk" stroke-width="8" fill="none"/>'
            f'<circle cx="32" cy="32" r="{r}" class="arc" fill="none" stroke-width="8" stroke-linecap="round" transform="rotate(-90 32 32)" '
            f'style="stroke-dasharray:{C:.1f};stroke-dashoffset:{C*(1-p):.1f};--c0:{C:.1f}"/></svg>')

PERSON = '<circle cx="6" cy="4" r="3.3"/><path d="M.4 18c0-5 2.6-8 5.6-8s5.6 3 5.6 8Z"/>'
def v_people(k, n):
    cells = ''.join(f'<g transform="translate({i*15},0)" class="pp{" on" if i < k else ""}" style="--j:{i}">{PERSON}</g>' for i in range(n))
    return f'<svg viewBox="0 0 {n*15-3} 18" class="vis people" style="width:{min(n*15-3, 118)}px">{cells}</svg>'

def v_gauge(v, mx=60):
    L = 3.14159 * 27
    return (f'<svg viewBox="0 0 64 38" class="vis"><path d="M5 34a27 27 0 0 1 54 0" class="trk" stroke-width="8" fill="none" stroke-linecap="round"/>'
            f'<path d="M5 34a27 27 0 0 1 54 0" class="arc" fill="none" stroke-width="8" stroke-linecap="round" style="stroke-dasharray:{L:.1f};stroke-dashoffset:{L*(1-min(v,mx)/mx):.1f};--c0:{L:.1f}"/>'
            f'<text x="5" y="38" class="gt" text-anchor="middle">0</text><text x="59" y="38" class="gt" text-anchor="middle">{mx}</text></svg>')

LEAF = '<path d="M2 16C2 7 8 2 17 2c0 9-5 14-15 14Z"/>'
def v_rating(v):
    return '<svg viewBox="0 0 98 18" class="vis rating">' + ''.join(
        f'<g transform="translate({i*20},0)" class="pp{" on" if i < round(v) else ""}" style="--j:{i}">{LEAF}</g>' for i in range(5)) + '</svg>'

def v_versus(a, b):
    return (f'<div class="vs"><div><span>Food groups</span><i style="--w:{a*100:.0f}%"></i><em>{P(a)}</em></div>'
            f'<div class="dim"><span>Calories</span><i style="--w:{b*100:.0f}%"></i><em>{P(b)}</em></div></div>')

INFO_CSS = """
@page{size:A4;margin:0}
:root{--bg:#040705;--card:#0D110F;--ink:#F5F5F7;--ink2:#AEB3B8;--ink3:#7A7F85;--line:rgba(255,255,255,.08);--g:#30D158;--neg:#FF6B5E;color-scheme:dark}
*{box-sizing:border-box}
html{background:var(--bg)}
body{margin:0;color:var(--ink);font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;-webkit-print-color-adjust:exact;print-color-adjust:exact;
  background:radial-gradient(900px 600px at 92% -4%,rgba(48,209,88,.18),transparent 60%),radial-gradient(800px 900px at -15% 40%,rgba(48,209,88,.07),transparent 60%),radial-gradient(900px 700px at 110% 70%,rgba(10,132,255,.08),transparent 60%),var(--bg)}
.page{position:relative;max-width:820px;margin:0 auto;padding:34px 30px 26px}
.tag{position:absolute;top:34px;right:30px;padding:6px 11px;border-radius:99px;font-size:10px;font-weight:700;letter-spacing:.03em;color:var(--ink3);box-shadow:inset 0 0 0 1px rgba(255,255,255,.14)}
.top{display:flex;align-items:center;gap:18px}
.top .loopi{filter:drop-shadow(0 12px 24px rgba(48,209,88,.35))}
.eyebrow{font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--g)}
h1{margin:4px 0 0;font-size:46px;font-weight:900;letter-spacing:-.045em;line-height:.98}
h1 em{font-style:normal;background:linear-gradient(90deg,#4ADE80,#30D158 60%,#9BE15D);-webkit-background-clip:text;background-clip:text;color:transparent}
.lede{margin:8px 0 0;font-size:13px;color:var(--ink2)}
.counts{display:grid;grid-template-columns:1.25fr repeat(4,1fr);gap:8px;margin:20px 0 0}
.cnt{position:relative;overflow:hidden;padding:10px 12px 10px 14px;border-radius:16px;background:var(--card);box-shadow:inset 0 0 0 1px var(--line)}
.cnt::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--c,#fff)}
.cnt b{display:block;font-size:24px;font-weight:900;letter-spacing:-.03em;line-height:1;color:var(--c,#fff);font-variant-numeric:tabular-nums}
.cnt span{font-size:10.5px;font-weight:600;color:var(--ink2)}
.cnt.all{background:linear-gradient(135deg,rgba(48,209,88,.24),rgba(48,209,88,.06));box-shadow:inset 0 0 0 1px rgba(48,209,88,.35)}
.cnt.all::before{display:none}
.card{position:relative;overflow:hidden;margin-top:12px;padding:16px 18px 13px;border-radius:22px;background:var(--card);box-shadow:inset 0 0 0 1px var(--line);break-inside:avoid}
.card::after{content:"";position:absolute;right:-90px;top:-100px;width:300px;height:250px;background:radial-gradient(closest-side,color-mix(in srgb,var(--c,#30D158) 22%,transparent),transparent);pointer-events:none}
.card>*{position:relative;z-index:1}
.card header{display:flex;align-items:center;gap:9px}
.dot{width:10px;height:10px;border-radius:50%;background:var(--c);box-shadow:0 0 12px var(--c)}
h2{margin:0;font-size:16px;font-weight:800;letter-spacing:-.02em}
.nresp{font-size:11px;color:var(--ink3);font-weight:600}
.app{margin-left:auto;padding:4px 10px;border-radius:99px;font-size:10.5px;font-weight:700;color:var(--c);background:color-mix(in srgb,var(--c) 14%,transparent)}
h3{margin:0 0 8px;font-size:9px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--ink3)}
/* overview: the problem vs wanting the fix */
.ov h2{font-size:15px}.ov .sub{margin:3px 0 12px;font-size:11px;color:var(--ink2)}
.ovrow{display:grid;grid-template-columns:118px 1fr 1fr;gap:14px;align-items:center;padding:7px 0;border-top:1px solid var(--line)}
.ovrow:first-child{border-top:0}
.ovrow .who{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:800}
.ovrow .who i{width:8px;height:8px;border-radius:50%;background:var(--c)}
.ovb{display:grid;grid-template-columns:1fr 34px;gap:6px;align-items:center}
.ovb .track{height:10px}
.ovb em{font-style:normal;font-size:12px;font-weight:900;text-align:right;font-variant-numeric:tabular-nums}
.ovb small{grid-column:1/-1;font-size:9.5px;color:var(--ink3);margin-top:-1px}
.ovb.bad .track i{background:var(--neg);opacity:.85}.ovb.bad em{color:var(--neg)}
.ovb.good .track i{background:var(--c)}.ovb.good em{color:var(--c)}
.ovhead{display:grid;grid-template-columns:118px 1fr 1fr;gap:14px;font-size:9px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--ink3)}
.ovhead span:nth-child(2){color:var(--neg)}.ovhead span:nth-child(3){color:var(--g)}
/* KPI tiles */
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}
.kpi{display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:16px;background:rgba(255,255,255,.035);box-shadow:inset 0 0 0 1px var(--line)}
.kpi .vis{flex:none;width:52px;height:auto;overflow:visible}
.kpi .vis.people,.kpi .vis.rating{width:auto;height:22px}
.kpi.col{flex-direction:column;align-items:flex-start;gap:7px}
.trk{stroke:rgba(255,255,255,.08)}.arc{stroke:var(--c);filter:drop-shadow(0 0 4px color-mix(in srgb,var(--c) 60%,transparent))}
.gt{font-size:7px;fill:var(--ink3);font-weight:700}
.pp{fill:rgba(255,255,255,.13)}.pp.on{fill:var(--c)}
.big{display:flex;align-items:baseline;gap:1px;color:var(--c)}
.big b{font-size:26px;font-weight:900;letter-spacing:-.045em;line-height:1;font-variant-numeric:tabular-nums}
.big small{font-size:13px;font-weight:800}
.kpi p{margin:3px 0 0;font-size:10.5px;line-height:1.32;color:var(--ink2)}
.kpi p b{color:var(--ink);font-weight:700}
.vs{width:100%;display:grid;gap:4px}
.vs div{display:grid;grid-template-columns:62px 1fr 28px;gap:6px;align-items:center;font-size:9.5px;color:var(--ink)}
.vs div i{height:8px;border-radius:8px;background:var(--c);width:var(--w)}
.vs div.dim i{background:rgba(255,255,255,.22)}.vs div.dim{color:var(--ink3)}
.vs em{font-style:normal;font-weight:800;text-align:right}
/* charts */
.charts{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:13px}
.row{display:grid;grid-template-columns:128px 1fr 30px;align-items:center;gap:7px;height:17px}
.row span{font-size:9.8px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row em{font-style:normal;font-size:9.8px;font-weight:800;text-align:right;font-variant-numeric:tabular-nums}
.track{height:8px;border-radius:8px;background:rgba(255,255,255,.06);overflow:hidden}
.track i{display:block;height:100%;width:var(--w);border-radius:8px;background:color-mix(in srgb,var(--c) 50%,transparent)}
.row.lead .track i{background:var(--c);box-shadow:0 0 10px color-mix(in srgb,var(--c) 60%,transparent)}
.row.lead span{color:var(--ink);font-weight:600}
.lk{display:grid;grid-template-columns:118px 1fr 32px;align-items:center;gap:7px;height:19px}
.lk span{font-size:9.8px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lk em{font-style:normal;font-size:9.8px;font-weight:800;text-align:right;color:var(--c)}
.stack{display:flex;height:11px;border-radius:6px;overflow:hidden;gap:1px}
.stack i{display:block;height:100%}
.s1{background:rgba(255,107,94,.85)}.s2{background:rgba(255,107,94,.42)}.s3{background:rgba(255,255,255,.16)}.s4{background:color-mix(in srgb,var(--c) 55%,transparent)}.s5{background:var(--c)}
.legend{display:flex;gap:10px;margin-top:6px;font-size:8.5px;color:var(--ink3);font-weight:600}
.legend i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px;vertical-align:-1px}
.card footer{display:flex;gap:8px;align-items:baseline;margin-top:11px;padding-top:9px;border-top:1px solid var(--line)}
.arrow{color:var(--c);font-weight:900}
.card footer p{margin:0;font-size:11.5px;line-height:1.4;color:var(--ink2)}
.card footer b{color:var(--c)}
.foot{display:flex;justify-content:space-between;gap:14px;margin-top:12px;font-size:9.5px;color:var(--ink3)}
.foot b{color:var(--ink2);white-space:nowrap}
.sheet{display:flex;flex-direction:column}.p2{margin-top:12px}
/* motion: screen only, each card animates when it scrolls into view */
@media screen and (prefers-reduced-motion:no-preference){
  .top,.cnt{animation:rise .8s cubic-bezier(.2,.8,.2,1) both}
  .cnt{animation-delay:calc(.15s + var(--k,0)*.07s)}
  .js .card{opacity:0;transform:translateY(26px);transition:opacity .8s cubic-bezier(.2,.8,.2,1),transform .8s cubic-bezier(.2,.8,.2,1)}
  .js .card.in{opacity:1;transform:none}
  .js .card.in .arc{animation:ring 1.4s cubic-bezier(.2,.8,.2,1) .35s both}
  .js .card.in .pp{animation:popi .45s cubic-bezier(.3,1.6,.5,1) calc(.35s + var(--j)*.09s) both;transform-box:fill-box;transform-origin:50% 100%}
  .js .card.in .track i,.js .card.in .vs i{animation:grow 1.2s cubic-bezier(.2,.8,.2,1) calc(.45s + var(--n,0)*.07s) both}
  .js .card.in .stack{animation:wipe 1.3s cubic-bezier(.2,.8,.2,1) calc(.5s + var(--n,0)*.08s) both}
  .dot{animation:pulse 2.4s ease-in-out infinite}
}
@keyframes rise{from{opacity:0;transform:translateY(22px)}}
@keyframes grow{from{width:0}}
@keyframes ring{from{stroke-dashoffset:var(--c0)}}
@keyframes popi{from{transform:scale(0)}}
@keyframes wipe{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes pulse{50%{box-shadow:0 0 0 5px color-mix(in srgb,var(--c) 18%,transparent),0 0 16px var(--c)}}
@media print{*{animation:none!important;transition:none!important}.js .card{opacity:1!important;transform:none!important}
  .page{max-width:none;width:210mm;padding:0 12mm}.tag{top:11mm;right:12mm}
  .sheet{height:296mm;padding:11mm 0 8mm;justify-content:space-between;overflow:hidden}.sheet>*{margin-top:0!important}
  .p1{justify-content:flex-start;gap:14px}.ov{flex:1;display:flex;flex-direction:column}.ovrows{flex:1;display:flex;flex-direction:column;justify-content:space-around}
  .ov h2{font-size:20px}.ov .sub{font-size:12.5px;margin-bottom:16px}.ovhead{font-size:10.5px}.ovrow{grid-template-columns:130px 1fr 1fr;gap:20px}.ovhead{grid-template-columns:130px 1fr 1fr;gap:20px}.ovrow .who{font-size:15px}.ovrow .who i{width:12px;height:12px;box-shadow:0 0 10px var(--c)}.ovb{grid-template-columns:1fr 66px;gap:10px}.ovb .track{height:20px;border-radius:20px}.ovb .track i{border-radius:20px}.ovb em{font-size:24px;letter-spacing:-.03em}.ovb small{font-size:11.5px;margin-top:5px}.p2{break-before:page;margin-top:0}}
@media (max-width:700px){.page{padding:52px 16px 22px}.tag{top:16px;right:16px}.top{gap:12px}h1{font-size:34px}.lede{font-size:12.5px}
  .counts{grid-template-columns:repeat(4,1fr)}.counts .all{grid-column:1/-1}.top .loopi{width:64px;height:auto}.app{display:none}
  .kpis,.charts{grid-template-columns:1fr}.ovrow,.ovhead{grid-template-columns:84px 1fr 1fr;gap:8px}.foot{flex-direction:column}}
"""

INFO_JS = """
(() => {
  document.querySelectorAll('.cnt').forEach((c, k) => c.style.setProperty('--k', k));
  document.querySelectorAll('.card').forEach(card => card.querySelectorAll('.row, .lk, .ovrow').forEach((r, n) => r.querySelectorAll('.track i, .stack').forEach(x => x.style.setProperty('--n', n))));
  if (navigator.webdriver || matchMedia('print').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.documentElement.classList.add('js');
  const final = e => e.textContent = (+e.dataset.to).toFixed(+e.dataset.dec);
  addEventListener('beforeprint', () => document.querySelectorAll('[data-to]').forEach(final));
  const count = (e, delay) => {
    const to = +e.dataset.to, dec = +e.dataset.dec, dur = 1300;
    e.textContent = (0).toFixed(dec);
    setTimeout(() => { const t0 = performance.now();
      const step = t => { const p = Math.min(1, (t - t0) / dur);
        e.textContent = (to * (1 - Math.pow(1 - p, 3))).toFixed(dec); if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step); }, delay);
  };
  document.querySelectorAll('.counts [data-to]').forEach(e => count(e, 250));
  const cards = document.querySelectorAll('.card');
  cards.forEach(c => c.querySelectorAll('[data-to]').forEach(e => e.textContent = (0).toFixed(+e.dataset.dec)));
  const io = new IntersectionObserver(es => es.forEach(en => {
    if (!en.isIntersecting) return;
    en.target.classList.add('in'); io.unobserve(en.target);
    en.target.querySelectorAll('[data-to]').forEach(e => count(e, 350));
  }), { threshold: .18 });
  cards.forEach(c => io.observe(c));
})();
"""

def infographic(groups, data):
    S, K, H, O = (data[k] for k in ('Students', 'Kitchen', 'Hospital', 'Office'))
    sh = lambda df, c, o: (df[c] == o).mean()
    ag = lambda df, c: (df[c] >= 4).mean()
    low = lambda df, c: (df[c] <= 3).mean()
    rnd = lambda v, q='1': Decimal(str(v)).quantize(Decimal(q), rounding=ROUND_HALF_UP)
    pc = lambda v: int(rnd(v * 100))
    gs = {G['key']: G for G in groups}
    opts = lambda k, c: next(x for x in gs[k]['qs'] if x[0] == c)[3]
    ranked = lambda df, c, o: sorted([(x, sh(df, c, x)) for x in o], key=lambda t: -t[1])
    reasons = S.S3.value_counts(normalize=True); order = opts('Students', 'S3')
    top = max(order, key=lambda o: reasons.get(o, 0))
    num = lambda v, suf='%', dec=0: f'<div class="big"><b data-to="{v}" data-dec="{dec}">{v:.{dec}f}</b><small>{suf}</small></div>'
    def kpi(vis, big, label, col=False):
        return f'<div class="kpi{" col" if col else ""}">{vis}<div>{big}<p>{label}</p></div></div>'
    def bars(title, items, lead=True):
        mx = max(v for _, v in items) or 1
        rows = ''.join(f'<div class="row{" lead" if lead and j == 0 else ""}"><span>{lab.replace(" standard portion", " portion")}</span>'
                       f'<div class="track"><i style="--w:{v / mx * 100:.1f}%"></i></div><em>{P(v)}</em></div>' for j, (lab, v) in enumerate(items))
        return f'<div><h3>{title}</h3>{rows}</div>'
    def likert(title, df, codes):
        rows = ''
        for c in codes:
            dist = [(df[c] == k).mean() for k in range(1, 6)]
            seg = ''.join(f'<i class="s{k+1}" style="width:{d*100:.1f}%"></i>' for k, d in enumerate(dist) if d > 0)
            rows += f'<div class="lk"><span>{SHORTQ[c]}</span><div class="stack">{seg}</div><em>{P(ag(df, c))}</em></div>'
        legend = ('<div class="legend"><span><i class="s1"></i>Disagree</span><span><i class="s3"></i>Neutral</span>'
                  '<span><i class="s5"></i>Agree</span><span style="margin-left:auto">% = agree (4–5)</span></div>')
        return f'<div><h3>{title}</h3>{rows}{legend}</div>'
    def card(key, n, kpis, left, right):
        colour = BRAND[key]; name, app = THEME[key][2], THEME[key][3]
        return (f'<section class="card" style="--c:{colour}">'
                f'<header><span class="dot"></span><h2>{name}</h2><span class="nresp">{n} responses</span><span class="app">{app}</span></header>'
                f'<div class="kpis">{"".join(kpis)}</div><div class="charts">{left}{right}</div>'
                f'<footer><span class="arrow">→</span><p><b>{app}</b> {MEANS[key]}</p></footer></section>\n')
    k_acc = int((K.K4 == 'Yes, accurately').sum()); h_tr = int((H.H3 >= 4).sum()); o_kn = int((O.O4 >= 4).sum())
    students = card('Students', len(S), [
        kpi(v_ring(sh(S, 'S3', top)), num(pc(sh(S, 'S3', top))), f'leave food mainly because: <b>{top.lower()}</b>'),
        kpi(v_versus(sh(S, 'S7', 'Food groups'), sh(S, 'S7', 'Calories')), num(pc(sh(S, 'S7', 'Food groups'))), 'would rather see <b>food groups</b> than calories', col=True),
        kpi(v_rating(float(rnd(S.S8.mean(), '0.1'))), num(float(rnd(S.S8.mean(), '0.1')), '/5', 1), 'interest in feeding the <b>Loopi pet</b>', col=True)],
        bars('Main reason for leaving food', ranked(S, 'S3', order)),
        likert('How students feel', S, ['S6', 'S8', 'S9', 'S10']))
    kitchen = card('Kitchen', len(K), [
        kpi(v_people(k_acc, len(K)), num(k_acc, f' of {len(K)}'), 'know accurately <b>which dishes come back</b>', col=True),
        kpi(v_ring(K.K3.mean() / 100), num(int(rnd(K.K3.mean()))), 'of cooked food is <b>thrown away</b>, by their estimate'),
        kpi(v_ring(ag(K, 'K7')), num(pc(ag(K, 'K7'))), 'want <b>waste shown by dish</b>')],
        bars('How quantities are decided', ranked(K, 'K2', opts('Kitchen', 'K2'))),
        likert('How useful would this be?', K, ['K6', 'K7', 'K8', 'K10']))
    hospital = card('Hospital', len(H), [
        kpi(v_people(h_tr, len(H)), num(h_tr, f' of {len(H)}'), '<b>trust</b> their intake records', col=True),
        kpi(v_gauge(H.H4.mean()), num(int(rnd(H.H4.mean())), ' min'), 'a shift spent <b>writing intake records</b>'),
        kpi(v_ring(ag(H, 'H7')), num(pc(ag(H, 'H7'))), 'want <b>automatic intake</b> records')],
        bars('When a patient who stops eating is noticed', [(o, sh(H, 'H5', o)) for o in opts('Hospital', 'H5')], lead=False),
        likert('How staff feel', H, ['H3', 'H7', 'H8']))
    office = card('Office', len(O), [
        kpi(v_ring(sh(O, 'O5', 'Often') + sh(O, 'O5', 'Daily')), num(pc(sh(O, 'O5', 'Often') + sh(O, 'O5', 'Daily'))), 'feel an <b>afternoon energy dip</b> often or daily'),
        kpi(v_people(o_kn, len(O)), num(o_kn, f' of {len(O)}'), '<b>know the nutrients</b> in their lunch', col=True),
        kpi(v_ring(sh(O, 'O6', 'Yes')), num(pc(sh(O, 'O6', 'Yes'))), 'would <b>pre-order</b> to skip the queue')],
        bars('Share meal data with employer?', [(o, sh(O, 'O8', o)) for o in opts('Office', 'O8')], lead=False),
        likert('How office workers feel', O, ['O4', 'O7']))
    # overview: the problem each group reports vs how many want PlateLoop's fix
    ov = [('Students', 1 - sh(S, 'S2', 'Never') - sh(S, 'S2', 'Rarely'), 'leave food at least sometimes', ag(S, 'S6'), 'want to see what they ate'),
          ('Kitchen', 1 - sh(K, 'K4', 'Yes, accurately'), 'don’t know accurately which dishes come back', ag(K, 'K7'), 'want waste shown by dish'),
          ('Hospital', low(H, 'H3'), 'aren’t confident intake records are accurate', ag(H, 'H7'), 'want automatic intake records'),
          ('Office', low(O, 'O4'), 'don’t know the nutrients in their lunch', ag(O, 'O7'), 'want a daily lunch suggestion')]
    ovrows = ''.join(f'<div class="ovrow" style="--c:{BRAND[k]}"><div class="who"><i></i>{THEME[k][2]}</div>'
                     f'<div class="ovb bad"><div class="track"><i style="--w:{a*100:.0f}%"></i></div><em>{P(a)}</em><small>{la}</small></div>'
                     f'<div class="ovb good"><div class="track"><i style="--w:{b*100:.0f}%"></i></div><em>{P(b)}</em><small>{lb}</small></div></div>' for k, a, la, b, lb in ov)
    overview = (f'<section class="card ov"><h2>The problem, and the appetite for a fix</h2><p class="sub">Each group’s biggest pain point, next to how many want what PlateLoop offers.</p>'
                f'<div class="ovhead"><span></span><span>The problem</span><span>Want PlateLoop’s fix</span></div><div class="ovrows">{ovrows}</div></section>\n')
    total = len(S) + len(K) + len(H) + len(O)
    counts = f'<div class="cnt all"><b data-to="{total}" data-dec="0">{total}</b><span>responses</span></div>' + ''.join(
        f'<div class="cnt" style="--c:{BRAND[k]}"><b data-to="{len(df)}" data-dec="0">{len(df)}</b><span>{THEME[k][2]}</span></div>'
        for k, df in (('Students', S), ('Kitchen', K), ('Hospital', H), ('Office', O)))
    return ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
            '<title>PlateLoop survey findings</title><meta name="theme-color" content="#040705">'
            '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap">'
            f'<style>{LOOPI_CSS}{INFO_CSS}</style></head><body><div class="page"><span class="tag">Illustrative data</span>'
            f'<div class="sheet p1"><div class="top">{loopi_svg("cheer", 88)}<div><div class="eyebrow">PlateLoop survey · findings</div><h1>What we <em>heard.</em></h1>'
            '<p class="lede">Students, kitchen staff, hospital staff and office workers on lunch, leftovers and nutrition.</p></div></div>'
            f'<div class="counts">{counts}</div>\n{overview}{students}</div><div class="sheet p2">{kitchen}{hospital}{office}'
            f'<div class="foot"><span>{NOTE} With groups this small, one answer moves a percentage by several points.</span><b>8jiwoo.github.io/plateloop</b></div></div>'
            f'</div><script>{INFO_JS}</script></body></html>')
