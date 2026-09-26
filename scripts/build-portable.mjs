// Builds a self-contained static distribution without Vite dependency prebundling.
import { execFileSync } from "node:child_process";
import { mkdir, copyFile, cp, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
const atomicCopy = async (source, dest) => {
  await copyFile(source, dest + ".tmp");
  await rename(dest + ".tmp", dest);
};
const qa = process.argv.includes("--qa"),
  out = qa ? ".qa-preview" : "dist";
const platform = process.platform === "win32" ? "win32" : process.platform;
const binary = join(
  "node_modules",
  `@esbuild/${platform}-${process.arch}`,
  process.platform === "win32" ? "esbuild.exe" : "bin/esbuild",
);
const bundleDir = `${out}/bundle-${process.pid}`;
await mkdir(bundleDir, { recursive: true });
execFileSync(
  binary,
  [
    "src/main.ts",
    "--bundle",
    "--external:three",
    "--external:three/*",
    `--outdir=${bundleDir}`,
    "--format=esm",
    "--target=es2022",
    '--tsconfig-raw={"compilerOptions":{"useDefineForClassFields":true}}',
    `--define:import.meta.env.DEV=${qa}`,
    '--define:import.meta.env.BASE_URL="./"',
    `--define:import.meta.env.VITE_ONLINE_WS_URL=${JSON.stringify(process.env.VITE_ONLINE_WS_URL ?? "")}`,
    "--minify",
  ],
  { stdio: "inherit" },
);
await mkdir(`${out}/assets`, { recursive: true });
for (const name of ["main.js", "main.css"])
  await rename(`${bundleDir}/${name}`, `${out}/assets/${name}`);
await mkdir(`${out}/vendor/addons/loaders`, { recursive: true });
await mkdir(`${out}/vendor/addons/utils`, { recursive: true });
await mkdir(`${out}/vendor/addons/controls`, { recursive: true });
for (const name of ["three.module.js", "three.core.js"])
  await atomicCopy(`node_modules/three/build/${name}`, `${out}/vendor/${name}`);
await atomicCopy("node_modules/three/LICENSE", `${out}/vendor/THREE-LICENSE`);
for (const name of [
  "loaders/GLTFLoader.js",
  "utils/BufferGeometryUtils.js",
  "controls/OrbitControls.js",
])
  await atomicCopy(
    `node_modules/three/examples/jsm/${name}`,
    `${out}/vendor/addons/${name}`,
  );
await cp("public/audio", `${out}/audio`, { recursive: true });
await cp("public/models", `${out}/models`, { recursive: true });
await cp("public/ui", `${out}/ui`, { recursive: true });
await writeFile(
  `${out}/index.html`,
  '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#168cd0"><title>INFRA RUSH — 勝利への道をつくろう。</title><link rel="stylesheet" href="./assets/main.css"><script type="importmap">{"imports":{"three":"./vendor/three.module.js","three/addons/":"./vendor/addons/"}}</script></head><body><div id="app"></div><script type="module" src="./assets/main.js"></script></body></html>',
);
console.log(
  `${out}/ is ready (${qa ? "development QA" : "production, no QA hooks"}).`,
);
