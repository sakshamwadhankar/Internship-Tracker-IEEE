import numpy as np
from PIL import Image, ImageDraw
import re

with open('public/icon.svg', 'r') as f:
    svg = f.read()

paths = re.findall(r'<path d="(.*?)"', svg)

def parse_svg_path(d):
    tokens = d.strip().split()
    pts = []
    i = 0
    while i < len(tokens):
        if tokens[i] in ['M', 'L']:
            pts.append((float(tokens[i+1]), float(tokens[i+2])))
            i += 3
        elif tokens[i] == 'Z':
            break
        else:
            i += 1
    return pts

pts1 = parse_svg_path(paths[0])
pts2 = parse_svg_path(paths[1])

SCALE = 4
SIZE = 512 * SCALE
img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

r = int(112 * SCALE)
draw.rounded_rectangle([0, 0, SIZE, SIZE], radius=r, fill=(13, 15, 14, 255))

orange_color = (255, 100, 32, 255)
scaled_pts1 = [(p[0] * SCALE, p[1] * SCALE) for p in pts1]
scaled_pts2 = [(p[0] * SCALE, p[1] * SCALE) for p in pts2]

draw.polygon(scaled_pts1, fill=orange_color)
draw.polygon(scaled_pts2, fill=orange_color)

img_512 = img.resize((512, 512), Image.Resampling.LANCZOS)
img_512.save('public/icon-512.png', 'PNG')

img_192 = img.resize((192, 192), Image.Resampling.LANCZOS)
img_192.save('public/icon-192.png', 'PNG')

print("Rasterized 512 and 192 icons successfully")
