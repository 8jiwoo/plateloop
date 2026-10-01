"""
Split the A1 poster PDF into A4 sheets to print and stick together.

  pip install pypdf reportlab pillow
  python tools/tiles.py

Writes two files next to the poster:
  plateloop-poster-A1-in-8-A4.pdf     8 sheets (2 across, 4 down, A4 landscape), edge to edge with no margins.
                                       For a print shop or a printer that can print borderless.
  plateloop-poster-A1-home-printer.pdf  15 sheets (3 across, 5 down, A4 landscape) with 10 mm margins and a
                                       10 mm overlap, crop marks and labels. Prints at 100% on any printer and
                                       assembles to exactly A1.
Both start with a guide page showing where each sheet goes.
"""
import copy, io, os
from PIL import Image
from pypdf import PdfReader, PdfWriter, Transformation, PageObject
from pypdf.generic import ContentStream, NameObject
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSTER = os.path.join(ROOT, 'poster')
MM = 72 / 25.4
A1W, A1H = 594, 841
A4L = (297, 210)

def overlay(w, h, draw):
    buf = io.BytesIO(); c = canvas.Canvas(buf, pagesize=(w * MM, h * MM)); draw(c); c.save()
    return PdfReader(io.BytesIO(buf.getvalue())).pages[0]

def tile(src, x, y, w, h, page_w, page_h, ox, oy):
    """A page of page_w × page_h mm showing the poster region (x, y, w, h) (mm, from the top left) at 100%, placed at (ox, oy) from the page's top left, clipped to that region."""
    page = PageObject.create_blank_page(width=page_w * MM, height=page_h * MM)
    tx, ty = (ox - x) * MM, (page_h - oy - h - (A1H - y - h)) * MM
    page.merge_transformed_page(src, Transformation().translate(tx, ty))
    cs = ContentStream(page.get_contents(), page.pdf if hasattr(page, 'pdf') else None)
    clip = f'q {ox * MM:.3f} {(page_h - oy - h) * MM:.3f} {w * MM:.3f} {h * MM:.3f} re W n\n'.encode()
    cs.set_data(clip + cs.get_data() + b'\nQ\n')
    page[NameObject('/Contents')] = cs
    return page

def guide(cols, rows, cell_w, cell_h, step_w, step_h, title, lines):
    thumb = Image.open(os.path.join(POSTER, 'plateloop-poster-A1.png')).convert('RGB')
    thumb.thumbnail((1200, 1700))
    def draw(c):
        W, H = 210 * MM, 297 * MM
        c.setFont('Helvetica-Bold', 20); c.drawString(20 * MM, H - 24 * MM, title)
        c.setFont('Helvetica', 10.5); y = H - 33 * MM
        for ln in lines: c.drawString(20 * MM, y, ln); y -= 5.4 * MM
        tw = 120 * MM; th = tw * A1H / A1W; tx = (W - tw) / 2; ty = 16 * MM
        c.drawImage(ImageReader(thumb), tx, ty, tw, th)
        k = tw / (A1W * MM)
        c.setStrokeColor(HexColor('#30D158')); c.setLineWidth(1.2)
        n = 0
        for r in range(rows):
            for col in range(cols):
                n += 1
                x0, y0 = col * step_w, r * step_h
                rx, ry = tx + x0 * MM * k, ty + th - (y0 + cell_h) * MM * k
                c.rect(rx, ry, cell_w * MM * k, cell_h * MM * k, stroke=1, fill=0)
                c.setFillColor(HexColor('#30D158')); c.setFont('Helvetica-Bold', 13)
                c.drawCentredString(rx + min(cell_w, A1W - x0) * MM * k / 2, ry + cell_h * MM * k / 2 - 4, str(n))
    return overlay(210, 297, draw)

def exact():
    src = PdfReader(os.path.join(POSTER, 'plateloop-poster-A1.pdf')).pages[0]
    out = PdfWriter()
    cols, rows, w, h = 2, 4, A1W / 2, A1H / 4
    out.add_page(guide(cols, rows, w, h, w, h, 'PlateLoop poster: A1 from 8 A4 sheets', [
        'Print every sheet on A4 at 100% (Actual size), landscape, with borderless printing on.',
        'Each sheet is exactly one eighth of the A1 poster, edge to edge, so there is nothing to trim.',
        'Lay them out as numbered below (2 across, 4 down) and tape them together from the back.',
        'If your printer cannot print borderless, use the home-printer file instead: it has margins and overlaps.']))
    for r in range(rows):
        for c in range(cols):
            out.add_page(tile(src, c * w, r * h, w, h, *A4L, 0, 0))
    p = os.path.join(POSTER, 'plateloop-poster-A1-in-8-A4.pdf'); out.write(p); return p

def home():
    src = PdfReader(os.path.join(POSTER, 'plateloop-poster-A1.pdf')).pages[0]
    out = PdfWriter()
    m, o = 10, 10                     # margin and overlap, mm
    cw, ch = A4L[0] - 2 * m, A4L[1] - 2 * m
    sw, sh = cw - o, ch - o
    cols = -(-(A1W - o) // sw); rows = -(-(A1H - o) // sh)
    cols, rows = int(cols), int(rows)
    out.add_page(guide(cols, rows, cw, ch, sw, sh, f'PlateLoop poster: A1 from {cols * rows} A4 sheets (home printer)', [
        'Print every sheet on A4 at 100% (Actual size, not "Fit"), landscape. Any printer works.',
        f'1. Lay the sheets out as numbered below: {cols} across, {rows} down.',
        '2. On every sheet except the left column, cut along the LEFT crop marks.',
        '3. On every sheet except the top row, cut along the TOP crop marks.',
        f'4. Slide each cut edge over its neighbour\'s {o} mm overlap until the picture lines up, then tape it from the back.',
        '5. Trim the white margins around the outside last. The finished poster is exactly 594 x 841 mm.']))
    n = 0
    for r in range(rows):
        for c in range(cols):
            n += 1
            x, y = c * sw, r * sh
            w, h = min(cw, A1W - x), min(ch, A1H - y)
            page = tile(src, x, y, w, h, *A4L, m, m)
            def marks(cv, r=r, c=c, w=w, h=h, n=n):
                PW, PH = A4L[0] * MM, A4L[1] * MM
                L, T = m * MM, PH - m * MM
                R, B = L + w * MM, T - h * MM
                cv.setStrokeColor(HexColor('#000000')); cv.setLineWidth(.5)
                def tick_v(x):  # vertical crop mark in the top and bottom margins
                    cv.line(x, T + 1.5 * MM, x, PH - 1 * MM); cv.line(x, B - 1.5 * MM, x, 1 * MM)
                def tick_h(y):
                    cv.line(L - 1.5 * MM, y, 1 * MM, y); cv.line(R + 1.5 * MM, y, PW - 1 * MM, y)
                for x in (L, R): tick_v(x)
                for y in (T, B): tick_h(y)
                cv.setStrokeColor(HexColor('#888888')); cv.setDash(2, 2)
                if c < cols - 1 and w >= cw: tick_v(R - o * MM)   # where the next sheet's cut edge lands
                if r < rows - 1 and h >= ch: tick_h(B + o * MM)
                cv.setDash()
                cv.setFont('Helvetica', 7.5); cv.setFillColor(HexColor('#444444'))
                cv.drawString(L, 3.2 * MM, f'PlateLoop A1 poster  |  sheet {n} of {cols * rows}  |  row {r + 1} of {rows}, column {c + 1} of {cols}  |  print at 100%')
                note = []
                if c > 0: note.append('cut the LEFT edge')
                if r > 0: note.append('cut the TOP edge')
                if note: cv.drawRightString(PW - m * MM, 3.2 * MM, ' and '.join(note) + ', then overlap')
            page.merge_page(overlay(*A4L, marks))
            out.add_page(page)
    p = os.path.join(POSTER, 'plateloop-poster-A1-home-printer.pdf'); out.write(p); return p

if __name__ == '__main__':
    for f in (exact(), home()):
        r = PdfReader(f); print(os.path.basename(f), len(r.pages), 'pages', f'{os.path.getsize(f) / 1e6:.1f} MB')
