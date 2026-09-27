"""Reference-first drill excavator for INFRA RUSH.

The approved 掘削機.png sheet defines the silhouette, colour blocking and
proportions. This is independent of the generic vehicle() generator.

Run: blender -b --python assets/blender/build_drill_reference.py [-- --blockout]
"""

from pathlib import Path
from mathutils import Vector
import bpy
import json
import math
import shutil
import sys

ROOT = Path(__file__).resolve().parents[2]
ASSET = ROOT / "assets" / "vehicles" / "drill_excavator"
MODEL = ASSET / "export" / "drill.glb"
SOURCE = ASSET / "source" / "drill_excavator.blend"
PREVIEW = ASSET / "previews"
BLOCKOUT = "--blockout" in sys.argv
for path in (MODEL.parent, SOURCE.parent, PREVIEW):
    path.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = "DrillExcavator"
scene.render.film_transparent = False

PALETTE = {
    "team": "2D8CFF", "blue_light": "55B7FF", "yellow": "FFA62B",
    "yellow_light": "FFD16D", "white": "F7F7F4", "glass": "A7D8FF",
    "track": "1A1A1A", "track_side": "2A3440", "dark_blue": "223A78",
    "metal": "D9D9E0", "metal_shadow": "AAB1BC", "eye": "1A1A1A",
    "lamp": "FFF1B2", "vent": "253243",
}


def linear(hex_color):
    values = [int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in values)


def material(name):
    old = bpy.data.materials.get(name)
    if old:
        return old
    color = PALETTE[name]
    srgb = tuple(int(color[i:i + 2], 16) / 255 for i in (0, 2, 4))
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*srgb, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*linear(color), 1)
    bsdf.inputs["Roughness"].default_value = .33 if name in {"team", "yellow", "blue_light"} else .64
    if name in {"metal", "metal_shadow"}:
        bsdf.inputs["Metallic"].default_value = .42
    if name == "glass":
        bsdf.inputs["Alpha"].default_value = .18
        bsdf.inputs["Roughness"].default_value = .12
        mat.surface_render_method = "BLENDED"
    if name == "lamp":
        bsdf.inputs["Emission Color"].default_value = (*linear(color), 1)
        bsdf.inputs["Emission Strength"].default_value = .9
    return mat


def empty(name, parent=None, location=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    return obj


def assign(obj, name, parent, location, mat):
    obj.name = name
    obj.parent = parent
    obj.location = location
    obj.data.materials.append(material(mat))
    return obj


def soften(obj, width, segments=5):
    bevel = obj.modifiers.new("toy-soft edges", "BEVEL")
    bevel.width = width
    bevel.segments = segments
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    normal = obj.modifiers.new("soft normals", "WEIGHTED_NORMAL")
    bpy.ops.object.modifier_apply(modifier=normal.name)
    return obj


def block(name, parent, location, dimensions, mat, bevel=.08, segments=5):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.object
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        soften(obj, min(bevel, min(dimensions) * .48), segments)
    return assign(obj, name, parent, location, mat)


def orb(name, parent, location, radii, mat, segments=24, rings=14):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings)
    obj = bpy.context.object
    obj.scale = radii
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return assign(obj, name, parent, location, mat)


def disc(name, parent, location, radius, depth, mat, axis="Y", vertices=24, bevel=.03):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth)
    obj = bpy.context.object
    obj.rotation_euler = (math.pi / 2, 0, 0) if axis == "Y" else ((0, math.pi / 2, 0) if axis == "X" else (0, 0, 0))
    if bevel:
        soften(obj, bevel, 3)
    return assign(obj, name, parent, location, mat)


def frustum(name, parent, y_center, length, rear_radius, front_radius, mat):
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=rear_radius, radius2=front_radius, depth=length)
    obj = bpy.context.object
    obj.rotation_euler.x = math.pi / 2
    soften(obj, .025, 3)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return assign(obj, name, parent, (0, y_center, 0), mat)


def strut(name, parent, start, end, width, mat, depth=None, bevel=.08):
    a, b = Vector(start), Vector(end)
    obj = block(name, parent, (a + b) / 2, (width, depth or width, (b - a).length), mat, bevel)
    obj.rotation_euler = (b - a).to_track_quat("Z", "Y").to_euler()
    return obj


def track(parent, side):
    x = -.70 if side == "L" else .70
    root = empty(f"Track_{side}", parent, (x, .05, .35))
    block("thick rounded crawler belt", root, (0, 0, 0), (.47, 1.88, .64), "track", .30, 8)
    outer_x = -.25 if side == "L" else .25
    block("crawler side wall", root, (outer_x, 0, 0), (.075, 1.54, .43), "track_side", .16, 6)
    for y in (-.60, -.20, .20, .60):
        disc("black load wheel", root, (outer_x + (-.045 if side == "L" else .045), y, -.035), .21, .075, "track_side", "X", 20, .026)
    for y in (-.61, .61):
        disc("orange axle hub", root, (outer_x + (-.095 if side == "L" else .095), y, -.035), .14, .09, "yellow", "X", 20, .028)
    block("orange crawler sill", root, (outer_x + (-.10 if side == "L" else .10), 0, -.045), (.09, .88, .22), "yellow", .095, 5)
    for y in [-.68 + i * .125 for i in range(12)]:
        block("rounded upper tread", root, (0, y, .305), (.48, .11, .072), "track_side", .027, 3)
        block("rounded lower tread", root, (0, y, -.305), (.48, .11, .072), "track_side", .027, 3)
    return root


def bot_in_cabin(seat):
    # Large head and face are kept clear of the thick front windshield frame.
    block("seat cushion", seat, (0, .20, .23), (.48, .38, .20), "dark_blue", .095)
    orb("Bot blue body", seat, (0, .03, .39), (.29, .22, .30), "team")
    orb("Bot orange vest", seat, (0, -.035, .44), (.31, .23, .25), "yellow")
    block("Bot reflective waist", seat, (0, -.23, .32), (.55, .045, .065), "white", .025)
    for x in (-.20, .20):
        block("Bot reflective chest band", seat, (x, -.25, .49), (.045, .05, .29), "white", .018)
    orb("Bot head", seat, (0, -.015, .72), (.275, .22, .22), "team")
    orb("Bot face", seat, (0, -.225, .70), (.225, .050, .145), "white")
    for x in (-.075, .075):
        orb("Bot oval eye", seat, (x, -.270, .71), (.023, .016, .047), "eye", 12, 8)
    orb("Bot helmet dome", seat, (0, 0, .88), (.31, .26, .19), "team")
    block("Bot helmet brim", seat, (0, -.035, .82), (.68, .57, .080), "team", .038, 5)
    block("Bot helmet ridge", seat, (0, -.01, 1.05), (.07, .34, .045), "blue_light", .022)
    for x in (-.34, .34):
        orb("Bot blue sleeve", seat, (x, -.045, .48), (.105, .12, .155), "team")
        orb("Bot dark glove", seat, (x, -.13, .35), (.090, .083, .095), "dark_blue")
    for x in (-.15, .15):
        block("Bot boot", seat, (x, -.12, .10), (.20, .25, .14), "dark_blue", .065)
    disc("steering wheel", seat, (0, -.38, .36), .16, .045, "track", "Y", 16, .015)


def cabin(parent, detail):
    cab = empty("Cabin", parent, (0, .13, 0))
    # The reference has a single bulbous blue cab, not a white roof and pipe cage.
    block("cab lower blue shell", cab, (0, 0, 1.03), (1.47, 1.25, .48), "team", .22, 8)
    block("rounded blue rear cab", cab, (0, .48, 1.50), (1.43, .31, 1.20), "team", .16, 7)
    block("thick blue roof", cab, (0, 0, 2.12), (1.54, 1.30, .34), "team", .16, 8)
    for x in (-.65, .65):
        strut("thick front cab frame", cab, (x, -.53, 1.16), (x * .88, -.48, 2.08), .20, "team", .20, .085)
        strut("thick rear cab frame", cab, (x, .50, 1.15), (x * .9, .50, 2.06), .17, "team", .16, .07)
        block("blue side lower door", cab, (x, -.05, 1.06), (.18, .88, .45), "team", .075)
        block("blue side window sill", cab, (x, -.05, 1.34), (.18, .92, .12), "team", .04)
    block("blue front lower ledge", cab, (0, -.56, 1.13), (1.23, .20, .20), "team", .08)
    block("blue windshield header", cab, (0, -.53, 1.98), (1.30, .19, .17), "team", .07)
    # Glass panels sit behind the body-coloured thick frames; Bot stays visible.
    block("large curved front glass", cab, (0, -.515, 1.61), (1.12, .035, .73), "glass", .045, 4)
    for x in (-.675, .675):
        block("wide blue side glass", cab, (x, -.02, 1.66), (.036, .83, .64), "glass", .025, 3)
    seat = empty("BotSeat", cab, (0, -.09, .98))
    empty("P_BotSeat", seat)
    empty("P_BotEntry", cab, (.85, -.22, .80))
    if detail:
        bot_in_cabin(seat)
        for x in (-.32, .32):
            block("black lamp housing", cab, (x, -.48, 2.30), (.28, .23, .23), "track_side", .075)
            block("yellow lamp lens", cab, (x, -.605, 2.31), (.18, .045, .16), "lamp", .035)
        block("rear yellow engine panel", cab, (0, .697, 1.24), (1.29, .22, .50), "yellow", .14, 6)
        for z in (1.12, 1.24, 1.36):
            block("rear vent slot", cab, (0, .818, z), (.57, .04, .045), "vent", .018)
        disc("black exhaust lower", cab, (.52, .60, 1.74), .082, .78, "track_side", "Z", 16)
        disc("black exhaust upper", cab, (.52, .60, 2.20), .10, .35, "track_side", "Z", 16)
        block("rear amber side panel", cab, (.69, .40, 1.07), (.10, .43, .27), "yellow", .045)
        block("rear amber side panel", cab, (-.69, .40, 1.07), (.10, .43, .27), "yellow", .045)
        for x in (-.765, .765):
            block("broad orange side accent", cab, (x, .23, 1.10), (.045, .58, .23), "yellow", .065)
    return cab


def drill_arm(parent, detail):
    arm = empty("DrillArm", parent, (0, -.49, 1.22))
    # Two short, thick shoulders frame the cab face without hiding the Bot.
    for x in (-.49, .49):
        strut("fat blue boom", arm, (x, .02, .13), (x * .57, -.65, -.13), .27, "team", .25, .12)
        if detail:
            disc("round orange shoulder pin", arm, (x + (.14 if x > 0 else -.14), .02, .13), .205, .09, "yellow", "X", 24)
            disc("round orange elbow pin", arm, (x * .57, -.64, -.13), .17, .09, "yellow", "X", 24)
            strut("short yellow actuator", arm, (x, -.11, -.14), (x * .58, -.56, -.13), .10, "yellow", .10, .045)
    head = empty("DrillHead", arm, (0, -.74, -.10))
    disc("large orange bit flange", head, (0, -.04, 0), .53, .24, "yellow", "Y", 32, .055)
    disc("dark bit socket", head, (0, -.19, 0), .41, .08, "track_side", "Y", 28, .035)
    spin = empty("drill_spin", head, (0, -.24, 0))
    # Five rounded silver frustums create the design sheet's stepped cone.
    sections = [(-.115, .23, .47, .40), (-.34, .24, .39, .32),
                (-.56, .23, .31, .24), (-.765, .22, .23, .15),
                (-.96, .20, .14, .035)]
    for index, (y, length, rear, front) in enumerate(sections):
        frustum("rounded drill cone section", spin, y, length, rear, front,
                "metal" if index % 2 == 0 else "metal_shadow")
        if detail and index < 4:
            disc("soft drill step rim", spin, (0, y + length * .45, 0), rear * 1.03,
                 .055, "metal", "Y", 32, .026)
    empty("P_DrillContact", spin, (0, -1.08, 0))
    return arm, head


def static_merge():
    groups = {}
    for obj in list(scene.objects):
        if obj.type == "MESH":
            key = (obj.parent, obj.data.materials[0].name)
            groups.setdefault(key, []).append(obj)
    for (_, _), objects in groups.items():
        if len(objects) < 2:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
    bpy.ops.object.select_all(action="DESELECT")


def uv_unwrap():
    for obj in scene.objects:
        if obj.type != "MESH":
            continue
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(island_margin=.018)
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")


def nla_clip(obj, name, channel, keys):
    obj.animation_data_create()
    action = bpy.data.actions.new(f"{name}_{obj.name}")
    obj.animation_data.action = action
    original = tuple(getattr(obj, channel))
    for frame, value in keys:
        setattr(obj, channel, value)
        obj.keyframe_insert(data_path=channel, frame=frame)
    setattr(obj, channel, original)
    obj.animation_data.action = None
    track = obj.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 1, action)


def animate(arm, head):
    nla_clip(arm, "Approach", "rotation_euler", [(1, (0, 0, 0)), (16, (-.14, 0, 0)), (31, (0, 0, 0))])
    nla_clip(head, "Drill", "rotation_euler", [(1, (0, 0, 0)), (16, (.08, 0, 0)), (31, (0, 0, 0))])
    spin = bpy.data.objects["drill_spin"]
    nla_clip(spin, "Drill", "rotation_euler", [(1, (0, 0, 0)), (31, (0, math.tau * 4, 0))])
    nla_clip(arm, "Retract", "rotation_euler", [(1, (-.14, 0, 0)), (25, (0, 0, 0))])


def build():
    top = empty("DrillExcavator")
    root = empty("Root", top)
    track(root, "L")
    track(root, "R")
    upper = empty("UpperBody", root)
    block("rounded blue hull", upper, (0, .04, .72), (1.65, 1.68, .40), "team", .18, 7)
    block("deep blue side skirt", upper, (0, .04, .62), (1.44, 1.45, .28), "dark_blue", .12, 6)
    cab = cabin(upper, not BLOCKOUT)
    arm, head = drill_arm(upper, not BLOCKOUT)
    if not BLOCKOUT:
        for x in (-.76, .76):
            block("orange chassis step", upper, (x, -.20, .73), (.17, .42, .13), "yellow", .06)
        empty("P_WorkPoint", root, (0, -2.46, 1.12))
    static_merge()
    if not BLOCKOUT:
        uv_unwrap()
        animate(arm, head)
    scene.frame_set(1)
    return top


def render_views(output_dir, prefix=""):
    meshes = [obj for obj in scene.objects if obj.type == "MESH"]
    bounds = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    low = Vector(min(p[i] for p in bounds) for i in range(3))
    high = Vector(max(p[i] for p in bounds) for i in range(3))
    center = (low + high) / 2
    size = max(high - low)
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = size * 1.36
    scene.camera = camera
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.world = bpy.data.worlds.new("preview background")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (.82, .88, .96, 1)
    background.inputs["Strength"].default_value = .8
    scene.world.color = (.86, .90, .94)
    bpy.ops.object.light_add(type="AREA", location=(-3, -4, 7))
    key_light = bpy.context.object
    key_light.name = "Preview Key Light"
    key_light.data.energy = 850
    key_light.data.shape = "DISK"
    key_light.data.size = 5
    bpy.ops.object.light_add(type="AREA", location=(4, 3, 6))
    fill_light = bpy.context.object
    fill_light.name = "Preview Fill Light"
    fill_light.data.energy = 550
    fill_light.data.size = 5
    scene.view_settings.view_transform = "Standard"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    views = {
        "front": Vector((0, -1, .22)),
        "side": Vector((1, 0, .25)),
        "back": Vector((0, 1, .22)),
        "beauty": Vector((.70, -1, .62)),
    }
    for name, direction in views.items():
        camera.location = center + direction.normalized() * size * 3
        camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = str(output_dir / f"{prefix}{name}.png")
        bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(camera, do_unlink=True)
    bpy.data.objects.remove(key_light, do_unlink=True)
    bpy.data.objects.remove(fill_light, do_unlink=True)


build()
if BLOCKOUT:
    render_views(PREVIEW, "blockout_")
    print("Blockout rendered from approved drill design proportions")
else:
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
    bpy.ops.export_scene.gltf(filepath=str(MODEL), export_format="GLB", use_active_scene=True,
                              export_yup=True, export_animations=True, export_animation_mode="NLA_TRACKS")
    shutil.copy2(MODEL, ROOT / "public" / "models" / "drill.glb")
    render_views(PREVIEW)
    manifest = {
        "id": "drill_excavator", "category": "vehicles",
        "source": "source/drill_excavator.blend", "model": "export/drill.glb", "scale": 1.0,
        "mountPoints": ["P_BotSeat", "P_BotEntry", "P_DrillContact", "P_WorkPoint"],
        "animations": {"approach": "Approach", "drill": "Drill", "retract": "Retract"},
        "teamColorMaterials": ["team"], "damageStates": [],
        "referenceFiles": ["../../../docs/references/1nrTX_XQGdDGJ9LWzkfiUqPTcklEBide-.png"],
        "notes": "Dedicated reference-first model; hierarchy DrillExcavator/Root/Track_L,Track_R,UpperBody/Cabin/BotSeat,DrillArm/DrillHead.",
    }
    (ASSET / "asset.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(f"Saved {SOURCE}, {MODEL}, and four orthographic renders")
