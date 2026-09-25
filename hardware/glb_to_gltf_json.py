"""Convert a .glb into a single self-contained glTF JSON file (buffer embedded as base64).

Usage: python glb_to_gltf_json.py in.glb out.json
"""
import base64, json, struct, sys

src, dst = sys.argv[1], sys.argv[2]
data = open(src, 'rb').read()
magic, version, length = struct.unpack_from('<4sII', data, 0)
assert magic == b'glTF', 'not a GLB file'
off, gltf, binchunk = 12, None, b''
while off < length:
    clen, ctype = struct.unpack_from('<I4s', data, off)
    chunk = data[off + 8: off + 8 + clen]
    if ctype == b'JSON':
        gltf = json.loads(chunk.decode('utf-8'))
    elif ctype == b'BIN\x00':
        binchunk = chunk
    off += 8 + clen
gltf['buffers'][0]['uri'] = 'data:application/octet-stream;base64,' + base64.b64encode(binchunk).decode('ascii')
with open(dst, 'w', encoding='utf-8') as f:
    json.dump(gltf, f, separators=(',', ':'))
print(dst, len(open(dst, 'rb').read()))
