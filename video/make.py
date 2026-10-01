"""
Build the PlateLoop explainer video (video/plateloop-explainer.mp4).

  pip install selenium pillow numpy imageio-ffmpeg kokoro-onnx soundfile
  python video/make.py            # everything
  python video/make.py --no-frames  # narration + timeline only (for previewing film.html in a browser)

1. Narration: each sentence is spoken by Kokoro (open-source neural TTS, runs locally) into its own WAV.
2. Timeline: scene and subtitle times come from the real length of each sentence (build/timeline.js).
3. Frames: film.html is one long CSS animation; headless Chrome seeks it frame by frame.
4. Audio: narration + a soft generated pad, mixed with numpy.
5. ffmpeg joins frames and audio into an H.264 MP4.
"""
import json, os, subprocess, sys, time, wave, base64, shutil
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BUILD = os.path.join(HERE, 'build')
FPS = 30
VOICE = 'af_heart'   # Kokoro: warm American female
SPEED = 0.98
SR = 24000

# (scene id, [(spoken, subtitle)]): subtitles are shown on screen; the spoken line spells out numbers and names for the voice.
# Every number is checked against its source in docs/research.md, and the film shows the source on screen.
SCENES = [
    ('hook', [("Every school day, thousands of lunch trays come back half full.", "Every school day, thousands of lunch trays come back half full."),
              ("Nobody writes down what was left. It just goes in the bin.", "Nobody writes down what was left. It just goes in the bin."),
              ("And tomorrow, the kitchen cooks the same amount again.", "And tomorrow, the kitchen cooks the same amount again.")]),
    ('problem', [("In 2023, Singapore threw away seven hundred and fifty-five thousand tonnes of food. Only eighteen percent was recycled.", "In 2023, Singapore threw away 755,000 tonnes of food. Only 18% was recycled."),
                 ("Around the world, more than a quarter of food waste comes from canteens, caterers and restaurants.", "Around the world, more than a quarter of food waste comes from canteens, caterers and restaurants."),
                 ("The problem isn't that people don't care. It's that nobody can see what's actually being eaten.", "The problem isn’t that people don’t care. It’s that nobody can see what’s actually being eaten.")]),
    ('people', [("Wei Ling gets the same big scoop as everyone else, and she's told to finish it.", "Wei Ling gets the same big scoop as everyone else, and she’s told to finish it."),
                ("Mrs Lim runs the school canteen. She cooks by feel, and watches half the vegetables come back.", "Mrs Lim runs the school canteen. She cooks by feel, and watches half the vegetables come back."),
                ("And on a hospital ward, a nurse finds out days later that a patient has stopped eating.", "And on a hospital ward, a nurse finds out days later that a patient has stopped eating.")]),
    ('scanner', [("So we built PlateLoop. One scanner, two scans.", "So we built PlateLoop. One scanner, two scans."),
                 ("You look at the camera, and put your tray down before you eat, then again after.", "You look at the camera, and put your tray down before you eat, then again after."),
                 ("Six hundred and twenty grams served. Ninety-five left. That's five hundred and twenty-five grams eaten, dish by dish, in about two seconds.", "620 g served. 95 g left. That’s 525 g eaten, dish by dish, in about two seconds.")]),
    ('evidence', [("And measuring works.", "And measuring works."),
                  ("When eighty-six catering sites started tracking their food waste, they cut it by thirty-six percent in the first year, and got six dollars back for every dollar they spent.", "When 86 catering sites started tracking their food waste, they cut it by 36% in the first year, and got $6 back for every $1 spent.")]),
    ('kitchen', [("PlateLoop Kitchen does that tracking automatically, on every single tray.", "PlateLoop Kitchen does that tracking automatically, on every single tray."),
                 ("It shows which dishes come back, and plans tomorrow's order from real attendance, the weather and school events.", "It shows which dishes come back, and plans tomorrow’s order from real attendance, the weather and school events."),
                 ("And it keeps a carbon ledger of every kilogram saved.", "And it keeps a carbon ledger of every kilogram saved.")]),
    ('loopi', [("For students, there's Loopy. A virtual pet that only eats the lunch you really ate.", "For students, there’s Loopi: a virtual pet that only eats the lunch you really ate."),
               ("Waste less, and it stays healthy, earns hearts and levels up. It shows food groups, not calories, because counting calories can harm teenagers.", "Waste less, and it stays healthy, earns hearts and levels up. It shows food groups, not calories, because counting calories can harm teenagers."),
               ("And classes compete. In one school study, that alone cut plate waste by thirty-five percent.", "And classes compete. In one school study, that alone cut plate waste by 35%.")]),
    ('care', [("In hospitals, almost three in ten patients are malnourished, and hand-written food charts miss most of it.", "In hospitals, almost 3 in 10 patients are malnourished, and hand-written food charts miss most of it."),
              ("Loopy Care measures every tray, lets patients choose tomorrow's meals, and tells the nurse why a meal wasn't eaten.", "Loopi Care measures every tray, lets patients choose tomorrow’s meals, and tells the nurse why a meal wasn’t eaten.")]),
    ('work', [("And six in ten Singaporeans eat out most days.", "And 6 in 10 Singaporeans eat out most days."),
              ("Loopy Work turns a health goal into a daily pick from the office canteen. Pre-order to skip the queue, and a quick check-in at three p.m. shows which lunches leave you flat.", "Loopi Work turns a health goal into a daily pick from the office canteen. Pre-order to skip the queue, and a 3 pm check-in shows which lunches leave you flat.")]),
    ('impact', [("For one school serving eight hundred meals a day, a thirty percent cut, less than those caterers achieved, means five point seven tonnes of food saved,", "For one school serving 800 meals a day, a 30% cut, less than those caterers achieved, means 5.7 tonnes of food saved,"),
                ("and over twenty-eight thousand dollars back every year. PlateLoop pays for itself in under three months.", "and over S$28,000 back every year. PlateLoop pays for itself in under three months.")]),
    ('end', [("PlateLoop. Know what's eaten. Waste less.", "PlateLoop. Know what’s eaten. Waste less."),
             ("Try the live demo, and see it for yourself.", "Try the live demo, and see it for yourself.")]),
]
LEAD, GAP, TAIL = 0.7, 0.35, 0.9  # seconds before the first sentence, between sentences, after the last

def tts():
    """Speak every sentence into build/tts/<scene>_<n>.wav with Kokoro, an open-source neural voice that runs locally.
    Model files (kokoro-v1.0.onnx, voices-v1.0.bin) go in build/models; see the kokoro-onnx project's releases."""
    import soundfile as sf
    from kokoro_onnx import Kokoro
    out = os.path.join(BUILD, 'tts'); os.makedirs(out, exist_ok=True)
    k = Kokoro(os.path.join(BUILD, 'models', 'kokoro-v1.0.onnx'), os.path.join(BUILD, 'models', 'voices-v1.0.bin'))
    for sid, sents in SCENES:
        for i, (say, _) in enumerate(sents):
            x, sr = k.create(say, voice=VOICE, speed=SPEED, lang='en-us')
            sf.write(os.path.join(out, f'{sid}_{i}.wav'), x, sr, subtype='PCM_16')
            print('  voice', sid, i, f'{len(x) / sr:.1f}s')

def wav_len(p):
    with wave.open(p) as w: return w.getnframes() / w.getframerate()

def timeline():
    t, scenes = 0.0, []
    for sid, sents in SCENES:
        start, cur, subs = t, t + LEAD, []
        for i, (_, show) in enumerate(sents):
            n = wav_len(os.path.join(BUILD, 'tts', f'{sid}_{i}.wav'))
            subs.append({'t': round(cur, 3), 'len': round(n, 3), 'text': show, 'wav': f'{sid}_{i}.wav'})
            cur += n + GAP
        dur = cur - GAP + TAIL - start
        scenes.append({'id': sid, 's': round(start, 3), 'd': round(dur, 3), 'subs': subs})
        t += dur
    tl = {'total': round(t, 3), 'scenes': scenes}
    open(os.path.join(BUILD, 'timeline.js'), 'w', encoding='utf-8').write('window.TL = ' + json.dumps(tl, ensure_ascii=False) + ';\n')
    print(f'timeline: {t:.1f} s, {len(scenes)} scenes')
    return tl

def pad(total):
    """A quiet, slowly changing chord pad under the voice (Cmaj9, Am9, Fmaj9, G6)."""
    n = int(total * SR); t = np.arange(n) / SR; out = np.zeros(n)
    chords = [[48, 55, 59, 62, 64], [45, 52, 55, 59, 64], [41, 48, 52, 55, 60], [43, 50, 55, 59, 64]]
    seg = 8.0
    for k in range(int(total / seg) + 1):
        a, b = int(k * seg * SR), min(n, int((k + 1) * seg * SR + 2 * SR))
        if a >= n: break
        tt = t[a:b] - k * seg
        env = np.clip(tt / 2.5, 0, 1) * np.clip((seg + 2 - tt) / 2.5, 0, 1)
        for m in chords[k % 4]:
            f = 440 * 2 ** ((m - 69) / 12)
            for det in (-0.12, 0.12):
                out[a:b] += env * np.sin(2 * np.pi * f * (1 + det / 100) * tt + m) * (0.5 if m > 60 else 0.8)
    out *= 0.11 / max(1e-9, np.abs(out).max())
    fade = int(3 * SR); out[:fade] *= np.linspace(0, 1, fade); out[-fade:] *= np.linspace(1, 0, fade)
    return out

def audio(tl):
    total = tl['total']; n = int(total * SR) + SR
    voice = np.zeros(n)
    for sc in tl['scenes']:
        for s in sc['subs']:
            with wave.open(os.path.join(BUILD, 'tts', s['wav'])) as w:
                x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
            a = int(s['t'] * SR); voice[a:a + len(x)] += x[:max(0, n - a)]
    voice *= 0.89 / max(1e-9, np.abs(voice).max())  # even level across the neural voice
    music = pad(total + 1)
    # duck the music under the voice
    env = np.convolve(np.abs(voice), np.ones(SR // 4) / (SR // 4), mode='same')
    duck = 1 - 0.55 * np.clip(env * 12, 0, 1)
    mix = voice * 0.95 + music[:n] * duck
    mix = np.clip(mix, -1, 1)
    p = os.path.join(BUILD, 'audio.wav')
    with wave.open(p, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes())
    return p

def frames(tl):
    sys.path.insert(0, os.path.join(ROOT, 'tools'))
    from capture import serve, PORT
    from selenium import webdriver
    fdir = os.path.join(BUILD, 'frames'); shutil.rmtree(fdir, ignore_errors=True); os.makedirs(fdir)
    httpd = serve()
    o = webdriver.ChromeOptions()
    for a in ('--headless=new', '--hide-scrollbars', '--window-size=1920,1080'): o.add_argument(a)
    d = webdriver.Chrome(options=o)
    try:
        d.execute_cdp_cmd('Emulation.setDeviceMetricsOverride', {'width': 1920, 'height': 1080, 'deviceScaleFactor': 1, 'mobile': False})
        d.get(f'http://127.0.0.1:{PORT}/video/film.html?capture'); time.sleep(4)
        d.execute_script('window.FILM.prepare()')
        count = int(tl['total'] * FPS) + 1
        t0 = time.time()
        for i in range(count):
            d.execute_script('window.FILM.seek(arguments[0])', i / FPS * 1000)
            shot = d.execute_cdp_cmd('Page.captureScreenshot', {'format': 'jpeg', 'quality': 92, 'optimizeForSpeed': True})
            open(os.path.join(fdir, f'{i:05d}.jpg'), 'wb').write(base64.b64decode(shot['data']))
            if i % 300 == 0: print(f'  frame {i}/{count}  {time.time() - t0:.0f}s')
    finally:
        d.quit(); httpd.shutdown()
    return fdir

def encode(fdir, wav):
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    out = os.path.join(HERE, 'plateloop-explainer.mp4')
    subprocess.run([ff, '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(fdir, '%05d.jpg'), '-i', wav,
                    '-vf', 'scale=out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-profile:v', 'high', '-level', '4.1', '-color_range', 'tv', '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2',
                    '-shortest', '-movflags', '+faststart', out], check=True)
    print('wrote', out, f'{os.path.getsize(out) / 1e6:.1f} MB')
    # WebM too, for browsers without H.264 (some Chromium/Electron builds)
    webm = out[:-4] + '.webm'
    subprocess.run([ff, '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(fdir, '%05d.jpg'), '-i', wav, '-vf', 'scale=out_range=tv,format=yuv420p',
                    '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '34', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', '-c:a', 'libopus', '-b:a', '128k', '-ar', '48000', '-ac', '2', '-shortest', webm], check=True)
    print('wrote', webm, f'{os.path.getsize(webm) / 1e6:.1f} MB')

if __name__ == '__main__':
    os.makedirs(BUILD, exist_ok=True)
    if '--encode-only' in sys.argv:
        encode(os.path.join(BUILD, 'frames'), os.path.join(BUILD, 'audio.wav')); sys.exit()
    tts()
    tl = timeline()
    wav = audio(tl)
    if '--no-frames' not in sys.argv:
        encode(frames(tl), wav)
