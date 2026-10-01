"""
Export the A1 poster (poster/index.html) to a print-ready PDF and a PNG preview.

  pip install selenium
  python tools/poster.py

Writes poster/plateloop-poster-A1.pdf (vector text, 594 × 841 mm) and poster/plateloop-poster-A1.png.
"""
import base64, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from capture import serve, PORT, ROOT
from selenium import webdriver

W, H = 2245, 3179  # A1 at 96 px per inch

def main():
    httpd = serve()
    o = webdriver.ChromeOptions()
    for a in ('--headless=new', '--hide-scrollbars', f'--window-size={W},{H}'):
        o.add_argument(a)
    d = webdriver.Chrome(options=o)
    try:
        d.execute_cdp_cmd('Emulation.setDeviceMetricsOverride', {'width': W, 'height': H, 'deviceScaleFactor': 2, 'mobile': False})
        d.execute_cdp_cmd('Emulation.setEmulatedMedia', {'media': 'print'})
        d.get(f'http://127.0.0.1:{PORT}/poster/index.html')
        time.sleep(4)
        out = os.path.join(ROOT, 'poster')
        pdf = d.execute_cdp_cmd('Page.printToPDF', {'printBackground': True, 'preferCSSPageSize': True, 'marginTop': 0, 'marginBottom': 0, 'marginLeft': 0, 'marginRight': 0})
        open(os.path.join(out, 'plateloop-poster-A1.pdf'), 'wb').write(base64.b64decode(pdf['data']))
        png = d.execute_cdp_cmd('Page.captureScreenshot', {'format': 'png', 'clip': {'x': 0, 'y': 0, 'width': W, 'height': H, 'scale': 1}})
        open(os.path.join(out, 'plateloop-poster-A1.png'), 'wb').write(base64.b64decode(png['data']))
        over = d.execute_script("const p=document.querySelector('.poster');return [p.scrollHeight, p.clientHeight]")
        print('saved; content height vs page:', over)
    finally:
        d.quit(); httpd.shutdown()

if __name__ == '__main__':
    main()
