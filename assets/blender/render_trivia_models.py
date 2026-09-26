"""Render the production GLBs as lightweight transparent trivia portraits.

Run with Blender in background mode after `assets/blender/build.py` has produced
`public/models/*.glb`. The UI uses these images rather than another WebGL view.
"""

from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "public/ui/trivia"
OUTPUT.mkdir(parents=True, exist_ok=True)
ASSETS = (
    "excavator",
    "dozer",
    "grader",
    "launcher",
    "stone-bridge",
    "steel-bridge",
    "soil",
    "stone-resource",
)

for asset in ASSETS:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / "public/models" / f"{asset}.glb"))
    scene = bpy.context.scene
    bounds = [
        obj.matrix_world @ Vector(corner)
        for obj in scene.objects
        if obj.type == "MESH"
        for corner in obj.bound_box
    ]
    low = Vector(min(point[i] for point in bounds) for i in range(3))
    high = Vector(max(point[i] for point in bounds) for i in range(3))
    target = (low + high) / 2
    size = max(high - low)
    bpy.ops.object.camera_add(location=target + Vector((5, -8, 6)).normalized() * size * 3)
    camera = bpy.context.object
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = size * 1.35
    scene.camera = camera
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = True
    scene.display.shading.cavity_type = "BOTH"
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "Standard"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = str(OUTPUT / f"{asset}.png")
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {asset}")
