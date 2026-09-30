// One-click launcher used by start.bat / start.command.
// Installs and builds only when needed, starts the Go server, and opens the browser once /health answers.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const port = 8080;
const url = `http://localhost:${port}/`;
const stampFile = ".launcher-stamp.json";
const shell = process.platform === "win32";

const fail = (message) => {
  console.error(`\n[ERROR] ${message}`);
  process.exit(1);
};
const run = (cmd, args) => {
  const result = spawnSync(cmd, args, { stdio: "inherit", shell });
  if (result.error || result.status !== 0)
    fail(`"${cmd} ${args.join(" ")}" failed. See the messages above.`);
};

const hasGo =
  spawnSync("go", ["version"], { stdio: "ignore", shell }).status === 0;
if (!hasGo)
  fail(
    "Go is not installed. Install it from https://go.dev/dl/ and run this file again.",
  );

// path + size + mtime of every file that feeds the frontend build
function fingerprint(paths) {
  const hash = createHash("sha256");
  const walk = (path) => {
    if (!existsSync(path)) return;
    const stat = statSync(path);
    if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort()) walk(join(path, name));
    } else {
      hash.update(`${path}:${stat.size}:${Math.floor(stat.mtimeMs)}\n`);
    }
  };
  paths.forEach(walk);
  return hash.digest("hex");
}
const installKey = createHash("sha256")
  .update(readFileSync("package-lock.json"))
  .digest("hex");
const buildKey = fingerprint([
  "src",
  "public",
  "index.html",
  "vite.config.ts",
  "tsconfig.json",
  "package-lock.json",
]);
let stamp = {};
try {
  stamp = JSON.parse(readFileSync(stampFile, "utf8"));
} catch {
  // no stamp yet: first launch
}

if (!existsSync("node_modules") || stamp.install !== installKey) {
  console.log("Installing packages (a few minutes at first)...");
  run("npm", ["ci"]);
  stamp.install = installKey;
  stamp.build = undefined;
  writeFileSync(stampFile, JSON.stringify(stamp));
}
if (!existsSync(join("dist", "index.html")) || stamp.build !== buildKey) {
  console.log("Building the game...");
  run("npm", ["run", "build"]);
  stamp.build = buildKey;
  writeFileSync(stampFile, JSON.stringify(stamp));
}

console.log(`\nINFRA RUSH: ${url}\nClose this window to stop the game.`);
const server = spawn(
  "go",
  [
    "run",
    "./server",
    "-addr",
    `127.0.0.1:${port}`,
    "-static",
    "dist",
    "-master",
    "master",
  ],
  { stdio: "inherit", shell },
);
server.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.kill());

// Open the browser only after the server (first `go run` may still be compiling) answers.
for (let attempt = 0; attempt < 300; attempt++) {
  try {
    if ((await fetch(`${url}health`)).ok) break;
  } catch {
    // server not up yet
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
const [cmd, args] =
  process.platform === "win32"
    ? ["cmd", ["/c", "start", "", url]]
    : process.platform === "darwin"
      ? ["open", [url]]
      : ["xdg-open", [url]];
spawn(cmd, args, { stdio: "ignore", detached: true })
  .on("error", () => {})
  .unref();
