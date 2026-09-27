"""Build the reference-specific Bot, civil machines and bridge models.

Run: blender -b --python assets/blender/build_reference_fleet.py -- bot
Supported: bot, excavator, dozer, grader, launcher, stone-bridge, steel-bridge.
Each target starts from an empty Blender file and produces its own editable source.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from reference_kit import Kit, manifest
from mathutils import Vector
import bpy
import math

REF = {
    "bot": ["16VE0Sft-tV2VhA78yvOGWuFPgKrqKxrB"],
    "excavator": ["1mrnEluiU6tqH5dCtVgzYpyyLDZwp2U2d"],
    "dozer": ["1bBrCmDSU9MdVCiEwnXWEjphb17FyEERH"],
    "grader": ["1JCvLEcOnf4hCnQaQwWeUcbP5kktsLypK"],
    "launcher": ["1VvnzqS2HrSDoOsVi5p0NJK_MAJmCUvVk", "1T7bxSD-voxS8uK_EcWYdRPBAh7ypmcyX"],
    "stone-bridge": ["1XbCwOrDq2IhssDZkKU0mDQMDqp5FJRlw", "18dgRP4e-0tB_Lv_74Sl9ZHK_xIWTST5o"],
    "steel-bridge": ["1S3DRIAvjFTZosd-GJgkM1emLk1QmOKoU"],
}


def bot_shape(k, parent, prefix="", scale=1):
    body = k.empty(prefix + "Body", parent)
    body.scale = (scale,) * 3
    k.sphere(prefix + "rounded blue torso", body, (0, 0, .42), (.31, .225, .32), "team", 32, 20)
    k.sphere(prefix + "rounded blue lower body", body, (0, .01, .25), (.33, .238, .17), "team", 32, 20)
    k.sphere(prefix + "orange fitted safety vest", body, (0, -.018, .47), (.312, .246, .235), "orange", 32, 20)
    # Reflective material follows the rounded vest rather than floating as bars.
    def vest_point(a, z):
        radius = math.sqrt(max(.01, 1 - ((z-.47)/.235)**2))
        return ((.312*radius+.012)*math.cos(a),
                -.018+(.246*radius+.032)*math.sin(a), z)
    belt_verts = []
    for zz in (.365, .425):
        belt_verts.extend(vest_point(2*math.pi*i/40, zz) for i in range(40))
    belt_faces = [(i, (i+1)%40, 40+(i+1)%40, 40+i) for i in range(40)]
    k.quad_mesh(prefix + "vest fitted reflective waist band", body,
                belt_verts, belt_faces, "stripe")
    for x in (-.205, .205):
        strip = []
        for i in range(9):
            zz = .425 + i*(.62-.425)/8
            for xx in (x-.022, x+.022):
                radius = math.sqrt(max(.01, 1 - ((zz-.47)/.235)**2))
                yy = -.018-.246*radius*math.sqrt(max(.02, 1-(xx/(.312*radius))**2))-.035
                strip.append((xx, yy, zz))
        k.quad_mesh(prefix + "vest fitted vertical reflector", body, strip,
                    [(2*i, 2*i+1, 2*i+3, 2*i+2) for i in range(8)], "stripe")
    k.box(prefix + "vest front zip", body, (0, -.264, .49), (.023, .018, .15), "orange_light", .008)
    k.sphere(prefix + "blue head", body, (0, -.016, .715), (.285, .23, .21), "team", 32, 20)
    k.sphere(prefix + "large white face", body, (0, -.208, .695), (.245, .064, .145), "face", 32, 20)
    for x in (-.079, .079):
        k.sphere(prefix + "black oval eye", body, (x, -.260, .705), (.026, .020, .050), "black", 16, 10)
    k.sphere(prefix + "domed blue hardhat", body, (0, 0, .863), (.319, .275, .18), "team", 36, 22)
    k.sphere(prefix + "hardhat brim", body, (0, -.026, .818), (.359, .312, .052), "team", 36, 16)
    k.box(prefix + "hardhat central ridge", body, (0, -.018, 1.035), (.067, .30, .076), "blue_light", .028)
    k.box(prefix + "hardhat front stud", body, (0, -.298, .858), (.115, .042, .09), "team", .025)
    for side, x in (("left", -.348), ("right", .348)):
        pivot = k.empty(prefix + "arm_" + side, body, (x, 0, .548))
        k.sphere(prefix + "blue sleeve", pivot, (0, -.01, -.054), (.106, .112, .153), "team")
        k.sphere(prefix + "dark glove", pivot, (0, -.025, -.184), (.100, .090, .102), "dark")
    for side, x in (("left", -.147), ("right", .147)):
        pivot = k.empty(prefix + "leg_" + side, body, (x, 0, .178))
        k.sphere(prefix + "short blue leg", pivot, (0, 0, -.008), (.105, .105, .113), "team")
        k.box(prefix + "rounded navy boot", pivot, (0, -.043, -.105), (.21, .247, .134), "dark", .067, 7)
    return body


def worker_bot():
    k = Kit("worker_bot", "characters", "bot")
    top = k.empty("WorkerBot")
    root = k.empty("Root", top)
    bpy.ops.object.armature_add()
    rig = bpy.context.object
    rig.name = "Armature"
    rig.parent = root
    # Edit-ready skeletal pivots are retained alongside the runtime limb nodes.
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    rig.data.edit_bones.remove(rig.data.edit_bones[0])
    for name, head, tail in [
        ("B_Body", (0, 0, .24), (0, 0, .65)),
        ("B_Head", (0, 0, .65), (0, 0, .94)),
        ("B_Arm_L", (-.34, 0, .57), (-.34, 0, .33)),
        ("B_Arm_R", (.34, 0, .57), (.34, 0, .33)),
        ("B_Leg_L", (-.15, 0, .20), (-.15, 0, .04)),
        ("B_Leg_R", (.15, 0, .20), (.15, 0, .04)),
    ]:
        bone = rig.data.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
    bpy.ops.object.mode_set(mode="OBJECT")
    bot_shape(k, root)
    k.empty("P_InteractPoint", root, (0, -.45, .55))
    for side in ("left", "right"):
        pivot = bpy.data.objects["arm_" + side]
        k.clip(pivot, "Work", [(1, (0, 0, 0)), (13, (-.65 if side == "left" else .25, 0, 0)), (25, (0, 0, 0))])
        leg = bpy.data.objects["leg_" + side]
        sign = -1 if side == "left" else 1
        k.clip(leg, "Walk", [(1, (.36 * sign, 0, 0)), (13, (-.36 * sign, 0, 0)), (25, (.36 * sign, 0, 0))])
    k.save(manifest("worker_bot", "characters", "bot", REF["bot"], ["P_InteractPoint"],
                    {"walk": "Walk", "work": "Work"}, notes="Reference-specific rounded Bot; runtime limb pivots and edit-ready armature."))


def track_pair(k, parent, half_x=.73, y=.0, length=1.92, tall=.64):
    for side, x in (("L", -half_x), ("R", half_x)):
        track = k.empty("Track_" + side, parent, (x, y, .34))
        k.box("deep rounded black crawler", track, (0, 0, 0), (.48, length, tall), "black", .26, 7)
        exterior = -.26 if side == "L" else .26
        k.box("dark crawler outer plate", track, (exterior, 0, -.015), (.070, length * .8, .45), "track", .16, 6)
        for yy in (-length * .32, 0, length * .32):
            k.cyl("crawler wheel", track, (exterior + (-.035 if side == "L" else .035), yy, -.02), .19, .065, "track", "X")
        for yy in (-length * .32, length * .32):
            k.cyl("orange hub", track, (exterior + (-.095 if side == "L" else .095), yy, -.02), .135, .08, "orange", "X")
        k.box("blue side rail", track, (exterior + (-.085 if side == "L" else .085), 0, -.045), (.08, length * .52, .19), "team", .07)
        for i in range(13):
            yy = (i - 6) * length / 14
            for z in (-tall * .48, tall * .48):
                k.box("separate crawler tread", track, (0, yy, z), (.48, .11, .065), "track", .025, 3)


def swept_body(k, parent, name, stations, color, edge=.055):
    """Loft a solid around a designed side silhouette.

    Each station is (y, z, half_width, half_height). The narrowed shoulders
    create a rounded octagonal section without flattening the side profile.
    """
    verts = []
    section = [(-.74, -1), (.74, -1), (1, -.70), (1, .70),
               (.74, 1), (-.74, 1), (-1, .70), (-1, -.70)]
    for yy, zz, half_w, half_h in stations:
        verts.extend((u * half_w, yy, zz + v * half_h) for u, v in section)
    faces = [tuple(reversed(range(8)))]
    for j in range(len(stations)-1):
        for i in range(8):
            faces.append((j*8+i, j*8+(i+1)%8,
                          (j+1)*8+(i+1)%8, (j+1)*8+i))
    faces.append(tuple((len(stations)-1)*8+i for i in range(8)))
    obj = k.quad_mesh(name, parent, verts, faces, color)
    k.bevel(obj, edge, 4)
    return obj


def lamp_set(k, parent, roof_y, roof_z, pair=True, beacon=True):
    xs = (-.32, .32) if pair else (0,)
    for x in xs:
        k.box("dark headlight housing", parent, (x, roof_y, roof_z), (.24, .23, .22), "track", .06)
        k.box("soft yellow headlight", parent, (x, roof_y - .125, roof_z), (.17, .035, .15), "lamp", .025)
    if beacon:
        k.cyl("amber rotating beacon", parent, (0, roof_y + .50, roof_z + .03), .103, .20, "orange", "Z", 24, .035)


def cab(k, parent, y=.25, z=.80, white=True, scale=1):
    cabin = k.empty("Cabin", parent, (0, y, z))
    cabin.scale = (scale,) * 3
    shell = "white" if white else "team"
    # A continuous rounded outer skin. Glass is assigned to selected faces of
    # the skin itself; there is no opaque wall behind it or four-post cage.
    count = 40
    rings = [
        (.10, .58, .52, 0), (.22, .66, .59, 0),
        (.38, .70, .60, 0), (.45, .70, .59, 0),
        (1.18, .65, .53, 1), (1.27, .61, .49, 0),
        (1.37, .52, .42, 0), (1.43, .35, .28, 0),
        (1.46, .05, .04, 0),
    ]
    verts = []
    for height, rx, ry, _ in rings:
        for i in range(count):
            a = 2 * math.pi * i / count
            ca, sa = math.cos(a), math.sin(a)
            # The front edge leans back into the curved roof as on the sheets.
            fore = .035 + .09 * max(0, height - .56)
            verts.append((rx * math.copysign(abs(ca) ** .36, ca),
                          ry * math.copysign(abs(sa) ** .36, sa) + fore,
                          height))
    faces, mats = [], []
    for j in range(len(rings) - 1):
        for i in range(count):
            ni = (i + 1) % count
            faces.append((j * count + i, j * count + ni,
                          (j + 1) * count + ni, (j + 1) * count + i))
            a = 2 * math.pi * (i + .5) / count
            ca, sa = math.cos(a), math.sin(a)
            front_glass = sa < -.52 and abs(ca) < .70
            side_glass = abs(ca) > .84 and -.30 < sa < .60
            window_sector = front_glass or side_glass
            mats.append(1 if j == 3 and window_sector else
                        (2 if j in (2, 4) and window_sector else 0))
    faces.append(tuple(reversed(tuple(range(count)))))
    mats.append(0)
    faces.append(tuple((len(rings)-1)*count+i for i in range(count)))
    mats.append(0)
    skin = k.quad_mesh("one piece domed cabin shell and panoramic glazing", cabin, verts, faces, shell)
    skin.data.materials.append(k.mat("glass"))
    skin.data.materials.append(k.mat("track"))
    for poly, mi in zip(skin.data.polygons, mats):
        poly.material_index = mi
        poly.use_smooth = True
    for x in (-.70, .70):
        k.box("black wing mirror", cabin, (x * 1.13, -.35, .94), (.15, .10, .27), "track", .045)
    k.box("dark operator seat", cabin, (0, .24, .32), (.53, .37, .34), "dark", .10)
    pilot = k.empty("pilot", cabin, (0, -.075, .20))
    pilot.scale = (.88,) * 3
    bot_shape(k, pilot, "pilot ")
    k.empty("P_BotSeat", cabin, (0, -.075, .20))
    k.empty("P_BotEntry", cabin, (.75, -.10, -.06))
    lamp_set(k, cabin, -.45, 1.50)
    return cabin


def rear_engine(k, parent, y=.75, z=1.18):
    k.box("rounded orange engine cover", parent, (0, y, z), (1.28, .78, .73), "orange", .20, 7)
    for zz in (z - .13, z, z + .13):
        k.box("black rear ventilation", parent, (0, y + .405, zz), (.58, .027, .047), "vent", .014)
    k.cyl("black exhaust", parent, (.53, y + .14, z + .56), .075, .80, "track", "Z", 16)


def vehicle_base(k, root, length=1.95, y=.05):
    track_pair(k, root, .72, y, length)
    upper = k.empty("UpperBody", root)
    k.box("deep blue chassis", upper, (0, y, .67), (1.70, length * .81, .36), "team", .17, 7)
    k.cyl("round slewing base", upper, (0, y, .86), .68, .22, "blue_dark", "Z", 32)
    return upper


def bucket_mesh(k, parent, center=(0, 0, 0), width=1.10, radius=.48, color="team"):
    # An open U-shaped scoop, with the lip projecting far forward from the pin.
    # The section is designed in side view rather than reducing the bucket to a box.
    profile = [(.26, .48), (.38, .29), (.43, .04), (.37, -.24),
               (.20, -.47), (-.05, -.60), (-.34, -.60), (-.68, -.47)]
    s = radius / .53
    verts = [(center[0] + x, center[1] + yy*s, center[2] + zz*s)
             for x in (-width/2, width/2) for yy, zz in profile]
    n = len(profile)
    faces = [(i, i + 1, n + i + 1, n + i) for i in range(n - 1)]
    obj = k.quad_mesh("deep curved bucket bowl", parent, verts, faces, color)
    solid = obj.modifiers.new("bucket shell thickness", "SOLIDIFY")
    solid.thickness = .10
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=solid.name)
    k.bevel(obj, .035, 3)
    for x in (-width / 2, width / 2):
        side = [(center[0] + x, center[1] + yy*s, center[2] + zz*s)
                for yy, zz in profile]
        side += [(center[0] + x, center[1] - .61*s, center[2] - .08*s),
                 (center[0] + x, center[1] - .32*s, center[2] + .29*s)]
        cheek = k.quad_mesh("curved bucket end cheek", parent, side, [tuple(range(len(side)))], color)
        solid = cheek.modifiers.new("thick bucket cheek", "SOLIDIFY")
        solid.thickness = .08
        bpy.context.view_layer.objects.active = cheek
        bpy.ops.object.modifier_apply(modifier=solid.name)
        k.bevel(cheek, .03, 3)
    for x in (-width*.31, -width*.10, width*.10, width*.31):
        k.box("rounded bucket tooth", parent,
              (x, center[1] - .70*s, center[2] - .49*s),
              (.16, .25, .13), color, .05)


def excavator():
    k = Kit("excavator", "vehicles", "excavator")
    top = k.empty("Excavator")
    root = k.empty("Root", top)
    upper = vehicle_base(k, root, 2.10)
    k.box("wide blue upper deck", upper, (0, .15, .98), (1.61, 1.73, .32), "team", .15)
    rear_engine(k, upper, .84, 1.23)
    cab(k, upper, .32, .91, True, .90)
    boom = k.empty("boom", upper, (-.50, -.40, 1.20))
    swept_body(k, boom, "arched thick blue boom",
               [(.10, .05, .24, .22), (-.12, .42, .26, .24),
                (-.29, .89, .24, .23), (-.38, 1.00, .20, .18)], "team", .08)
    k.beam("orange hydraulic ram", boom, (.17, -.08, .18), (.16, -.31, .91), .13, "orange", .11, .05)
    k.cyl("large orange shoulder hinge", boom, (-.20, 0, .03), .23, .14, "orange", "X")
    arm = k.empty("arm", boom, (-.06, -.38, 1.00))
    swept_body(k, arm, "tapered rounded blue dipper arm",
               [(.04, .02, .22, .20), (-.12, -.33, .23, .20),
                (-.30, -.83, .21, .18), (-.46, -1.30, .17, .16)], "team", .065)
    k.beam("bucket piston", arm, (.12, -.08, -.42), (.08, -.42, -1.21), .085, "metal", .07)
    k.cyl("orange elbow hinge", arm, (.12, 0, 0), .17, .12, "orange", "X")
    bucket = k.empty("bucket", arm, (.07, -.46, -1.30))
    bucket_mesh(k, bucket, (0, -.15, -.23), 1.08, .36, "team")
    k.cyl("bucket pin", bucket, (.58, 0, 0), .16, .12, "orange", "X")
    k.empty("P_DigContact", bucket, (0, -.70, -.62))
    k.clip(boom, "Dig", [(1, (0, 0, 0)), (15, (-.18, 0, 0)), (30, (0, 0, 0))])
    k.clip(arm, "Dig", [(1, (0, 0, 0)), (15, (.22, 0, 0)), (30, (0, 0, 0))])
    k.clip(bucket, "Load", [(1, (0, 0, 0)), (18, (.38, 0, 0)), (30, (0, 0, 0))])
    k.save(manifest("excavator", "vehicles", "excavator", REF["excavator"], ["P_BotSeat", "P_DigContact"],
                    {"dig": "Dig", "load": "Load"}, notes="Large blue open bucket, tall white cab, orange engine and thick articulated arm."))


def curved_blade(k, parent, width=2.18, height=.79, color="orange", grader=False):
    # The forward lip and swept-back top remain legible in the side silhouette.
    verts = []
    columns = 9
    rows = 7
    for col in range(columns):
        x = -width/2 + col*width/(columns-1)
        horizontal_cup = (.07 if grader else .23)*(1-(x/(width/2))**2)
        for j in range(rows):
            t = j / 6
            z = -height / 2 + t * height
            y = ((-.07 + .12*(1-(2*t-1)**2)) if grader
                 else (-.38 + .73*t - .22*t*t)) + horizontal_cup
            verts.append((x, y, z))
    faces = [(col*rows+j, col*rows+j+1,
              (col+1)*rows+j+1, (col+1)*rows+j)
             for col in range(columns-1) for j in range(rows-1)]
    blade = k.quad_mesh("concave bulldozer blade" if not grader else "angled grader blade", parent, verts, faces,
                        "metal" if grader else color)
    solid = blade.modifiers.new("thick blade", "SOLIDIFY")
    solid.thickness = .08
    bpy.context.view_layer.objects.active = blade
    bpy.ops.object.modifier_apply(modifier=solid.name)
    k.bevel(blade, .024, 3)
    for poly in blade.data.polygons:
        poly.use_smooth = True
    if grader:
        k.box("bright orange cutting edge", parent, (0, -.08, -height / 2),
              (width + .06, .16, .11), "orange", .035)
    else:
        lip = []
        for col in range(columns):
            x = -width/2 + col*width/(columns-1)
            yy = -.38 + .23*(1-(x/(width/2))**2)
            lip += [(x, -.46, -height/2-.015), (x, yy+.025, -height/2-.015)]
        lip_obj = k.quad_mesh("continuous rounded forward blade lip", parent,
                              lip, [(2*i, 2*i+1, 2*i+3, 2*i+2)
                                    for i in range(columns-1)], "orange")
        thick = lip_obj.modifiers.new("rolled lower cutting lip", "SOLIDIFY")
        thick.thickness = .10
        bpy.context.view_layer.objects.active = lip_obj
        bpy.ops.object.modifier_apply(modifier=thick.name)
        k.bevel(lip_obj, .035, 3)
    if grader:
        k.box("orange upper grader blade rail", parent, (0, -.07, height/2),
              (width+.06, .11, .10), "orange", .025)
    for x in (-width / 2, width / 2):
        outline = []
        for j in range(7):
            t = j / 6
            yy = (-.07 + .12*(1-(2*t-1)**2)) if grader else (-.38 + .73*t - .22*t*t)
            outline.append((x, yy - .025,
                            -height/2 + t*height))
        outline += ([(x, .14, height/2), (x, .14, -height/2)] if grader
                    else [(x, .42, height/2), (x, .32, -height/2)])
        cheek = k.quad_mesh("swept blade side cheek", parent, outline,
                            [tuple(range(len(outline)))], "orange")
        solid = cheek.modifiers.new("substantial cheek", "SOLIDIFY")
        solid.thickness = .12
        bpy.context.view_layer.objects.active = cheek
        bpy.ops.object.modifier_apply(modifier=solid.name)
        k.bevel(cheek, .035, 3)


def bulldozer():
    k = Kit("bulldozer", "vehicles", "dozer")
    top = k.empty("Bulldozer")
    root = k.empty("Root", top)
    upper = vehicle_base(k, root, 1.98)
    k.box("rounded blue machine deck", upper, (0, .22, .89), (1.58, 1.75, .32), "team", .15)
    rear_engine(k, upper, .91, 1.15)
    cab(k, upper, .19, .82, True, .90)
    blade = k.empty("blade", upper, (0, -1.22, .56))
    curved_blade(k, blade, 2.20, .86, "orange")
    for x in (-.84, .84):
        k.beam("powerful blue blade push arm", blade, (x, .72, .06), (x, .06, .02), .18, "team", .16, .08)
        k.cyl("large orange push hinge", blade, (x * 1.07, .55, .12), .17, .12, "orange", "X")
    k.empty("P_SoilPush", blade, (0, -.16, -.48))
    k.clip(blade, "PushSoil", [(1, (0, 0, 0)), (15, (-.08, 0, 0)), (30, (0, 0, 0))])
    k.save(manifest("bulldozer", "vehicles", "dozer", REF["dozer"], ["P_BotSeat", "P_SoilPush"],
                    {"push": "PushSoil"}, notes="Oversized concave orange blade, thick tracks, white cab and rear vented engine."))


def wheel(k, parent, x, y, z, r=.43):
    k.cyl("deep-tread black tire", parent, (x, y, z), r, .33, "track", "X", 28, .075)
    for i in range(14):
        a = 2*math.pi*i/14
        tread = k.box("rounded angled tire tread", parent,
                      (x, y + r*.98*math.sin(a), z + r*.98*math.cos(a)),
                      (.35, .115, .065), "black", .018, 3)
        tread.rotation_euler.x = -a
        tread.rotation_euler.z = math.radians(13 if i % 2 else -13)
    k.cyl("orange inset hub", parent, (x + (.178 if x > 0 else -.178), y, z), r * .56, .045, "orange", "X", 24, .025)
    k.cyl("gold wheel center", parent, (x + (.205 if x > 0 else -.205), y, z), r * .23, .04, "orange_light", "X", 20, .015)


def grader():
    k = Kit("motor_grader", "vehicles", "grader")
    top = k.empty("MotorGrader")
    root = k.empty("Root", top)
    front_axle = k.empty("FrontAxle", root, (0, -1.48, 0))
    rear_axle = k.empty("RearAxle", root, (0, .81, 0))
    for x in (-.74, .74):
        wheel(k, front_axle, x, 0, .43, .45)
        for y in (-.38, .38):
            wheel(k, rear_axle, x, y, .43, .43)
    body = k.empty("Body", root)
    swept_body(k, body, "arched long front gooseneck body",
               [(-2.13, .78, .30, .20), (-1.80, .80, .33, .23),
                (-1.42, .94, .29, .18), (-.90, 1.12, .23, .16),
                (-.45, 1.10, .24, .19)], "team", .085)
    k.box("wide blue rear engine", body, (0, .94, 1.05), (1.25, 1.20, .85), "team", .14)
    k.box("orange rear engine side", body, (-.67, 1.22, 1.05), (.09, .63, .65), "orange", .045)
    for zz in (.89, 1.04, 1.19):
        k.box("rear dark grille", body, (0, 1.56, zz), (.57, .045, .045), "vent", .015)
    k.cyl("upright rear exhaust", body, (.51, 1.07, 1.78), .075, .81, "track", "Z", 18)
    cab(k, body, .28, .70, True, .92)
    for x in (-.50, .50):
        k.cyl("low front amber lamp", body, (x, -1.46, 1.05), .11, .12, "lamp", "Y")
    link = k.empty("GraderLink", body, (0, -.63, .64))
    k.cyl("yellow blade yaw ring", link, (0, 0, 0), .42, .09, "orange", "Z")
    for x in (-.59, .59):
        k.beam("amber blade lift linkage", link, (x, .12, 0), (x, -.08, -.20), .10, "orange", .09)
    blade = k.empty("grader_work_blade", link, (0, -.09, -.27))
    blade.rotation_euler.z = math.radians(18)
    curved_blade(k, blade, 2.28, .50, grader=True)
    k.empty("P_GradeContact", blade, (0, -.15, -.31))
    k.clip(blade, "Grade", [(1, (0, 0, .16)), (16, (.02, 0, -.16)), (31, (0, 0, .16))])
    k.clip(front_axle, "Steer", [(1, (0, 0, 0)), (16, (0, 0, .14)), (31, (0, 0, 0))])
    k.save(manifest("motor_grader", "vehicles", "grader", REF["grader"], ["P_BotSeat", "P_GradeContact"],
                    {"grade": "Grade", "steer": "Steer"}, notes="Six large tires, long articulated nose, central angled blade, white Bot cab."))


def crown(k, parent, x, y, z, s=.22):
    k.box("white crown base", parent, (x, y, z), (s * 1.8, .026, s * .40), "face", .01)
    for xx in (-.52, 0, .52):
        k.cone("white crown tip", parent, (x + xx * s, y, z + s * .34), s * .32, 0, s * .42, "face", 4)


def bridge_launcher():
    k = Kit("bridge_launcher", "vehicles", "launcher")
    top = k.empty("BridgeLauncher")
    root = k.empty("Root", top)
    track_pair(k, root, .76, .23, 2.04, .62)
    chassis = k.empty("Chassis", root)
    k.box("compact blue tracked chassis", chassis, (0, .21, .72), (1.85, 2.50, .47), "team", .18)
    pilot_cab = cab(k, chassis, -1.13, .88, True, .82)
    # Launcher cabin has a visibly blue operator, frontal glazing and a navy roof pod.
    k.box("blue camera pod", chassis, (0, -1.60, 2.05), (.55, .33, .24), "blue_dark", .07)
    for x in (-.88, .88):
        k.cyl("black vertical stabilizer tube", chassis, (x, -.52, 1.71), .08, 1.38, "track", "Z", 16)
        k.box("yellow striped crawler guard", chassis, (x, -.61, .83), (.20, .51, .31), "orange", .06)
    k.box("rear blue engine tower", chassis, (0, 1.03, 1.52), (1.28, .65, 1.07), "team", .13)
    k.box("white crown side plate", chassis, (.68, 1.06, 1.75), (.075, .63, .69), "team", .045)
    crown(k, chassis, .736, 1.06, 1.79, .27)
    truss = k.empty("TrussFrame", chassis, (0, .23, 2.38))
    # Tall lattice arm dominates the side silhouette; orange clamps bracket each end.
    for x in (-.53, .53):
        for z in (-.24, .24):
            k.beam("continuous blue truss chord", truss, (x, -1.22, z), (x, 2.65, z), .10, "team", .09, .035)
        for i in range(8):
            y0 = -1.20 + i * .48
            a = (x, y0, -.23 if i % 2 else .23)
            b = (x, y0 + .48, .23 if i % 2 else -.23)
            k.beam("triangular lattice strut", truss, a, b, .085, "team", .08, .025)
    for y in (-1.23, 2.67):
        k.box("thick amber girder clamp", truss, (0, y, 0), (1.33, .35, .73), "orange", .10)
        for x in (-.70, .70):
            k.cyl("clamp hinge", truss, (x, y, 0), .15, .13, "orange_light", "X")
    for x in (-.40, .40):
        k.beam("silver hydraulic guide", truss, (x, -1.18, .34), (x, 2.63, .34), .058, "silver", .06, .018)
    carrier = k.empty("GirderCarrier", chassis, (0, 0, 1.79))
    k.box("large pale bridge segment", carrier, (0, .91, 0), (1.70, 4.05, .35), "stone_light", .045)
    for x in (-.88, .88):
        k.box("blue bridge segment rail", carrier, (x, .91, -.03), (.16, 4.05, .33), "team", .035)
    for i in range(8):
        k.box("bridge deck separation", carrier, (0, -.85 + i * .52, .19), (1.69, .035, .025), "stone", .008)
    k.empty("P_BridgeSegmentSocket", carrier, (0, -1.19, 0))
    for sy, yy in (("F", -1.0), ("R", 1.0)):
        for sx, x in (("L", -.95), ("R", .95)):
            outrigger = k.empty(f"Outrigger_{sy}{sx}", root, (x, yy, .73))
            k.beam("heavy blue outrigger leg", outrigger, (0, 0, 0), (x * .31, 0, -.57), .15, "team", .14)
            k.cyl("silver stabilizer piston", outrigger, (x * .31, 0, -.45), .105, .36, "silver", "Z")
            k.box("wide yellow stabilizer foot", outrigger, (x * .31, 0, -.68), (.46, .47, .14), "orange", .055)
            k.clip(outrigger, "DeployOutriggers", [(1, (0, 0, 0)), (25, (0, 0, .20 if x > 0 else -.20))])
    k.empty("P_BridgeOutput", carrier, (0, -1.21, .15))
    k.clip(carrier, "LaunchGirder", [(1, (0, 0, 1.79)), (30, (0, -1.00, 1.79))], "location")
    k.save(manifest("bridge_launcher", "vehicles", "launcher", REF["launcher"],
                    ["P_BotSeat", "P_BridgeSegmentSocket", "P_BridgeOutput"],
                    {"deploy": "DeployOutriggers", "launch": "LaunchGirder"},
                    notes="Compact white Bot cab, tall blue lattice truss, carried pale girder and four yellow feet."))


def bridge_post(k, parent, x, y, steel=False):
    stone = "metal" if steel else "stone"
    cap = "stone_dark" if steel else "stone_light"
    k.box("thick corner bridge post", parent, (x, y, .84), (.43, .47, 1.67), stone, .10, 6)
    k.box("wide carved post base", parent, (x, y, .13), (.56, .60, .32), cap, .07)
    if steel:
        k.cyl("faceted steel post cap", parent, (x, y, 1.73), .34, .30,
              cap, "Z", 12, .055)
        k.cyl("warm inset bridge post lamp band", parent, (x, y, 1.59),
              .285, .065, "orange_light", "Z", 16, .012)
    else:
        k.box("large rounded carved stone post cap", parent,
              (x, y, 1.73), (.60, .62, .32), cap, .11, 6)
    for z in (.38, 1.26):
        k.box("steel bolted post collar", parent, (x, y, z), (.56, .60, .22), "stone_dark" if not steel else "track", .04)
        for xx in (-.20, .20):
            k.sphere("collar bolt", parent, (x + xx, y - .308, z), (.035, .026, .035), "silver", 12, 8)
    banner = k.empty("TeamMarkers", parent, (x, y - .34, 1.08))
    k.box("blue hanging team banner", banner, (0, -.025, -.09), (.29, .045, .59), "team", .04)
    crown(k, banner, 0, -.052, -.04, .12)


def stone_bridge():
    k = Kit("stone_bridge", "bridges", "stone-bridge")
    top = k.empty("StoneBridge")
    root = k.empty("Root", top, (0, 0, -1.1))
    healthy = k.empty("Healthy", root)
    k.box("stone deck substrate", healthy, (0, 0, .82), (2.42, 5.54, .25), "stone_dark", .07)
    for x in (-.77, 0, .77):
        for j in range(3):
            y = -1.75 + j * 1.75
            k.box("individual broad stone road slab", healthy, (x, y, 1.01), (.75, 1.69, .17),
                  "stone_light" if (j + round(x * 3)) % 3 == 0 else "stone", .055, 5)
    for x in (-1.26, 1.26):
        for j in range(6):
            k.box("raised stone curb blocks", healthy, (x, -2.29 + j * .91, 1.03), (.29, .85, .34), "stone_light", .045)
        ys = [-2.61, -1.9, -1.0, 0, 1.0, 1.9, 2.61]
        underside = [.24, .33, .50, .61, .50, .33, .24]
        arch_outline = [(x, yy, .94) for yy in ys]
        arch_outline += [(x, yy, zz) for yy, zz in reversed(list(zip(ys, underside)))]
        wall = k.quad_mesh("continuous carved stone arch side profile", healthy,
                           arch_outline, [tuple(range(len(arch_outline)))], "stone")
        thick = wall.modifiers.new("wide stone arch depth", "SOLIDIFY")
        thick.thickness = .32
        bpy.context.view_layer.objects.active = wall
        bpy.ops.object.modifier_apply(modifier=thick.name)
        k.bevel(wall, .04, 3)
    for x in (-1.33, 1.33):
        for y in (-2.55, 2.55):
            bridge_post(k, healthy, x, y)
    damage = k.empty("Damage01", root)
    damage.hide_render = True
    damage.hide_set(True)
    k.save(manifest("stone_bridge", "bridges", "stone-bridge", REF["stone-bridge"],
                    damage=["Healthy"],
                    notes="Stone slab road, four carved banner posts and side support beams; game damage uses separate crack overlays."))


def steel_bridge():
    k = Kit("steel_bridge", "bridges", "steel-bridge")
    top = k.empty("SteelBridge")
    root = k.empty("Root", top, (0, 0, -1.1))
    healthy = k.empty("Healthy", root)
    for j in range(3):
        yy = -1.73 + j*1.73
        k.box("broad riveted steel road plate", healthy, (0, yy, 1.04),
              (2.32, 1.66, .13), "metal" if j != 1 else "silver", .04, 4)
        for xx in (-1.04, 1.04):
            for dy in (-.70, -.23, .23, .70):
                k.sphere("steel deck rivet", healthy, (xx, yy+dy, 1.115),
                         (.030, .030, .014), "stone_dark", 10, 6)
    # The supplied sheet shows D1 light damage: shallow visible cracks while
    # the deck is still continuous and functional.
    for points in [
        [(-.38, -2.35), (-.18, -2.12), (-.30, -1.93), (-.07, -1.70)],
        [(.28, -.52), (.09, -.32), (.20, -.11), (-.03, .10)],
    ]:
        for (x0, y0), (x1, y1) in zip(points, points[1:]):
            k.beam("D1 shallow deck crack", healthy, (x0, y0, 1.122),
                   (x1, y1, 1.122), .022, "stone_dark", .011, .005)
    for x in (-1.26, 1.26):
        for z in (.47, 1.01):
            k.beam("long riveted side beam", healthy, (x, -2.59, z), (x, 2.59, z), .15, "track", .13, .035)
        for j in range(3):
            y0 = -2.55 + j*1.70
            y1 = y0 + 1.70
            k.beam("full crossing steel truss brace", healthy,
                   (x, y0, .50), (x, y1, .99), .12, "metal", .10, .028)
            k.beam("full crossing steel truss brace", healthy,
                   (x, y0, .99), (x, y1, .50), .12, "metal", .10, .028)
    for x in (-1.35, 1.35):
        for y in (-2.55, 2.55):
            bridge_post(k, healthy, x, y, steel=True)
    for label in ("Damage01", "Damage02"):
        node = k.empty(label, root)
        node.hide_render = True
        node.hide_set(True)
    k.save(manifest("steel_bridge", "bridges", "steel-bridge", REF["steel-bridge"],
                    damage=["Healthy"],
                    notes="Riveted six-span deck with side lattice beams and four lit banner posts; game damage uses separate crack and exposed-structure overlays."))


BUILDERS = {"bot": worker_bot, "excavator": excavator, "dozer": bulldozer,
            "grader": grader, "launcher": bridge_launcher,
            "stone-bridge": stone_bridge, "steel-bridge": steel_bridge}

if __name__ == "__main__":
    target = sys.argv[-1]
    if target not in BUILDERS:
        raise SystemExit("Choose: " + ", ".join(BUILDERS))
    BUILDERS[target]()
