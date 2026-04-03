import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { AgentType } from "../src";

export interface OpenSpecWrapperOptions {
  repoRoot: string;
  changeId: string;
  agent: AgentType;
  model?: string;
  maxIterations?: number;
  extraArgs?: string[];
  skipGitCleanCheck?: boolean;
}

export interface RalphLoopInvocation {
  command: string;
  args: string[];
}

export const OPENSPEC_PROMPT_TEMPLATE = `# 执行 OpenSpec 变更

执行以下 OpenSpec change：


\`openspec/changes/<CHANGE_ID>/\`

变更路径会在运行时提供，请从用户输入中获取实际的 change 目录路径。

必须阅读并遵循：

- \`proposal.md\`
- \`spec.md\`
- \`design.md\`
- \`tasks.md\`

如果 \`spec.md\` 位于子目录，也必须全部阅读。

执行规则：

1. 每一轮只能选择一个未完成且当前可推进的最小任务
2. 每一轮只能推进这一个任务，禁止同时推进多个任务
3. 即使多个任务可以顺手一起做，也必须拆开
4. 完成当前任务后运行必要验证
5. 只有任务真正完成后才能勾选 \`tasks.md\`，并输出简短总结
6. 未完成、部分完成、验证不完整的任务都不要勾选
7. 不要创建额外任务系统
8. 不要创建额外执行记录文件
9. 不要做超出 spec 的改动
10. 如果阻塞，只在 \`tasks.md\` 对应任务下补充一行简短备注，记录阻塞原因和下一步建议
11. 当前任务没有完整闭环前，不要切换到其他任务

当且仅当所有任务完成且验证通过后，输出：

\`\`\`text
<promise>COMPLETE</promise>
\`\`\``;

export function buildOpenSpecPrompt(changeDir: string): string {
  return `执行 OpenSpec change：${changeDir}`;
}

export function buildRalphLoopArgs(options: {
  promptText: string;
  appendPrompt: string;
  agent: AgentType;
  model?: string;
  maxIterations?: number;
  extraArgs?: string[];
}): string[] {
  const args = ["--agent", options.agent, options.promptText, "--append-prompt", options.appendPrompt];

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

export function resolveRalphLoopCommand(_currentRepoRoot: string): string {
  const globalCommand = Bun.which("ralph-loop");
  if (globalCommand) {
    return globalCommand;
  }

  // Fall back to the bundled CLI in this package so local `bun run` development
  // still works even before the global launcher is installed.
  return join(import.meta.dir, "..", "bin", "ralph-loop.ts");
}

export function resolveRalphLoopInvocation(currentRepoRoot: string): RalphLoopInvocation {
  const command = resolveRalphLoopCommand(currentRepoRoot);
  if (command.endsWith(".ts")) {
    return {
      command: process.execPath,
      args: ["run", command],
    };
  }

  return {
    command,
    args: [],
  };
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
  console.log(`Agent           : ${options.agent}`);
  if (options.maxIterations) {
    console.log(`Max iterations  : ${options.maxIterations}`);
  }
  if (options.model) {
    console.log(`Model           : ${options.model}`);
  }
  console.log("");

  const ralphLoopInvocation = resolveRalphLoopInvocation(options.repoRoot);

  const proc = Bun.spawn(
    [
      ralphLoopInvocation.command,
      ...ralphLoopInvocation.args,
      ...buildRalphLoopArgs({
        promptText: OPENSPEC_PROMPT_TEMPLATE,
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
