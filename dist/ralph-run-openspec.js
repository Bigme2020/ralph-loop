#!/usr/bin/env bun
// @bun

// openspec-wrapper/index.ts
import { existsSync, readdirSync } from "fs";
import { join } from "path";
var OPENSPEC_PROMPT_TEMPLATE = `# \u6267\u884C OpenSpec \u53D8\u66F4

\u6267\u884C\u4EE5\u4E0B OpenSpec change\uFF1A


\`openspec/changes/<CHANGE_ID>/\`

\u53D8\u66F4\u8DEF\u5F84\u4F1A\u5728\u8FD0\u884C\u65F6\u63D0\u4F9B\uFF0C\u8BF7\u4ECE\u7528\u6237\u8F93\u5165\u4E2D\u83B7\u53D6\u5B9E\u9645\u7684 change \u76EE\u5F55\u8DEF\u5F84\u3002

\u5FC5\u987B\u9605\u8BFB\u5E76\u9075\u5FAA\uFF1A

- \`proposal.md\`
- \`spec.md\`
- \`design.md\`
- \`tasks.md\`

\u5982\u679C \`spec.md\` \u4F4D\u4E8E\u5B50\u76EE\u5F55\uFF0C\u4E5F\u5FC5\u987B\u5168\u90E8\u9605\u8BFB\u3002

\u6267\u884C\u89C4\u5219\uFF1A

1. \u6BCF\u4E00\u8F6E\u53EA\u80FD\u9009\u62E9\u4E00\u4E2A\u672A\u5B8C\u6210\u4E14\u5F53\u524D\u53EF\u63A8\u8FDB\u7684\u6700\u5C0F\u4EFB\u52A1
2. \u6BCF\u4E00\u8F6E\u53EA\u80FD\u63A8\u8FDB\u8FD9\u4E00\u4E2A\u4EFB\u52A1\uFF0C\u7981\u6B62\u540C\u65F6\u63A8\u8FDB\u591A\u4E2A\u4EFB\u52A1
3. \u5373\u4F7F\u591A\u4E2A\u4EFB\u52A1\u53EF\u4EE5\u987A\u624B\u4E00\u8D77\u505A\uFF0C\u4E5F\u5FC5\u987B\u62C6\u5F00
4. \u5B8C\u6210\u5F53\u524D\u4EFB\u52A1\u540E\u8FD0\u884C\u5FC5\u8981\u9A8C\u8BC1
5. \u53EA\u6709\u4EFB\u52A1\u771F\u6B63\u5B8C\u6210\u540E\u624D\u80FD\u52FE\u9009 \`tasks.md\`\uFF0C\u5E76\u8F93\u51FA\u7B80\u77ED\u603B\u7ED3
6. \u672A\u5B8C\u6210\u3001\u90E8\u5206\u5B8C\u6210\u3001\u9A8C\u8BC1\u4E0D\u5B8C\u6574\u7684\u4EFB\u52A1\u90FD\u4E0D\u8981\u52FE\u9009
7. \u4E0D\u8981\u521B\u5EFA\u989D\u5916\u4EFB\u52A1\u7CFB\u7EDF
8. \u4E0D\u8981\u521B\u5EFA\u989D\u5916\u6267\u884C\u8BB0\u5F55\u6587\u4EF6
9. \u4E0D\u8981\u505A\u8D85\u51FA spec \u7684\u6539\u52A8
10. \u5982\u679C\u963B\u585E\uFF0C\u53EA\u5728 \`tasks.md\` \u5BF9\u5E94\u4EFB\u52A1\u4E0B\u8865\u5145\u4E00\u884C\u7B80\u77ED\u5907\u6CE8\uFF0C\u8BB0\u5F55\u963B\u585E\u539F\u56E0\u548C\u4E0B\u4E00\u6B65\u5EFA\u8BAE
11. \u5F53\u524D\u4EFB\u52A1\u6CA1\u6709\u5B8C\u6574\u95ED\u73AF\u524D\uFF0C\u4E0D\u8981\u5207\u6362\u5230\u5176\u4ED6\u4EFB\u52A1

\u5F53\u4E14\u4EC5\u5F53\u6240\u6709\u4EFB\u52A1\u5B8C\u6210\u4E14\u9A8C\u8BC1\u901A\u8FC7\u540E\uFF0C\u8F93\u51FA\uFF1A

\`\`\`text
<promise>COMPLETE</promise>
\`\`\``;
function buildOpenSpecPrompt(changeDir) {
  return `\u6267\u884C OpenSpec change\uFF1A${changeDir}`;
}
function buildRalphLoopArgs(options) {
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
function resolveRalphLoopCommand(_currentRepoRoot) {
  const globalCommand = Bun.which("ralph-loop");
  if (globalCommand) {
    return globalCommand;
  }
  return join(import.meta.dir, "..", "bin", "ralph-loop.ts");
}
function resolveRalphLoopInvocation(currentRepoRoot) {
  const command = resolveRalphLoopCommand(currentRepoRoot);
  if (command.endsWith(".ts")) {
    return {
      command: process.execPath,
      args: ["run", command]
    };
  }
  return {
    command,
    args: []
  };
}
function findSpecFiles(changeDir) {
  const specsDir = join(changeDir, "specs");
  const result = [];
  const walk = (dir) => {
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
function validateOpenSpecChange(changeDir) {
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
function assertGitClean(repoRoot) {
  if (process.env.RALPH_SKIP_GIT_CLEAN_CHECK === "1") {
    return;
  }
  const proc = Bun.spawnSync(["git", "-C", repoRoot, "status", "--porcelain"], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe"
  });
  if (proc.exitCode === 0 && proc.stdout.toString().trim()) {
    throw new Error("git working tree is not clean.");
  }
}
async function runOpenSpecWrapper(options) {
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
  const proc = Bun.spawn([
    ralphLoopInvocation.command,
    ...ralphLoopInvocation.args,
    ...buildRalphLoopArgs({
      promptText: OPENSPEC_PROMPT_TEMPLATE,
      appendPrompt: buildOpenSpecPrompt(changeDir),
      agent: options.agent,
      model: options.model,
      maxIterations: options.maxIterations,
      extraArgs: options.extraArgs
    })
  ], {
    cwd: options.repoRoot,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    env: process.env
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

// bin/ralph-run-openspec.ts
function usage() {
  console.log(`Usage: ralph-run-openspec --change-id <CHANGE_ID> [--max-iterations <N>] [--model <MODEL>] [--agent <AGENT>] [-- <agent-extra-args...>]

Options:
  -h, --help                 Show this help message
  --change-id <CHANGE_ID>    OpenSpec change ID to run
  --max-iterations <N>       Maximum iteration count
  --model <MODEL>            Model passed to ralph-loop
  --agent <AGENT>            Agent passed to ralph-loop (default: opencode)
`);
}
var argv = process.argv.slice(2);
var passthroughIndex = argv.indexOf("--");
var passthroughArgs = passthroughIndex >= 0 ? argv.slice(passthroughIndex + 1) : [];
var args = passthroughIndex >= 0 ? argv.slice(0, passthroughIndex) : argv;
var changeId = "";
var maxIterations;
var model;
var agent = "opencode";
for (let i = 0;i < args.length; i += 1) {
  const arg = args[i];
  switch (arg) {
    case "-h":
    case "--help":
      usage();
      process.exit(0);
    case "--change-id":
      changeId = args[++i] ?? "";
      break;
    case "--max-iterations":
      maxIterations = Number(args[++i]);
      break;
    case "--model":
      model = args[++i];
      break;
    case "--agent":
      agent = args[++i] ?? "opencode";
      break;
    default:
      if (arg.startsWith("--change-id=")) {
        changeId = arg.slice("--change-id=".length);
      } else if (arg.startsWith("--max-iterations=")) {
        maxIterations = Number(arg.slice("--max-iterations=".length));
      } else if (arg.startsWith("--model=")) {
        model = arg.slice("--model=".length);
      } else if (arg.startsWith("--agent=")) {
        agent = arg.slice("--agent=".length);
      } else {
        console.error(`Error: unknown option: ${arg}`);
        usage();
        process.exit(1);
      }
  }
}
if (!changeId) {
  console.error("Error: --change-id is required");
  usage();
  process.exit(1);
}
if (maxIterations !== undefined && (!Number.isInteger(maxIterations) || maxIterations <= 0)) {
  console.error(`Error: MAX_ITERATIONS must be a positive integer: ${maxIterations}`);
  process.exit(1);
}
await runOpenSpecWrapper({
  repoRoot: process.cwd(),
  changeId,
  agent,
  model,
  maxIterations,
  extraArgs: passthroughArgs
});
