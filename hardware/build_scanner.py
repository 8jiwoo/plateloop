"""
PlateLoop Scanner: one station that scans each tray twice, BEFORE lunch (what was served) and
AFTER lunch (what is left). eaten = before - after.

Run headless:
  blender --background --python build_scanner.py -- <out_dir> [--no-render]
Outputs: plateloop_scanner.blend, scanner.glb, render_scanner_hero.png, render_scanner_detail.png
Units are metres; the front faces -Y.
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = os.path.abspath(argv[0]) if argv else os.path.dirname(os.path.abspath(__file__))
DO_RENDER = "--no-render" not in argv
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'

# ---------------------------------------------------------------- palette (matches the web app)
def hex_rgb(h):
    h = h.lstrip('#')
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, 1.0)

C = {
    'shell':   hex_rgb('#EEF2EE'),
    'ink':     hex_rgb('#1B2A23'),
    'mint':    hex_rgb('#17A673'),
    'persim':  hex_rgb('#FF7A45'),
    'sun':     hex_rgb('#FFC83D'),
    'steel':   hex_rgb('#B9C2BE'),
    'rubber':  hex_rgb('#2B3431'),
    'lcd':     hex_rgb('#C9D9B1'),
}

# ---------------------------------------------------------------- materials
_mats = {}
def mat(name, color, metallic=0.0, rough=0.5, emit=None, strength=0.0, alpha=1.0, coat=0.0):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    m.diffuse_color = color
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    def setin(key, val):
        s = bsdf.inputs.get(key)
        if s is not None:
            s.default_value = val
    setin('Base Color', color)
    setin('Metallic', metallic)
    setin('Roughness', rough)
    setin('Coat Weight', coat)
    if emit is not None:
        setin('Emission Color', emit)
        setin('Emission Strength', strength)
    if alpha < 1.0:
        setin('Alpha', alpha)
        for attr, val in (('surface_render_method', 'BLENDED'), ('blend_method', 'BLEND')):
            try:
                setattr(m, attr, val)
            except Exception:
                pass
    _mats[name] = m
    return m

M_SHELL  = lambda: mat('Shell',   C['shell'], rough=0.35, coat=0.3)
M_INK    = lambda: mat('Ink',     C['ink'], rough=0.45)
M_GLOSS  = lambda: mat('Glass_Dark', C['ink'], rough=0.08, coat=1.0)
M_MINT   = lambda: mat('Mint',    C['mint'], rough=0.4)
M_LED    = lambda: mat('LED_Mint', C['mint'], emit=C['mint'], strength=6.0)
M_STEEL  = lambda: mat('Steel',   C['steel'], metallic=1.0, rough=0.28)
M_RUBBER = lambda: mat('Rubber',  C['rubber'], rough=0.8)
M_WHITE  = lambda: mat('Label_White', (0.9, 0.93, 0.9, 1), rough=0.5)
M_GLASS  = lambda: mat('Sneeze_Glass', (0.85, 0.95, 0.95, 1), rough=0.02, alpha=0.18)
M_LENS   = lambda: mat('Lens', (0.02, 0.03, 0.06, 1), rough=0.02, coat=1.0)
M_IR     = lambda: mat('IR_Emitter', (0.3, 0.02, 0.02, 1), emit=(1, 0.1, 0.05, 1), strength=2.0)

# ---------------------------------------------------------------- geometry helpers
def _normalize(bm, dims):
    xs = [v.co.x for v in bm.verts]; ys = [v.co.y for v in bm.verts]; zs = [v.co.z for v in bm.verts]
    cx, cy, cz = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, (max(zs) + min(zs)) / 2
    ex, ey, ez = max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)
    for v in bm.verts:
        v.co.x = (v.co.x - cx) * (dims[0] / ex if ex else 1)
        v.co.y = (v.co.y - cy) * (dims[1] / ey if ey else 1)
        v.co.z = (v.co.z - cz) * (dims[2] / ez if ez else 1)

def _finish(name, bm, loc, rot, material, parent, smooth, bevel):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = rot
    if material:
        me.materials.append(material)
    if bevel:
        mod = ob.modifiers.new('Bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 4
        mod.limit_method = 'ANGLE'
        try:
            mod.harden_normals = True
        except Exception:
            pass
    if parent:
        ob.parent = parent
    return ob

def box(name, dims, loc, material, parent=None, bevel=0.0, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    _normalize(bm, dims)
    return _finish(name, bm, loc, rot, material, parent, smooth=bool(bevel), bevel=bevel)

def cyl(name, r, h, loc, material, parent=None, rot=(0, 0, 0), seg=40, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=1, radius2=1, depth=1)
    _normalize(bm, (2 * r, 2 * r, h))
    ob = _finish(name, bm, loc, rot, material, parent, smooth=True, bevel=bevel)
    return ob

def blob(name, dims, loc, material, parent=None, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=28, v_segments=14, radius=1)
    _normalize(bm, dims)
    return _finish(name, bm, loc, rot, material, parent, smooth=True, bevel=0)

def plane(name, w, h, loc, material, parent=None, rot=(0, 0, 0)):
    bm = bmesh.new()
    bm.loops.layers.uv.new('UVMap')
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1, calc_uvs=True)
    _normalize(bm, (w, h, 0))
    return _finish(name, bm, loc, rot, material, parent, smooth=False, bevel=0)

FONT = None
for fp in ('C:/Windows/Fonts/segoeuib.ttf', 'C:/Windows/Fonts/arialbd.ttf'):
    if os.path.exists(fp):
        try:
            FONT = bpy.data.fonts.load(fp); break
        except Exception:
            pass

def text(name, body, size, loc, material, parent=None, rot=(math.pi / 2, 0, 0), extrude=0.0015):
    cu = bpy.data.curves.new(name + '_curve', 'FONT')
    cu.body = body; cu.size = size; cu.extrude = extrude
    cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
    if FONT:
        cu.font = FONT
    tmp = bpy.data.objects.new(name + '_tmp', cu)
    scene.collection.objects.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    me.name = name
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    ob.location = loc; ob.rotation_euler = rot
    me.materials.append(material)
    if parent:
        ob.parent = parent
    return ob

def root(name):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = 'PLAIN_AXES'
    scene.collection.objects.link(e)
    return e

# ---------------------------------------------------------------- pet screen texture (pixel LCD)
PET = [
    "......LL.LL.....",
    ".......LLL......",
    "........#.......",
    ".....######.....",
    "....#......#....",
    "...#........#...",
    "..#..##..##..#..",
    "..#..##..##..#..",
    "..#..........#..",
    "..#.#......#.#..",
    "..#..######..#..",
    "...#........#...",
    "....##....##....",
    "....#.#..#.#....",
]

def pet_image():
    W, H = 96, 62
    img = bpy.data.images.new('PetScreen', W, H, alpha=False)
    lcd = (0.79, 0.85, 0.69, 1.0)
    ink = (0.13, 0.19, 0.12, 1.0)
    px = [lcd] * (W * H)
    def put(x, y, col):
        if 0 <= x < W and 0 <= y < H:
            px[(H - 1 - y) * W + x] = col
    s = 3
    ox, oy = (W - 16 * s) // 2, 6
    for r, row in enumerate(PET):
        for c, ch in enumerate(row):
            if ch != '.':
                for dx in range(s):
                    for dy in range(s):
                        put(ox + c * s + dx, oy + r * s + dy, ink)
    # energy bar along the bottom
    for x in range(10, 86):
        put(x, 53, ink); put(x, 58, ink)
    for y in range(53, 59):
        put(10, y, ink); put(85, y, ink)
    for x in range(12, 66):
        for y in range(55, 57):
            put(x, y, ink)
    # little hearts
    heart = [".#.#.", "#####", ".###.", "..#.."]
    for hx, hy in ((8, 8), (80, 12)):
        for r, row in enumerate(heart):
            for c, ch in enumerate(row):
                if ch == '#':
                    put(hx + c, hy + r, ink)
    img.pixels = [ch for p in px for ch in p]
    img.pack()
    m = bpy.data.materials.new('PetScreen')
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img; tex.interpolation = 'Closest'
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Emission Color'])
    bsdf.inputs['Emission Strength'].default_value = 0.9
    bsdf.inputs['Roughness'].default_value = 0.2
    return m

# ---------------------------------------------------------------- food tray (steel school canteen tray)
FOODS = {
    'rice':     hex_rgb('#F3EEDC'),
    'chicken':  hex_rgb('#9C5A2E'),
    'soup':     hex_rgb('#B9793A'),
    'kailan':   hex_rgb('#2F6B2A'),
    'cabbage':  hex_rgb('#CFE0A0'),
    'melon':    hex_rgb('#F2545B'),
}

def tray(name, loc, parent, eaten=None):
    """eaten: dict food->fraction remaining (1 = full). None = full serve tray."""
    t = root(name); t.parent = parent; t.location = loc
    W, D, base, rim = 0.38, 0.28, 0.004, 0.02
    st = M_STEEL()
    box(name + '_Base', (W, D, base), (0, 0, base / 2), st, t, bevel=0.002)
    for i, (dims, p) in enumerate((
        ((W, 0.006, rim), (0, D / 2 - 0.003, rim / 2)),
        ((W, 0.006, rim), (0, -D / 2 + 0.003, rim / 2)),
        ((0.006, D, rim), (W / 2 - 0.003, 0, rim / 2)),
        ((0.006, D, rim), (-W / 2 + 0.003, 0, rim / 2)),
        ((W, 0.004, rim * 0.8), (0, 0.03, rim * 0.4)),          # row divider
        ((0.004, D / 2 - 0.03, rim * 0.8), (-W / 6, 0.03 + (D / 2 - 0.03) / 2, rim * 0.4)),
        ((0.004, D / 2 - 0.03, rim * 0.8), (W / 6, 0.03 + (D / 2 - 0.03) / 2, rim * 0.4)),
        ((0.004, D / 2 + 0.03, rim * 0.8), (-W / 6, -(D / 2 + 0.03) / 2 + 0.03, rim * 0.4)),
        ((0.004, D / 2 + 0.03, rim * 0.8), (W / 6, -(D / 2 + 0.03) / 2 + 0.03, rim * 0.4)),
    )):
        box(f'{name}_Rim{i}', dims, p, st, t, bevel=0.0015)
    # compartment centres: back row small sides, front row mains
    slots = {
        'kailan': (-W / 3, 0.085), 'cabbage': (0, 0.085), 'melon': (W / 3, 0.085),
        'rice': (-W / 3, -0.055), 'chicken': (0, -0.055), 'soup': (W / 3, -0.055),
    }
    size = {'kailan': (0.085, 0.07, 0.035), 'cabbage': (0.08, 0.065, 0.035), 'melon': (0.085, 0.07, 0.04),
            'rice': (0.105, 0.13, 0.065), 'chicken': (0.105, 0.12, 0.045), 'soup': (0.105, 0.14, 0.014)}
    for food, (x, y) in slots.items():
        k = 1.0 if eaten is None else eaten.get(food, 1.0)
        if k <= 0.02:
            continue
        sx, sy, sz = size[food]
        f = k ** 0.5
        dims = (sx * f, sy * f, sz * max(k, 0.3))
        rough = 0.15 if food == 'soup' else 0.6
        blob(f'{name}_{food}', dims, (x, y, base + dims[2] / 2 * 0.9),
             mat('Food_' + food, FOODS[food], rough=rough), t)
    return t

# ---------------------------------------------------------------- RGB-D camera head
def camera_head(name, loc, parent):
    h = root(name); h.parent = parent; h.location = loc
    box(name + '_Body', (0.17, 0.08, 0.035), (0, 0, 0), M_GLOSS(), h, bevel=0.012)
    for i, x in enumerate((-0.045, 0.045)):
        cyl(f'{name}_Lens{i}', 0.013, 0.006, (x, 0, -0.019), M_LENS(), h)
        cyl(f'{name}_LensRing{i}', 0.017, 0.003, (x, 0, -0.0175), M_STEEL(), h)
    cyl(name + '_IR', 0.006, 0.004, (0, 0, -0.018), M_IR(), h)
    cyl(name + '_RGB', 0.009, 0.005, (0.0, 0.022, -0.018), M_LENS(), h)
    return h

# ================================================================= RETURN SCAN STATION
# ================================================================= Apple-style finish
C.update({'shell': hex_rgb('#F5F5F7'), 'alu': hex_rgb('#C7CACF'), 'ink': hex_rgb('#1D1D1F'), 'green': hex_rgb('#34C759'), 'label': hex_rgb('#8E8E93')})
M_SHELL = lambda: mat('Shell_Satin', C['shell'], rough=0.3, coat=0.15)
M_ALU = lambda: mat('Aluminium', C['alu'], metallic=0.9, rough=0.3)
M_INK = lambda: mat('Graphite', C['ink'], rough=0.5)
M_GLOSS = lambda: mat('Black_Glass', C['ink'], rough=0.06, coat=1.0)
M_LED = lambda: mat('LED_Green', C['green'], emit=C['green'], strength=5.0)
M_GREEN = lambda: mat('Green', C['green'], rough=0.4)
M_LABEL = lambda: mat('Label_Gray', C['label'], rough=0.5)
M_RUBBER = lambda: mat('Pad', hex_rgb('#3A3A3C'), rough=0.85)

def build_scanner():
    R = root('PlateLoopScanner')
    shell, alu = M_SHELL(), M_ALU()
    # main cabinet: soft, rounded, one colour
    box('PS_Plinth', (0.76, 0.40, 0.05), (0, 0.02, 0.025), M_INK(), R, bevel=0.012)
    box('PS_Cabinet', (0.80, 0.46, 0.81), (0, 0, 0.455), shell, R, bevel=0.06)
    text('PS_Logo', 'PlateLoop', 0.05, (0.08, -0.2335, 0.62), M_LABEL(), R)
    box('PS_StatusLine', (0.40, 0.004, 0.006), (0.08, -0.2325, 0.80), M_LED(), R)
    # weighing platform (aluminium frame, dark pad) with the tray on it
    box('PS_ScaleFrame', (0.52, 0.34, 0.02), (0.08, -0.04, 0.87), alu, R, bevel=0.008)
    box('PS_ScalePad', (0.48, 0.30, 0.008), (0.08, -0.04, 0.881), M_RUBBER(), R, bevel=0.004)
    # camera column and arm
    box('PS_Column', (0.11, 0.08, 0.72), (0.08, 0.175, 1.22), alu, R, bevel=0.03)
    box('PS_Arm', (0.12, 0.40, 0.05), (0.08, 0.02, 1.555), alu, R, bevel=0.022)
    box('PS_ArmLight', (0.09, 0.004, 0.008), (0.08, -0.1815, 1.545), M_LED(), R)
    camera_head('PS_Camera', (0.08, -0.10, 1.51), R)
    # tablet-style screen at a child's eye height
    cyl('PS_ScreenStalk', 0.018, 0.26, (-0.28, 0.06, 0.99), alu, R)
    pod = root('PS_ScreenPod'); pod.parent = R; pod.location = (-0.28, 0.05, 1.17)
    pod.rotation_euler = (math.radians(-16), 0, math.radians(-8))
    box('PS_ScreenBody', (0.28, 0.018, 0.19), (0, 0, 0), alu, pod, bevel=0.016)
    box('PS_ScreenGlass', (0.272, 0.004, 0.182), (0, -0.008, 0), M_GLOSS(), pod, bevel=0.012)
    plane('ReturnScreen', 0.245, 0.158, (0, -0.0104, 0.0), pet_image(), pod, rot=(math.pi / 2, 0, 0))
    # face camera on top of the screen: the only way students sign in (no cards, no QR codes)
    face = root('PS_FaceCam'); face.parent = pod; face.location = (0, -0.002, 0.112)
    box('PS_FaceCamBody', (0.12, 0.03, 0.032), (0, 0, 0), M_GLOSS(), face, bevel=0.012)
    front = (math.pi / 2, 0, 0)
    cyl('PS_FaceRing', 0.0115, 0.002, (0, -0.0152, 0), M_LED(), face, rot=front, seg=48)
    cyl('PS_FaceLens', 0.0085, 0.003, (0, -0.016, 0), M_LENS(), face, rot=front, seg=48)
    for i, x in enumerate((-0.036, 0.036)):
        cyl(f'PS_FaceIR{i}', 0.0045, 0.002, (x, -0.0155, 0), M_IR(), face, rot=front)
    # food waste bin
    box('PS_BinPlinth', (0.33, 0.40, 0.05), (0.585, 0.02, 0.025), M_INK(), R, bevel=0.012)
    box('PS_Bin', (0.36, 0.46, 0.81), (0.585, 0, 0.455), shell, R, bevel=0.06)
    cyl('PS_BinRing', 0.12, 0.006, (0.585, -0.01, 0.861), M_LABEL(), R, seg=64)
    cyl('PS_BinHole', 0.105, 0.008, (0.585, -0.01, 0.8625), M_INK(), R, seg=64)
    text('PS_BinLabel', 'Food waste', 0.03, (0.585, -0.2335, 0.62), M_LABEL(), R)
    tray('PS_Tray', (0.08, -0.04, 0.885), R,
         eaten={'rice': 0.25, 'chicken': 0.0, 'soup': 0.35, 'kailan': 0.7, 'cabbage': 0.4, 'melon': 0.0})
    return R

scanner = build_scanner()

def select_tree(r):
    for o in scene.objects:
        o.select_set(False)
    stack = [r]
    while stack:
        o = stack.pop(); o.select_set(True); stack.extend(o.children)
    bpy.context.view_layer.objects.active = r

select_tree(scanner)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'scanner.glb'), export_format='GLB', use_selection=True, export_apply=True)

# ---------------------------------------------------------------- white studio
plane('Floor', 14, 14, (0, 0, 0), mat('Floor', hex_rgb('#E8E8ED'), rough=0.9))
plane('Backdrop', 14, 6, (0, 1.5, 3), mat('Backdrop', hex_rgb('#F2F2F5'), rough=0.95), rot=(math.pi / 2, 0, 0))
world = bpy.data.worlds.new('World'); scene.world = world
try:
    world.use_nodes = True
except Exception:
    pass
bg = next((n for n in world.node_tree.nodes if n.type == 'BACKGROUND'), None)
if bg:
    bg.inputs['Color'].default_value = (0.92, 0.92, 0.94, 1)
    bg.inputs['Strength'].default_value = 0.45

def area(name, loc, target, energy, size):
    ld = bpy.data.lights.new(name, 'AREA'); ld.energy = energy; ld.size = size
    lo = bpy.data.objects.new(name, ld); scene.collection.objects.link(lo); lo.location = loc
    lo.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()

area('Key', (-1.8, -2.4, 3.0), (0.1, 0, 0.9), 380, 3.0)
area('Fill', (2.6, -2.0, 1.6), (0.1, 0, 0.9), 140, 3.0)
area('Top', (0.2, -0.2, 3.2), (0.1, 0, 0.9), 160, 2.0)
try:
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
except Exception:
    pass

cam_d = bpy.data.cameras.new('Cam'); cam = bpy.data.objects.new('Cam', cam_d)
scene.collection.objects.link(cam); scene.camera = cam

def shoot(fname, loc, target, lens):
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    cam_d.lens = lens
    scene.render.filepath = os.path.join(OUT, fname)
    bpy.ops.render.render(write_still=True)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'plateloop_scanner.blend'))

if DO_RENDER:
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1600, 1100
    scene.render.image_settings.file_format = 'PNG'
    shoot('render_scanner_hero.png', (1.6, -2.9, 1.75), (0.14, 0, 0.82), 42)
    shoot('render_scanner_detail.png', (0.75, -1.25, 1.7), (-0.02, -0.02, 1.0), 38)

print('PLATELOOP_BUILD_OK', OUT)
