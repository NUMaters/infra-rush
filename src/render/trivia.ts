import {
  AmbientLight,
  Box3,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { CivilTrivia } from "../content/trivia";

type ModelName = CivilTrivia["model"];

/** A small, disposable 3D stage for the model featured on the result card. */
export class TriviaViewer {
  private renderer: WebGLRenderer | null = null;
  private frame = 0;
  private generation = 0;

  stop() {
    this.generation++;
    cancelAnimationFrame(this.frame);
    this.renderer?.forceContextLoss();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.renderer = null;
  }

  async show(host: HTMLElement, name: ModelName) {
    this.stop();
    const generation = this.generation;
    let renderer: WebGLRenderer | null = null;
    try {
      const gltf = await new GLTFLoader().loadAsync(
        `${import.meta.env.BASE_URL}models/${name}.glb`,
      );
      if (generation !== this.generation || !host.isConnected) return;

      renderer = new WebGLRenderer({ alpha: true, antialias: true });
      const stageRenderer = renderer;
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      renderer.setSize(host.clientWidth, host.clientHeight);
      renderer.domElement.className = "trivia-canvas";
      renderer.domElement.setAttribute("role", "img");
      renderer.domElement.setAttribute("aria-label", `${name}の動く3Dモデル`);
      const scene = new Scene();
      scene.add(new AmbientLight(0xffffff, 2.1));
      const sun = new DirectionalLight(0xffffff, 2.7);
      sun.position.set(4, 8, 6);
      scene.add(sun);

      const turntable = new Group();
      const model = gltf.scene;
      model.traverse((part) => {
        if (!(part instanceof Mesh)) return;
        const materials = Array.isArray(part.material)
          ? part.material
          : [part.material];
        for (const material of materials) {
          if (!(material instanceof MeshStandardMaterial)) continue;
          material.normalMap = null;
          material.roughnessMap = null;
          material.metalnessMap = null;
          material.aoMap = null;
          material.needsUpdate = true;
        }
      });
      const box = new Box3().setFromObject(model);
      const center = box.getCenter(new Vector3());
      model.position.sub(center);
      turntable.add(model);
      scene.add(turntable);
      const size = box.getSize(new Vector3());
      const radius = Math.max(size.x, size.y, size.z, 0.1);
      const camera = new PerspectiveCamera(
        34,
        host.clientWidth / host.clientHeight,
        0.01,
        100,
      );
      camera.position.set(radius * 0.95, radius * 0.7, radius * 1.25);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      host.append(renderer.domElement);
      host.querySelector(".trivia-model-wait")?.remove();
      this.renderer = renderer;

      const movingPart =
        name === "excavator"
          ? model.getObjectByName("boom")
          : name === "dozer"
            ? model.getObjectByName("blade")
            : name === "launcher"
              ? model.getObjectByName("girder")
              : name === "grader"
                ? model.getObjectByName("grader_work_blade")
                : null;
      const initialRotation = movingPart?.rotation.x ?? 0;
      const initialPosition = movingPart?.position.clone();
      const pilotArm =
        model.getObjectByName("arm_left.001") ??
        model.getObjectByName("arm_left.002") ??
        model.getObjectByName("arm_left.003") ??
        model.getObjectByName("arm_left.004");
      const pilotArmRotation = pilotArm?.rotation.x ?? 0;
      const clockStart = performance.now();
      let lastFrame = 0;
      const animate = (now: number) => {
        if (generation !== this.generation || !host.isConnected) return;
        this.frame = requestAnimationFrame(animate);
        if (now - lastFrame < 32) return;
        lastFrame = now;
        const t = (now - clockStart) / 1000;
        const reducedMotion = matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        if (!reducedMotion) {
          turntable.rotation.y = Math.sin(t * 0.45) * 0.22;
          turntable.position.y = Math.sin(t * 2) * radius * 0.012;
          if (movingPart && initialPosition) {
            movingPart.rotation.x = initialRotation + Math.sin(t * 2.5) * 0.13;
            if (name === "launcher")
              movingPart.position.z =
                initialPosition.z + (Math.sin(t * 1.5) + 1) * radius * 0.09;
            else if (name === "dozer")
              movingPart.position.y =
                initialPosition.y + Math.sin(t * 2.5) * radius * 0.025;
          }
          if (pilotArm)
            pilotArm.rotation.x = pilotArmRotation + Math.sin(t * 4) * 0.16;
        }
        stageRenderer.render(scene, camera);
      };
      this.frame = requestAnimationFrame(animate);
    } catch {
      renderer?.forceContextLoss();
      renderer?.dispose();
      renderer?.domElement.remove();
      if (generation !== this.generation || !host.isConnected) return;
      host.querySelector(".trivia-model-wait")?.remove();
      host.querySelector(".trivia-model")?.classList.add("fallback-visible");
    }
  }
}
