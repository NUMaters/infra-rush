import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporary = mkdtempSync(join(tmpdir(), "infra-balance-"));
const executable = join("node_modules", ".bin", "esbuild");
const output = join(temporary, "balance-runner.mjs");
try {
  execFileSync(
    executable,
    [
      "scripts/balance-runner.ts",
      "--bundle",
      "--platform=node",
      "--format=esm",
      `--outfile=${output}`,
    ],
    { stdio: "inherit" },
  );
  execFileSync(process.execPath, [output, ...process.argv.slice(2)], {
    stdio: "inherit",
    env: process.env,
  });
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
