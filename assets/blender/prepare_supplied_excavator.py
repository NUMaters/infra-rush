"""Turn the supplied textured excavator into the game's movable hierarchy.

Run with Blender in background mode. The original GLB remains under source/;
this script writes the editable rigged blend and the two runtime GLB copies.
"""

from pathlib import Path
import bpy


ROOT = Path(__file__).resolve().parents[2]
ASSET = ROOT / "assets/vehicles/excavator"
SOURCE = ASSET / "source/supplied-excavator.glb"
BLEND = ASSET / "source/excavator.blend"
EXPORT = ASSET / "export/excavator.glb"
PUBLIC = ROOT / "public/models/excavator.glb"
SCALE = 3.6


def empty(name, at, parent=None):
    object_ = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(object_)
    object_.location = at
    bpy.context.view_layer.update()
    if parent is not None:
        parent_keep_world(object_, parent)
    return object_


def parent_keep_world(object_, parent):
    world = object_.matrix_world.copy()
    object_.parent = parent
    object_.matrix_world = world


bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
parts = {int(o.name.rsplit("_", 1)[1]): o for o in bpy.data.objects if o.type == "MESH"}
assert set(parts) == set(range(26)), "The supplied model topology changed; inspect before rebuilding"

root = empty("Root", (0, 0, 0))
upper = empty("UpperBody", (0, 0.17, 0.18), root)
boom = empty("boom", (-0.11, 0.08, 0.32), upper)
# The new reference model fuses the boom and dipper in one mesh. Preserve that
# silhouette as a rigid assembly instead of tearing it apart at arbitrary
# material islands. The joint remains as a named future modeling target.
empty("arm", (-0.11, -0.12, 0.64), boom)
bucket = empty("bucket", (-0.11, -0.33, 0.34), boom)

# Original object indices were checked against the supplied file in Blender.
# Tracks stay on the chassis; the cabin and engine slew; only the boom/arm and
# bucket participate in the digging motion.
track_left = empty("Track_L", (-0.21, 0.2, 0.09), root)
track_right = empty("Track_R", (0.22, 0.2, 0.09), root)
for index, object_ in parts.items():
    if index in (2, 15):
        parent = track_right
    elif index in (3, 12, 21, 22):
        parent = track_left
    elif index in (4,):
        parent = root
    elif index in (5, 20, 24, 25):
        parent = bucket
    elif index in (1, 14):
        parent = boom
    else:
        parent = upper
    parent_keep_world(object_, parent)

# Parts 17 and 23 are the two thin panels in the cab's boom-side window.
# The supplied texture makes them opaque blue, hiding the driver completely.
# Their materials are unique to these panels, so tint and transparency can be
# adjusted without making the white cab shell or blue boom see-through.
for index in (17, 23):
    material = parts[index].active_material
    material.surface_render_method = "BLENDED"
    shader = material.node_tree.nodes.get("Principled BSDF")
    color_input = shader.inputs["Base Color"]
    for link in list(color_input.links):
        material.node_tree.links.remove(link)
    color_input.default_value = (0.88, 0.94, 1.0, 1.0)
    shader.inputs["Alpha"].default_value = 0.12

# The supplied sculpt has 177k triangles. Preserve the small silhouette
# details, but simplify the large textured surfaces for mobile rendering.
for object_ in parts.values():
    if len(object_.data.polygons) < 3000:
        continue
    bpy.ops.object.select_all(action="DESELECT")
    object_.select_set(True)
    bpy.context.view_layer.objects.active = object_
    modifier = object_.modifiers.new("MobileMeshReduction", "DECIMATE")
    modifier.ratio = 0.62
    bpy.ops.object.modifier_apply(modifier=modifier.name)

# The runtime replaces this empty with the shared animated WorkBot. Inverse
# local scale cancels the machine's size conversion so the pilot stays ~1 unit.
pilot = empty("pilot", (0.085, 0.21, 0.26), upper)
pilot.scale = (1 / SCALE,) * 3
empty("P_BotSeat", (0.085, 0.21, 0.26), upper)
empty("P_DigContact", (-0.11, -0.51, 0.08), bucket)

for object_ in list(bpy.data.objects):
    if object_.name == "excavator 3d model":
        bpy.data.objects.remove(object_, do_unlink=True)

root.scale = (SCALE,) * 3
bpy.context.view_layer.update()

# Keep only the game asset in the saved source and export. Texture images are
# embedded by glTF; Blender keeps the editable object hierarchy and UVs.
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
bpy.ops.object.select_all(action="DESELECT")
for object_ in bpy.data.objects:
    object_.select_set(True)
bpy.context.view_layer.objects.active = root
bpy.ops.export_scene.gltf(
    filepath=str(EXPORT),
    export_format="GLB",
    use_selection=True,
    export_texcoords=True,
    export_materials="EXPORT",
    export_animations=False,
)
PUBLIC.write_bytes(EXPORT.read_bytes())
print(f"Prepared excavator: {EXPORT.stat().st_size} bytes, bucket and boom rigged")
