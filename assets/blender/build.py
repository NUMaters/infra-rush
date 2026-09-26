"""Reference-driven, editable low-poly asset library. Blender 5.x, Z-up, front -Y."""
import bpy, math, os, json
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
OUT=os.path.join(ROOT,'public/models'); os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
COLORS={'team':'2D8CFF','orange':'FFA62B','white':'E8E8EB','dark':'223A78','black':'1A1A1A','track':'344252','glass':'AEEEFF','stone':'D9D0BC','stoneDark':'B4ACA1','steel':'8999AD','gold':'FFCA43','wood':'BA7D39','green':'83C93C','leaf':'69BC35','rock':'A8A5AF','soil':'BC8656'}
def mat(n):
 m=bpy.data.materials.get(n)
 if m:return m
 m=bpy.data.materials.new(n); m.diffuse_color=(*[((int(COLORS[n][i:i+2],16)/255+.055)/1.055)**2.4 for i in (0,2,4)],1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=m.diffuse_color;bs.inputs['Roughness'].default_value=.36 if n in ['team','orange','gold'] else .7
 if n=='steel':bs.inputs['Metallic'].default_value=.45
 return m
parent=None

def finish(o,n,c):
 o.name=n;o.data.materials.append(mat(c));o.parent=parent
 return o

def box(n,p,s,c,b=.06):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.dimensions=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if b:
  mod=o.modifiers.new('soft toy edges','BEVEL');mod.width=b;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
  mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
 return finish(o,n,c)

def sphere(n,p,s,c,seg=16,rings=10):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=p);o=bpy.context.object;o.scale=s
 for f in o.data.polygons:f.use_smooth=True
 return finish(o,n,c)

def cyl(n,p,r,d,c,vertices=16):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=d,location=p);o=bpy.context.object
 mod=o.modifiers.new('edge','BEVEL');mod.width=.025;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
 return finish(o,n,c)

def beam(n,a,b,w,c):
 a=Vector(a);b=Vector(b);o=box(n,(a+b)/2,(w,w,(b-a).length),c,w*.18);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o

def empty(n,p=(0,0,0)):
 o=bpy.data.objects.new(n,None);bpy.context.collection.objects.link(o);o.location=p;o.parent=parent;return o

def bot():
 global parent
 sphere('body',(0,0,.43),(.28,.20,.32),'team')
 sphere('vest',(0,-.002,.44),(.29,.208,.205),'orange')
 # broad reflective waist band and two vertical front strips
 cyl('reflective belt',(0,0,.34),.292,.055,'white').scale.y=.73
 for x in [-.17,.17]:box('reflective strip',(x,-.187,.49),(.05,.03,.25),'white',.012)
 box('vest zip',(0,-.216,.45),(.035,.022,.25),'orange',.007)
 sphere('head',(0,0,.73),(.272,.21,.235),'team')
 sphere('face',(0,-.189,.725),(.205,.045,.139),'white')
 for x in [-.067,.067]:sphere('eye',(x,-.231,.738),(.025,.016,.048),'black',12,8)
 sphere('helmet dome',(0,0,.88),(.3,.242,.17),'team')
 cyl('helmet brim',(0,-.013,.842),.328,.047,'team',24).scale.y=.83
 box('helmet ridge',(0,-.012,.987),(.06,.3,.047),'team',.02)
 for side,x in [('left',-.345),('right',.345)]:
  root=empty('arm_'+side,(x,0,.56));old=parent;parent=root
  sphere('sleeve',(0,0,-.055),(.084,.10,.14),'team');sphere('glove',(0,-.012,-.17),(.081,.087,.091),'dark');parent=old
 for side,x in [('left',-.145),('right',.145)]:
  root=empty('leg_'+side,(x,0,.16));old=parent;parent=root
  sphere('leg',(0,0,0),(.087,.085,.085),'team');box('boot',(0,-.035,-.095),(.18,.245,.13),'dark',.055);parent=old

def flag(x,y,z,w=.7):
 box('banner',(x,y,z),(w,.055,w*1.3),'team',.04)
 # crown silhouette formed by triangular teeth + lower bar
 box('crown',(x,y-.035,z),(w*.46,.02,w*.17),'white',.005)
 for dx in [-.18,0,.18]:
  bpy.ops.mesh.primitive_cone_add(vertices=3,radius1=w*.13,depth=.025,location=(x+w*dx,y-.052,z+w*.13));o=bpy.context.object;o.rotation_euler[0]=math.pi/2;finish(o,'crown tip','white')

def castle():
 for x,y,r,h in [(-1.7,0,.67,2.3),(1.7,0,.67,2.3),(0,.65,.87,3.1)]:
  for i in range(int(h/.42)):cyl('tower course',(x,y,.22+i*.42),r,.405,'stone',16)
  cyl('battlement ring',(x,y,h),r+.12,.30,'stone')
  for a in range(8):box('merlon',(x+math.cos(a*math.pi/4)*(r+.02),y+math.sin(a*math.pi/4)*(r+.02),h+.23),(.3,.3,.36),'stone',.05)
  sphere('dome',(x,y,h+.36),(r*.9,r*.9,.58),'team')
  sphere('finial',(x,y,h+.96),(.10,.1,.1),'gold',12,8)
  box('window',(x,y-r-.009,h-.6),(.18,.03,.32),'track',.07)
 for x in [-1.03,1.03]:
  for z in [.25,.75,1.25]:box('wall',(x,-.5,z),(.85,.6,.48),'stone',.05)
 for z in [.25,.75,1.25,1.75]:
  for x in [-.67,.67]:box('gateway',(x,-.65,z),(.35,.75,.48),'stone',.05)
 # arch voussoirs around dark arched opening
 box('gate darkness',(0,-.53,.65),(1.04,.12,1.25),'track',.05)
 sphere('gate arch',(0,-.55,1.2),(.52,.07,.52),'track')
 for i in range(9):
  a=math.pi*i/8;o=box('arch stone',(math.cos(a)*.7,-.73,1.18+math.sin(a)*.7),(.33,.55,.30),'stone',.04);o.rotation_euler[1]=-a
 for x in [-2.2,2.2]:
  for y in [-1.6,1.2]:
   for z in [.22,.64,1.06]:cyl('corner',(x,y,z),.29,.4,'stone',12)
 for x in [-1.22,1.22]:flag(x,-.91,1.7,.55)
 cyl('flagpole',(0,.65,4.15),.04,1,'steel');sphere('pole gold',(0,.65,4.65),(.095,.095,.095),'gold');flag(.42,.65,4.4,.65)

def wheel(x,y,z,r=.32):
 o=cyl('rubber',(x,y,z),r,.26,'track');o.rotation_euler[1]=math.pi/2
 o=cyl('hub',(x+(.145 if x>0 else -.145),y,z),r*.53,.035,'orange');o.rotation_euler[1]=math.pi/2

def tracks(length=1.65):
 for x in [-.67,.67]:
  box('crawler',(x,0,.31),(.39,length,.5),'track',.2)
  for y in [-length*.35,0,length*.35]:wheel(x,y,.32,.23)
  for y in range(9):box('tread',(x,(y-4)*length/9,.55),(.41,.12,.065),'black',.015)

def cabin(y=.05):
 # Open front and side glass keeps actual pilot readable.
 box('cabin floor',(0,y,.78),(1.08,.95,.18),'team')
 box('rear engine',(0,y+.66,1.05),(1.05,.50,.60),'orange',.13)
 for x in [-.49,.49]:
  for yy in [-.42,.42]:beam('cabin pillar',(x,y+yy,.85),(x*.86,y+yy*.9,1.91),.09,'white')
 box('roof',(0,y,1.97),(1.1,.99,.15),'white',.09)
 box('rear glass',(0,y+.41,1.45),(.79,.03,.80),'glass',.04)
 for x in [-.32,.32]:box('lamp',(x,y-.5,1.98),(.19,.10,.16),'gold',.035)
 cyl('beacon',(0,y+.12,2.12),.095,.16,'orange')
 box('seat',(0,y+.14,1.08),(.55,.4,.28),'track',.09)
 old=globals()['parent'];pilot=empty('pilot',(0,y-.09,.9));globals()['parent']=pilot;bot();pilot.scale=(.82,.82,.82);globals()['parent']=old
 for i in range(3):box('vent',(0,y+.925,1.02+i*.12),(.57,.025,.047),'track',.014)

def vehicle(kind):
 global parent
 if kind=='grader':
  for x in [-.70,.70]:
   for y in [-1.45,.35,1.0]:wheel(x,y,.4,.4)
  box('long frame',(0,-.35,.73),(.4,3.0,.25),'team');cabin(.5)
  box('blade',(0,-.62,.28),(1.6,.24,.43),'steel');box('blade edge',(0,-.77,.08),(1.7,.06,.08),'orange')
 else:tracks();cabin(.2 if kind!='launcher' else .85)
 if kind in ['excavator','drill']:
  old=parent;pivot=empty('boom',(0,-.35,1.13));parent=pivot
  beam('boom beam',(0,0,0),(0,-.6,1.03),.26,'team');beam('piston',(.16,-.05,.15),(.16,-.48,.93),.09,'steel')
  arm=empty('arm',(0,-.6,1.03));parent=arm
  beam('arm beam',(0,0,0),(0,-.68,-.75),.19,'team')
  bucket=empty('bucket',(0,-.68,-.75));parent=bucket
  if kind=='excavator':
   box('bucket scoop',(0,-.10,-.08),(.64,.47,.3),'team',.10)
   for x in [-.22,0,.22]:box('tooth',(x,-.35,-.18),(.12,.23,.10),'steel',.025)
  else:
   for i in range(7):
    o=cyl('drill',(0,-.06-i*.105,-.06),.36*(1-i/8),.13,'steel');o.rotation_euler[0]=math.pi/2
   o=cyl('drill collar',(0,.04,-.06),.40,.16,'orange');o.rotation_euler[0]=math.pi/2
  parent=old
 if kind=='dozer':
  old=parent;parent=empty('blade',(0,-1.05,.38))
  box('blade face',(0,-.12,.05),(1.85,.22,.67),'orange',.10);box('cut edge',(0,-.30,-.27),(1.9,.18,.10),'gold',.03)
  for x in [-.75,.75]:beam('push arm',(x,.5,.1),(x,-.12,.1),.14,'team')
  parent=old
 if kind=='launcher':
  old=parent;parent=empty('truss',(0,0,2.40))
  for x in [-.55,.55]:
   for z in [0,.6]:beam('truss rail',(x,1.4,z),(x,-3.3,z),.13,'team')
   for i in range(8):beam('truss diagonal',(x,1.4-i*.59,0),(x,1.4-(i+1)*.59,.6),.085,'team')
  for y in [1.35,-3.25]:box('cross',(0,y,.3),(1.35,.17,.85),'orange')
  parent=old
  old=parent;parent=empty('girder',(0,-1.2,1.92));box('concrete girder',(0,0,0),(1.45,4.3,.23),'stone');parent=old
  for x in [-1,1]:
   for y in [-1.3,1.2]:
    old=parent;parent=empty('outrigger',(x,y,.50));cyl('leg',(0,0,.12),.12,.8,'steel');box('foot',(0,0,-.28),(.58,.58,.13),'stone');box('collar',(0,0,.33),(.37,.33,.24),'orange');parent=old

def bridge(steel=False):
 c='steel' if steel else 'stone'
 for x in [-1.32,1.32]:
  for y in [-2.7,2.7]:
   for z in [-.7,-.25,.2,.65]:cyl('pillar',(x,y,z),.31,.44,c,12)
   box('cap',(x,y,.90),(.62,.62,.25),c)
   for z in [-.1,.55]:box('metal collar',(x,y,z),(.65,.65,.16),'steel')
   flag(x,y-.34,.44,.30)
 for x in [-.83,0,.83]:
  for y in [-2.5,-1.5,-.5,.5,1.5,2.5]:box('deck tile',(x,y,-.08),(.80,.96,.24),c,.04)
 for x in [-1.22,1.22]:
  box('parapet',(x,0,.13),(.22,5.5,.30),c)
  beam('beam',(x,-2.7,-.5),(x,2.7,-.5),.25,c)
  if steel:
   for y in [-2,-.7,.7,2]:
    beam('brace',(x,y-.5,-.75),(x,y+.5,-.22),.09,'steel')
    beam('brace',(x,y+.5,-.75),(x,y-.5,-.22),.09,'steel')
   for y in range(11):sphere('rivet',(x, y*.5-2.5,.30),(.06,.06,.045),'white',8,6)

def tree():
 cyl('trunk',(0,0,.5),.14,1,'wood',8)
 for p,s in [((0,0,1.2),(.63,.54,.66)),((0,0,1.7),(.40,.38,.52)),((-.35,0,1.2),(.33,.38,.4)),((.32,.05,1.25),(.35,.38,.4))]:sphere('foliage',p,s,'leaf',10,7)

def props():
 for x in [-.65,.65]:box('fence post',(x,0,.42),(.18,.18,.85),'wood')
 for z in [.3,.65]:box('fence rail',(0,0,z),(1.4,.12,.13),'wood')

def merge_static():
 groups={}
 for o in list(bpy.context.scene.objects):
  if o.type=='MESH':groups.setdefault((o.parent.name if o.parent else '',o.data.materials[0].name),[]).append(o)
 for key,objects in groups.items():
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name=key[1]+'_mesh'

stats=[]
for name,fn in [('bot',bot),('castle',castle),('excavator',lambda:vehicle('excavator')),('dozer',lambda:vehicle('dozer')),('grader',lambda:vehicle('grader')),('launcher',lambda:vehicle('launcher')),('drill',lambda:vehicle('drill')),('stone-bridge',bridge),('steel-bridge',lambda:bridge(True)),('tree',tree),('fence',props)]:
 scene=bpy.data.scenes.new(name);bpy.context.window.scene=scene;parent=None
 fn();merge_static()
 bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',use_active_scene=True,export_yup=True,export_animations=False)
 tris=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in scene.objects if o.type=='MESH')
 stats.append({'asset':name,'triangles':tris,'meshes':sum(o.type=='MESH' for o in scene.objects),'bytes':os.path.getsize(os.path.join(OUT,name+'.glb'))})
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets/blender/infra-rush.blend'))
json.dump(stats,open(os.path.join(OUT,'manifest.json'),'w'),indent=2)
print(json.dumps(stats))
