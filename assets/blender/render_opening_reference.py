"""Render the six current game GLBs for a one-page opening movie reference sheet.

Blender -b -t 4 --python assets/blender/render_opening_reference.py
"""

from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "assets" / "opening-reference" / "renders"
OUTPUT.mkdir(parents=True, exist_ok=True)

ASSETS = ("bot", "excavator", "dozer", "grader", "drill", "launcher")
VIEWS = {
    "hero": Vector((5, -8, 6)),
    "front": Vector((0, -9, 3)),
    "side": Vector((9, 0, 3)),
}

for asset in ASSETS:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / "public" / "models" / f"{asset}.glb"))
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
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = size * (1.65 if asset == "launcher" else 1.45)
    scene.camera = camera
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.image_settings.color_mode = "RGBA"
    scene.world = bpy.data.worlds.new("ReferenceWorld")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes.get("Background").inputs[0].default_value = (0.82, 0.9, 1.0, 1)
    scene.world.node_tree.nodes.get("Background").inputs[1].default_value = 0.8
    for offset, energy, size_light in (((-4, -6, 8), 850, 7), ((5, 3, 6), 550, 6)):
        bpy.ops.object.light_add(type="AREA", location=target + Vector(offset).normalized() * size * 3)
        light = bpy.context.object
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size_light
        light.rotation_euler = (target - light.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "Standard"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    for name, direction in VIEWS.items():
        camera.location = target + direction.normalized() * size * 3
        camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = str(OUTPUT / f"{asset}-{name}.png")
        bpy.ops.render.render(write_still=True)
        print(f"Rendered {asset}-{name}")
