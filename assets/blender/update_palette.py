import bpy, ast, pathlib
p=pathlib.Path(__file__).with_name('build.py')
module=ast.parse(p.read_text())
colors={}
for node in module.body:
 if isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='COLORS' for t in node.targets):colors=ast.literal_eval(node.value)
for m in bpy.data.materials:
 if m.name not in colors:continue
 c=colors[m.name];rgba=(*[((int(c[i:i+2],16)/255+.055)/1.055)**2.4 for i in (0,2,4)],1)
 m.diffuse_color=rgba
 if m.use_nodes:m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=rgba
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
