"""Import the supplied WorkBot GLB as the editable Bot source and render previews.

Run with: blender -b --python assets/blender/import_workbot.py
"""

from pathlib import Path
import bpy
from mathutils import Vector


root = Path(__file__).resolve().parents[2]
asset = root / "assets" / "characters" / "worker_bot"
source = asset / "source" / "WorkBot.glb"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 32
scene.render.resolution_x = 900
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.world = bpy.data.worlds.new("preview world")
scene.world.color = (0.35, 0.39, 0.44)

# The uploaded GLB is the source of truth. Save its meshes, armature, materials,
# morph target, and four actions without changing their authored proportions.
bpy.ops.wm.save_as_mainfile(filepath=str(asset / "source" / "worker_bot.blend"))

ground = bpy.data.meshes.new("preview ground")
ground.from_pydata(
    [(-10, -10, -.03), (10, -10, -.03), (10, 10, -.03), (-10, 10, -.03)],
    [], [(0, 1, 2, 3)],
)
floor = bpy.data.objects.new("preview ground", ground)
scene.collection.objects.link(floor)
mat = bpy.data.materials.new("preview background")
mat.diffuse_color = (.56, .62, .68, 1)
ground.materials.append(mat)

for position, energy, size in [((4, -5, 8), 800, 5), ((-5, -1, 4), 350, 4)]:
    light_data = bpy.data.lights.new("preview area", "AREA")
    light_data.energy = energy
    light_data.shape = "DISK"
    light_data.size = size
    light = bpy.data.objects.new("preview area", light_data)
    scene.collection.objects.link(light)
    light.location = position

camera_data = bpy.data.cameras.new("preview camera")
camera = bpy.data.objects.new("preview camera", camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
camera_data.type = "ORTHO"
camera_data.ortho_scale = 4.25
target = Vector((0, 0, 1.55))
for name, position in {
    "front": (0, -7, 2.1),
    "side": (7, 0, 2.1),
    "back": (0, 7, 2.1),
    "beauty": (5, -7, 4.1),
}.items():
    camera.location = position
    direction = target - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = str(asset / "previews" / f"{name}.png")
    bpy.ops.render.render(write_still=True)
