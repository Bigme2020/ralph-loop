#!/usr/bin/env bun
// @bun

// bin/install.ts
import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { homedir } from "os";
import { resolve } from "path";

// src/install/paths.ts
import { join } from "path";
function getLauncherScript(sourcePath) {
  return `#!/usr/bin/env bash
set -euo pipefail

exec bun run "${sourcePath}" "$@"
`;
}
function resolveGlobalBinDir(homeDir, env) {
  return env.RALPH_BIN_DIR ?? join(homeDir, ".bun", "bin");
}
function getCommandLinks(repoRoot, globalBinDir) {
  return [
    {
      commandName: "ralph-loop",
      sourcePath: join(repoRoot, "bin", "ralph-loop.ts"),
      targetPath: join(globalBinDir, "ralph-loop")
    },
    {
      commandName: "ralph-run-openspec",
      sourcePath: join(repoRoot, "bin", "ralph-run-openspec.ts"),
      targetPath: join(globalBinDir, "ralph-run-openspec")
    }
  ];
}
function getPathExportHint(globalBinDir, currentPath) {
  const pathEntries = (currentPath ?? "").split(":").filter(Boolean);
  if (pathEntries.includes(globalBinDir)) {
    return null;
  }
  return `export PATH="${globalBinDir}:$PATH"`;
}

// bin/install.ts
var repoRoot = resolve(import.meta.dir, "..");
var globalBinDir = resolveGlobalBinDir(homedir(), process.env);
mkdirSync(globalBinDir, { recursive: true });
for (const link of getCommandLinks(repoRoot, globalBinDir)) {
  if (existsSync(link.targetPath)) {
    rmSync(link.targetPath, { force: true });
  }
  writeFileSync(link.targetPath, getLauncherScript(link.sourcePath), "utf8");
  chmodSync(link.targetPath, 493);
  console.log(`linked ${link.commandName} -> ${link.targetPath}`);
}
var pathHint = getPathExportHint(globalBinDir, process.env.PATH);
if (pathHint) {
  console.log("");
  console.log(`PATH hint: ${pathHint}`);
}
