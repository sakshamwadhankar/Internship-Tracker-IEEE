import numpy as np
from PIL import Image
from scipy import ndimage
import os

img_path = r'C:\Users\omrai\.gemini\antigravity-ide\brain\fd550b6c-2ff9-4760-8925-df73c9a2e3d3\.user_uploaded\media_1791039831577.jpg'
img = Image.open(img_path)
arr = np.array(img.convert('RGB'))
r, g, b = arr[:,:,0].astype(int), arr[:,:,1].astype(int), arr[:,:,2].astype(int)

# Extract orange logo mask without any watermarks
mask = (r > 120) & ((r - b) > 80) & ((r - g) > 40)
labeled, num_features = ndimage.label(mask)

def trace_boundary(binary_mask):
    pad = np.pad(binary_mask, 1, mode='constant', constant_values=0)
    y, x = np.where(pad)
    start_y, start_x = y[0], x[0]
    dirs = [(-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1)]
    contour = []
    curr = (start_y, start_x)
    contour.append((curr[1] - 1, curr[0] - 1))
    back_dir = 6
    max_steps = 30000
    steps = 0
    while steps < max_steps:
        found = False
        start_search = (back_dir + 1) % 8
        for i in range(8):
            d_idx = (start_search + i) % 8
            dy, dx = dirs[d_idx]
            ny, nx = curr[0] + dy, curr[1] + dx
            if pad[ny, nx]:
                curr = (ny, nx)
                contour.append((curr[1] - 1, curr[0] - 1))
                back_dir = (d_idx + 4) % 8
                found = True
                break
        if not found or curr == (start_y, start_x):
            break
        steps += 1
    return np.array(contour[:-1])

def rdp_open(points, epsilon):
    if len(points) <= 2:
        return points
    start, end = points[0], points[-1]
    line_vec = end - start
    line_len = np.linalg.norm(line_vec)
    if line_len == 0:
        dists = np.linalg.norm(points - start, axis=1)
    else:
        line_unit = line_vec / line_len
        v = points - start
        proj = np.outer(np.dot(v, line_unit), line_unit)
        dists = np.linalg.norm(v - proj, axis=1)
    dmax = np.max(dists)
    index = np.argmax(dists)
    if dmax > epsilon:
        rec1 = rdp_open(points[:index+1], epsilon)
        rec2 = rdp_open(points[index:], epsilon)
        return np.vstack((rec1[:-1], rec2))
    else:
        return np.array([points[0], points[-1]])

def rdp_closed(points, epsilon):
    dists = np.linalg.norm(points - points[0], axis=1)
    furthest_idx = np.argmax(dists)
    arc1 = np.vstack([points[:furthest_idx+1]])
    arc2 = np.vstack([points[furthest_idx:], [points[0]]])
    s1 = rdp_open(arc1, epsilon)
    s2 = rdp_open(arc2, epsilon)
    return np.vstack([s1[:-1], s2[:-1]])

c1 = trace_boundary(labeled == 1)
c2 = trace_boundary(labeled == 2)

# Use epsilon = 0.7 for high precision contour fidelity
s1 = rdp_closed(c1, 0.7)
s2 = rdp_closed(c2, 0.7)

print(f"Contour 1 simplified points: {len(s1)}, Contour 2 simplified points: {len(s2)}")

# Center and scale to fit in 512x512 box with 52px padding
all_pts = np.vstack([s1, s2])
min_x, min_y = all_pts.min(axis=0)
max_x, max_y = all_pts.max(axis=0)
w = max_x - min_x
h = max_y - min_y

target_size = 512
padding = 56
draw_size = target_size - (2 * padding)
scale = draw_size / max(w, h)

# Center inside 512x512
offset_x = (target_size - w * scale) / 2 - min_x * scale
offset_y = (target_size - h * scale) / 2 - min_y * scale

s1_scaled = s1 * scale + [offset_x, offset_y]
s2_scaled = s2 * scale + [offset_x, offset_y]

def points_to_svg_d(pts):
    d = f"M {pts[0,0]:.1f} {pts[0,1]:.1f} "
    for p in pts[1:]:
        d += f"L {p[0]:.1f} {p[1]:.1f} "
    d += "Z"
    return d

d1 = points_to_svg_d(s1_scaled)
d2 = points_to_svg_d(s2_scaled)

svg_app_icon = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="pGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF7A30" />
      <stop offset="100%" stop-color="#FF5500" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="#0D0F0E" />
  <path d="{d1}" fill="url(#pGrad)" />
  <path d="{d2}" fill="url(#pGrad)" />
</svg>
'''

svg_favicon = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="pFavGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF7A30" />
      <stop offset="100%" stop-color="#FF5500" />
    </linearGradient>
  </defs>
  <path d="{d1}" fill="url(#pFavGrad)" />
  <path d="{d2}" fill="url(#pFavGrad)" />
</svg>
'''

# Write to public/icon.svg and public/favicon.svg
pub_icon = r'c:\Users\omrai\OneDrive\Documents\GitHub\Ptracker\public\icon.svg'
pub_fav = r'c:\Users\omrai\OneDrive\Documents\GitHub\Ptracker\public\favicon.svg'

with open(pub_icon, 'w', encoding='utf-8') as f:
    f.write(svg_app_icon)

with open(pub_fav, 'w', encoding='utf-8') as f:
    f.write(svg_favicon)

print("Icons generated successfully in public/!")
