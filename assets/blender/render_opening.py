"""Film the opening from the same GLBs shipped with the game.

Preview: Blender -b -t 4 --python assets/blender/render_opening.py -- --preview
Full:    Blender -b -t 4 --python assets/blender/render_opening.py
Encode the resulting PNG sequence with the ffmpeg command in docs/OPENING_MOVIE.md.
"""

from pathlib import Path
import math
import sys

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
MODELS = ROOT / "public/models"
FRAMES = ROOT / ".qa-preview/opening-frames"
FRAMES.mkdir(parents=True, exist_ok=True)
PREVIEW = "--preview" in sys.argv

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 960
scene.render.resolution_y = 540
scene.render.resolution_percentage = 100
scene.render.fps = 20
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.render.film_transparent = False
scene.render.image_settings.compression = 20
scene.view_settings.view_transform = "AgX"
scene.render.image_settings.color_depth = "8"
scene.frame_start = 1
scene.frame_end = 160

world = bpy.data.worlds.new("Opening sky")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.55, 0.84, 0.95, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8
scene.world = world


def material(name, color, roughness=0.78):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


blue = material("Stage blue", (0.17, 0.60, 0.92))
green = material("Stage mint", (0.40, 0.80, 0.63))
yellow = material("Stage yellow", (1.0, 0.72, 0.20))
cream = material("Stage cream", (0.95, 0.94, 0.82))
orange = material("Stage orange", (1.0, 0.37, 0.18))
sky = material("Backdrop", (0.66, 0.88, 0.94))


def rounded_disc(name, x, color):
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=5.6, depth=0.22, location=(x, 0, -0.16))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(color)
    bevel = obj.modifiers.new("soft edge", "BEVEL")
    bevel.width = 0.18
    bevel.segments = 3
    obj.modifiers.new("weighted normals", "WEIGHTED_NORMAL")
    return obj


def orb(name, location, radius, color):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(color)
    return obj


def import_asset(name, stage_x, stage_y=0, height=None, label=None):
    before = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(MODELS / f"{name}.glb"))
    imported = set(scene.objects) - before
    meshes = [obj for obj in imported if obj.type == "MESH"]
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    low = Vector(min(point[i] for point in points) for i in range(3))
    high = Vector(max(point[i] for point in points) for i in range(3))
    scale = (height / (high.z - low.z)) if height else 1
    root = bpy.data.objects.new(label or f"Opening_{name}", None)
    scene.collection.objects.link(root)
    for obj in imported:
        if obj.parent not in imported:
            obj.parent = root
    root.scale = (scale,) * 3
    root.location = (stage_x - (low.x + high.x) * scale / 2,
                     stage_y - (low.y + high.y) * scale / 2,
                     -low.z * scale)
    return root, imported


def play_bot(imported, clip):
    for obj in imported:
        if obj.type != "ARMATURE" or not obj.animation_data:
            continue
        animation = obj.animation_data
        animation.action = None
        for track in animation.nla_tracks:
            track.mute = clip not in track.name
            if not track.mute:
                for strip in track.strips:
                    strip.repeat = 8


def move(root, frames, positions):
    base = root.location.copy()
    for frame, offset in zip(frames, positions):
        root.location = base + Vector(offset)
        root.keyframe_insert(data_path="location", frame=frame)


def hinge(imported, name, frames, angles):
    obj = next((o for o in imported if o.name.lower() == name.lower()), None)
    if not obj:
        return
    obj.rotation_mode = "XYZ"
    initial = obj.rotation_euler.x
    for frame, delta in zip(frames, angles):
        obj.rotation_euler.x = initial + delta
        obj.keyframe_insert(data_path="rotation_euler", frame=frame)


def look_at(camera, target):
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()


def shot(start, end, center, target_z, start_offset, end_offset, width_start, width_end):
    for frame, offset, width in ((start, start_offset, width_start), (end, end_offset, width_end)):
        camera.location = Vector(center) + Vector(offset)
        look_at(camera, (center[0], center[1], target_z))
        camera.data.ortho_scale = width
        camera.keyframe_insert(data_path="location", frame=frame)
        camera.keyframe_insert(data_path="rotation_euler", frame=frame)
        camera.data.keyframe_insert(data_path="ortho_scale", frame=frame)


for x, color in ((0, blue), (20, green), (40, yellow), (60, blue)):
    rounded_disc(f"Shot floor {x}", x, color)
    for i in range(4):
        angle = i * math.pi / 2
        orb(f"Stage pebble {x}-{i}", (x + math.sin(angle) * 4.3,
            math.cos(angle) * 3.7, 0.12), 0.2 + i * 0.04, cream)

# Shot 1: the actual rigged WorkBots march into view and wave.
hero, hero_parts = import_asset("bot", -1.2, 0.05, height=2.15, label="Hero_WorkBot")
friend, friend_parts = import_asset("bot", 1.35, 0.6, height=1.85, label="Friend_WorkBot")
play_bot(hero_parts, "ACT_Walk")
play_bot(friend_parts, "ACT_Wave")
move(hero, (1, 40), ((-0.55, -0.25, 0), (0.50, -0.25, 0)))
move(friend, (1, 40), ((0, 0, 0), (-0.15, 0, 0)))
for i in range(9):
    angle = i * 2 * math.pi / 9
    orb(f"Bot confetti {i}", (math.sin(angle) * 3.3, math.cos(angle) * 1.6, 2.2 + i % 3 * 0.5),
        0.10, (yellow, orange, cream)[i % 3])

# Shot 2: the real excavator's articulated boom, arm and bucket dig.
excavator, excavator_parts = import_asset("excavator", 20, 0.1, height=3.7, label="Digging_Excavator")
dig_bot, dig_bot_parts = import_asset("bot", 17.1, -1.3, height=1.45, label="Digging_WorkBot")
play_bot(dig_bot_parts, "ACT_Wave")
hinge(excavator_parts, "boom", (41, 52, 66, 80), (0, -0.24, 0.19, 0))
hinge(excavator_parts, "arm", (41, 52, 66, 80), (0, 0.24, -0.15, 0))
hinge(excavator_parts, "bucket", (41, 52, 66, 80), (0, -0.35, 0.22, 0))
for i in range(7):
    orb(f"Digging stone {i}", (18.1 + i * 0.25, 1.2 + (i % 2) * 0.25, 0.12), 0.22, cream)

# Shot 3: the dozer rolls forward with a raised blade and soil in front.
dozer, dozer_parts = import_asset("dozer", 39.8, 0.15, height=3.35, label="Pushing_Dozer")
push_bot, push_bot_parts = import_asset("bot", 43.0, -0.95, height=1.35, label="Pushing_WorkBot")
play_bot(push_bot_parts, "ACT_Walk")
move(dozer, (81, 120), ((0, -0.55, 0), (0, 0.45, 0)))
move(push_bot, (81, 120), ((0, -0.35, 0), (0, 0.45, 0)))
hinge(dozer_parts, "blade", (81, 92, 108, 120), (0, -0.11, 0.05, 0))
soil, _ = import_asset("soil", 39.5, 2.9, height=0.9, label="Pushed_Soil")
move(soil, (81, 120), ((0, -0.25, 0), (0, 0.25, 0)))

# Shot 4: the launcher extends a span toward a castle while a Bot cheers.
launcher, launcher_parts = import_asset("launcher", 58.8, 0, height=3.1, label="Bridge_Launcher")
bridge, _ = import_asset("stone-bridge", 62.8, 0.8, height=1.55, label="New_Stone_Bridge")
castle, _ = import_asset("castle", 64.7, 1.6, height=3.2, label="Destination_Castle")
bridge_bot, bridge_bot_parts = import_asset("bot", 59.8, -2, height=1.45, label="Bridge_WorkBot")
play_bot(bridge_bot_parts, "ACT_Wave")
move(bridge, (121, 142, 160), ((-1.1, 0, 0.25), (-0.2, 0, 0.1), (0, 0, 0)))
hinge(launcher_parts, "GirderCarrier", (121, 140, 160), (0, 0.08, 0))
for i in range(7):
    orb(f"Bridge sparkle {i}", (62.0 + i * 0.7, -1.9 + (i % 2) * 0.3,
        2.4 + (i % 3) * 0.35), 0.11, yellow)

bpy.ops.object.camera_add()
camera = bpy.context.object
camera.name = "Opening_Camera"
camera.data.type = "ORTHO"
scene.camera = camera
shot(1, 40, (0, 0, 0), 1.25, (4, -7.5, 3.7), (3.4, -6.9, 3.5), 10.8, 9.5)
shot(41, 80, (20, 0, 0), 1.45, (5.2, -7.8, 4.6), (4.3, -7.2, 4.1), 11.2, 9.9)
shot(81, 120, (40, 0, 0), 1.35, (5.2, -7.7, 4.3), (4.6, -7.0, 4.0), 11.0, 9.8)
shot(121, 160, (62.5, 0.8, 0), 1.4, (5.3, -9.8, 4.9), (4.9, -8.8, 4.6), 15.3, 14.1)

for stage_x in (0, 20, 40, 60):
    for obj, energy, size, offset in (
        ("Key", 1150, 6, (5, -7, 10)),
        ("Fill", 680, 7, (-5, -3, 6)),
        ("Rim", 850, 5, (4, 8, 9)),
    ):
        bpy.ops.object.light_add(type="AREA", location=Vector((stage_x, 0, 0)) + Vector(offset))
        light = bpy.context.object
        light.name = f"{obj}_{stage_x}"
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size

scene.frame_set(1)
if PREVIEW:
    for frame in (10, 50, 90, 135, 155):
        scene.frame_set(frame)
        scene.render.filepath = str(FRAMES / f"preview-{frame:03}.png")
        bpy.ops.render.render(write_still=True)
        print(f"Rendered preview frame {frame}")
else:
    scene.render.filepath = str(FRAMES / "frame-####.png")
    bpy.ops.render.render(animation=True)
