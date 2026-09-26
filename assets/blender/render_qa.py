"""Render the exported GLBs for silhouette/scale review; does not modify assets."""
import bpy, math, pathlib
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/qa/assets';OUT.mkdir(parents=True,exist_ok=True)
for name in ['bot','castle','excavator','dozer','grader','launcher','drill','stone-bridge','steel-bridge','soil','stone-resource','iron-resource','crate','minecart','flower']:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models'/f'{name}.glb'))
 scene=bpy.context.scene
 bounds=[o.matrix_world@Vector(c) for o in scene.objects if o.type=='MESH' for c in o.bound_box]
 lo=Vector([min(p[i] for p in bounds) for i in range(3)]);hi=Vector([max(p[i] for p in bounds) for i in range(3)]);target=(lo+hi)/2
 bpy.ops.object.camera_add(location=target+Vector((7,-10,7)))
 camera=bpy.context.object;camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=max(hi-lo)*1.65;scene.camera=camera
 scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True;scene.display.shading.cavity_type='BOTH';scene.display.shading.background_type='WORLD';scene.world=bpy.data.worlds.new('QA');scene.world.color=(.82,.86,.89)
 scene.view_settings.view_transform='Standard';scene.render.resolution_x=600;scene.render.resolution_y=600;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/f'{name}.png');bpy.ops.render.render(write_still=True)
