// Excavator joint poses, in radians on the supplied model's pivots. Its boom
// and dipper are a single rigid textured mesh; the boom lowers/raises that
// assembly, the bucket curls, and the upper body slews on the tracks.
export interface ExcavatorPose {
  boom: number;
  arm: number;
  bucket: number;
  slew: number;
}

// Arm folded up with the bucket tucked in front of the tracks, clear of the
// ground, as a real machine carries it between sites.
export const EXCAVATOR_TRAVEL_POSE: ExcavatorPose = {
  boom: -0.15,
  arm: 0,
  bucket: -0.15,
  slew: 0,
};

export const EXCAVATOR_DIG_SECONDS = 4.4;

const bite: ExcavatorPose = { boom: 0.35, arm: 0, bucket: 0.35, slew: 0 };
const scooped: ExcavatorPose = { boom: 0.3, arm: 0, bucket: -0.35, slew: 0 };
const lifted: ExcavatorPose = {
  boom: -0.12,
  arm: 0,
  bucket: -0.25,
  slew: 0,
};
const swung: ExcavatorPose = { ...lifted, slew: 0.35 };
const dumped: ExcavatorPose = { boom: -0.08, arm: 0, bucket: 0.65, slew: 0.35 };
const reaching: ExcavatorPose = { boom: 0.2, arm: 0, bucket: 0.25, slew: 0.08 };

// One dig cycle: bite with the open bucket, crowd the arm in while curling
// the load, lift, swing aside, dump, then swing back and reach for the next
// bite. Slew values are a fraction of the per-machine swing angle.
const cycle: [number, ExcavatorPose][] = [
  [0, bite],
  [0.28, scooped],
  [0.4, lifted],
  [0.54, swung],
  [0.7, dumped],
  [0.77, dumped],
  [0.92, reaching],
  [1, bite],
];

const ease = (t: number) => t * t * (3 - 2 * t);

export function excavatorDigPose(seconds: number, swing = 1.2): ExcavatorPose {
  const t = (((seconds / EXCAVATOR_DIG_SECONDS) % 1) + 1) % 1;
  let i = 0;
  while (i < cycle.length - 2 && t >= cycle[i + 1][0]) i++;
  const [t0, a] = cycle[i];
  const [t1, b] = cycle[i + 1];
  const k = ease((t - t0) / (t1 - t0));
  const mix = (x: number, y: number) => x + (y - x) * k;
  return {
    boom: mix(a.boom, b.boom),
    arm: mix(a.arm, b.arm),
    bucket: mix(a.bucket, b.bucket),
    slew: mix(a.slew, b.slew) * swing,
  };
}

// Frame-rate independent approach toward an angle along the shorter arc.
export function dampAngle(
  current: number,
  target: number,
  lambda: number,
  dt: number,
): number {
  const delta = Math.atan2(
    Math.sin(target - current),
    Math.cos(target - current),
  );
  return current + delta * (1 - Math.exp(-lambda * dt));
}
