import * as T from "three";

export type MarineKind = "fish" | "birds" | "dolphin" | "whale";

// One understated encounter at a time. The sequence loops independently of
// match state, so decorative life never changes the authoritative game RNG.
const appearances: readonly {
  kind: MarineKind;
  starts: readonly number[];
  duration: number;
}[] = [
  { kind: "fish", starts: [18, 86, 154, 220, 289, 349], duration: 7 },
  { kind: "birds", starts: [42, 129, 231, 319], duration: 5.5 },
  { kind: "dolphin", starts: [69, 188, 274], duration: 2.8 },
  { kind: "whale", starts: [112, 304], duration: 14 },
];

export function marineAppearance(
  time: number,
): { kind: MarineKind; progress: number; index: number } | null {
  const phase = ((time % 360) + 360) % 360;
  for (const cue of appearances) {
    for (let index = 0; index < cue.starts.length; index++) {
      const progress = (phase - cue.starts[index]) / cue.duration;
      if (progress >= 0 && progress < 1)
        return { kind: cue.kind, progress, index };
    }
  }
  return null;
}

const fade = (progress: number) =>
  Math.min(1, progress * 7, (1 - progress) * 7);
const shadowMaterial = (opacity: number) =>
  new T.MeshBasicMaterial({
    color: 0x073a61,
    transparent: true,
    opacity,
    depthWrite: false,
    side: T.DoubleSide,
  });
const toyMaterial = (color: number) =>
  new T.MeshStandardMaterial({
    color,
    roughness: 0.68,
    metalness: 0.02,
    flatShading: true,
  });

function triangle(points: number[], material: T.Material) {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(points, 3));
  geometry.computeVertexNormals();
  return new T.Mesh(geometry, material);
}

export class MarineLife {
  private fish = new T.Group();
  private birds = new T.Group();
  private dolphin = new T.Group();
  private whale = new T.Group();
  private wings: { left: T.Group; right: T.Group }[] = [];
  private whaleTail = new T.Group();
  private splash = new T.Mesh(
    new T.RingGeometry(0.42, 0.48, 20),
    new T.MeshBasicMaterial({
      color: 0xc7f5ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: T.DoubleSide,
    }),
  );
  private fishMaterial = shadowMaterial(0.22);
  private whaleMaterial = shadowMaterial(0.18);
  private preview: {
    kind: MarineKind;
    progress: number;
    index: number;
  } | null = null;
  private compact = false;

  constructor(scene: T.Scene) {
    const fishBody = new T.SphereGeometry(1, 8, 6);
    const fishTail = new T.BufferGeometry();
    fishTail.setAttribute(
      "position",
      new T.Float32BufferAttribute(
        [0, 0, -0.17, -0.12, 0, -0.37, 0.12, 0, -0.37],
        3,
      ),
    );
    fishTail.computeVertexNormals();
    for (let i = 0; i < 9; i++) {
      const fish = new T.Group();
      const body = new T.Mesh(fishBody, this.fishMaterial);
      body.scale.set(0.11 + (i % 3) * 0.018, 0.012, 0.23 + (i % 2) * 0.04);
      fish.add(body, new T.Mesh(fishTail, this.fishMaterial));
      fish.position.set((((i * 7) % 5) - 2) * 0.35, 0, (i - 4) * 0.48);
      fish.rotation.y = ((i % 3) - 1) * 0.16;
      this.fish.add(fish);
    }

    const gullBody = new T.SphereGeometry(1, 8, 6);
    const white = toyMaterial(0xe8f7f5);
    const wing = toyMaterial(0xb4d1da);
    wing.side = T.DoubleSide;
    for (let i = 0; i < 5; i++) {
      const gull = new T.Group();
      const body = new T.Mesh(gullBody, white);
      body.scale.set(0.12, 0.07, 0.19);
      gull.add(body);
      const left = new T.Group(),
        right = new T.Group();
      left.add(triangle([0, 0, 0.04, -0.43, 0, -0.03, -0.16, 0, -0.17], wing));
      right.add(triangle([0, 0, 0.04, 0.43, 0, -0.03, 0.16, 0, -0.17], wing));
      gull.add(left, right);
      gull.position.set(
        (i % 2 ? 1 : -1) * (0.4 + i * 0.13),
        (i % 3) * 0.17,
        (i - 2) * 0.95,
      );
      gull.scale.setScalar(0.9 + (i % 2) * 0.18);
      this.birds.add(gull);
      this.wings.push({ left, right });
    }

    const dolphinBlue = toyMaterial(0x6c9eb5);
    dolphinBlue.side = T.DoubleSide;
    const dolphinBelly = toyMaterial(0xc5e6e7);
    const dolphinBody = new T.Mesh(new T.SphereGeometry(1, 12, 8), dolphinBlue);
    dolphinBody.scale.set(0.3, 0.24, 0.78);
    this.dolphin.add(dolphinBody);
    const belly = new T.Mesh(new T.SphereGeometry(1, 10, 6), dolphinBelly);
    belly.scale.set(0.22, 0.055, 0.5);
    belly.position.set(0, -0.17, 0.1);
    this.dolphin.add(belly);
    const nose = new T.Mesh(new T.ConeGeometry(0.16, 0.55, 8), dolphinBlue);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 0.77;
    this.dolphin.add(nose);
    this.dolphin.add(
      triangle([0, 0.17, 0.05, 0, 0.52, -0.17, 0, 0.17, -0.4], dolphinBlue),
    );
    this.dolphin.add(
      triangle(
        [
          -0.08, 0, -0.63, -0.38, 0, -0.98, 0, 0, -0.87, 0, 0, -0.87, 0.38, 0,
          -0.98, 0.08, 0, -0.63,
        ],
        dolphinBlue,
      ),
    );
    this.splash.rotation.x = -Math.PI / 2;
    this.splash.position.y = -0.51;
    scene.add(this.splash);

    const whaleBody = new T.Mesh(
      new T.SphereGeometry(1, 14, 8),
      this.whaleMaterial,
    );
    whaleBody.scale.set(0.72, 0.012, 1.75);
    this.whale.add(whaleBody);
    for (const side of [-1, 1]) {
      const fin = new T.Mesh(new T.SphereGeometry(1, 8, 5), this.whaleMaterial);
      fin.scale.set(0.47, 0.008, 0.18);
      fin.rotation.y = side * 0.4;
      fin.position.set(side * 0.82, 0, -0.25);
      this.whale.add(fin);
    }
    this.whaleTail.position.z = -1.64;
    this.whaleTail.add(
      triangle(
        [
          -0.1, 0, 0, -0.82, 0, -0.5, 0, 0, -0.37, 0, 0, -0.37, 0.82, 0, -0.5,
          0.1, 0, 0,
        ],
        this.whaleMaterial,
      ),
    );
    this.whale.add(this.whaleTail);

    for (const group of [this.fish, this.birds, this.dolphin, this.whale]) {
      group.visible = false;
      scene.add(group);
    }
  }

  previewAt(kind: MarineKind | null, progress = 0.5) {
    this.preview = kind
      ? { kind, progress: T.MathUtils.clamp(progress, 0.01, 0.99), index: 0 }
      : null;
  }

  setCompact(compact: boolean) {
    this.compact = compact;
  }

  update(time: number) {
    this.currentTime = time;
    const cue = this.preview ?? marineAppearance(time);
    for (const group of [this.fish, this.birds, this.dolphin, this.whale])
      group.visible = false;
    this.splash.visible = false;
    if (!cue) return;
    const { progress: p, index } = cue;
    const side = index % 2 ? 1 : -1;
    const oceanX = this.compact ? 10.8 : 17.9;
    if (cue.kind === "fish") {
      this.fish.visible = true;
      this.fish.position.set(
        side * (oceanX + Math.sin(p * Math.PI) * 0.45),
        -0.49,
        -14 + p * 28,
      );
      this.fish.rotation.y = side < 0 ? Math.PI : 0;
      this.fishMaterial.opacity = 0.22 * fade(p);
    } else if (cue.kind === "birds") {
      this.birds.visible = true;
      this.birds.position.set(
        side * (oceanX + 0.5),
        5.2 + Math.sin(p * Math.PI) * 0.35,
        -16 + p * 32,
      );
      this.birds.rotation.y = side < 0 ? Math.PI : 0;
      for (let i = 0; i < this.wings.length; i++) {
        const flap = Math.sin(time * 11 + i * 0.7) * 0.45;
        this.wings[i].left.rotation.z = flap;
        this.wings[i].right.rotation.z = -flap;
      }
      this.birds.scale.setScalar(fade(p));
    } else if (cue.kind === "dolphin") {
      this.dolphin.visible = true;
      const z = -2.8 + p * 5.6;
      this.dolphin.position.set(
        side * (oceanX - 0.7),
        -0.62 + Math.sin(p * Math.PI) * 1.8,
        z,
      );
      this.dolphin.rotation.y = side < 0 ? -Math.PI / 2 : Math.PI / 2;
      this.dolphin.rotation.x = (0.5 - p) * 0.85;
      this.dolphin.scale.setScalar(1.08 * fade(p));
      const splashStrength = Math.max(0, 1 - Math.min(p, 1 - p) * 9);
      this.splash.visible = splashStrength > 0;
      this.splash.position.set(
        side * (oceanX - 0.7),
        -0.51,
        p < 0.5 ? -2.8 : 2.8,
      );
      this.splash.scale.setScalar(0.6 + (1 - splashStrength) * 1.4);
      (this.splash.material as T.MeshBasicMaterial).opacity =
        splashStrength * 0.28;
    } else {
      this.whale.visible = true;
      this.whale.position.set(
        side * (oceanX + 0.3) + Math.sin(p * Math.PI) * 0.4,
        -0.49,
        -16 + p * 32,
      );
      this.whale.rotation.y = side < 0 ? Math.PI : 0;
      this.whaleTail.rotation.y = Math.sin(time * 2.2) * 0.16;
      this.whaleMaterial.opacity = 0.17 * fade(p);
    }
  }

  snapshot() {
    const cue = this.preview ?? marineAppearance(this.currentTime);
    return { kind: cue?.kind ?? null, progress: cue?.progress ?? 0 };
  }

  private currentTime = 0;
}
