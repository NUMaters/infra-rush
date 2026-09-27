"""Refresh build statistics for the runtime GLBs without rebuilding them."""

from pathlib import Path
import json
import struct

root = Path(__file__).resolve().parents[2]
target = root / "public" / "models" / "manifest.json"
order = [record["asset"] for record in json.loads(target.read_text())]
records = []
for name in order:
    path = root / "public" / "models" / f"{name}.glb"
    with path.open("rb") as f:
        f.read(12)
        length, chunk_type = struct.unpack("<II", f.read(8))
        data = json.loads(f.read(length))
    triangles = 0
    for mesh in data.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            accessor = data["accessors"][primitive["indices"]]
            triangles += accessor["count"] // 3
    records.append({"asset": name, "triangles": triangles, "meshes": len(data.get("meshes", [])),
                    "bytes": path.stat().st_size})
target.write_text(json.dumps(records, indent=2) + "\n")
