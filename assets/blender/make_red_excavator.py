"""Export a red-team texture variant of the supplied excavator.

Run after prepare_supplied_excavator.py. Only the saturated painted-blue
areas of base-color maps change; glass, dark tracks, white cab and orange
hardware keep their source colors and all rig pivots remain identical.
"""

from pathlib import Path
import bpy
import numpy as np


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets/vehicles/excavator/source/excavator.blend"
OUTPUT = ROOT / "public/models/excavator-red.glb"
ARCHIVE = ROOT / "assets/vehicles/excavator/export/excavator-red.glb"

bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
changed = 0
for image in bpy.data.images:
    if not image.name.endswith("_basecolor"):
        continue
    pixels = np.empty(len(image.pixels), dtype=np.float32)
    image.pixels.foreach_get(pixels)
    rgba = pixels.reshape((-1, 4))
    red, green, blue = rgba[:, 0].copy(), rgba[:, 1].copy(), rgba[:, 2].copy()
    # Saturated royal-blue paint. Leave the less saturated cyan cab glass and
    # navy rubber untouched, so this remains a plausible machine variant.
    # The cab windows and seat are blue-gray too, but have much less saturated
    # blue than the painted bucket/boom. A broad hue-only mask turned the
    # boom-side window pink and exposed jagged texture edges in the game.
    mask = (blue > red * 2.2) & (blue > green * 1.35) & (blue > 0.42) & (green > 0.14)
    count = int(np.count_nonzero(mask))
    if not count:
        continue
    rgba[mask, 0] = np.clip(blue[mask] * 0.98 + 0.06, 0, 1)
    rgba[mask, 1] = np.clip(red[mask] * 0.50 + 0.035, 0, 1)
    rgba[mask, 2] = np.clip(red[mask] * 0.57 + 0.045, 0, 1)
    image.pixels.foreach_set(pixels)
    image.update()
    changed += count

assert changed > 1000, "No painted-blue texture pixels were recolored"
bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = bpy.data.objects["Root"]
bpy.ops.export_scene.gltf(
    filepath=str(OUTPUT),
    export_format="GLB",
    use_selection=True,
    export_texcoords=True,
    export_materials="EXPORT",
    export_animations=False,
)
ARCHIVE.write_bytes(OUTPUT.read_bytes())
print(f"Red excavator: {changed} blue pixels recolored, {OUTPUT.stat().st_size} bytes")
