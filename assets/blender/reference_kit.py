"""Shared Blender primitives and packaging for reference-driven INFRA RUSH assets."""

from pathlib import Path
from mathutils import Vector
import bpy
import json
import math
import shutil

ROOT = Path(__file__).resolve().parents[2]

COLORS = {
    "team": "2D8CFF", "blue_light": "57B9FF", "blue_dark": "173D9A",
    "orange": "FFA62B", "orange_light": "FFD16D", "white": "E8E8EB",
    "face": "F9F9F8", "glass": "A7D8FF", "black": "1A1A1A",
    "track": "262C38", "dark": "223A78", "metal": "AEB6C2",
    "silver": "D9DDE4", "stone": "ABA9A8", "stone_light": "CCC8C1",
    "stone_dark": "777C86", "gold": "FFE16E", "red": "FF5553",
    "lamp": "FFF2BB", "vent": "263445", "stripe": "F5F6F7",
}


def linear(h):
    vals = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in vals)


class Kit:
    def __init__(self, asset_id, category, glb_name):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        self.scene = bpy.context.scene
        self.asset_id = asset_id
        self.category = category
        self.glb_name = glb_name
        self.base = ROOT / "assets" / category / asset_id
        for directory in ("source", "export", "previews"):
            (self.base / directory).mkdir(parents=True, exist_ok=True)
        self.materials = {}

    def mat(self, name):
        if name in self.materials:
            return self.materials[name]
        mat = bpy.data.materials.new(name)
        color = COLORS[name]
        mat.diffuse_color = tuple(int(color[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (1,)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = (*linear(color), 1)
        bsdf.inputs["Roughness"].default_value = .33 if name in {"team", "orange", "blue_light"} else .62
        if name in {"metal", "silver"}:
            bsdf.inputs["Metallic"].default_value = .36
        if name == "glass":
            bsdf.inputs["Alpha"].default_value = .26
            bsdf.inputs["Roughness"].default_value = .12
            mat.surface_render_method = "BLENDED"
        if name == "lamp":
            bsdf.inputs["Emission Color"].default_value = (*linear(color), 1)
            bsdf.inputs["Emission Strength"].default_value = .75
        self.materials[name] = mat
        return mat

    def empty(self, name, parent=None, loc=(0, 0, 0)):
        obj = bpy.data.objects.new(name, None)
        self.scene.collection.objects.link(obj)
        obj.parent = parent
        obj.location = loc
        return obj

    def finish(self, obj, name, parent, loc, mat):
        obj.name = name
        obj.parent = parent
        obj.location = loc
        obj.data.materials.append(self.mat(mat))
        return obj

    def bevel(self, obj, width, segments=5):
        mod = obj.modifiers.new("rounded toy edges", "BEVEL")
        mod.width = width
        mod.segments = segments
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod = obj.modifiers.new("smooth normals", "WEIGHTED_NORMAL")
        bpy.ops.object.modifier_apply(modifier=mod.name)

    def box(self, name, parent, loc, dims, mat, radius=.06, seg=5):
        bpy.ops.mesh.primitive_cube_add(size=1)
        obj = bpy.context.object
        obj.dimensions = dims
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if radius:
            self.bevel(obj, min(radius, min(dims) * .48), seg)
        return self.finish(obj, name, parent, loc, mat)

    def sphere(self, name, parent, loc, radii, mat, segments=24, rings=14):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings)
        obj = bpy.context.object
        obj.scale = radii
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        for poly in obj.data.polygons:
            poly.use_smooth = True
        return self.finish(obj, name, parent, loc, mat)

    def cyl(self, name, parent, loc, radius, depth, mat, axis="Z", vertices=24, radius_edge=.025):
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth)
        obj = bpy.context.object
        if radius_edge:
            self.bevel(obj, radius_edge, 3)
        obj.rotation_euler = (math.pi / 2, 0, 0) if axis == "Y" else ((0, math.pi / 2, 0) if axis == "X" else (0, 0, 0))
        return self.finish(obj, name, parent, loc, mat)

    def beam(self, name, parent, start, end, width, mat, depth=None, radius=.05):
        a, b = Vector(start), Vector(end)
        obj = self.box(name, parent, (a + b) / 2, (width, depth or width, (b - a).length), mat, radius)
        obj.rotation_euler = (b - a).to_track_quat("Z", "Y").to_euler()
        return obj

    def cone(self, name, parent, loc, r1, r2, depth, mat, vertices=24):
        bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=depth)
        obj = bpy.context.object
        self.bevel(obj, min(.025, depth * .1), 3)
        return self.finish(obj, name, parent, loc, mat)

    def torus(self, name, parent, loc, major, minor, mat, axis="Y"):
        bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=28, minor_segments=8)
        obj = bpy.context.object
        if axis == "Y":
            obj.rotation_euler.x = math.pi / 2
        elif axis == "X":
            obj.rotation_euler.y = math.pi / 2
        return self.finish(obj, name, parent, loc, mat)

    def quad_mesh(self, name, parent, verts, faces, mat, bevel=0):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        self.scene.collection.objects.link(obj)
        obj.parent = parent
        obj.data.materials.append(self.mat(mat))
        if bevel:
            self.bevel(obj, bevel, 3)
        return obj

    def uv(self):
        for obj in list(self.scene.objects):
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

    def merge_static(self):
        """Combine same-material pieces under one mechanical pivot for fewer draw calls."""
        groups = {}
        for obj in list(self.scene.objects):
            if obj.type == "MESH" and obj.data.materials:
                groups.setdefault((obj.parent, obj.data.materials[0].name), []).append(obj)
        for objects in groups.values():
            if len(objects) < 2:
                continue
            bpy.ops.object.select_all(action="DESELECT")
            for obj in objects:
                obj.select_set(True)
            bpy.context.view_layer.objects.active = objects[0]
            bpy.ops.object.join()
        bpy.ops.object.select_all(action="DESELECT")

    def clip(self, obj, name, keys, channel="rotation_euler"):
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

    def render(self):
        mesh_objects = [obj for obj in self.scene.objects if obj.type == "MESH"]
        bounds = [obj.matrix_world @ Vector(corner) for obj in mesh_objects for corner in obj.bound_box]
        lo = Vector(min(p[i] for p in bounds) for i in range(3))
        hi = Vector(max(p[i] for p in bounds) for i in range(3))
        center = (lo + hi) / 2
        size = max(hi - lo)
        bpy.ops.object.camera_add()
        cam = bpy.context.object
        cam.data.type = "ORTHO"
        cam.data.ortho_scale = size * 1.38
        self.scene.camera = cam
        self.scene.render.engine = "CYCLES"
        self.scene.cycles.samples = 20
        self.scene.cycles.use_denoising = True
        self.scene.world = bpy.data.worlds.new("preview")
        self.scene.world.use_nodes = True
        background = self.scene.world.node_tree.nodes.get("Background")
        background.inputs["Color"].default_value = (.80, .86, .94, 1)
        background.inputs["Strength"].default_value = .7
        lights = []
        for xyz, energy in [((-3, -4, 7), 700), ((4, 3, 6), 400)]:
            bpy.ops.object.light_add(type="AREA", location=xyz)
            light = bpy.context.object
            light.data.energy = energy
            light.data.size = 5
            lights.append(light)
        self.scene.view_settings.view_transform = "Standard"
        self.scene.render.resolution_x = 900
        self.scene.render.resolution_y = 900
        self.scene.render.resolution_percentage = 100
        self.scene.render.image_settings.file_format = "PNG"
        directions = {"front": Vector((0, -1, .2)), "side": Vector((1, 0, .22)),
                      "back": Vector((0, 1, .2)), "beauty": Vector((.7, -1, .65))}
        for name, direction in directions.items():
            cam.location = center + direction.normalized() * size * 3
            cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
            self.scene.render.filepath = str(self.base / "previews" / f"{name}.png")
            bpy.ops.render.render(write_still=True)
        bpy.data.objects.remove(cam, do_unlink=True)
        for light in lights:
            bpy.data.objects.remove(light, do_unlink=True)

    def save(self, manifest, render=True):
        self.scene.frame_set(1)
        self.merge_static()
        self.uv()
        source = self.base / "source" / f"{self.asset_id}.blend"
        glb = self.base / "export" / f"{self.glb_name}.glb"
        bpy.ops.wm.save_as_mainfile(filepath=str(source), compress=True)
        bpy.ops.export_scene.gltf(filepath=str(glb), export_format="GLB", use_active_scene=True,
                                  export_yup=True, export_animations=True, export_animation_mode="NLA_TRACKS")
        shutil.copy2(glb, ROOT / "public" / "models" / f"{self.glb_name}.glb")
        if render:
            self.render()
        (self.base / "asset.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
        print(f"Saved {self.asset_id}: {glb}")


def manifest(asset_id, category, glb_name, reference_files, mount_points=None, animations=None, damage=None, notes=""):
    return {"id": asset_id, "category": category, "source": f"source/{asset_id}.blend",
            "model": f"export/{glb_name}.glb", "scale": 1.0,
            "mountPoints": mount_points or [], "animations": animations or {},
            "teamColorMaterials": ["team"], "damageStates": damage or [],
            "referenceFiles": [f"../../../docs/references/{ref}.png" for ref in reference_files],
            "notes": notes}
