"""
Build the six PlateLoop apps as self-contained HTML files.

  python build.py <out_dir>

Outputs six separate apps: 1-plateloop-scanner-3d.html, 2-plateloop-kiosk.html,
3-plateloop-kitchen.html, 4-loopi-student-app.html, 5-loopi-care-hospital.html and
6-loopi-kids-kindergarten.html. They have no shared navigation.
Each file inlines the CSS, the shared core + game rules and its own app, so it runs by
double-clicking. scanner-3d.html also embeds three.js, the 3D model and the renders, so it
works offline. All six share one demo save in the browser, so a tray scanned on the scanner
screen shows up in the kitchen and student apps open in other tabs.
"""
import base64, io, os, sys
from PIL import Image

SRC = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(SRC, 'dist'))
os.makedirs(OUT, exist_ok=True)
read = lambda p: open(os.path.join(SRC, p), encoding='utf-8').read()

PAGES = {
    'model':   ('1-plateloop-scanner-3d.html', 'PlateLoop Scanner',  ['vendor/three.min.js', 'vendor/GLTFLoader.js', 'js/model.js']),
    'scanner': ('2-plateloop-kiosk.html',      'PlateLoop Kiosk',    ['js/scanner.js']),
    'kitchen': ('3-plateloop-kitchen.html',    'PlateLoop Kitchen',  ['js/kitchen.js']),
    'student': ('4-loopi-student-app.html',    'Loopi',              ['js/room.js', 'js/student.js']),
    'care':    ('5-loopi-care-hospital.html',  'Loopi Care',         ['js/health.js', 'js/care.js']),
    'kids':    ('6-loopi-kids-kindergarten.html', 'Loopi Kids',      ['js/room.js', 'js/health.js', 'js/kids.js']),
}
FILES = {k: v[0] for k, v in PAGES.items()}

def jpeg(png, width=1400, quality=82):
    im = Image.open(os.path.join(SRC, png)).convert('RGB')
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'JPEG', quality=quality, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')
IMAGES = {n: jpeg(n) for n in ('render_scanner_hero.png', 'render_scanner_detail.png')}

def inline(path):
    s = read(path)
    for n, uri in IMAGES.items():
        s = s.replace(f'src="{n}"', f'src="{uri}"')
    assert '</script' not in s.lower(), path
    return s

BOOT = """
(() => {
  const APP = %(app)r, FILES = %(files)s;
  const go = n => { location.href = FILES[n]; };
  PL.open = go;
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const n = a.getAttribute('href').slice(1); if (FILES[n]) { e.preventDefault(); go(n); }
  });
  if (/[?&]demo=lunch\\b/.test(location.search) && PL.cls32Scanned() === 0) { PL.scanRestOfClass(); PL.store.save('scan'); }
  const app = PL.apps[APP];
  document.body.dataset.app = APP;
  app.mount(document.getElementById('root'));
  PL.store.subscribe((kind, fromSelf) => { if (app.update) app.update(kind, fromSelf); });
  let t = 0; setInterval(() => { t++; if (app.tick) app.tick(t); }, 480);
})();
"""
css = read('css/apple.css')
fonts = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Silkscreen&display=swap">')
for app, (fname, title, scripts) in PAGES.items():
    parts = ['<!doctype html>', '<html lang="en">', '<head>', '<meta charset="utf-8">',
             '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
             f'<title>{title}</title>', fonts, f'<style>\n{css}\n</style>', '</head>', '<body>', '<div id="root"></div>',
             '<noscript>PlateLoop needs JavaScript to run.</noscript>']
    if app == 'model':
        m = read('scanner.gltf.json'); assert '</script' not in m.lower()
        parts.append(f'<script type="application/json" id="model-scanner">{m}</script>')
    for p in ['js/core.js', 'js/game.js'] + scripts:
        parts.append(f'<script>\n/* ---- {p} ---- */\n{inline(p)}\n</script>')
    parts.append(f'<script>{BOOT % {"app": app, "files": FILES}}</script>')
    parts += ['</body>', '</html>']
    html = '\n'.join(parts)
    open(os.path.join(OUT, fname), 'w', encoding='utf-8', newline='\n').write(html)
    print(f'{fname:22s} {len(html.encode("utf-8")) / 1024:7.0f} KB')
