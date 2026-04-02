import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { LoopState } from "./types";

export interface StateStore {
  stateDir: string;
  statePath: string;
  load(): LoopState | null;
  save(state: LoopState): void;
  clear(): void;
}

export function createStateStore(cwd: string, stateDirName = ".ralph-loop"): StateStore {
  const stateDir = join(cwd, stateDirName);
  const statePath = join(stateDir, "active-run.json");

  return {
    stateDir,
    statePath,
    load() {
      if (!existsSync(statePath)) {
        return null;
      }

      try {
        return JSON.parse(readFileSync(statePath, "utf8")) as LoopState;
      } catch {
        return null;
      }
    },
    save(state) {
      mkdirSync(stateDir, { recursive: true });
      writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    },
    clear() {
      if (existsSync(statePath)) {
        rmSync(statePath, { force: true });
      }
    },
  };
}
