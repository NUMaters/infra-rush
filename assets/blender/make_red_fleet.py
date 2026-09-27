"""Export red paint variants while preserving glass, orange and metal parts."""

from pathlib import Path
import bpy
import numpy as np
import sys


ROOT = Path(__file__).resolve().parents[2]
FOLDERS = {
    "dozer": ("bulldozer", "bulldozer.blend"),
    "grader": ("motor_grader", "motor_grader.blend"),
    "drill": ("drill_excavator", "drill_excavator.blend"),
    "launcher": ("bridge_launcher", "bridge_launcher.blend"),
}
name = sys.argv[-1]
folder, blend_name = FOLDERS[name]
asset = ROOT / "assets/vehicles" / folder
bpy.ops.wm.open_mainfile(filepath=str(asset / "source" / blend_name))
changed = 0
for image in bpy.data.images:
    if not image.name.endswith("_basecolor"):
        continue
    pixels = np.empty(len(image.pixels), dtype=np.float32)
    image.pixels.foreach_get(pixels)
    rgba = pixels.reshape((-1, 4))
    red, green, blue = rgba[:, 0].copy(), rgba[:, 1].copy(), rgba[:, 2].copy()
    mask = (blue > red * 1.5) & (blue > green * 1.14) & (blue > .23) & (green > .12)
    count = int(np.count_nonzero(mask))
    if count:
        rgba[mask, 0] = np.clip(blue[mask] * .96 + .055, 0, 1)
        rgba[mask, 1] = np.clip(red[mask] * .48 + .03, 0, 1)
        rgba[mask, 2] = np.clip(red[mask] * .55 + .045, 0, 1)
        image.pixels.foreach_set(pixels)
        image.update()
        changed += count

assert changed > 1000, f"No painted-blue pixels found in {name}"
export = asset / "export" / f"{name}-red.glb"
public = ROOT / "public/models" / f"{name}-red.glb"
bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = bpy.data.objects["Root"]
bpy.ops.export_scene.gltf(filepath=str(export), export_format="GLB", use_selection=True,
                          export_texcoords=True, export_materials="EXPORT", export_animations=False)
public.write_bytes(export.read_bytes())
print(f"Red {name}: {changed} paint pixels, {export.stat().st_size} bytes")
