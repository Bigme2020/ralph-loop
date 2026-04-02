import { join } from "node:path";

export interface CommandLink {
  commandName: string;
  sourcePath: string;
  targetPath: string;
}

export function getLauncherScript(sourcePath: string): string {
  return `#!/usr/bin/env bash
set -euo pipefail

exec bun run "${sourcePath}" "$@"
`;
}

export function resolveGlobalBinDir(homeDir: string, env: Record<string, string | undefined>): string {
  return env.RALPH_BIN_DIR ?? join(homeDir, ".bun", "bin");
}

export function getCommandLinks(repoRoot: string, globalBinDir: string): CommandLink[] {
  return [
    {
      commandName: "ralph-loop",
      sourcePath: join(repoRoot, "bin", "ralph-loop.ts"),
      targetPath: join(globalBinDir, "ralph-loop"),
    },
    {
      commandName: "ralph-run-openspec",
      sourcePath: join(repoRoot, "bin", "ralph-run-openspec.ts"),
      targetPath: join(globalBinDir, "ralph-run-openspec"),
    },
  ];
}

export function getPathExportHint(globalBinDir: string, currentPath: string | undefined): string | null {
  const pathEntries = (currentPath ?? "").split(":").filter(Boolean);
  if (pathEntries.includes(globalBinDir)) {
    return null;
  }

  return `export PATH="${globalBinDir}:$PATH"`;
}
