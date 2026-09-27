// Turn the four filmed scenes into a fast 8-second opening with a final hit montage.
// Each entry is a frame range from assets/blender/render_opening.py at 20 fps.
import { copyFileSync, existsSync, linkSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const filmed = resolve(root, ".qa-preview/opening-frames");
const edited = resolve(root, ".qa-preview/opening-cut");
const cuts = [
  [1, 30], // Bot entrance
  [45, 74], // excavator hit
  [83, 112], // dozer pushes soil
  [122, 151], // bridge reaches castle
  [31, 40], // rapid recap: Bot
  [56, 65], // rapid recap: excavation impact
  [99, 108], // rapid recap: dozer impact
  [145, 154], // rapid recap: bridge connection
];

mkdirSync(edited, { recursive: true });
let index = 0;
for (const [first, last] of cuts) {
  for (let frame = first; frame <= last; frame++) {
    const source = resolve(
      filmed,
      `frame-${String(frame).padStart(4, "0")}.png`,
    );
    const target = resolve(
      edited,
      `frame-${String(++index).padStart(4, "0")}.png`,
    );
    if (!existsSync(source)) throw new Error(`Missing render: ${source}`);
    if (existsSync(target)) rmSync(target);
    try {
      linkSync(source, target);
    } catch {
      copyFileSync(source, target);
    }
  }
}
if (index !== 160) throw new Error(`Expected 160 frames, got ${index}`);
console.log(`Edited ${index} frames in ${edited}`);
