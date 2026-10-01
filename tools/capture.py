"""
Capture fresh screenshots of every PlateLoop app in good demo states.

  pip install selenium pillow
  python tools/capture.py

Starts a local server, opens each app in headless Chrome, drives it with the apps' own demo functions
(scan a tray, open a tab, claim a challenge) and saves:
  video/shots/*.jpg       2x shots used by the explainer video
  docs/screenshots/*.jpg  1600-wide shots used by the README
"""
import http.server, io, os, socketserver, sys, threading, time
from PIL import Image
from selenium import webdriver

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS, DOCS = os.path.join(ROOT, 'video', 'shots'), os.path.join(ROOT, 'docs', 'screenshots')
PORT = 8799
W, H = 1600, 1000

class Quiet(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(self, *a): pass

def serve():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.ThreadingTCPServer(('127.0.0.1', PORT), Quiet)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd

def browser():
    o = webdriver.ChromeOptions()
    for a in ('--headless=new', f'--window-size={W},{H}', '--force-device-scale-factor=2', '--hide-scrollbars',
              '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'):
        o.add_argument(a)
    d = webdriver.Chrome(options=o)
    d.set_window_size(W, H)
    d.execute_cdp_cmd('Emulation.setDeviceMetricsOverride', {'width': W, 'height': H, 'deviceScaleFactor': 2, 'mobile': False})
    return d

def save(png, name, crop=None, readme=False):
    im = Image.open(io.BytesIO(png)).convert('RGB')
    if crop: im = im.crop(crop)
    os.makedirs(SHOTS, exist_ok=True)
    im.save(os.path.join(SHOTS, name + '.jpg'), 'JPEG', quality=88, optimize=True)
    if readme:
        os.makedirs(DOCS, exist_ok=True)
        r = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS) if im.width > 1600 else im
        r.save(os.path.join(DOCS, name + '.jpg'), 'JPEG', quality=84, optimize=True)
    print('  saved', name, im.size)

def phone_box(d, sel='.phone', pad=24):
    r = d.execute_script(f"const r=document.querySelector('{sel}').getBoundingClientRect();return [r.left,r.top,r.right,r.bottom]")
    return tuple(int(v * 2) for v in (r[0] - pad, max(0, r[1] - pad), r[2] + pad, min(H, r[3] + pad)))

def js(d, code, wait=0.0):
    out = d.execute_script(code)
    if wait: time.sleep(wait)
    return out

def open_app(d, path, wait=2.5, intro=None):
    d.get(f'http://127.0.0.1:{PORT}/{path}')
    js(d, "localStorage.clear(); " + (f"localStorage.setItem('plateloop-intro-{intro}','1');" if intro else ''))
    d.get(f'http://127.0.0.1:{PORT}/{path}')
    time.sleep(wait)

def run():
    httpd = serve()
    d = browser()
    try:
        print('landing'); open_app(d, 'index.html', 2.5)
        save(d.get_screenshot_as_png(), '0-landing', readme=True)

        print('prototype'); open_app(d, 'dist/1-plateloop-scanner-3d.html', 6)
        save(d.get_screenshot_as_png(), '1-prototype', readme=True)
        open_app(d, 'dist/1-plateloop-scanner-3d.html?kiosk', 9)
        save(d.get_screenshot_as_png(), '2-kiosk', readme=True)

        print('kitchen'); open_app(d, 'dist/3-plateloop-kitchen.html', 3, 'kitchen')
        save(d.get_screenshot_as_png(), '3-kitchen', readme=True)
        for view in ('plan', 'dishes', 'carbon'):
            js(d, f"(document.querySelector('[data-view=\"{view}\"]')||document.querySelector('[data-go=\"{view}\"]')||{{click(){{}}}}).click()", 1.6)
            save(d.get_screenshot_as_png(), f'3-kitchen-{view}')

        print('loopi'); open_app(d, 'dist/4-loopi-student-app.html', 2.5, 'loopi')
        save(d.get_screenshot_as_png(), '4-loopi', readme=True)
        save(d.get_screenshot_as_png(), '4-loopi-phone', phone_box(d))
        js(d, "document.querySelector('#stu-scan').click()", 1)
        js(d, "document.querySelector('#stu-scan').click()", 2.5)
        js(d, "document.querySelector('[data-close]') && document.querySelector('[data-close]').click(); document.querySelectorAll('.pnote,.notif').forEach(n=>n.remove())", 1)
        save(d.get_screenshot_as_png(), '4-loopi-lunch-phone', phone_box(d))
        js(d, "document.querySelector('.acts [data-home=feed]').click()", 4.5)
        js(d, "document.querySelector('#stu-body').scrollTop = document.querySelector('.mission').offsetTop - 10", 1.2)
        save(d.get_screenshot_as_png(), '4-loopi-mission-phone', phone_box(d))
        js(d, "document.querySelector('#stu-body').scrollTop = document.querySelector('.chal').offsetTop - 10", 1.2)
        save(d.get_screenshot_as_png(), '4-loopi-challenges-phone', phone_box(d))
        js(d, "document.querySelector('[data-tab=ranks]').click()", 1.8)
        save(d.get_screenshot_as_png(), '4-loopi-race-phone', phone_box(d))

        print('care'); open_app(d, 'dist/5-loopi-care-hospital.html', 2.5, 'care')
        js(d, "const s=document.querySelector('#care-preset'); s.value='Barely ate'; s.dispatchEvent(new Event('change')); document.querySelector('#care-serve').click()", 1)
        js(d, "document.querySelector('#care-serve').click()", 2.5)
        save(d.get_screenshot_as_png(), '5-care', readme=True)
        save(d.get_screenshot_as_png(), '5-care-phone', phone_box(d))
        js(d, "document.querySelector('[data-tab=menu]').click()", 1.5)
        save(d.get_screenshot_as_png(), '5-care-menu-phone', phone_box(d))

        print('work'); open_app(d, 'dist/7-loopi-work-office.html', 2.5, 'work')
        js(d, "document.querySelector('#pre-go').click()", 1.2)
        js(d, "document.querySelector('.ticket').scrollIntoView({block:'center'})", 1)
        save(d.get_screenshot_as_png(), '7-work', readme=True)
        save(d.get_screenshot_as_png(), '7-work-phone', phone_box(d))
        js(d, "document.querySelector('[data-tab=report]').click()", 1)
        js(d, "document.querySelector('#work-body').scrollTop = document.querySelector('.en-week').offsetTop - 10", 1.8)
        save(d.get_screenshot_as_png(), '7-work-energy-phone', phone_box(d))

        print('lunch rush'); open_app(d, 'dist/8-plateloop-lunch-rush-3d.html', 8)
        save(d.get_screenshot_as_png(), '8-lunch-rush', readme=True)

        print('pitch'); d.get(f'http://127.0.0.1:{PORT}/pitch/index.html#1'); time.sleep(3)
        save(d.get_screenshot_as_png(), '9-pitch', readme=True)
    finally:
        d.quit(); httpd.shutdown()

if __name__ == '__main__':
    run()
