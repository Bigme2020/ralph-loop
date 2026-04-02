import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { AgentType } from "../src";

export interface OpenSpecWrapperOptions {
  repoRoot: string;
  changeId: string;
  promptFile: string;
  agent: AgentType;
  model?: string;
  maxIterations?: number;
  extraArgs?: string[];
  skipGitCleanCheck?: boolean;
}

export function buildOpenSpecPrompt(changeDir: string): string {
  return `执行 OpenSpec change：${changeDir}`;
}

export function buildRalphLoopArgs(options: {
  repoRoot: string;
  promptFile: string;
  appendPrompt: string;
  agent: AgentType;
  model?: string;
  maxIterations?: number;
  extraArgs?: string[];
}): string[] {
  const args = [
    "run",
    join(options.repoRoot, "bin", "ralph-loop.ts"),
    "--agent",
    options.agent,
    "--prompt-file",
    options.promptFile,
    "--append-prompt",
    options.appendPrompt,
  ];

  if (options.maxIterations) {
    args.push("--max-iterations", String(options.maxIterations));
  }

  if (options.model) {
    args.push("--model", options.model);
  }

  if (options.extraArgs?.length) {
    args.push("--", ...options.extraArgs);
  }

  return args;
}

export function findSpecFiles(changeDir: string): string[] {
  const specsDir = join(changeDir, "specs");
  const result: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name === "spec.md") {
        result.push(fullPath);
      }
    }
  };

  if (!existsSync(specsDir)) {
    return [];
  }

  walk(specsDir);
  return result;
}

export function validateOpenSpecChange(changeDir: string): void {
  const promptFiles = ["proposal.md", "design.md", "tasks.md"];
  for (const name of promptFiles) {
    const fullPath = join(changeDir, name);
    if (!existsSync(fullPath)) {
      throw new Error(`missing file: ${fullPath}`);
    }
  }

  const specFiles = findSpecFiles(changeDir);
  if (specFiles.length === 0) {
    throw new Error(`no spec.md found under: ${join(changeDir, "specs")}`);
  }
}

export function assertGitClean(repoRoot: string): void {
  if (process.env.RALPH_SKIP_GIT_CLEAN_CHECK === "1") {
    return;
  }

  const proc = Bun.spawnSync(["git", "-C", repoRoot, "status", "--porcelain"], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (proc.exitCode === 0 && proc.stdout.toString().trim()) {
    throw new Error("git working tree is not clean.");
  }
}

export async function runOpenSpecWrapper(options: OpenSpecWrapperOptions): Promise<void> {
  const changeDir = join(options.repoRoot, "openspec", "changes", options.changeId);
  validateOpenSpecChange(changeDir);
  if (!options.skipGitCleanCheck) {
    assertGitClean(options.repoRoot);
  }

  const specFiles = findSpecFiles(changeDir);
  console.log("Found spec files:");
  for (const file of specFiles) {
    console.log(`  - ${file}`);
  }

  console.log("== OpenSpec Ralph Run ==");
  console.log(`Change ID       : ${options.changeId}`);
  console.log(`Change dir      : ${changeDir}`);
  console.log(`Prompt file     : ${options.promptFile}`);
  console.log(`Agent           : ${options.agent}`);
  if (options.maxIterations) {
    console.log(`Max iterations  : ${options.maxIterations}`);
  }
  if (options.model) {
    console.log(`Model           : ${options.model}`);
  }
  console.log("");

  const proc = Bun.spawn(
    [
      process.execPath,
      ...buildRalphLoopArgs({
        repoRoot: options.repoRoot,
        promptFile: options.promptFile,
        appendPrompt: buildOpenSpecPrompt(changeDir),
        agent: options.agent,
        model: options.model,
        maxIterations: options.maxIterations,
        extraArgs: options.extraArgs,
      }),
    ],
    {
      cwd: options.repoRoot,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
      env: process.env,
    },
  );

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
