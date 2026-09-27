#!/bin/sh
set -eu

BLENDER_BIN="/Applications/Blender.app/Contents/MacOS/Blender"

# The common scene provides world props and the castle. Each approved character,
# vehicle and bridge then replaces its generic counterpart from a separate file.
"$BLENDER_BIN" --background --python assets/blender/build.py
for asset in bot stone-bridge steel-bridge; do
  "$BLENDER_BIN" --background --python assets/blender/build_reference_fleet.py -- "$asset"
done
"$BLENDER_BIN" --background --python assets/blender/prepare_supplied_excavator.py
"$BLENDER_BIN" --background --python assets/blender/make_red_excavator.py
for asset in dozer grader drill launcher; do
  "$BLENDER_BIN" --background --python assets/blender/prepare_supplied_fleet.py -- "$asset"
  "$BLENDER_BIN" --background --python assets/blender/make_red_fleet.py -- "$asset"
done
python3 assets/blender/refresh_model_manifest.py
