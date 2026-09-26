"""Migrate initial Blender exports from sRGB numeric values to linear factors.
Only applies to the initial asset revisions identified by original file sizes/metadata.
The Blender generator already produces the corrected factors on regeneration.
"""
import json,struct,pathlib
for p in pathlib.Path('public/models').glob('*.glb'):
 data=p.read_bytes();length,kind=struct.unpack_from('<II',data,12);doc=json.loads(data[20:20+length])
 if doc.get('extras',{}).get('linearPalette'):continue
 # bot was regenerated with the corrected Blender palette.
 if p.name!='bot.glb':
  for m in doc.get('materials',[]):
   c=m.get('pbrMetallicRoughness',{}).get('baseColorFactor')
   if c:
    for i in range(3):c[i]=((c[i]+.055)/1.055)**2.4
 doc.setdefault('extras',{})['linearPalette']=True
 new=json.dumps(doc,separators=(',',':')).encode();new+=b' '*((-len(new))%4);tail=data[20+length:];out=struct.pack('<4sII',b'glTF',2,20+len(new)+len(tail))+struct.pack('<II',len(new),0x4e4f534a)+new+tail
 temp=p.with_suffix('.tmp');temp.write_bytes(out);temp.replace(p)
 print(p.name,len(out))
p=pathlib.Path('public/models/manifest.json');m=json.loads(p.read_text());
for a in m:a['bytes']=pathlib.Path('public/models',a['asset']+'.glb').stat().st_size
p.write_text(json.dumps(m,indent=2))
