#!/usr/bin/env bun

import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { getCommandLinks, getLauncherScript, getPathExportHint, resolveGlobalBinDir } from "../src/install/paths";

const repoRoot = resolve(import.meta.dir, "..");
const globalBinDir = resolveGlobalBinDir(homedir(), process.env);

mkdirSync(globalBinDir, { recursive: true });

for (const link of getCommandLinks(repoRoot, globalBinDir)) {
  if (existsSync(link.targetPath)) {
    rmSync(link.targetPath, { force: true });
  }

  writeFileSync(link.targetPath, getLauncherScript(link.sourcePath), "utf8");
  chmodSync(link.targetPath, 0o755);
  console.log(`linked ${link.commandName} -> ${link.targetPath}`);
}

const pathHint = getPathExportHint(globalBinDir, process.env.PATH);
if (pathHint) {
  console.log("");
  console.log(`PATH hint: ${pathHint}`);
}
