import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { M } from "../game/master";
import { side } from "../game/engine";
import type { Bot, GameEvent, GameState, Point, Team } from "../game/types";

const TEAM = { blue: 0x1689ff, red: 0xf34b53 };
const unit = new T.Vector3(0, 1, 0);
const clamp = T.MathUtils.clamp;
interface Particle {
  mesh: T.Mesh;
  velocity: T.Vector3;
  life: number;
  max: number;
}
export class World {
  readonly renderer: T.WebGLRenderer;
  readonly scene = new T.Scene();
  readonly camera = new T.OrthographicCamera(-20, 20, 20, -20, 0.1, 150);
  readonly canvas: HTMLCanvasElement;
  private templates = new Map<string, T.Group>();
  private teamMaterials = new Map<string, T.MeshStandardMaterial>();
  private particleGeometry = new T.BoxGeometry(0.12, 0.12, 0.12);
  private particleMaterials = new Map<number, T.MeshStandardMaterial>();
  private actors = new Map<
    string,
    { bot: T.Group; rig: T.Group | null; kind: string; ring: T.Mesh }
  >();
  private bridges = new Map<
    string,
    {
      stone: T.Group;
      steel: T.Group;
      mound: T.Mesh;
      cracks: T.Group;
      debris: T.Group;
    }
  >();
  private castles = new Map<Team, T.Group>();
  private particles: Particle[] = [];
  private dynamic = new T.Group();
  private water: T.ShaderMaterial;
  private clock = 0;
  private shake = 0;
  private hit = new Map<Team, number>();
  private selected: string | null = null;
  private route: T.Line;
  private zoom = 1;
  private target = new T.Vector3(0, 0, 0);
  private width = 1;
  private height = 1;
  fps = 60;
  frameTimes: number[] = [];
  onPick: (kind: "bot" | "bridge", id: string) => void = () => {};
  constructor(container: HTMLElement) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.canvas = this.renderer.domElement;
    this.canvas.setAttribute(
      "aria-label",
      "INFRA RUSH 3Dマップ。青いBotをタップして作業を指示",
    );
    this.canvas.tabIndex = 0;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.append(this.canvas);
    this.scene.background = new T.Color(0x4bc6e9);
    this.scene.fog = new T.Fog(0x73d8ed, 70, 130);
    this.scene.add(new T.HemisphereLight(0xe1f5ff, 0x9ba64c, 1.6));
    const sun = new T.DirectionalLight(0xfff1d4, 2.7);
    sun.position.set(-14, 28, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -25,
      right: 25,
      top: 25,
      bottom: -25,
      near: 0.1,
      far: 80,
    });
    sun.shadow.normalBias = 0.06;
    sun.shadow.bias = -0.0003;
    this.scene.add(sun);
    this.scene.add(this.dynamic);
    this.water = new T.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec3 v;uniform float time;void main(){float a=sin(v.x*2.4+sin(v.y*3.0+time*.4))*sin(v.y*3.2-time*.8);float b=sin(v.x*7.+v.y*4.+time);vec3 c=mix(vec3(.025,.51,.77),vec3(.07,.61,.87),a*.5+.5);c+=vec3(.11,.15,.15)*pow(max(0.,b*a),22.)*.30;gl_FragColor=vec4(c,1.);}`,
    });
    const sea = new T.Mesh(new T.PlaneGeometry(200, 200), this.water);
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -0.7;
    this.scene.add(sea);
    this.route = new T.Line(
      new T.BufferGeometry(),
      new T.LineDashedMaterial({
        color: 0xffdf68,
        dashSize: 0.45,
        gapSize: 0.22,
        transparent: true,
        opacity: 0.85,
      }),
    );
    this.scene.add(this.route);
    this.resize();
    new ResizeObserver(() => this.resize()).observe(container);
    this.canvas.addEventListener("pointerup", (e) => this.pick(e));
    this.canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.zoom = clamp(this.zoom - e.deltaY * 0.001, 0.8, 1.6);
        this.resize();
      },
      { passive: false },
    );
  }
  async load(onProgress: (n: number) => void) {
    const names = [
      "bot",
      "castle",
      "excavator",
      "dozer",
      "grader",
      "launcher",
      "drill",
      "stone-bridge",
      "steel-bridge",
      "tree",
      "fence",
    ];
    let loaded = 0;
    await Promise.all(
      names.map(async (n) => {
        const gltf = await new GLTFLoader().loadAsync(`/models/${n}.glb`);
        this.templates.set(n, gltf.scene);
        onProgress(++loaded / names.length);
      }),
    );
    this.buildMap();
  }
  model(name: string, team: Team = "blue") {
    const source = this.templates.get(name);
    if (!source) throw new Error(`Missing model ${name}`);
    const group = source.clone(true);
    group.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        const mat = o.material as T.MeshStandardMaterial;
        if (mat.name === "team") {
          const key = mat.uuid + team;
          let colored = this.teamMaterials.get(key);
          if (!colored) {
            colored = mat.clone();
            colored.color.setHex(TEAM[team]);
            this.teamMaterials.set(key, colored);
          }
          o.material = colored;
        }
      }
    });
    return group;
  }
  private solid(
    geometry: T.BufferGeometry,
    color: number,
    x: number,
    y: number,
    z: number,
    parent: T.Object3D = this.scene,
  ) {
    const m = new T.Mesh(
      geometry,
      new T.MeshStandardMaterial({ color, roughness: 0.85 }),
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  private buildMap() {
    let seed = 941;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const trees: T.Matrix4[] = [];
    const rocks: T.Matrix4[] = [];
    const flowers: T.Matrix4[] = [];
    const d = new T.Object3D();
    for (const team of ["blue", "red"] as const) {
      const sz = side(team),
        center = sz * 9;
      const shape = new T.Shape();
      const points: Point[] = [];
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        const x =
          Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), 0.35) * 13.5;
        const z =
          Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.45) * 5.5;
        points.push([x * (0.98 + rand() * 0.03), z * (0.97 + rand() * 0.04)]);
      }
      points.forEach((p, i) =>
        i ? shape.lineTo(p[0], p[1]) : shape.moveTo(p[0], p[1]),
      );
      shape.closePath();
      const land = new T.Mesh(
        new T.ExtrudeGeometry(shape, {
          depth: 1.1,
          bevelEnabled: true,
          bevelSegments: 1,
          steps: 1,
          bevelSize: 0.35,
          bevelThickness: 0.18,
        }),
        [
          new T.MeshStandardMaterial({ color: 0x75c531, roughness: 0.9 }),
          new T.MeshStandardMaterial({ color: 0xc49b79, flatShading: true }),
        ],
      );
      land.rotation.x = -Math.PI / 2;
      land.position.set(0, -0.9, center);
      land.receiveShadow = true;
      land.castShadow = true;
      this.scene.add(land);
      // Shoreline skirt reflects the reference's white foam around the island.
      const shore = new T.LineLoop(
        new T.BufferGeometry().setFromPoints(
          points.map(
            (p) => new T.Vector3(p[0] * 1.035, -0.61, center + p[1] * 1.07),
          ),
        ),
        new T.LineBasicMaterial({
          color: 0x95edff,
          transparent: true,
          opacity: 0.8,
        }),
      );
      this.scene.add(shore);
      const cliffM = new T.MeshStandardMaterial({
        color: 0xc39775,
        flatShading: true,
      });
      const cliffG = new T.DodecahedronGeometry(1, 0);
      const cliff = new T.InstancedMesh(cliffG, cliffM, points.length);
      points.forEach((p, i) => {
        d.position.set(p[0], -0.22, center + p[1]);
        d.scale.set(0.48, 0.67, 0.4);
        d.rotation.y = rand() * 6;
        d.updateMatrix();
        cliff.setMatrixAt(i, d.matrix);
      });
      cliff.castShadow = cliff.receiveShadow = true;
      this.scene.add(cliff);
      const castle = this.model("castle", team);
      castle.position.set(M.castle[team][0], 0.4, M.castle[team][1]);
      if (team === "red") castle.rotation.y = Math.PI;
      this.scene.add(castle);
      this.castles.set(team, castle);
      for (const x of [-7, 0, 7]) {
        const curve = new T.CatmullRomCurve3([
          new T.Vector3(x, 0.43, sz * 3.8),
          new T.Vector3(x * 0.97, 0.43, sz * 6),
          new T.Vector3(x * 0.55, 0.43, sz * 8),
          new T.Vector3(M.castle[team][0], 0.43, sz * 8.3),
        ]);
        this.path(curve, 1.1);
      }
      this.path(
        new T.CatmullRomCurve3([
          new T.Vector3(-8, 0.43, center),
          new T.Vector3(0, 0.43, center - 1 * sz),
          new T.Vector3(8, 0.43, center),
        ]),
        0.85,
      );
      const qx = team === "blue" ? 8 : -8;
      this.solid(
        new T.CylinderGeometry(3.65, 3.65, 0.08, 20),
        0xe4c18d,
        qx,
        0.32,
        sz * 10,
      );
      for (let i = 0; i < 12; i++) {
        const a = (i / 11) * Math.PI;
        const x = qx + Math.cos(a) * 3.1;
        const z = sz * (10.5 + Math.sin(a) * 2.3);
        const rock = this.solid(
          new T.DodecahedronGeometry(0.85 + rand() * 0.4, 0),
          0xa6a4ad,
          x,
          0.9 + rand() * 0.2,
          z,
        );
        rock.scale.y = 1.3 + rand();
      }
      // Timber mine entrance, props, and team wayfinding posts.
      for (const x of [qx - 0.8, qx + 0.8])
        this.solid(
          new T.BoxGeometry(0.18, 1.5, 0.2),
          0xb27d42,
          x,
          1.05,
          sz * 11.6,
        );
      this.solid(
        new T.BoxGeometry(2, 0.18, 0.28),
        0xc69148,
        qx,
        1.85,
        sz * 11.6,
      );
      for (let i = 0; i < 65; i++) {
        const x = -12.6 + rand() * 25.2,
          z = center + (rand() - 0.5) * 9.9;
        if (
          (Math.abs(x - M.castle[team][0]) < 3.0 &&
            Math.abs(z - M.castle[team][1]) < 2.8) ||
          (Math.abs(x - qx) < 3.8 && Math.abs(z - sz * 10) < 3.4) ||
          Math.abs(z - sz * 6.3) < 1.1 ||
          Math.abs(z - center) < 0.6
        )
          continue;
        d.position.set(x, 0.32, z);
        d.rotation.y = rand() * 6;
        d.scale.setScalar(0.7 + rand() * 0.45);
        d.updateMatrix();
        trees.push(d.matrix.clone());
      }
      for (let i = 0; i < 35; i++) {
        const x = -12 + rand() * 24,
          z = center + (rand() - 0.5) * 9;
        if (Math.abs(z - center) < 1.5) continue;
        d.position.set(x, 0.42, z);
        d.scale.set(
          0.18 + rand() * 0.22,
          0.18 + rand() * 0.28,
          0.18 + rand() * 0.2,
        );
        d.updateMatrix();
        rocks.push(d.matrix.clone());
      }
      for (let i = 0; i < 100; i++) {
        const x = -12 + rand() * 24,
          z = center + (rand() - 0.5) * 10;
        d.position.set(x, 0.34, z);
        d.scale.setScalar(0.04 + rand() * 0.045);
        d.updateMatrix();
        flowers.push(d.matrix.clone());
      }
      for (const x of [-11.5, -3, 3, 11.5]) {
        const fence = this.model("fence");
        fence.position.set(x, 0.35, sz * 12.3);
        this.scene.add(fence);
      }
    }
    this.instanceAsset("tree", trees);
    this.instanceGeometry(
      new T.DodecahedronGeometry(1),
      new T.MeshStandardMaterial({ color: 0xaaa8a9, flatShading: true }),
      rocks,
    );
    this.instanceGeometry(
      new T.SphereGeometry(1, 5, 3),
      new T.MeshStandardMaterial({ color: 0xfff9bd }),
      flowers,
    );
    for (const site of M.bridges.sites) {
      for (const sz of [-1, 1]) {
        this.solid(
          new T.BoxGeometry(3.1, 0.2, 0.65),
          0xd6b480,
          site.x,
          0.28,
          sz * 3.2,
        );
        for (const dx of [-1.3, 1.3]) {
          this.solid(
            new T.CylinderGeometry(0.15, 0.18, 1, 8),
            0xbd883f,
            site.x + dx,
            0.5,
            sz * 3.3,
          );
          this.solid(
            new T.SphereGeometry(0.17, 8, 6),
            0xffd65c,
            site.x + dx,
            1.05,
            sz * 3.3,
          );
        }
      }
      const stone = this.model(
        "stone-bridge",
        site.id === "red" ? "red" : "blue",
      );
      const steel = this.model(
        "steel-bridge",
        site.id === "red" ? "red" : "blue",
      );
      stone.position.set(site.x, 0.42, 0);
      steel.position.copy(stone.position);
      stone.visible = steel.visible = false;
      for (const obj of [stone, steel])
        obj.traverse((o) => {
          if (o instanceof T.Mesh && (o.material as T.Material).name === "team")
            o.material = (o.material as T.Material).clone();
        });
      this.scene.add(stone, steel);
      const mound = this.solid(
        new T.SphereGeometry(1, 10, 6),
        0xa57b42,
        site.x,
        0.4,
        site.id === "red" ? -4 : 4,
      );
      mound.scale.set(1.65, 1, 1);
      mound.visible = false;
      const cracks = new T.Group();
      cracks.position.set(site.x, 0.5, 0);
      cracks.visible = false;
      for (let i = 0; i < 5; i++) {
        const pts = [
          new T.Vector3(-0.7, 0.02, i - 2),
          new T.Vector3(-0.2, 0.025, i - 1.8),
          new T.Vector3(0, 0.025, i - 2),
          new T.Vector3(0.5, 0.025, i - 1.8),
        ];
        const l = new T.Line(
          new T.BufferGeometry().setFromPoints(pts),
          new T.LineBasicMaterial({ color: 0x58494a }),
        );
        cracks.add(l);
      }
      this.scene.add(cracks);
      const debris = new T.Group();
      debris.position.set(site.x, -0.5, 0);
      for (let i = 0; i < 8; i++)
        this.solid(
          new T.DodecahedronGeometry(0.3, 0),
          0xb2b3b1,
          (rand() - 0.5) * 2.5,
          0,
          (rand() - 0.5) * 5,
          debris,
        );
      debris.visible = false;
      this.scene.add(debris);
      this.bridges.set(site.id, { stone, steel, mound, cracks, debris });
    }
  }
  private path(curve: T.CatmullRomCurve3, width: number) {
    const points = curve.getPoints(40);
    const vertices: number[] = [];
    const edges = points.map((p, i) => {
      const previous = points[Math.max(0, i - 1)];
      const next = points[Math.min(points.length - 1, i + 1)];
      const normal = next
        .clone()
        .sub(previous)
        .normalize()
        .cross(unit)
        .multiplyScalar(width / 2);
      return [p.clone().add(normal), p.clone().sub(normal)];
    });
    for (let i = 0; i < edges.length - 1; i++) {
      for (const v of [
        edges[i][0],
        edges[i][1],
        edges[i + 1][0],
        edges[i + 1][0],
        edges[i][1],
        edges[i + 1][1],
      ])
        vertices.push(v.x, v.y, v.z);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
    geo.computeVertexNormals();
    const path = new T.Mesh(
      geo,
      new T.MeshStandardMaterial({ color: 0xeac68a, side: T.DoubleSide }),
    );
    path.receiveShadow = true;
    this.scene.add(path);
  }
  private instanceAsset(name: string, matrices: T.Matrix4[]) {
    const groups = new Map<T.Material, T.BufferGeometry[]>();
    const root = this.templates.get(name)!;
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (o instanceof T.Mesh) {
        const g = o.geometry.clone().applyMatrix4(o.matrixWorld),
          m = o.material as T.Material;
        groups.set(m, [...(groups.get(m) ?? []), g]);
      }
    });
    for (const [m, g] of groups)
      this.instanceGeometry(mergeGeometries(g), m, matrices);
  }
  private instanceGeometry(
    geo: T.BufferGeometry,
    mat: T.Material,
    matrices: T.Matrix4[],
  ) {
    const mesh = new T.InstancedMesh(geo, mat, matrices.length);
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.castShadow = mesh.receiveShadow = true;
    this.scene.add(mesh);
  }
  private actor(b: Bot) {
    let a = this.actors.get(b.id);
    if (a) return a;
    const bot = this.model("bot", b.team);
    this.dynamic.add(bot);
    const ring = this.solid(
      new T.RingGeometry(0.5, 0.62, 32),
      0xffdf6a,
      0,
      0.4,
      0,
      this.dynamic,
    );
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    a = { bot, rig: null, kind: "", ring };
    this.actors.set(b.id, a);
    return a;
  }
  setSelected(id: string | null) {
    this.selected = id;
  }
  setZoom(amount: number) {
    this.zoom = clamp(this.zoom + amount, 0.8, 1.6);
    this.resize();
  }
  reset() {
    this.selected = null;
    for (const p of this.particles) this.dynamic.remove(p.mesh);
    this.particles = [];
    this.shake = 0;
    this.hit.clear();
  }
  resize() {
    this.width = this.canvas.parentElement?.clientWidth ?? innerWidth;
    this.height = this.canvas.parentElement?.clientHeight ?? innerHeight;
    this.renderer.setSize(this.width, this.height);
    const aspect = this.width / this.height;
    const vertical = Math.max(14.3, 15.2 / aspect) / this.zoom;
    this.camera.left = -vertical * aspect;
    this.camera.right = vertical * aspect;
    this.camera.top = vertical;
    this.camera.bottom = -vertical;
    this.camera.updateProjectionMatrix();
  }
  project(point: Point, height = 1): { x: number; y: number } {
    const p = new T.Vector3(point[0], height, point[1]).project(this.camera);
    return {
      x: ((p.x + 1) * this.width) / 2,
      y: ((1 - p.y) * this.height) / 2,
    };
  }
  private pick(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect(),
      p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    let nearest: { id: string; d: number } | null = null;
    for (const [id, a] of this.actors) {
      if (!id.startsWith("blue")) continue;
      const pos = this.project([a.bot.position.x, a.bot.position.z], 1);
      const d = Math.hypot(p.x - pos.x, p.y - pos.y);
      if (d < 32 && (!nearest || d < nearest.d)) nearest = { id, d };
    }
    if (nearest) {
      this.onPick("bot", nearest.id);
      return;
    }
    for (const site of M.bridges.sites) {
      const pos = this.project([site.x, 0], 0.4);
      if (Math.hypot(p.x - pos.x, p.y - pos.y) < 50) {
        this.onPick("bridge", site.id);
        return;
      }
    }
  }
  effect(event: GameEvent) {
    if (event.kind === "earthquake") {
      this.shake = M.earthquake.shakeSeconds;
      for (const x of [-7, 0, 7]) this.burst([x, 0], 0xc2ac87, 12);
    }
    if (event.kind === "attack" && event.team) {
      this.hit.set(event.team === "blue" ? "red" : "blue", 0.7);
      this.burst(event.position!, 0xffd658, 20);
    }
    if (event.kind === "complete") this.burst(event.position!, 0xffdd58, 20);
    if (event.kind === "collapse") this.burst(event.position!, 0xa7a8a1, 25);
    if (event.kind === "return")
      this.burst(
        event.position!,
        event.team === "blue" ? 0xa5e9ff : 0xffc2c4,
        7,
      );
  }
  private burst(position: Point, color: number, count: number) {
    const geometry = this.particleGeometry;
    let material = this.particleMaterials.get(color);
    if (!material) {
      material = new T.MeshStandardMaterial({ color });
      this.particleMaterials.set(color, material);
    }
    for (let i = 0; i < count; i++) {
      const mesh = new T.Mesh(geometry, material);
      mesh.position.set(position[0], 1, position[1]);
      this.dynamic.add(mesh);
      this.particles.push({
        mesh,
        velocity: new T.Vector3(
          (Math.random() - 0.5) * 4,
          2 + Math.random() * 3,
          (Math.random() - 0.5) * 4,
        ),
        life: 0.9,
        max: 0.9,
      });
    }
  }
  update(s: GameState, dt: number, elapsed = dt) {
    this.clock += dt;
    this.water.uniforms.time.value = this.clock;
    this.frameTimes.push(elapsed * 1000);
    if (this.frameTimes.length > 180) this.frameTimes.shift();
    this.fps =
      1000 /
      (this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length);
    this.shake = Math.max(0, this.shake - dt);
    const jitter = this.shake > 0 ? Math.sin(this.clock * 70) * 0.12 : 0;
    this.camera.position.set(jitter, 32, 29 + jitter);
    this.camera.lookAt(this.target);
    for (const b of s.bots) {
      const a = this.actor(b);
      const active = ![
        "IDLE",
        "MARCHING",
        "ATTACKING_CASTLE",
        "RETURNING",
      ].includes(b.state);
      const kind =
        active && b.action && b.action in M.vehicles
          ? M.vehicles[b.action as keyof typeof M.vehicles]
          : "";
      if (a.kind !== kind) {
        if (a.rig) {
          this.dynamic.remove(a.rig);
          a.rig = null;
        }
        if (kind) {
          a.rig = this.model(kind, b.team);
          this.dynamic.add(a.rig);
        }
        a.kind = kind;
      }
      a.bot.visible = !kind;
      a.bot.position.set(b.position[0], 0.35, b.position[1]);
      a.bot.rotation.y = b.team === "blue" ? 0 : Math.PI;
      const moving = b.state === "MOVING" || b.state === "MARCHING";
      if (moving && b.path.length) {
        const p = b.path[0];
        a.bot.rotation.y = Math.atan2(
          p[0] - b.position[0],
          p[1] - b.position[1],
        );
      }
      let scale = 1;
      if (b.state === "RETURNING")
        scale = Math.max(0.01, 1 - b.progress / b.duration);
      else if (b.id === this.selected)
        scale = 1 + Math.sin(this.clock * 5) * 0.025;
      a.bot.scale.setScalar(scale);
      if (moving)
        a.bot.position.y += Math.abs(Math.sin(this.clock * 11 + b.index)) * 0.1;
      for (const [name, sign] of [
        ["leg_left", 1],
        ["leg_right", -1],
        ["arm_left", -1],
        ["arm_right", 1],
      ] as const) {
        const part = a.bot.getObjectByName(name);
        if (part)
          part.rotation.x = moving
            ? Math.sin(this.clock * 11) * 0.4 * sign
            : Math.sin(this.clock * 2) * 0.04;
      }
      if (a.rig) {
        a.rig.position.copy(a.bot.position);
        a.rig.rotation.y = moving
          ? a.bot.rotation.y
          : b.team === "blue"
            ? Math.PI
            : 0;
        const work = !moving;
        const boom = a.rig.getObjectByName("boom"),
          arm = a.rig.getObjectByName("arm"),
          bucket = a.rig.getObjectByName("bucket");
        if (boom) boom.rotation.x = work ? Math.sin(this.clock * 2.4) * 0.2 : 0;
        if (arm)
          arm.rotation.x = work ? Math.sin(this.clock * 2.4 + 1) * 0.3 : 0;
        if (bucket && kind === "drill") bucket.rotation.y = this.clock * 12;
        const girder = a.rig.getObjectByName("girder");
        if (girder)
          girder.position.z =
            1.2 + (work ? clamp(b.progress / b.duration, 0, 1) * 3 : 0);
        a.rig.traverse((o) => {
          if (o.name.startsWith("outrigger")) o.scale.y = work ? 1 : 0.5;
        });
        if (work && kind === "grader")
          a.rig.position.x += Math.sin(this.clock) * 0.55;
        if (work && kind === "dozer")
          a.rig.position.z += Math.sin(this.clock * 1.2) * 0.35;
      }
      a.ring.visible = b.id === this.selected;
      a.ring.position.set(b.position[0], 0.4, b.position[1]);
      a.ring.scale.setScalar(kind ? 1.6 : 1);
    }
    for (const b of s.bridges) {
      const view = this.bridges.get(b.id)!;
      view.stone.visible = b.level === 1;
      view.steel.visible = b.level >= 2;
      view.debris.visible = b.level === 0 && b.damage > 0;
      view.cracks.visible = b.damage > 0 && b.level > 0;
      view.cracks.scale.x = b.damage === 2 ? 1.6 : 1;
      view.mound.visible = !!b.blockedBy;
      view.mound.position.z = b.owner === "blue" ? 4 : -4;
      for (const obj of [view.stone, view.steel]) {
        obj.traverse((o) => {
          if (o instanceof T.Mesh && (o.material as T.Material).name === "team")
            (o.material as T.MeshStandardMaterial).color.setHex(
              b.owner ? TEAM[b.owner] : 0xffcb59,
            );
        });
        obj.rotation.z = this.shake
          ? Math.sin(this.clock * 35 + b.x) * 0.015
          : 0;
      }
      const worker = s.bots.find(
        (x) => x.target === b.id && x.state === "BUILDING_EMBANKMENT",
      );
      if (worker) {
        view.mound.visible = true;
        view.mound.position.z = side(worker.team) * 4;
        view.mound.scale.y = 0.15 + worker.progress / worker.duration;
      } else view.mound.scale.y = 1;
    }
    for (const [team, castle] of this.castles) {
      const h = Math.max(0, (this.hit.get(team) ?? 0) - dt);
      this.hit.set(team, h);
      castle.rotation.z = Math.sin(this.clock * 32) * h * 0.08;
      castle.scale.y = 1 - Math.sin(h * 12) * h * 0.12;
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.velocity.y -= dt * 7;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.rotation.x += dt * 5;
      p.mesh.scale.setScalar(Math.max(0, p.life / p.max));
      if (p.life <= 0) {
        this.dynamic.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
    const b = s.bots.find((x) => x.id === this.selected);
    this.route.visible = !!b?.path.length;
    if (b?.path.length) {
      const points = [b.position, ...b.path].map(
        (p) => new T.Vector3(p[0], 0.55, p[1]),
      );
      this.route.geometry.dispose();
      this.route.geometry = new T.BufferGeometry().setFromPoints(points);
      this.route.computeLineDistances();
    }
    this.renderer.render(this.scene, this.camera);
  }
  metrics() {
    return {
      fps: Math.round(this.fps),
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      pixelRatio: this.renderer.getPixelRatio(),
    };
  }
}
