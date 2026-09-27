"""Rig the four user-supplied textured construction vehicles for gameplay.

Run: blender -b --python assets/blender/prepare_supplied_fleet.py -- dozer
The original GLB and .blend are preserved in each asset's source folder.
"""

from pathlib import Path
import bpy
import math
import sys


ROOT = Path(__file__).resolve().parents[2]
CONFIG = {
    "dozer": dict(folder="bulldozer", source="bulldozer.blend", scale=2.4,
                  turn=0, pilot=(0, .04, .26), pilot_turn=0,
                  glass=(30, 31, 33, 34), blade=(1, 11, 12, 13, 26, 28)),
    "grader": dict(folder="motor_grader", source="motor_grader.blend", scale=2.9,
                   turn=0, pilot=(0, .1, .19), pilot_turn=0,
                   glass=(49, 84, 147, 151, 194), blade=(6, 31)),
    "drill": dict(folder="drill_excavator", source="drill_excavator.blend", scale=2.3,
                  turn=math.pi / 2, pilot=(.20, 0, .13), pilot_turn=-math.pi / 2,
                  glass=(17, 23, 31, 32),
                  drill_tip=(44, 53, 59, 62, 65, 69, 78, 81, 87, 90)),
    "launcher": dict(folder="bridge_launcher", source="bridge_launcher.blend", scale=4.1,
                     turn=-math.pi / 2, pilot=(-.29, 0, .13), pilot_turn=-math.pi / 2,
                     glass=(8,), girder=(0, 4, 5, 6, 15, 23, 25, 29, 30, 33,
                                         40, 43, 46, 54, 59, 65)),
}


def make_empty(name, location, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    bpy.context.view_layer.update()
    if parent:
        keep_world(obj, parent)
    return obj


def keep_world(obj, parent):
    matrix = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = matrix


name = sys.argv[-1]
assert name in CONFIG, f"Unknown supplied vehicle: {name}"
cfg = CONFIG[name]
asset = ROOT / "assets/vehicles" / cfg["folder"]
source = asset / "source" / f"supplied-{cfg['folder']}.glb"
blend = asset / "source" / cfg["source"]
export = asset / "export" / f"{name}.glb"
public = ROOT / "public/models" / f"{name}.glb"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
parts = {int(o.name.rsplit("_", 1)[1]): o for o in bpy.data.objects if o.type == "MESH"}
assert len(parts) == len(set(parts)), "Supplied mesh names are not unique"
root = make_empty("Root", (0, 0, 0))
upper = make_empty("UpperBody", (0, 0, 0), root)
groups = {}
if name == "dozer":
    groups["blade"] = make_empty("blade", (0, -.23, .18), upper)
elif name == "grader":
    groups["grader_work_blade"] = make_empty("grader_work_blade", (0, -.10, .11), upper)
elif name == "drill":
    groups["DrillArm"] = make_empty("DrillArm", (-.04, 0, .34), upper)
    groups["DrillHead"] = make_empty("DrillHead", (-.17, 0, .23), groups["DrillArm"])
    groups["drill_spin"] = make_empty("drill_spin", (-.25, 0, .22), groups["DrillHead"])
elif name == "launcher":
    groups["GirderCarrier"] = make_empty("GirderCarrier", (0, 0, .36), upper)
    groups["Outrigger_front_left"] = make_empty("Outrigger_front_left", (-.43, -.07, .07), root)
    groups["Outrigger_front_right"] = make_empty("Outrigger_front_right", (-.43, .07, .07), root)

for index, part in parts.items():
    parent = upper
    if name in ("dozer", "grader") and index in cfg["blade"]:
        parent = groups["blade" if name == "dozer" else "grader_work_blade"]
    elif name == "drill":
        if index in cfg["drill_tip"]:
            parent = groups["drill_spin"]
        elif index in (7, 34):
            parent = groups["DrillHead"]
        elif index in (11,):
            parent = groups["DrillArm"]
    elif name == "launcher":
        if index in cfg["girder"]:
            parent = groups["GirderCarrier"]
        elif index == 31:
            parent = groups["Outrigger_front_left"]
        elif index == 32:
            parent = groups["Outrigger_front_right"]
    keep_world(part, parent)

# These part IDs were visually isolated in Blender. They are the glass panes,
# not the white surrounding cab; avoid a cyan opaque card over the Bot.
for index in cfg["glass"]:
    part = parts[index]
    material = part.active_material
    material.surface_render_method = "BLENDED"
    shader = material.node_tree.nodes.get("Principled BSDF")
    color_input = shader.inputs["Base Color"]
    for link in list(color_input.links):
        material.node_tree.links.remove(link)
    color_input.default_value = (.89, .95, 1, 1)
    shader.inputs["Alpha"].default_value = .13

# Tripo's metallic/roughness maps give the supplied sculpt a wet, glossy look
# under the game's soft lights. Keep its painted textures and normal detail,
# but use restrained toy-like PBR values; the drill tip remains actual metal.
for index, part in parts.items():
    shader = part.active_material.node_tree.nodes.get("Principled BSDF")
    for socket_name in ("Metallic", "Roughness"):
        socket = shader.inputs[socket_name]
        for link in list(socket.links):
            part.active_material.node_tree.links.remove(link)
    metal_tip = name == "drill" and index in cfg["drill_tip"]
    shader.inputs["Metallic"].default_value = .38 if metal_tip else .035
    shader.inputs["Roughness"].default_value = .40 if metal_tip else (.18 if index in cfg["glass"] else .57)

# The common WorkBot is attached by the renderer. Cancelling the vehicle's
# scale at this mount keeps the driver's height one game unit.
pilot = make_empty("pilot", cfg["pilot"], upper)
pilot.rotation_euler.z = cfg["pilot_turn"]
pilot.scale = (1 / cfg["scale"],) * 3
make_empty("P_BotSeat", cfg["pilot"], upper)
if name == "dozer":
    make_empty("P_SoilPush", (0, -.48, .06), groups["blade"])
elif name == "grader":
    make_empty("P_GradeContact", (0, -.1, .02), groups["grader_work_blade"])
elif name == "drill":
    make_empty("P_DrillContact", (-.48, 0, .12), groups["drill_spin"])
elif name == "launcher":
    make_empty("P_BridgeOutput", (.48, 0, .28), groups["GirderCarrier"])

for obj in list(bpy.data.objects):
    if obj.type == "EMPTY" and obj not in (root, upper, pilot, *groups.values()) and obj.name.startswith("tripo"):
        bpy.data.objects.remove(obj, do_unlink=True)

# Decimate high-poly sculpted parts only. Small gears, windows and railings
# keep their silhouette while the body becomes cheaper on mobile.
for part in parts.values():
    if len(part.data.polygons) < 3000:
        continue
    bpy.ops.object.select_all(action="DESELECT")
    part.select_set(True)
    bpy.context.view_layer.objects.active = part
    modifier = part.modifiers.new("MobileMeshReduction", "DECIMATE")
    modifier.ratio = .72
    bpy.ops.object.modifier_apply(modifier=modifier.name)

root.scale = (cfg["scale"],) * 3
root.rotation_euler.z = cfg["turn"]
bpy.context.view_layer.update()
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = root
bpy.ops.export_scene.gltf(filepath=str(export), export_format="GLB", use_selection=True,
                          export_texcoords=True, export_materials="EXPORT", export_animations=False)
public.write_bytes(export.read_bytes())
print(f"Prepared {name}: {len(parts)} meshes, {export.stat().st_size} bytes")
