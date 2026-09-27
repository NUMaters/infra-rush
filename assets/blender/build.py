"""Reference-driven, editable low-poly asset library. Blender 5.x, Z-up, front -Y."""
import bpy, math, os, json
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
OUT=os.path.join(ROOT,'public/models'); os.makedirs(OUT,exist_ok=True)
# GUI runs are repeatable: discard prior generated scenes before rebuilding.
start_scene=bpy.data.scenes.new('_asset_start')
bpy.context.window.scene=start_scene
for old_scene in list(bpy.data.scenes):
 if old_scene != start_scene:bpy.data.scenes.remove(old_scene)
for old_object in list(bpy.data.objects):
 bpy.data.objects.remove(old_object,do_unlink=True)
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

def scene_part(name,collection=None):
 objects=collection if collection is not None else bpy.context.scene.objects
 return next((o for o in objects if o.name==name or o.name.startswith(name+'.')),None)

def bot():
 global parent
 sphere('body',(0,0,.43),(.28,.20,.32),'team')
 sphere('padded safety vest',(0,-.005,.455),(.304,.224,.267),'orange',24,14)
 # broad reflective waist band and two vertical front strips
 cyl('reflective belt',(0,0,.34),.299,.047,'white',24).scale.y=.745
 for x in [-.17,.17]:box('reflective strip',(x,-.175,.46),(.05,.017,.26),'white',.009)
 box('vest zip',(0,-.216,.45),(.035,.022,.25),'orange',.007)
 sphere('head',(0,0,.73),(.272,.21,.235),'team')
 sphere('face',(0,-.189,.725),(.225,.045,.139),'white')
 for x in [-.067,.067]:sphere('eye',(x,-.231,.738),(.025,.016,.048),'black',12,8)
 sphere('helmet dome',(0,0,.88),(.3,.242,.17),'team')
 cyl('helmet brim',(0,-.013,.842),.328,.047,'team',24).scale.y=.83
 box('helmet ridge',(0,-.012,1.035),(.075,.28,.06),'team',.025)
 box('helmet ridge front',(0,-.23,.872),(.10,.045,.10),'team',.022)
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
 # Connected perimeter courses keep the castle a compact building, not isolated posts.
 for z in [.23,.65,1.07]:
  for x in [-2.12,2.12]:
   for y in [-1.0,-.35,.30,.95]:box('curtain wall',(x,y,z),(.35,.63,.40),'stone',.055)
  for x in [-1.5,-.75,0,.75,1.5]:box('rear wall',(x,1.18,z),(.72,.35,.40),'stone',.05)
 for x in [-1.22,1.22]:flag(x,-.94,1.25,.72)
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
 for x in [-.48,.48]:
  box('door lower',(x,y+.06,1.03),(.08,.79,.38),'white',.035)
  box('mirror',(x*1.26,y-.38,1.68),(.14,.08,.29),'track',.035)
 wheel_support=beam('steering column',(0,y-.33,.97),(0,y-.25,1.27),.065,'track')
 bpy.ops.mesh.primitive_torus_add(major_radius=.16,minor_radius=.027,major_segments=12,minor_segments=6,location=(0,y-.27,1.29));steer=bpy.context.object;steer.rotation_euler[0]=math.radians(28);finish(steer,'steering wheel','track')
 old=globals()['parent'];pilot=empty('pilot',(0,y-.09,.9));globals()['parent']=pilot;bot();pilot.scale=(.82,.82,.82);globals()['parent']=old
 for i in range(3):box('vent',(0,y+.925,1.02+i*.12),(.57,.025,.047),'track',.014)

def vehicle(kind):
 global parent
 if kind=='grader':
  for x in [-.70,.70]:
   for y in [-1.45,.35,1.0]:wheel(x,y,.4,.4)
  box('long frame',(0,-.35,.73),(.4,3.0,.25),'team');cabin(.5)
  old=parent;parent=empty('grader_work_blade',(0,-.40,.31))
  box('blade',(0,0,0),(2.0,.24,.52),'steel');box('blade edge',(0,-.15,-.23),(2.1,.08,.10),'orange')
  for x in [-.5,.5]:beam('blade hydraulic',(x,0,.44),(x,0,.07),.10,'orange')
  parent=old
 else:tracks();cabin(.2 if kind!='launcher' else .85)
 if kind in ['excavator','dozer','drill','launcher']:
  box('track cross-chassis',(0,0,.50),(1.65,1.45,.32),'track',.11)
  cyl('slewing turntable',(0,.14,.73),.68,.23,'team',20)
  box('upper deck',(0,.16,.84),(1.42,1.55,.23),'team',.11)
 if kind in ['excavator','drill']:
  old=parent;pivot=empty('boom',(0,-.35,1.13));parent=pivot
  beam('boom beam',(0,0,0),(0,-.6,1.03),.26,'team');beam('piston',(.16,-.05,.15),(.16,-.48,.93),.09,'steel')
  arm=empty('arm',(0,-.6,1.03));parent=arm
  beam('arm beam',(0,0,0),(0,-.68,-.75),.19,'team')
  bucket=empty('bucket',(0,-.68,-.75));parent=bucket
  if kind=='excavator':
   box('bucket curved back',(0,.14,-.08),(.82,.13,.46),'team',.09)
   box('bucket bowl floor',(0,-.13,-.32),(.78,.56,.12),'team',.05)
   for x in [-.22,0,.22]:box('tooth',(x,-.43,-.26),(.12,.23,.10),'steel',.025)
  else:
   old=parent;parent=empty('drill_spin')
   for i in range(7):
    o=cyl('drill',(0,-.06-i*.105,-.06),.36*(1-i/8),.13,'steel');o.rotation_euler[0]=math.pi/2
   o=cyl('drill collar',(0,.04,-.06),.40,.16,'orange');o.rotation_euler[0]=math.pi/2
   parent=old
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
 box('solid bridge bed',(0,0,-.225),(2.58,5.55,.22),c,.055)
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
  else:
   for i in range(6):
    y0=-2.55+i*.85;y1=y0+.85
    z0=-.57+.24*(1-(y0/2.7)**2);z1=-.57+.24*(1-(y1/2.7)**2)
    beam('arched stone support',(x,y0,z0),(x,y1,z1),.18,'stoneDark')

def tree():
 cyl('trunk',(0,0,.5),.14,1,'wood',8)
 for p,s in [((0,0,1.2),(.63,.54,.66)),((0,0,1.7),(.40,.38,.52)),((-.35,0,1.2),(.33,.38,.4)),((.32,.05,1.25),(.35,.38,.4))]:sphere('foliage',p,s,'leaf',10,7)

def props():
 for x in [-.65,.65]:box('fence post',(x,0,.42),(.18,.18,.85),'wood')
 for z in [.3,.65]:box('fence rail',(0,0,z),(1.4,.12,.13),'wood')

def faceted_rock(n,p,s,c):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=p)
 o=bpy.context.object;o.scale=s
 return finish(o,n,c)

def soil_resource():
 sphere('soft earth base',(0,0,.28),(1.30,.88,.43),'soil',18,9)
 sphere('upper earth',(0,.12,.55),(.78,.62,.39),'soil',14,8)
 for x,y,z,s in [(-1.03,-.42,.23,.31),(-.57,.58,.28,.27),(.63,-.48,.36,.38),(.99,.10,.29,.25),(-.05,-.05,.89,.23)]:
  faceted_rock('embedded warm stone',(x,y,z),(s,s*.9,s*.75),'soil')
 for x,y in [(-.7,-.7),(-.23,.75),(.14,-.79),(.79,.55)]:
  sphere('earth pebble',(x,y,.12),(.10,.075,.045),'soil',8,5)

def stone_resource():
 for x,y,z,s in [(-.56,.20,.71,.67),(.40,.31,.83,.82),(-.80,-.28,.35,.38),(.84,-.30,.42,.45),(.06,-.62,.40,.42),(-.18,.55,.27,.25)]:
  faceted_rock('quarry stone',(x,y,z),(s,s*.82,s*.8),'rock')
 for x,y in [(-.55,-.68),(.47,-.69),(.96,.22)]:
  faceted_rock('small quarry stone',(x,y,.12),(.20,.17,.18),'stoneDark')

def iron_ingot(n,x,y,z,s):
 w=s*.57;h=s*.24;d=s*.36
 vertices=[(x+sx*w,y+sy*d,z) for sx,sy in [(-1,-1),(1,-1),(1,1),(-1,1)]]
 vertices += [(x+sx*w*.78,y+sy*d*.78,z+h) for sx,sy in [(-1,-1),(1,-1),(1,1),(-1,1)]]
 faces=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
 mesh=bpy.data.meshes.new(n);mesh.from_pydata(vertices,[],faces);mesh.update()
 o=bpy.data.objects.new(n,mesh);bpy.context.collection.objects.link(o)
 bevel=o.modifiers.new('soft cast edges','BEVEL');bevel.width=s*.025;bevel.segments=2
 bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=bevel.name)
 return finish(o,n,'steel')

def iron_resource():
 for x,y,z,s in [(-.40,-.24,.04,.87),(.39,-.24,.04,.87),(0,.28,.28,1.08)]:
  iron_ingot('rounded iron ingot',x,y,z,s)

def crate():
 box('wood crate body',(0,0,.45),(.88,.88,.88),'wood',.055)
 for side in [-1,1]:
  for z in [.06,.84]:box('crate horizontal batten',(0,side*.455,z),(.98,.10,.11),'wood',.018)
  for x in [-.42,.42]:box('crate vertical batten',(x,side*.455,.45),(.10,.10,.89),'wood',.018)
  beam('crate diagonal brace',(-.37,side*.51,.12),(.37,side*.51,.78),.065,'wood')
  for x in [-.42,.42]:box('crate side post',(side*.455,x,.45),(.10,.10,.89),'wood',.018)
 box('crate lid',(0,0,.91),(.98,.98,.10),'wood',.025)

def minecart():
 box('cart base',(0,0,.33),(1.40,1.20,.18),'wood',.055)
 box('cart trough floor',(0,0,.63),(1.38,1.08,.12),'track',.04)
 for x in [-.70,.70]:box('cart side',(x,0,.80),(.10,1.17,.42),'steel',.035)
 for y in [-.59,.59]:box('cart end',(0,y,.80),(1.50,.10,.42),'steel',.035)
 for x in [-.58,.58]:
  for y in [-.46,.46]:
   o=cyl('cart wheel',(x,y,.18),.21,.11,'track',12);o.rotation_euler[1]=math.pi/2
   o=cyl('cart wheel hub',(x+(.07 if x>0 else -.07),y,.18),.09,.02,'orange',12);o.rotation_euler[1]=math.pi/2
 for x,y,z,s in [(-.36,-.25,.91,.28),(.18,-.32,.94,.32),(.43,.21,.87,.25),(-.19,.28,.99,.30)]:
  faceted_rock('cart stone',(x,y,z),(s,s*.88,s*.81),'rock')
 for x in [-.55,.55]:beam('cart tow handle',(x,.61,.41),(x,.93,.36),.07,'wood')

def flower():
 cyl('flower stem',(0,0,.13),.022,.25,'green',7)
 for i in range(5):
  a=i*math.tau/5
  sphere('white petal',(math.cos(a)*.16,math.sin(a)*.16,.31),(.125,.095,.045),'white',8,5)
 sphere('gold center',(0,0,.33),(.09,.09,.05),'gold',8,5)

def refinement(kind):
 """Sheet-specific details added as editable Blender objects before GLB export.

 The base shapes stay deliberately simple; hinges, buckets, blades and launcher
 girders remain children of their animation empties instead of being joined to
 the chassis. Coordinates use Blender Z-up and the machinery faces negative Y.
 """
 global parent
 if kind=='bot':
  # The reference has one large, clean white face and a small central vest clasp.
  sphere('face inset',(0,-.209,.722),(.216,.026,.137),'white',20,12)
  for x in [-.069,.069]:sphere('tall oval eye',(x,-.239,.734),(.022,.013,.050),'black',12,8)
  box('vest clasp',(0,-.230,.532),(.065,.035,.105),'gold',.016)
  for x in [-.19,.19]:sphere('helmet ear',(x,-.024,.837),(.043,.06,.065),'team',12,8)
 if kind=='castle':
  # Blue rounded rooftops, crenellations, keystone and raised flags are the
  # most distinctive parts of the official castle sheet at game camera scale.
  for x,y,r,z in [(-1.7,0,.67,2.3),(1.7,0,.67,2.3),(0,.65,.87,3.1)]:
   cyl('roof blue drum',(x,y,z+.22),r*.84,.34,'team',16)
   sphere('roof dome cap',(x,y,z+.43),(r*.79,r*.79,.52),'team',16,10)
   for dx in [-.16,.16]:box('front window frame',(x+dx,y-r-.047,z-.55),(.035,.05,.34),'stoneDark',.012)
  box('gold keystone',(0,-.81,1.86),(.23,.09,.29),'gold',.025)
  for x in [-1.24,1.24]:
   cyl('banner pole',(x,-.91,1.23),.025,.95,'steel',10)
   sphere('banner finial',(x,-.91,1.73),(.055,.055,.055),'gold',10,7)
 if kind in ['excavator','dozer','drill','launcher','grader']:
  # Common cabin pieces; the open front preserves the visibly seated Bot.
  for x in [-.51,.51]:
   box('cab side sill',(x,-.025,1.19),(.075,.95,.075),'white',.018)
   beam('windshield slant',(x,-.47,.94),(x*.93,-.43,1.94),.07,'white')
   sphere('side mirror glass',(x*1.26,-.40,1.68),(.044,.035,.105),'glass',12,8)
  box('windshield top',(0,-.46,1.85),(1.0,.07,.10),'white',.02)
  for x in [-.31,.31]:
   box('headlight rim',(x,-.55,1.99),(.215,.08,.185),'track',.03)
   box('headlight lens',(x,-.601,1.99),(.16,.025,.135),'gold',.028)
  box('beacon base',(0,.13,2.035),(.25,.25,.08),'track',.025)
  cyl('beacon amber',(0,.13,2.15),.095,.14,'orange',16)
  for x in [-.24,0,.24]:
   box('engine vent',(x,.924,1.04),(.12,.031,.28),'track',.015)
  box('side brand plate',(.535,.52,1.15),(.025,.35,.19),'white',.012)
  for x in [-.53,.53]:
   box('grab handle',(x,-.38,1.08),(.042,.045,.23),'orange',.017)
 if kind in ['excavator','dozer','drill','launcher']:
  # Thick, continuous crawler silhouette with visible segmented rubber pads.
  for x in [-.67,.67]:
   box('rubber belt',(x,0,.31),(.44,1.57,.46),'black',.21)
   box('crawler side wall',(x*1.33,0,.31),(.065,1.53,.34),'black',.08)
   for y in [-.58,-.29,0,.29,.58]:
    o=cyl('drive roller',(x*1.49,y,.31),.19,.045,'track',12);o.rotation_euler[1]=math.pi/2
   for y in [-.68,-.46,-.23,0,.23,.46,.68]:
    box('track pad',(x, y,.09),(.43,.17,.065),'black',.02)
    box('track ridge',(x, y,.54),(.42,.07,.06),'black',.014)
  for x in [-.69,.69]:
   for y in [-.55,.55]:
    o=cyl('orange sprocket',(x*1.49,y,.32),.12,.08,'orange',16);o.rotation_euler[1]=math.pi/2
   box('blue crawler side panel',(x*1.58,0,.32),(.065,.98,.26),'team',.045)
 if kind in ['excavator','drill']:
  # Joint caps and paired hydraulic cylinders echo the sheet's color blocking.
  for x in [-.18,.18]:
   beam('boom hydraulic',(x,-.30,1.02),(x,-.75,1.77),.11,'orange')
   beam('boom chrome',(x,-.56,1.40),(x,-.70,1.74),.07,'steel')
  for y,z,r in [(-.35,1.13,.25),(-.95,2.16,.23)]:
   for x in [-.30,.30]:
    o=cyl('orange pivot disc',(x,y,z),r,.065,'orange',18);o.rotation_euler[1]=math.pi/2
    o=cyl('pivot inset',(x+(.038 if x>0 else -.038),y,z),r*.42,.014,'team',16);o.rotation_euler[1]=math.pi/2
  box('rear engine side',(.49,.74,1.11),(.17,.43,.44),'orange',.08)
  for z in [.98,1.10,1.22]:box('rear vent stripe',(.584,.70,z),(.016,.24,.034),'track',.012)
  pivot=scene_part('boom')
  if pivot:
   arm=scene_part('arm',pivot.children)
   if arm:
    bucket=scene_part('bucket',arm.children)
    if bucket:
     old=parent;parent=bucket
     if kind=='excavator':
      box('bucket rolled lip',(0,-.43,-.16),(.80,.10,.14),'team',.05)
      for x in [-.39,.39]:
       box('bucket cheek',(x,-.13,-.08),(.09,.58,.49),'team',.045)
       sphere('bucket side pin',(x*1.12,.14,.04),(.08,.07,.08),'orange',12,8)
      for x in [-.30,-.10,.10,.30]:box('bucket tooth',(x,-.52,-.24),(.10,.19,.09),'steel',.026)
     else:
      spin=scene_part('drill_spin',bucket.children)
      if spin: parent=spin
      for i in range(4):
       z=-.06-i*.025
       box('drill spiral tooth',(0,-.24-i*.12,z),(.18,.09,.16),'gold',.03)
     parent=old
 if kind=='dozer':
  blade=scene_part('blade')
  if blade:
   old=parent;parent=blade
   box('blade bright inside',(0,-.263,.10),(1.65,.035,.48),'orange',.045)
   box('blade upper rail',(0,-.275,.39),(1.92,.10,.11),'orange',.035)
   sweep=[(-.48,-.28),(-.43,-.13),(-.33,.10),(-.22,.38)]
   vertices=[(x,y,z) for y,z in sweep for x in [-.79,.79]]
   faces=[(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(sweep)-1)]
   mesh=bpy.data.meshes.new('curved dozer scoop');mesh.from_pydata(vertices,[],faces);mesh.update()
   scoop=bpy.data.objects.new('curved dozer scoop',mesh);bpy.context.collection.objects.link(scoop)
   solid=scoop.modifiers.new('blade thickness','SOLIDIFY');solid.thickness=.045
   bpy.context.view_layer.objects.active=scoop;bpy.ops.object.modifier_apply(modifier=solid.name)
   finish(scoop,'curved dozer scoop','orange')
   for x in [-.85,.85]:box('blade side cheek',(x,-.22,.04),(.20,.32,.67),'orange',.065)
   parent=old
  for x in [-.70,.70]:
   beam('lift cylinder',(x,-.43,.75),(x,-1.12,.40),.10,'steel')
   sphere('lift pivot',(x,-.43,.75),(.15,.15,.15),'orange',12,8)
 if kind=='grader':
  # Three large rubber wheels per side, a long blue nose, front lights,
  # orange articulated link and suspended grader blade are legible in 3/4 view.
  box('long engine hood',(0,-.95,1.05),(.86,1.25,.43),'team',.13)
  box('front grille',(0,-1.62,1.05),(.72,.06,.29),'track',.028)
  for x in [-.37,.37]:
   box('nose lamp',(x,-1.64,1.26),(.18,.06,.18),'gold',.03)
   beam('front fork',(x,-.77,.85),(x,-1.48,.55),.13,'team')
  beam('articulation link',(0,-.15,.71),(0,-1.35,.65),.15,'orange')
  box('engine cover',(0,1.12,1.05),(1.10,.67,.55),'team',.13)
  box('rear orange panel',(0,1.48,1.08),(1.10,.14,.49),'orange',.045)
  for x in [-.35,0,.35]:box('rear grill stripe',(x,1.568,1.08),(.19,.022,.23),'track',.02)
  cyl('exhaust pipe',(.41,1.15,1.72),.065,.60,'track',12)
  for x in [-.70,.70]:
   for y in [-1.45,.35,1.0]:
    o=cyl('tire hub',(x*1.22,y,.40),.22,.11,'orange',20);o.rotation_euler[1]=math.pi/2
    for a in range(8):
     ang=a*math.tau/8
     box('tire lug',(x*1.06,y+math.cos(ang)*.30,.40+math.sin(ang)*.30),(.06,.13,.09),'black',.025)
  grader_blade=scene_part('grader_work_blade')
  if grader_blade:
   old=parent;parent=grader_blade
   for x in [-.65,.65]:beam('grader blade lift',(x,.21,.37),(x,-.05,.06),.11,'orange')
   box('grader dark blade',(0,-.14,.01),(2.04,.04,.40),'track',.02)
   parent=old
 if kind=='launcher':
  # The launcher reference has a tall, double-sided truss, stacked orange
  # outriggers and a long concrete girder. Keep the truss as its own pivot.
  truss=scene_part('truss')
  if truss:
   old=parent;parent=truss
   for x in [-.63,.63]:
    for i in range(9):
     y=1.35-i*.56
     beam('truss opposite diagonal',(x,y,.63),(x,y-.56,0),.085,'team')
     box('truss hinge',(x,y,.30),(.20,.18,.20),'orange',.04)
   for y in [1.3,.65,0,-.65,-1.3,-1.95,-2.6,-3.25]:
    box('truss cross tie',(0,y,.65),(1.40,.10,.10),'orange',.018)
   parent=old
  for x in [-1,1]:
   for y in [-1.3,1.2]:
    box('outrigger beam',(x*.83,y,.67),(.76,.19,.17),'orange',.04)
    cyl('jack foot collar',(x,y,.14),.19,.08,'orange',12)
  box('winch box',(0,.12,2.14),(.78,.55,.35),'orange',.08)
 if kind in ['stone-bridge','steel-bridge']:
  steel=kind=='steel-bridge'; rail='team' if steel else 'stone'
  for x in [-1.18,1.18]:
   for y in [-2.68,2.68]:
    box('pier capital',(x,y,.89),(.74,.74,.12),'white' if steel else 'stoneDark',.025)
    for z in [-.66,-.2,.25,.68]:
     box('course seam',(x,y,z+.22),(.50,.53,.025),'stoneDark' if not steel else 'track',.007)
    for side in [-1,1]:
     o=cyl('pier rivet',(x+side*.28,y,.12),.045,.025,'gold',10);o.rotation_euler[1]=math.pi/2
   box('continuous handrail',(x,0,.43),(.12,5.52,.12),rail,.045)
   for y in [-2,-1,0,1,2]:
    box('baluster',(x,y,.25),(.12,.12,.41),rail,.035)
    sphere('rail knob',(x,y,.52),(.12,.12,.10),'gold' if steel else 'stoneDark',10,7)
  for y in [-2.5,-1.5,-.5,.5,1.5,2.5]:
   box('paving groove',(0,y+.47,.049),(2.28,.025,.014),'stoneDark' if not steel else 'track',.003)
  if steel:
   for x in [-.95,.95]:
    for y in [-2.4,-1.2,0,1.2,2.4]:
     o=cyl('deck bolt',(x,y,.067),.055,.02,'gold',10)
  else:
   for x in [-.85,0,.85]:
    for y in [-2,-.98,.02,1.02,2.02]:
     box('stone joint',(x,y,.053),(.022,.83,.012),'stoneDark',.002)

def merge_static():
 groups={}
 for o in list(bpy.context.scene.objects):
  if o.type=='MESH':groups.setdefault((o.parent.name if o.parent else '',o.data.materials[0].name),[]).append(o)
 for key,objects in groups.items():
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name=key[1]+'_mesh'

stats=[]
for name,fn in [('bot',bot),('castle',castle),('excavator',lambda:vehicle('excavator')),('dozer',lambda:vehicle('dozer')),('grader',lambda:vehicle('grader')),('launcher',lambda:vehicle('launcher')),('drill',lambda:vehicle('drill')),('stone-bridge',bridge),('steel-bridge',lambda:bridge(True)),('tree',tree),('fence',props),('soil',soil_resource),('stone-resource',stone_resource),('iron-resource',iron_resource),('crate',crate),('minecart',minecart),('flower',flower)]:
 scene=bpy.data.scenes.new(name);bpy.context.window.scene=scene;parent=None
 fn();refinement(name);merge_static()
 bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',use_active_scene=True,export_yup=True,export_animations=False)
 tris=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in scene.objects if o.type=='MESH')
 stats.append({'asset':name,'triangles':tris,'meshes':sum(o.type=='MESH' for o in scene.objects),'bytes':os.path.getsize(os.path.join(OUT,name+'.glb'))})
bpy.data.scenes.remove(start_scene)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets/blender/infra-rush.blend'))
json.dump(stats,open(os.path.join(OUT,'manifest.json'),'w'),indent=2)
print(json.dumps(stats))
