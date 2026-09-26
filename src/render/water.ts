import * as T from "three";

type WaterTime = { value: number };

export function seaMaterial(time: WaterTime): T.ShaderMaterial {
  return new T.ShaderMaterial({
    uniforms: { time },
    vertexShader: `
      uniform float time;
      varying vec2 waterPosition;
      varying float swellHeight;
      void main() {
        vec3 p = position;
        waterPosition = vec2(p.x, -p.y);
        float broad = sin(dot(waterPosition, vec2(0.42, 0.29)) - time * 0.75);
        float cross = sin(dot(waterPosition, vec2(-0.21, 0.64)) + time * 0.58);
        swellHeight = broad * 0.085 + cross * 0.045;
        p.z += swellHeight;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      varying vec2 waterPosition;
      varying float swellHeight;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        vec2 p = waterPosition;
        float current = noise(p * 0.14 + vec2(time * 0.055, -time * 0.042));
        float detail = noise(p * 0.67 + vec2(-time * 0.13, time * 0.085));
        vec2 flow = p + vec2(current * 4.8 + detail * 0.9, detail * 1.6);
        float swell = sin(dot(flow, vec2(0.52, 0.83)) * 3.4 - time * 1.7);
        float cross = sin(dot(flow, vec2(-0.87, 0.41)) * 5.2 + time * 1.25);
        float colorMix = clamp(0.3 + current * 0.48 + swell * 0.12 + swellHeight * 0.55, 0.0, 1.0);
        vec3 deep = vec3(0.015, 0.32, 0.54);
        vec3 turquoise = vec3(0.055, 0.59, 0.78);
        vec3 color = mix(deep, turquoise, colorMix);
        float ripple = smoothstep(0.55, 0.9, swell * 0.8 + detail * 0.17);
        color += vec3(0.045, 0.08, 0.09) * ripple;
        float crest = smoothstep(0.78, 0.92, swell + current * 0.12);
        float broken = smoothstep(0.48, 0.78, noise(p * 0.27 + vec2(time * 0.08, 0.0)));
        color = mix(color, vec3(0.61, 0.88, 0.94), crest * broken * 0.2);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}

export function shoreMaterial(time: WaterTime): T.ShaderMaterial {
  return new T.ShaderMaterial({
    uniforms: { time },
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    vertexShader: `
      attribute vec2 foamCoord;
      varying vec2 vFoam;
      void main() {
        vFoam = foamCoord;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      varying vec2 vFoam;
      void main() {
        float flutter = sin(vFoam.x * 0.92 - time * 1.65 + sin(vFoam.x * 0.3) * 0.9);
        float band = 0.36 + flutter * 0.15;
        float foam = 1.0 - smoothstep(band - 0.18, band + 0.28, vFoam.y);
        foam *= smoothstep(0.03, 0.19, vFoam.y);
        foam *= 0.45 + 0.4 * smoothstep(-0.2, 0.9, flutter);
        gl_FragColor = vec4(0.83, 0.97, 1.0, foam);
      }
    `,
  });
}

export function shoreGeometry(
  points: [number, number][],
  center: number,
): T.BufferGeometry {
  const positions: number[] = [];
  const coords: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= points.length; i++) {
    const [x, z] = points[i % points.length];
    for (const [xScale, zScale, across] of [
      [1.012, 1.024, 0],
      [1.095, 1.155, 1],
    ]) {
      positions.push(x * xScale, -0.64, center + z * zScale);
      coords.push(i, across);
    }
    if (i < points.length) {
      const n = i * 2;
      indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("foamCoord", new T.Float32BufferAttribute(coords, 2));
  geometry.setIndex(indices);
  return geometry;
}
