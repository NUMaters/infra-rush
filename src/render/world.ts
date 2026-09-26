import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { M } from "../game/master";
import { side } from "../game/engine";
import type { Bot, GameEvent, GameState, Point, Team } from "../game/types";
import { vehicleWorkHeading } from "./vehicle-heading";
import { seaMaterial, shoreGeometry, shoreMaterial } from "./water";

const TEAM = { blue: 0x1689ff, red: 0xf34b53 };
const DEFAULT_ZOOM = 1.03;
const unit = new T.Vector3(0, 1, 0);
const clamp = T.MathUtils.clamp;
function rigPart(root: T.Object3D, name: string): T.Object3D | undefined {
  let found: T.Object3D | undefined;
  root.traverse((node) => {
    if (!found && (node.name === name || node.name.startsWith(`${name}.`)))
      found = node;
  });
  return found;
}
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
    {
      bot: T.Group;
      rig: T.Group | null;
      kind: string;
      ring: T.Mesh;
      walkBlend: number;
      team: Team;
    }
  >();
  private bridges = new Map<
    string,
    {
      stone: T.Group;
      steel: T.Group;
      mound: T.Group;
      cracks: T.Group;
      debris: T.Group;
    }
  >();
  private castles = new Map<Team, T.Group>();
  private particles: Particle[] = [];
  private dynamic = new T.Group();
  private waterTime = { value: 0 };
  private foam: T.ShaderMaterial;
  private clock = 0;
  private shake = 0;
  private hit = new Map<Team, number>();
  private selected: string | null = null;
  private homeTeam: Team = "blue";
  private followBot: string | null = null;
  private siteSignals = new Map<string, T.Mesh>();
  private route: T.Line;
  readonly controls: OrbitControls;
  private width = 1;
  private height = 1;
  fps = 60;
  frameTimes: number[] = [];
  onPick: (kind: "bot" | "bridge" | "empty", id: string) => void = () => {};
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
    const water = seaMaterial(this.waterTime);
    this.foam = shoreMaterial(this.waterTime);
    const sea = new T.Mesh(new T.PlaneGeometry(200, 200, 96, 96), water);
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
    this.camera.position.set(0, 40, -24);
    this.camera.zoom = DEFAULT_ZOOM;
    this.camera.updateProjectionMatrix();
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.screenSpacePanning = false;
    this.controls.minPolarAngle = Math.PI / 9;
    this.controls.maxPolarAngle = Math.PI / 2.6;
    this.controls.minZoom = 0.7;
    this.controls.maxZoom = 3.5;
    this.controls.mouseButtons = {
      LEFT: T.MOUSE.PAN,
      MIDDLE: T.MOUSE.DOLLY,
      RIGHT: T.MOUSE.ROTATE,
    };
    this.controls.touches = { ONE: T.TOUCH.PAN, TWO: T.TOUCH.DOLLY_ROTATE };
    this.controls.update();
    this.controls.saveState();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(container);
    const pointers = new Map<number, { x: number; y: number }>();
    let dragged = false;
    this.canvas.addEventListener("pointerdown", (e) => {
      this.followBot = null;
      if (!pointers.size) dragged = false;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size > 1 || e.button !== 0) dragged = true;
    });
    this.canvas.addEventListener("pointermove", (e) => {
      const start = pointers.get(e.pointerId);
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 7)
        dragged = true;
    });
    this.canvas.addEventListener("pointerup", (e) => {
      pointers.delete(e.pointerId);
    });
    this.canvas.addEventListener("pointercancel", (e) => {
      pointers.delete(e.pointerId);
      dragged = true;
    });
    this.canvas.addEventListener("wheel", () => (this.followBot = null), {
      passive: true,
    });
    // Pick on click, after the browser has fixed this tap's target. Opening
    // the task panel during pointerup can place a new action under the finger
    // and route the synthetic click to that action (a ghost command).
    this.canvas.addEventListener("click", (e) => {
      if (!dragged && e.button === 0) this.pick(e);
    });
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
      "soil",
      "stone-resource",
      "iron-resource",
      "crate",
      "minecart",
      "flower",
    ];
    let loaded = 0;
    const modelBase = new URL(import.meta.env.BASE_URL, window.location.href);
    await Promise.all(
      names.map(async (n) => {
        const gltf = await new GLTFLoader().loadAsync(
          new URL(`models/${n}.glb`, modelBase).href,
        );
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
        center = sz * 9.45;
      const shape = new T.Shape();
      const points: Point[] = [];
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        const x =
          Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), 0.35) * 15;
        const z =
          Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.45) * 5.95;
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
      const shore = new T.Mesh(shoreGeometry(points, center), this.foam);
      this.scene.add(shore);
      const cliffM = new T.MeshStandardMaterial({
        color: 0xc39775,
        flatShading: true,
      });
      const cliffG = new T.DodecahedronGeometry(1, 0);
      const cliff = new T.InstancedMesh(cliffG, cliffM, points.length);
      points.forEach((p, i) => {
        d.position.set(p[0], -0.22, center + p[1]);
        const roughness = 0.78 + rand() * 0.52;
        d.scale.set(0.48 * roughness, 0.67 * roughness, 0.4 * roughness);
        d.rotation.y = rand() * 6;
        d.updateMatrix();
        cliff.setMatrixAt(i, d.matrix);
        cliff.setColorAt(
          i,
          new T.Color().setHSL(0.075, 0.22, 0.68 + rand() * 0.14),
        );
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
      // The quarry spur makes the work route legible from either castle.
      this.path(
        new T.CatmullRomCurve3([
          new T.Vector3(M.castle[team][0], 0.43, center),
          new T.Vector3(0, 0.43, center - sz * 0.9),
          new T.Vector3(team === "blue" ? 5 : -5, 0.43, center - sz * 0.5),
          new T.Vector3(team === "blue" ? 8 : -8, 0.43, sz * 9.1),
        ]),
        0.72,
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
      const stonePile = this.model("stone-resource");
      stonePile.position.set(qx - 1.7, 0.39, sz * 9.4);
      stonePile.scale.setScalar(1.15);
      const ironPile = this.model("iron-resource");
      ironPile.position.set(qx + 1.5, 0.4, sz * 9.2);
      ironPile.scale.setScalar(1.2);
      const earthPile = this.model("soil");
      earthPile.position.set(qx + 2.9, 0.35, sz * 10.6);
      earthPile.scale.setScalar(0.8);
      this.scene.add(stonePile, ironPile, earthPile);
      const cart = this.model("minecart");
      cart.position.set(qx + 0.5, 0.38, sz * 8.5);
      cart.rotation.y = team === "red" ? Math.PI / 5 : -Math.PI / 5;
      this.scene.add(cart);
      const excavator = this.model("excavator", team);
      excavator.position.set(qx - 1.4, 0.39, sz * 10.35);
      excavator.rotation.y = team === "blue" ? 1.1 : -2.05;
      excavator.scale.setScalar(0.84);
      this.scene.add(excavator);
      for (const [cx, cz] of [
        [qx - 2.8, sz * 9.2],
        [
          M.castle[team][0] + (team === "blue" ? -3.2 : 3.2),
          M.castle[team][1] + sz * 1.0,
        ],
      ]) {
        const crate = this.model("crate");
        crate.position.set(cx, 0.39, cz);
        crate.rotation.y = (cx + cz) * 0.23;
        this.scene.add(crate);
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
        const x = -14 + rand() * 28,
          z = center + (rand() - 0.5) * 10.7;
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
        const x = -13.4 + rand() * 26.8,
          z = center + (rand() - 0.5) * 9.8;
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
        const x = -13.4 + rand() * 26.8,
          z = center + (rand() - 0.5) * 10.8;
        d.position.set(x, 0.34, z);
        d.scale.setScalar(0.24 + rand() * 0.11);
        d.updateMatrix();
        flowers.push(d.matrix.clone());
      }
      for (const x of [-13, -3, 3, 13]) {
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
    this.instanceAsset("flower", flowers);
    // Small reefs break up the straight sea margin without obscuring a route.
    for (const [x, z, size] of [
      [-17.1, -3.1, 1.0],
      [17.3, 2.4, 0.85],
      [-18.2, 2.6, 0.68],
      [18.4, -2.7, 0.7],
    ] as const) {
      const reef = this.solid(
        new T.DodecahedronGeometry(size, 0),
        0xb1a69a,
        x,
        -0.47,
        z,
      );
      reef.scale.y = 0.5;
      const cap = this.solid(
        new T.DodecahedronGeometry(size * 0.61, 0),
        0x83b977,
        x - size * 0.12,
        -0.11,
        z,
      );
      cap.scale.y = 0.31;
    }
    for (const site of M.bridges.sites) {
      for (const sz of [-1, 1]) {
        // Three timber landing stages are visible even before construction.
        this.solid(
          new T.BoxGeometry(3.4, 0.2, 1.35),
          0x986a43,
          site.x,
          0.2,
          sz * 3.65,
        );
        for (let i = -2; i <= 2; i++)
          this.solid(
            new T.BoxGeometry(0.59, 0.12, 1.27),
            i % 2 ? 0xe1b87a : 0xf1cb87,
            site.x + i * 0.64,
            0.36,
            sz * 3.65,
          );
        for (const dx of [-1.3, 1.3]) {
          this.solid(
            new T.CylinderGeometry(0.15, 0.18, 1, 8),
            0xbd883f,
            site.x + dx,
            0.67,
            sz * 3.9,
          );
          this.solid(
            new T.CylinderGeometry(0.165, 0.165, 0.36, 8),
            sz === -1 ? TEAM.blue : TEAM.red,
            site.x + dx,
            0.88,
            sz * 3.9,
          );
          this.solid(
            new T.SphereGeometry(0.17, 8, 6),
            0xffd65c,
            site.x + dx,
            1.22,
            sz * 3.9,
          );
        }
        const flagX = site.x + (sz === -1 ? -1.48 : 1.48);
        this.solid(
          new T.CylinderGeometry(0.065, 0.09, 1.85, 7),
          0xf8ecce,
          flagX,
          1.26,
          sz * 4.42,
        );
        const flag = new T.BufferGeometry();
        flag.setAttribute(
          "position",
          new T.Float32BufferAttribute(
            [
              flagX,
              2.13,
              sz * 4.42,
              flagX + (sz === -1 ? 0.72 : -0.72),
              1.94,
              sz * 4.42,
              flagX,
              1.75,
              sz * 4.42,
            ],
            3,
          ),
        );
        flag.computeVertexNormals();
        this.solid(flag, sz === -1 ? TEAM.blue : TEAM.red, 0, 0, 0);
      }
      const signal = this.solid(
        new T.TorusGeometry(0.72, 0.075, 5, 20),
        0xffe36d,
        site.x,
        0.57,
        this.homeTeam === "blue" ? -3.65 : 3.65,
      );
      signal.rotation.x = -Math.PI / 2;
      signal.visible = false;
      this.siteSignals.set(site.id, signal);
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
      const mound = this.model("soil");
      mound.position.set(site.x, 0.33, site.id === "red" ? -4 : 4);
      mound.scale.setScalar(1.1);
      mound.visible = false;
      this.scene.add(mound);
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
    this.pathLayer(curve, width + 0.22, 0xd2a76c, -0.012);
    this.pathLayer(curve, width, 0xf1d49b, 0);
  }
  private pathLayer(
    curve: T.CatmullRomCurve3,
    width: number,
    color: number,
    offset: number,
  ) {
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
        vertices.push(v.x, v.y + offset, v.z);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
    geo.computeVertexNormals();
    const path = new T.Mesh(
      geo,
      new T.MeshStandardMaterial({ color, side: T.DoubleSide }),
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
    a = { bot, rig: null, kind: "", ring, walkBlend: 0, team: b.team };
    this.actors.set(b.id, a);
    return a;
  }
  setSelected(id: string | null) {
    this.selected = id;
  }
  followMarch(id: string) {
    if (this.width < 700) this.followBot = id;
  }
  setSiteAvailability(ids: string[]) {
    for (const [id, signal] of this.siteSignals)
      signal.visible = ids.includes(id);
  }
  setZoom(amount: number) {
    this.camera.zoom = clamp(
      this.camera.zoom + amount,
      this.controls.minZoom,
      this.controls.maxZoom,
    );
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }
  rotateView(angle: number) {
    this.camera.position
      .sub(this.controls.target)
      .applyAxisAngle(unit, angle)
      .add(this.controls.target);
    this.controls.update();
  }
  resetView() {
    this.followBot = null;
    this.controls.enableDamping = false;
    this.controls.reset();
    this.controls.enableDamping = true;
    this.setHomeTeam(this.homeTeam);
  }
  reset() {
    this.selected = null;
    for (const p of this.particles) this.dynamic.remove(p.mesh);
    this.particles = [];
    this.shake = 0;
    this.hit.clear();
    this.resetView();
  }
  setHomeTeam(team: Team) {
    this.homeTeam = team;
    this.followBot = null;
    const home = this.width < 700;
    const targetZ = home ? -side(team) * 2.2 : 0;
    this.controls.target.set(0, 0, targetZ);
    this.camera.position.set(
      0,
      home ? 34 : 40,
      targetZ + side(team) * (home ? 18 : 24),
    );
    this.camera.zoom = home ? 1.3 : DEFAULT_ZOOM;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    for (const signal of this.siteSignals.values())
      signal.position.z = team === "blue" ? -3.65 : 3.65;
    this.canvas.setAttribute(
      "aria-label",
      `INFRA RUSH 3Dマップ。${team === "blue" ? "青" : "赤"}いBotをタップして作業を指示`,
    );
  }
  focusIntro(team: Team) {
    const [x, z] = M.castle[team];
    this.controls.enableDamping = false;
    this.controls.target.set(x, 0, z);
    this.camera.position.set(x, 23, z + (team === "blue" ? -13 : 13));
    this.camera.zoom = 1.45;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.controls.enableDamping = true;
  }
  resize() {
    this.width = this.canvas.parentElement?.clientWidth ?? innerWidth;
    this.height = this.canvas.parentElement?.clientHeight ?? innerHeight;
    this.renderer.setSize(this.width, this.height);
    const aspect = this.width / this.height;
    const vertical = Math.max(14.3, 15.2 / aspect);
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
  private pick(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect(),
      p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    let nearest: { id: string; d: number } | null = null;
    for (const [id, a] of this.actors) {
      if (a.team !== this.homeTeam) continue;
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
    this.onPick("empty", "");
  }
  effect(event: GameEvent) {
    if (event.kind === "earthquake") {
      this.shake = M.earthquake.shakeSeconds;
      for (const x of [-7, 0, 7]) this.burst([x, 0], 0xc2ac87, 12);
    }
    if (event.kind === "attack" && event.team) {
      this.hit.set(event.team === "blue" ? "red" : "blue", 0.7);
      this.shake = Math.max(this.shake, 0.17);
      this.burst(event.position!, 0xffd658, 30);
    }
    if (event.kind === "command" && event.position)
      this.burst(event.position, 0x9ceaff, 8);
    if (event.kind === "complete") this.burst(event.position!, 0xffdd58, 28);
    if (event.kind === "collapse") this.burst(event.position!, 0xa7a8a1, 32);
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
    this.waterTime.value = this.clock;
    this.frameTimes.push(elapsed * 1000);
    if (this.frameTimes.length > 180) this.frameTimes.shift();
    this.fps =
      1000 /
      (this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length);
    this.shake = Math.max(0, this.shake - dt);
    const jitter = this.shake > 0 ? Math.sin(this.clock * 70) * 0.12 : 0;
    if (this.followBot) {
      const tracked = s.bots.find((bot) => bot.id === this.followBot);
      if (!tracked) this.followBot = null;
      else if (tracked.state === "IDLE") this.setHomeTeam(this.homeTeam);
      else if (tracked.state === "RETURNING") {
        const targetZ = -side(this.homeTeam) * 2.2;
        const homeTarget = new T.Vector3(0, 0, targetZ);
        const homeCamera = new T.Vector3(
          0,
          34,
          targetZ + side(this.homeTeam) * 18,
        );
        this.controls.target.lerp(homeTarget, Math.min(1, dt * 3.5));
        this.camera.position.lerp(homeCamera, Math.min(1, dt * 3.5));
      } else {
        const target = new T.Vector3(
          tracked.position[0],
          0,
          tracked.position[1],
        );
        const shift = target
          .sub(this.controls.target)
          .multiplyScalar(Math.min(1, dt * 1.35));
        this.controls.target.add(shift);
        this.camera.position.add(shift);
      }
    }
    this.controls.update();
    this.camera.position.x += jitter;
    this.camera.position.z += jitter;
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
      a.walkBlend = T.MathUtils.damp(
        a.walkBlend,
        moving && !kind ? 1 : 0,
        14,
        dt,
      );
      const phase =
        this.clock * 13 + b.index * 1.7 + (b.team === "red" ? 0.8 : 0);
      const step = Math.sin(phase);
      a.bot.position.y += Math.abs(step) * 0.065 * a.walkBlend;
      a.bot.rotation.z = step * 0.055 * a.walkBlend;
      for (const sideName of ["left", "right"] as const) {
        const side = sideName === "left" ? 1 : -1;
        const footLift = Math.max(0, step * side) * a.walkBlend;
        const leg = rigPart(a.bot, `leg_${sideName}`);
        if (leg) {
          leg.rotation.x = step * side * 0.85 * a.walkBlend;
          leg.rotation.z = -side * (0.08 * a.walkBlend + footLift * 0.48);
          leg.position.x = side * (0.145 + footLift * 0.07);
          leg.position.y = 0.16 - 0.08 * a.walkBlend + footLift * 0.14;
        }
        const arm = rigPart(a.bot, `arm_${sideName}`);
        if (arm) {
          arm.rotation.x = -step * side * 0.95 * a.walkBlend;
          arm.rotation.z =
            -side *
            (0.07 * a.walkBlend +
              Math.max(0, -step * side) * a.walkBlend * 0.62);
        }
      }
      if (a.rig) {
        a.rig.position.copy(a.bot.position);
        a.rig.rotation.y = moving
          ? a.bot.rotation.y
          : vehicleWorkHeading(b, s.bridges);
        const work = !moving;
        const boom = rigPart(a.rig, "boom"),
          arm = rigPart(a.rig, "arm"),
          bucket = rigPart(a.rig, "bucket");
        if (boom) boom.rotation.x = work ? Math.sin(this.clock * 2.4) * 0.2 : 0;
        if (arm)
          arm.rotation.x = work ? Math.sin(this.clock * 2.4 + 1) * 0.3 : 0;
        if (bucket && kind === "drill") bucket.rotation.y = this.clock * 12;
        const girder = rigPart(a.rig, "girder");
        if (girder)
          girder.position.z =
            1.2 + (work ? clamp(b.progress / b.duration, 0, 1) * 4.4 : 0);
        a.rig.traverse((o) => {
          if (o.name.startsWith("outrigger")) o.scale.y = work ? 1 : 0.5;
        });
        if (work && kind === "grader")
          a.rig.position.x += Math.sin(this.clock) * 0.55;
        if (work && kind === "dozer") {
          const push = Math.sin(this.clock * 1.2) * 0.35;
          a.rig.position.x += Math.sin(a.rig.rotation.y) * push;
          a.rig.position.z += Math.cos(a.rig.rotation.y) * push;
        }
      }
      a.ring.visible = b.id === this.selected;
      a.ring.position.set(b.position[0], 0.4, b.position[1]);
      a.ring.scale.setScalar(kind ? 1.6 : 1);
    }
    for (const b of s.bridges) {
      const view = this.bridges.get(b.id)!;
      const signal = this.siteSignals.get(b.id);
      if (signal) {
        signal.visible = signal.visible && b.level === 0 && !b.lock;
        signal.scale.setScalar(1 + Math.sin(this.clock * 4) * 0.13);
      }
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
        (x) =>
          x.target === b.id &&
          ["BUILDING_EMBANKMENT", "CLEARING_EMBANKMENT"].includes(x.state),
      );
      if (worker) {
        view.mound.visible = true;
        const clearing = worker.state === "CLEARING_EMBANKMENT";
        view.mound.position.z = b.owner === "blue" ? 4 : -4;
        view.mound.scale.y = clearing
          ? Math.max(0.03, 1 - worker.progress / worker.duration)
          : 0.15 + (0.85 * worker.progress) / worker.duration;
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
    this.camera.position.x -= jitter;
    this.camera.position.z -= jitter;
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
