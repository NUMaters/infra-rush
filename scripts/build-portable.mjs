// Builds a self-contained static distribution without Vite dependency prebundling.
import { execFileSync } from "node:child_process";
import {
  mkdir,
  copyFile,
  cp,
  writeFile,
  rename,
  readFile,
} from "node:fs/promises";
import { join } from "node:path";
const atomicCopy = async (source, dest) => {
  await copyFile(source, dest + ".tmp");
  await rename(dest + ".tmp", dest);
};
const qa = process.argv.includes("--qa");
const outputArgument = process.argv.find((arg) => arg.startsWith("--outdir="));
const out =
  outputArgument?.slice("--outdir=".length) || (qa ? ".qa-preview" : "dist");
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
    `--define:import.meta.env.PROD=${!qa}`,
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
  "utils/SkeletonUtils.js",
  "controls/OrbitControls.js",
])
  await atomicCopy(
    `node_modules/three/examples/jsm/${name}`,
    `${out}/vendor/addons/${name}`,
  );
await cp("public/audio", `${out}/audio`, { recursive: true });
await cp("public/media", `${out}/media`, { recursive: true });
await cp("public/models", `${out}/models`, { recursive: true });
await cp("public/ui", `${out}/ui`, { recursive: true });
await cp("public/icons", `${out}/icons`, { recursive: true });
await atomicCopy("public/manifest.webmanifest", `${out}/manifest.webmanifest`);
await atomicCopy("public/sw.js", `${out}/sw.js`);
// Share the actual shell (opening media and early BGM included) with Vite.
// A separate minimal shell silently drifted and omitted required media nodes.
const moduleScript = '<script type="module" src="/src/main.ts"></script>';
const shell = await readFile("index.html", "utf8");
if (!shell.includes(moduleScript))
  throw new Error("Cannot locate the game entry script");
await writeFile(
  `${out}/index.html`,
  shell
    .replaceAll("%BASE_URL%", "./")
    .replace(
      "</head>",
      '<link rel="stylesheet" href="./assets/main.css"></head>',
    )
    .replace(
      moduleScript,
      '<script type="importmap">{"imports":{"three":"./vendor/three.module.js","three/addons/":"./vendor/addons/"}}</script><script type="module" src="./assets/main.js"></script>',
    ),
);
console.log(
  `${out}/ is ready (${qa ? "development QA" : "production, no QA hooks"}).`,
);
