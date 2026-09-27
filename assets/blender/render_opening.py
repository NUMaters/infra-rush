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
FRAME_RANGE = next((arg.partition("=")[2] for arg in sys.argv if arg.startswith("--frames=")), None)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.eevee.taa_render_samples = 24
scene.render.resolution_x = 960
scene.render.resolution_y = 540
scene.render.resolution_percentage = 100
scene.render.fps = 20
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.render.film_transparent = False
scene.render.image_settings.compression = 20
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "Medium High Contrast"
scene.view_settings.exposure = -0.55
scene.render.image_settings.color_depth = "8"
scene.frame_start = 1
scene.frame_end = 160

world = bpy.data.worlds.new("Opening sky")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.34, 0.64, 0.82, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.75
scene.world = world


def material(name, color, roughness=0.78):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


blue = material("Stage blue", (0.08, 0.43, 0.83))
green = material("Stage mint", (0.20, 0.68, 0.56))
yellow = material("Stage yellow", (1.0, 0.60, 0.12))
cream = material("Stage cream", (0.95, 0.94, 0.82))
orange = material("Stage orange", (1.0, 0.37, 0.18))
sky = material("Backdrop", (0.32, 0.65, 0.86))
dust = material("Impact dust", (0.88, 0.61, 0.33))
spark = material("Impact sparkle", (1.0, 0.88, 0.24))


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


def burst(name, origin, frame, count, reach, colors):
    """Animate small low-poly chunks that erupt from a real vehicle contact point."""
    center = Vector(origin)
    for index in range(count):
        angle = (index / count) * math.tau
        radius = 0.07 + (index % 3) * 0.045
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=radius, location=center)
        obj = bpy.context.object
        obj.name = f"{name}_{index:02}"
        obj.data.materials.append(colors[index % len(colors)])
        direction = Vector((math.cos(angle), math.sin(angle) * 0.7,
                            0.25 + (index % 4) * 0.14))
        for at, position, size in (
            (1, center, 0.001),
            (frame - 1, center, 0.001),
            (frame + 2, center + direction * reach * 0.25, 1.0),
            (frame + 10, center + direction * reach, 1.1),
            (frame + 20, center + direction * reach * 1.45, 0.001),
        ):
            obj.location = position
            obj.scale = (size,) * 3
            obj.keyframe_insert(data_path="location", frame=at)
            obj.keyframe_insert(data_path="scale", frame=at)


def shock_ring(name, location, frame, color):
    bpy.ops.mesh.primitive_torus_add(major_radius=0.55, minor_radius=0.055,
                                     location=location, major_segments=36, minor_segments=6)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(color)
    for at, size in ((1, 0.001), (frame - 1, 0.001), (frame + 1, 0.6),
                     (frame + 8, 2.4), (frame + 16, 3.4), (frame + 17, 0.001)):
        obj.scale = (size,) * 3
        obj.keyframe_insert(data_path="scale", frame=at)
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
move(hero, (1, 15, 40), ((-1.3, 0.25, 0), (-0.35, -0.1, 0), (0.45, -0.35, 0)))
move(friend, (1, 18, 40), ((0.85, 0.35, 0), (0.3, 0, 0), (-0.15, -0.1, 0)))
for i in range(9):
    angle = i * 2 * math.pi / 9
    piece = orb(f"Bot confetti {i}", (math.sin(angle) * 3.3, math.cos(angle) * 1.6,
                2.2 + i % 3 * 0.5), 0.10, (yellow, orange, cream)[i % 3])
    piece.keyframe_insert(data_path="location", frame=1)
    piece.location.z += 0.5 + (i % 3) * 0.12
    piece.keyframe_insert(data_path="location", frame=40)

# Shot 2: the real excavator's articulated boom, arm and bucket dig.
excavator, excavator_parts = import_asset("excavator", 20, 0.1, height=3.7, label="Digging_Excavator")
dig_bot, dig_bot_parts = import_asset("bot", 17.1, -1.3, height=1.45, label="Digging_WorkBot")
play_bot(dig_bot_parts, "ACT_Wave")
hinge(excavator_parts, "boom", (41, 52, 61, 70, 80), (0.12, -0.30, -0.35, 0.27, 0))
hinge(excavator_parts, "arm", (41, 52, 61, 70, 80), (-0.08, 0.31, 0.38, -0.24, 0))
hinge(excavator_parts, "bucket", (41, 52, 61, 70, 80), (0.12, -0.50, -0.62, 0.32, 0))
for i in range(7):
    orb(f"Digging stone {i}", (18.1 + i * 0.25, 1.2 + (i % 2) * 0.25, 0.12), 0.22, cream)
burst("Excavator debris", (18.6, -1.5, 0.38), 59, 18, 2.3, (dust, cream, orange))
shock_ring("Dig impact", (18.6, -1.5, 0.09), 59, spark)

# Shot 3: the dozer rolls forward with a raised blade and soil in front.
dozer, dozer_parts = import_asset("dozer", 39.8, 0.15, height=3.35, label="Pushing_Dozer")
push_bot, push_bot_parts = import_asset("bot", 43.0, -0.95, height=1.35, label="Pushing_WorkBot")
play_bot(push_bot_parts, "ACT_Walk")
move(dozer, (81, 96, 120), ((0, 0.65, 0), (0, 0.15, 0), (0, -0.95, 0)))
move(push_bot, (81, 120), ((0, 0.55, 0), (0, -0.55, 0)))
hinge(dozer_parts, "blade", (81, 92, 108, 120), (0.06, -0.19, 0.08, 0))
soil, _ = import_asset("soil", 39.5, -2.4, height=0.75, label="Pushed_Soil")
move(soil, (81, 120), ((0, 0.7, 0), (0, -0.8, 0)))
burst("Dozer debris", (39.5, -2.9, 0.3), 101, 17, 2.0, (dust, cream, yellow))
shock_ring("Dozer impact", (39.5, -2.9, 0.09), 101, orange)

# Shot 4: the launcher extends a span toward a castle while a Bot cheers.
launcher, launcher_parts = import_asset("launcher", 58.8, 0, height=3.1, label="Bridge_Launcher")
bridge, _ = import_asset("stone-bridge", 62.8, 0.8, height=1.55, label="New_Stone_Bridge")
castle, _ = import_asset("castle", 64.7, 1.6, height=3.2, label="Destination_Castle")
bridge_bot, bridge_bot_parts = import_asset("bot", 59.8, -2, height=1.45, label="Bridge_WorkBot")
play_bot(bridge_bot_parts, "ACT_Wave")
move(bridge, (121, 132, 150, 160), ((-2.0, 0, 0.50), (-1.7, 0, 0.45), (0, 0, 0), (0.18, 0, 0)))
hinge(launcher_parts, "GirderCarrier", (121, 137, 150, 160), (0, 0.18, -0.09, 0))
for i in range(7):
    orb(f"Bridge sparkle {i}", (62.0 + i * 0.7, -1.9 + (i % 2) * 0.3,
        2.4 + (i % 3) * 0.35), 0.11, yellow)
burst("Bridge connection", (63.0, -1.35, 1.9), 149, 22, 2.4, (spark, yellow, cream))

bpy.ops.object.camera_add()
camera = bpy.context.object
camera.name = "Opening_Camera"
camera.data.type = "ORTHO"
scene.camera = camera
shot(1, 40, (-0.2, 0, 0), 1.45, (3.6, -6.5, 2.6), (3.1, -5.8, 2.35), 7.8, 6.6)
shot(41, 80, (19.9, 0, 0), 1.45, (4.4, -7.2, 3.3), (3.4, -5.8, 2.8), 8.6, 6.8)
shot(81, 120, (40, 0, 0), 1.35, (4.0, -6.8, 3.0), (3.3, -5.2, 2.6), 8.7, 6.6)
shot(121, 160, (62.2, 0.8, 0), 1.55, (4.7, -8.5, 3.4), (4.0, -7.0, 3.0), 13.8, 10.8)

# A quick camera punch at each construction hit gives the edited cuts weight.
for hit in (59, 101, 149):
    for frame, zoom, shake in ((hit - 2, 1.0, 0), (hit, 0.91, 0.12),
                               (hit + 2, 1.03, -0.10), (hit + 6, 1.0, 0)):
        scene.frame_set(frame)
        camera.data.ortho_scale *= zoom
        camera.location.x += shake
        camera.data.keyframe_insert(data_path="ortho_scale", frame=frame)
        camera.keyframe_insert(data_path="location", frame=frame)

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
    for frame in (12, 32, 59, 63, 101, 108, 149, 157):
        scene.frame_set(frame)
        scene.render.filepath = str(FRAMES / f"preview-{frame:03}.png")
        bpy.ops.render.render(write_still=True)
        print(f"Rendered preview frame {frame}")
else:
    if FRAME_RANGE:
        first, last = (int(value) for value in FRAME_RANGE.split("-", 1))
        scene.frame_start = first
        scene.frame_end = last
    scene.render.filepath = str(FRAMES / "frame-####.png")
    bpy.ops.render.render(animation=True)
